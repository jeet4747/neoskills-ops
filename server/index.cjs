require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { query, withTransaction } = require('./db.cjs');
const { generateReceipt } = require('./receipt.cjs');
const { generateInvoice } = require('./invoice.cjs');
const { buildGst, fiscalYearParts, toWords } = require('./gst.cjs');
const { generateGstInvoice } = require('./gst_invoice.cjs');
const { BRANDS } = require('./brands.cjs');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'neosecret2026';

const COMPANY_PREFIX = { neoskills: 'NEO', careervue: 'CV', frolics: 'FRO' };

app.use(cors({ origin: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpe?g|png|gif|webp)$/i;
    if (!file.mimetype || !allowed.test(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, GIF or WEBP screenshots are allowed'));
    }
    cb(null, true);
  },
});

function auth(roles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token' });
    try {
      const user = jwt.verify(header.split(' ')[1], JWT_SECRET);
      if (roles.length && !roles.includes(user.role))
        return res.status(403).json({ error: 'Forbidden' });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

function ensureDb(req, res, next) {
  if (!process.env.DATABASE_URL)
    return res.status(503).json({ error: 'Database not configured' });
  next();
}

app.get('/api/health', async (req, res) => {
  try {
    if (process.env.DATABASE_URL) {
      await query('SELECT 1');
      res.json({ status: 'ok', db: 'connected' });
    } else {
      res.json({ status: 'ok', db: 'not configured' });
    }
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email, password required' });
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length)
      return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, status',
      [name, email, hash, 'sales', 'pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });
    const result = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status !== 'active') {
      const msg = user.status === 'on_leave'
        ? 'Your account is currently on leave.'
        : user.status === 'inactive'
          ? 'Your account has been deactivated by admin.'
          : user.status === 'rejected'
            ? 'Your account request was rejected. Contact admin.'
            : 'Account not yet approved. Contact admin.';
      return res.status(403).json({ error: msg });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, can_sell: !!user.can_sell },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, can_sell: !!user.can_sell } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', auth(), (req, res) => {
  res.json(req.user);
});

app.get('/api/auth/pending-users', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query(
      "SELECT id, name, email, role, status, created_at FROM users WHERE status = 'pending' ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/approve/:id', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { action } = req.body;
    const status = action === 'reject' ? 'rejected' : 'active';
    await query('UPDATE users SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.id, u.name, u.email, u.role, u.status, u.phone, u.city, u.can_sell, u.created_at,
        (SELECT COUNT(*) FROM enrollments e WHERE e.sales_user_id = u.id) as enrollments,
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'approved') as collected,
        (SELECT COALESCE(SUM(
           GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status = 'approved'
           ), 0), 0)
         ), 0)
         FROM enrollments e WHERE e.sales_user_id = u.id) as pending,
        (SELECT COUNT(*) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'pending_approval') as pending_approvals
      FROM users u
      ORDER BY u.role, u.name
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/users', auth(['admin']), async (req, res) => {
  try {
    const { name, email, password, role = 'sales', status = 'active', phone, city } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
    if (!['sales', 'manager', 'admin', 'ops'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (!['active', 'pending', 'rejected', 'on_leave', 'inactive'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password || 'neoskills@123', 10);
    const result = await query(
      'INSERT INTO users (name, email, password, role, status, phone, city) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, role, status',
      [name, email, hash, role, status, phone || null, city || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/users/:id', auth(['admin']), async (req, res) => {
  try {
    const { role, status, can_sell } = req.body;
    if (role && !['sales', 'manager', 'admin', 'ops'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });
    if (status && !['active', 'pending', 'rejected', 'on_leave', 'inactive'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    if (role && String(req.params.id) === String(req.user.id))
      return res.status(400).json({ error: 'You cannot change your own role' });
    const fields = [];
    const params = [];
    if (role) { fields.push(`role = $${params.length + 1}`); params.push(role); }
    if (status) { fields.push(`status = $${params.length + 1}`); params.push(status); }
    if (can_sell !== undefined) { fields.push(`can_sell = $${params.length + 1}`); params.push(!!can_sell); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    const result = await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, name, email, role, status, can_sell`, params);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/team/analytics', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.id, u.name, u.email, u.role, u.status, u.can_sell, u.created_at,
        (SELECT COUNT(*) FROM enrollments e WHERE e.sales_user_id = u.id) as enrollments,
        (SELECT COUNT(*) FROM enrollments e WHERE e.sales_user_id = u.id AND e.status IN ('active', 'waiting_approval')) as active_enrollments,
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'approved') as collected,
        (SELECT COALESCE(SUM(
           GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status = 'approved'
           ), 0), 0)
         ), 0)
         FROM enrollments e WHERE e.sales_user_id = u.id) as pending,
        (SELECT COUNT(*) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'pending_approval') as pending_approvals,
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'approved'
          AND DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', NOW())) as month_collected,
        (SELECT COUNT(*) FROM enrollments e WHERE e.sales_user_id = u.id
          AND DATE_TRUNC('month', e.created_at) = DATE_TRUNC('month', NOW())) as month_enrollments,
        (SELECT COUNT(*) FROM enrollments e WHERE e.sales_user_id = u.id
          AND DATE_TRUNC('month', e.created_at) = DATE_TRUNC('month', NOW())
          AND e.status = 'completed') as month_completed
      FROM users u
      WHERE (u.role = 'sales' OR u.role = 'manager' OR u.can_sell = true)
      ORDER BY collected DESC, enrollments DESC
    `);
    const users = result.rows.map((u) => ({
      ...u,
      collected: Number(u.collected) || 0,
      pending: Number(u.pending) || 0,
      enrollments: Number(u.enrollments) || 0,
      active_enrollments: Number(u.active_enrollments) || 0,
      month_collected: Number(u.month_collected) || 0,
      avg_deal_size: Number(u.collected) && Number(u.enrollments) ? Math.round(Number(u.collected) / Number(u.enrollments)) : 0,
    }));
    const totals = users.reduce((acc, u) => ({
      collected: acc.collected + u.collected,
      pending: acc.pending + u.pending,
      enrollments: acc.enrollments + u.enrollments,
      pending_approvals: acc.pending_approvals + Number(u.pending_approvals) || 0,
      month_collected: acc.month_collected + u.month_collected,
      active: acc.active + (u.status === 'active' ? 1 : 0),
      on_leave: acc.on_leave + (u.status === 'on_leave' ? 1 : 0),
    }), { collected: 0, pending: 0, enrollments: 0, pending_approvals: 0, month_collected: 0, active: 0, on_leave: 0 });
    res.json({ users, totals });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users/:id/profile', auth(), async (req, res) => {
  try {
    const userResult = await query('SELECT id, name, email, role FROM users WHERE id = $1', [req.params.id]);
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });

    const stats = await query(`
      SELECT
        (SELECT COALESCE(SUM(e.total_amount), 0) FROM enrollments e WHERE e.sales_user_id = u.id) as total_business,
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'approved') as collected,
        (SELECT COALESCE(SUM(
           GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status = 'approved'
           ), 0), 0)
         ), 0)
         FROM enrollments e WHERE e.sales_user_id = u.id) as pending,
        (SELECT COUNT(*) FROM enrollments e WHERE e.sales_user_id = u.id) as enrollments,
        (SELECT COUNT(*) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'pending_approval') as pending_approvals
      FROM users u
      WHERE u.id = $1
    `, [req.params.id]);

    res.json({ ...userResult.rows[0], ...stats.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/students', auth(), async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM students ORDER BY created_at DESC';
    let params = [];
    if (search) {
      sql = 'SELECT * FROM students WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 ORDER BY created_at DESC';
      params = [`%${search}%`];
    }
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/students', auth(), async (req, res) => {
  try {
    const { name, email, phone, city } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    if (phone) {
      const normPhone = String(phone).trim();
      const existing = await query('SELECT * FROM students WHERE phone = $1', [normPhone]);
      if (existing.rows.length) {
        return res.json(existing.rows[0]);
      }
    }
    if (email) {
      const existing = await query('SELECT * FROM students WHERE LOWER(email) = LOWER($1)', [String(email).trim()]);
      if (existing.rows.length) {
        return res.json(existing.rows[0]);
      }
    }

    const result = await query(
      'INSERT INTO students (name, email, phone, city) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, phone, city]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/enrollments', auth(), async (req, res) => {
  try {
    const { student_id, course_name, deal_type, category, training_fee, exam_fee, total_amount, source, batch_name, support_included, telecrm_link } = req.body;
    if (!student_id || !course_name || !total_amount)
      return res.status(400).json({ error: 'student_id, course_name, total_amount required' });
    if (!telecrm_link || !String(telecrm_link).trim())
      return res.status(400).json({ error: 'TeleCRM link is required' });
    const result = await query(
      `INSERT INTO enrollments (student_id, sales_user_id, course_name, deal_type, category, training_fee, exam_fee, total_amount, support_included, source, batch_name, telecrm_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [student_id, req.user.id, course_name, deal_type || 'bundle', category, training_fee || 0, exam_fee || 0, total_amount, !!support_included, source, batch_name, telecrm_link || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/enrollments/combined', auth(), async (req, res) => {
  try {
    const { student_name, student_email, student_phone, course_name, category, deal_type,
            training_fee, exam_fee, total_amount, support_included, source, batch_name, telecrm_link,
            amount_paid, payment_mode, payment_date, bank_account_id, transaction_id } = req.body;

    if (!student_name || !course_name)
      return res.status(400).json({ error: 'student_name and course_name required' });
    if (!student_email || !String(student_email).trim())
      return res.status(400).json({ error: 'Email is required' });
    if (!telecrm_link || !String(telecrm_link).trim())
      return res.status(400).json({ error: 'TeleCRM link is required' });
    if (!amount_paid || parseFloat(amount_paid) <= 0)
      return res.status(400).json({ error: 'Enter payment received amount' });
    if (parseFloat(amount_paid) > parseFloat(total_amount))
      return res.status(400).json({ error: 'Received amount cannot exceed total fee' });

    const result = await withTransaction(async (client) => {
      let student = null;
      if (student_phone) {
        const found = await client.query('SELECT * FROM students WHERE phone = $1', [String(student_phone).trim()]);
        if (found.rows.length) student = found.rows[0];
      }
      if (!student && student_email) {
        const found = await client.query('SELECT * FROM students WHERE LOWER(email) = LOWER($1)', [String(student_email).trim()]);
        if (found.rows.length) student = found.rows[0];
      }
      if (!student) {
        const created = await client.query(
          'INSERT INTO students (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
          [student_name, student_email || null, student_phone || null]
        );
        student = created.rows[0];
      }

      const enroll = await client.query(
        `INSERT INTO enrollments (student_id, sales_user_id, course_name, deal_type, category, training_fee, exam_fee, total_amount, support_included, source, batch_name, telecrm_link)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [student.id, req.user.id, course_name, deal_type || 'bundle', category, training_fee || 0, exam_fee || 0, total_amount, !!support_included, source, batch_name, telecrm_link || null]
      );
      const enrollment = enroll.rows[0];

      const paid = parseFloat(amount_paid);
      const prior = await client.query(
        `SELECT COALESCE(SUM(amount_paid), 0) as paid_so_far FROM payments
         WHERE enrollment_id = $1 AND status IN ('pending_approval', 'approved')`,
        [enrollment.id]
      );
      const paidSoFar = parseFloat(prior.rows[0].paid_so_far);
      const pending = Math.max(0, parseFloat(total_amount) - (paidSoFar + paid));

      const payStatus = req.user.role === 'admin' ? 'approved' : 'pending_approval';
      const pay = await client.query(
        `INSERT INTO payments (enrollment_id, student_id, sales_user_id, amount_paid, pending_amount, payment_mode, bank_account_id, transaction_id, status, approved_by, approved_at, payment_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [enrollment.id, student.id, req.user.id, paid, pending, payment_mode, bank_account_id || null, transaction_id || null, payStatus, req.user.role === 'admin' ? req.user.id : null, payStatus === 'approved' ? new Date() : null, payment_date || null]
      );

      const enrollStatus = payStatus === 'approved' ? (pending <= 0 ? 'completed' : 'active') : 'waiting_approval';
      await client.query("UPDATE enrollments SET status = $1 WHERE id = $2", [enrollStatus, enrollment.id]);
      enrollment.status = enrollStatus;

      return { student, enrollment, payment: pay.rows[0] };
    });

    res.status(201).json(result);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.get('/api/enrollments', auth(), async (req, res) => {
  try {
    const role = req.user.role;
    let sql = `
      SELECT e.*, s.name as student_name, s.email as student_email, s.phone as student_phone, u.name as salesperson_name,
        COALESCE((
          SELECT SUM(p.amount_paid) FROM payments p
          WHERE p.enrollment_id = e.id AND p.status = 'approved'
        ), 0) as paid_amount,
        GREATEST(e.total_amount - COALESCE((
          SELECT SUM(p.amount_paid) FROM payments p
          WHERE p.enrollment_id = e.id AND p.status = 'approved'
        ), 0), 0) as pending_amount,
        lp.id as last_payment_id,
        lp.bank_account_id as bank_account_id,
        lp.bank_account_name as bank_account_name
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN users u ON e.sales_user_id = u.id
      LEFT JOIN LATERAL (
        SELECT p.id, p.bank_account_id, ba.account_name as bank_account_name
        FROM payments p
        LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
        WHERE p.enrollment_id = e.id
        ORDER BY p.created_at DESC
        LIMIT 1
      ) lp ON true
    `;
    let params = [];
    const conditions = [];

    if (role === 'sales') {
      conditions.push(`e.sales_user_id = $${params.length + 1}`);
      params.push(req.user.id);
    } else if (role === 'ops') {
      conditions.push(`e.sales_user_id NOT IN (SELECT id FROM users WHERE role = 'admin')`);
    }

    if (req.query.status) {
      conditions.push(`e.status = $${params.length + 1}`);
      params.push(req.query.status);
    }

    if (req.query.sales_user_id) {
      conditions.push(`e.sales_user_id = $${params.length + 1}`);
      params.push(parseInt(req.query.sales_user_id));
    }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY e.created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/enrollments/:id', auth(), async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, s.name as student_name, s.email as student_email, s.phone as student_phone, u.name as salesperson_name
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       JOIN users u ON e.sales_user_id = u.id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const MODE_LABELS = {
  upi: 'UPI', card: 'Card', neft: 'NEFT/RTGS', cash: 'Cash',
  cheque: 'Cheque', bank_transfer: 'Bank Transfer',
};

app.get('/api/enrollments/:id/receipt', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const enrollResult = await query(
      `SELECT e.*, s.name as student_name, s.email as student_email, s.phone as student_phone, s.city as student_city, u.name as salesperson_name
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       JOIN users u ON e.sales_user_id = u.id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!enrollResult.rows.length) return res.status(404).json({ error: 'Enrollment not found' });
    const e = enrollResult.rows[0];

    const paysResult = await query(
      `SELECT p.*, ba.account_name as bank_account_name
       FROM payments p
       LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
       WHERE p.enrollment_id = $1
       ORDER BY p.created_at ASC`,
      [req.params.id]
    );

    const considered = paysResult.rows.filter((p) => p.status === 'approved');
    const totalPaid = considered.reduce((s, p) => s + parseFloat(p.amount_paid), 0);
    const totalPending = Math.max(0, parseFloat(e.total_amount) - totalPaid);
    const lastPayment = considered[considered.length - 1] || null;

    const receiptData = {
      receipt_number: `NEO-${String(e.id).padStart(6, '0')}`,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      enrollment_id: e.id,
      batch_name: e.batch_name,
      course_name: e.course_name,
      category: e.category || e.deal_type,
      student_name: e.student_name,
      student_email: e.student_email,
      student_phone: e.student_phone,
      student_city: e.student_city,
      salesperson_name: e.salesperson_name,
      training_fee: e.training_fee,
      exam_fee: e.exam_fee,
      support_included: e.support_included,
      total_amount: e.total_amount,
      total_paid: totalPaid,
      total_pending: totalPending,
      amount_paid: lastPayment ? lastPayment.amount_paid : 0,
      payment_mode_label: lastPayment ? (MODE_LABELS[lastPayment.payment_mode] || lastPayment.payment_mode) : '—',
      payment_status: totalPending > 0 ? 'Partially Paid' : 'Fully Paid',
      payments: paysResult.rows.map((p) => ({
        date: new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        mode_label: MODE_LABELS[p.payment_mode] || p.payment_mode,
        transaction_id: p.transaction_id,
        bank_account_name: p.bank_account_name,
        amount_paid: p.amount_paid,
        status_label: p.status === 'approved' ? 'Approved' : p.status === 'rejected' ? 'Rejected' : 'Pending Approval',
      })),
    };

    const pdf = await generateReceipt(receiptData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="NeoSkills-Receipt-${e.id}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/enrollments/:id', auth(), async (req, res) => {
  try {
    const existing = await query('SELECT * FROM enrollments WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Enrollment not found' });

    const enroll = existing.rows[0];
    const isManager = req.user.role === 'manager' || req.user.role === 'admin' || req.user.role === 'ops';
    if (!isManager && enroll.sales_user_id !== req.user.id)
      return res.status(403).json({ error: 'You can only edit your own enrollments' });

    const { student_id, course_name, deal_type, category, training_fee, exam_fee, total_amount, support_included, source, batch_name, telecrm_link } = req.body;

    const newTotal = total_amount !== undefined
      ? parseFloat(total_amount)
      : (parseFloat(training_fee) || 0) + (parseFloat(exam_fee) || 0);

    const updateEnroll = await query(
      `UPDATE enrollments SET
         course_name = $1, deal_type = $2, category = $3,
         training_fee = $4, exam_fee = $5, total_amount = $6,
         support_included = $7, source = $8, batch_name = $9, telecrm_link = $10
       WHERE id = $11 RETURNING *`,
      [
        course_name || enroll.course_name,
        deal_type || enroll.deal_type,
        category !== undefined ? category : enroll.category,
        training_fee !== undefined ? parseFloat(training_fee) : enroll.training_fee,
        exam_fee !== undefined ? parseFloat(exam_fee) : enroll.exam_fee,
        newTotal,
        support_included !== undefined ? !!support_included : enroll.support_included,
        source !== undefined ? source : enroll.source,
        batch_name !== undefined ? batch_name : enroll.batch_name,
        telecrm_link !== undefined ? telecrm_link : enroll.telecrm_link,
        req.params.id,
      ]
    );

    let studentResult = null;
    if (student_id) {
      studentResult = await query(
        `UPDATE students SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone) WHERE id = $4 RETURNING *`,
        [req.body.student_name || null, req.body.student_email || null, req.body.student_phone || null, student_id]
      );
    }

    res.json({ ...updateEnroll.rows[0], student: studentResult?.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/enrollments/:id', auth(['admin', 'manager']), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim())
      return res.status(400).json({ error: 'Reason is required to delete an enrollment' });

    const enroll = await query(
      `SELECT e.id, e.course_name, e.total_amount, e.sales_user_id,
              s.name as student_name, u.name as salesperson_name
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       JOIN users u ON e.sales_user_id = u.id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!enroll.rows.length) return res.status(404).json({ error: 'Enrollment not found' });
    const e = enroll.rows[0];

    const message = `${e.student_name} — ${e.course_name} (₹${Number(e.total_amount).toLocaleString()}). Deleted by ${req.user.name}. Reason: ${reason.trim()}`;

    await withTransaction(async (client) => {
      await client.query('DELETE FROM payments WHERE enrollment_id = $1', [e.id]);
      await client.query('DELETE FROM receipts WHERE enrollment_id = $1', [e.id]);
      await client.query('DELETE FROM gst_invoices WHERE enrollment_id = $1', [e.id]);
      await client.query('DELETE FROM enrollments WHERE id = $1', [e.id]);
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message) VALUES ($1, 'enrollment_deleted', 'Enrollment Deleted', $2)`,
        [e.sales_user_id, message]
      );
    });

    res.json({ message: 'Enrollment deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/notifications', auth(), async (req, res) => {
  try {
    const result = await query(
      `SELECT id, type, title, message, is_read, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 30`,
      [req.user.id]
    );
    const unread = result.rows.filter((n) => !n.is_read).length;
    res.json({ items: result.rows, unread });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/notifications/read', auth(), async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'Marked as read' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const BATCH_STATS = `
  COALESCE(m.cnt, 0) AS student_count,
  COALESCE(m.total_fee, 0) AS total_fee,
  COALESCE(m.received, 0) AS received,
  COALESCE(m.pending_approval, 0) AS pending_approval
`;
const BATCH_STATS_JOIN = `
  LEFT JOIN (
    SELECT bm.batch_id,
      COUNT(*) AS cnt,
      SUM(e.total_amount) AS total_fee,
      COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'approved'), 0) AS received,
      COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'pending_approval'), 0) AS pending_approval
    FROM batch_members bm
    JOIN enrollments e ON e.id = bm.enrollment_id
    LEFT JOIN payments p ON p.enrollment_id = e.id
    GROUP BY bm.batch_id
  ) m ON m.batch_id = b.id
`;

app.get('/api/batches', auth(), async (req, res) => {
  try {
    const result = await query(
      `SELECT b.*, ${BATCH_STATS} FROM batches b ${BATCH_STATS_JOIN} ORDER BY b.created_at DESC`
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/batches/:id', auth(), async (req, res) => {
  try {
    const batch = await query(
      `SELECT b.*, ${BATCH_STATS} FROM batches b ${BATCH_STATS_JOIN} WHERE b.id = $1`,
      [req.params.id]
    );
    if (!batch.rows.length) return res.status(404).json({ error: 'Batch not found' });
    const members = await query(
      `SELECT e.id AS enrollment_id, e.course_name, e.total_amount, e.status AS enrollment_status,
              s.name AS student_name, s.phone AS student_phone, s.email AS student_email,
              u.name AS salesperson_name,
              COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'approved'), 0) AS received,
              COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'pending_approval'), 0) AS pending_approval
       FROM batch_members bm
       JOIN enrollments e ON e.id = bm.enrollment_id
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = e.sales_user_id
       LEFT JOIN payments p ON p.enrollment_id = e.id
       WHERE bm.batch_id = $1
       GROUP BY e.id, s.id, u.name
       ORDER BY s.name`,
      [req.params.id]
    );
    res.json({ ...batch.rows[0], members: members.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/batches', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { name, course_name, trainer_name, start_date, status, zoom_link } = req.body;
    if (!name || !name.trim())
      return res.status(400).json({ error: 'Batch name is required' });
    const result = await query(
      `INSERT INTO batches (name, course_name, trainer_name, start_date, status, zoom_link, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name.trim(), course_name || null, trainer_name || null, start_date || null, status === 'completed' ? 'completed' : 'active', zoom_link || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/batches/:id', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { name, course_name, trainer_name, start_date, status, zoom_link } = req.body;
    const existing = await query('SELECT id FROM batches WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Batch not found' });
    const result = await query(
      `UPDATE batches SET
         name = COALESCE($1, name),
         course_name = COALESCE($2, course_name),
         trainer_name = COALESCE($3, trainer_name),
         start_date = COALESCE($4, start_date),
         status = CASE WHEN $5::text IN ('active', 'completed') THEN $5::text ELSE status END,
         zoom_link = COALESCE($6, zoom_link)
       WHERE id = $7 RETURNING *`,
      [name?.trim() || null, course_name || null, trainer_name || null, start_date || null, status || null, zoom_link || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/batches/:id', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query('DELETE FROM batches WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Batch not found' });
    res.json({ message: 'Batch deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/batches/:id/members', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const batch = await query('SELECT id FROM batches WHERE id = $1', [req.params.id]);
    if (!batch.rows.length) return res.status(404).json({ error: 'Batch not found' });
    const ids = Array.isArray(req.body.enrollment_ids) ? req.body.enrollment_ids : [];
    const valid = ids.filter((x) => Number.isInteger(x) || /^\d+$/.test(String(x)));
    if (!valid.length) return res.status(400).json({ error: 'Select at least one enrollment' });
    await withTransaction(async (client) => {
      for (const id of valid) {
        await client.query(
          `INSERT INTO batch_members (batch_id, enrollment_id)
           VALUES ($1, $2)
           ON CONFLICT (batch_id, enrollment_id) DO NOTHING`,
          [req.params.id, Number(id)]
        );
      }
    });
    res.status(201).json({ message: `Added ${valid.length} student(s)` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/batches/:id/members/:enrollmentId', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM batch_members WHERE batch_id = $1 AND enrollment_id = $2 RETURNING id',
      [req.params.id, req.params.enrollmentId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Student not in batch' });
    res.json({ message: 'Student removed from batch' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/bank-accounts', auth(), async (req, res) => {
  try {
    const result = await query('SELECT * FROM bank_accounts WHERE is_active = true ORDER BY bank_name');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/bank-accounts', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { account_name, account_number, bank_name, ifsc, branch } = req.body;
    if (!account_name || !account_number || !bank_name)
      return res.status(400).json({ error: 'account_name, account_number, bank_name required' });
    const result = await query(
      'INSERT INTO bank_accounts (account_name, account_number, bank_name, ifsc, branch) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [account_name, account_number, bank_name, ifsc, branch]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/bank-accounts/:id', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { account_name, account_number, bank_name, ifsc, branch } = req.body;
    const result = await query(
      `UPDATE bank_accounts SET account_name = $1, account_number = $2, bank_name = $3, ifsc = $4, branch = $5
       WHERE id = $6 AND is_active = true RETURNING *`,
      [account_name, account_number, bank_name, ifsc, branch, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Bank account not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/bank-accounts/:id', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query('UPDATE bank_accounts SET is_active = false WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/payments', auth(), async (req, res) => {
  try {
    const { enrollment_id, student_id, amount_paid, payment_mode, payment_date, bank_account_id, transaction_id } = req.body;
    if (!enrollment_id || !amount_paid)
      return res.status(400).json({ error: 'enrollment_id and amount_paid required' });

    const enroll = await query('SELECT total_amount FROM enrollments WHERE id = $1', [enrollment_id]);
    if (!enroll.rows.length) return res.status(404).json({ error: 'Enrollment not found' });

    const total = parseFloat(enroll.rows[0].total_amount);
    const paid = parseFloat(amount_paid);

    const prior = await query(
      `SELECT COALESCE(SUM(amount_paid), 0) as paid_so_far FROM payments
       WHERE enrollment_id = $1 AND status IN ('pending_approval', 'approved')`,
      [enrollment_id]
    );
    const paidSoFar = parseFloat(prior.rows[0].paid_so_far);
    if (paidSoFar + paid > total) {
      return res.status(400).json({ error: `Amount exceeds pending balance. Already paid ₹${paidSoFar}, pending ₹${Math.max(0, total - paidSoFar)}` });
    }
    const pending = Math.max(0, total - (paidSoFar + paid));

    const payStatus = req.user.role === 'admin' ? 'approved' : 'pending_approval';
    const result = await query(
      `INSERT INTO payments (enrollment_id, student_id, sales_user_id, amount_paid, pending_amount, payment_mode, bank_account_id, transaction_id, status, approved_by, approved_at, payment_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [enrollment_id, student_id, req.user.id, paid, pending, payment_mode, bank_account_id, transaction_id, payStatus, req.user.role === 'admin' ? req.user.id : null, payStatus === 'approved' ? new Date() : null, payment_date || null]
    );
    await refreshEnrollmentStatus(enrollment_id);
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/payments', auth(), async (req, res) => {
  try {
    const role = req.user.role;
    let sql = `
      SELECT p.*, s.name as student_name, s.email as student_email, e.course_name, u.name as salesperson_name,
             ba.account_name as bank_account_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      JOIN enrollments e ON p.enrollment_id = e.id
      JOIN users u ON p.sales_user_id = u.id
      LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
    `;
    let params = [];
    const conditions = [];

    if (role === 'sales') {
      conditions.push(`p.sales_user_id = $${params.length + 1}`);
      params.push(req.user.id);
    } else if (role === 'ops') {
      conditions.push(`p.sales_user_id NOT IN (SELECT id FROM users WHERE role = 'admin')`);
    }

    if (req.query.status) {
      conditions.push(`p.status = $${params.length + 1}`);
      params.push(req.query.status);
    }

    if (req.query.sales_user_id) {
      conditions.push(`p.sales_user_id = $${params.length + 1}`);
      params.push(parseInt(req.query.sales_user_id));
    }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY p.created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/payments/:id', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { amount_paid, payment_mode, payment_date, bank_account_id, transaction_id } = req.body;
    const existing = await query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Payment not found' });
    const payment = existing.rows[0];
    if (payment.status === 'approved') {
      return res.status(400).json({ error: 'Approved payments cannot be edited' });
    }

    const amount = amount_paid !== undefined && amount_paid !== '' ? parseFloat(amount_paid) : parseFloat(payment.amount_paid);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount' });
    }

    const enroll = await query('SELECT total_amount FROM enrollments WHERE id = $1', [payment.enrollment_id]);
    if (!enroll.rows.length) return res.status(404).json({ error: 'Enrollment not found' });
    const total = parseFloat(enroll.rows[0].total_amount);

    const prior = await query(
      `SELECT COALESCE(SUM(amount_paid), 0) as paid_so_far FROM payments
       WHERE enrollment_id = $1 AND status IN ('pending_approval', 'approved') AND id <> $2`,
      [payment.enrollment_id, payment.id]
    );
    const paidSoFar = parseFloat(prior.rows[0].paid_so_far);
    if (paidSoFar + amount > total) {
      return res.status(400).json({ error: `Amount exceeds pending balance. Already paid ₹${paidSoFar}, pending ₹${Math.max(0, total - paidSoFar)}` });
    }
    const pending = Math.max(0, total - (paidSoFar + amount));

    const result = await query(
      `UPDATE payments SET amount_paid = $1, pending_amount = $2, payment_mode = $3, payment_date = $4, bank_account_id = $5, transaction_id = $6
       WHERE id = $7 RETURNING *`,
      [amount, pending, payment_mode !== undefined ? payment_mode : payment.payment_mode,
       payment_date !== undefined ? payment_date : payment.payment_date,
       bank_account_id !== undefined ? bank_account_id : payment.bank_account_id,
       transaction_id !== undefined ? transaction_id : payment.transaction_id,
       payment.id]
    );
    await refreshEnrollmentStatus(payment.enrollment_id);
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/approvals/:id/approve', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query(
      `UPDATE payments SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2 AND status = 'pending_approval' RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Payment not found or already processed' });

    const payment = result.rows[0];
    await refreshEnrollmentStatus(payment.enrollment_id);

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/approvals/:id/reject', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await query(
      `UPDATE payments SET status = 'rejected', approved_by = $1, rejection_reason = $2 WHERE id = $3 AND status = 'pending_approval' RETURNING *`,
      [req.user.id, reason || 'No reason provided', req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Payment not found or already processed' });
    const rejected = result.rows[0];
    await refreshEnrollmentStatus(rejected.enrollment_id);
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/approvals/pending', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const role = req.user.role;
    const adminHidden = role === 'ops' ? " AND p.sales_user_id NOT IN (SELECT id FROM users WHERE role = 'admin')" : '';
    const result = await query(
      `SELECT p.*, s.name as student_name, s.email as student_email, s.phone as student_phone,
              e.course_name, u.name as salesperson_name, ba.account_name as bank_account_name
       FROM payments p
       JOIN students s ON p.student_id = s.id
       JOIN enrollments e ON p.enrollment_id = e.id
       JOIN users u ON p.sales_user_id = u.id
       LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
       WHERE p.status = 'pending_approval'${adminHidden}
       ORDER BY p.created_at ASC`
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/approvals/count', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const role = req.user.role;
    const adminHidden = role === 'ops' ? " AND sales_user_id NOT IN (SELECT id FROM users WHERE role = 'admin')" : '';
    const result = await query(
      `SELECT COUNT(*) as count FROM payments WHERE status = 'pending_approval'${adminHidden}`
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/payments/:id/receipt', auth(), upload.array('receipts', 6), async (req, res) => {
  try {
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No file uploaded' });
    const urls = req.files.map((f) => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`);
    await query('UPDATE payments SET receipt_url = $1, receipt_urls = $2 WHERE id = $3', [urls[0], JSON.stringify(urls), req.params.id]);
    res.json({ receipt_url: urls[0], receipt_urls: urls });
  } catch (e) {
    if (e.message && e.message.includes('Only JPG')) return res.status(400).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ---------- Customizable receipts (mybillbook-style) ----------
app.get('/api/brands', auth(['admin', 'manager', 'ops']), (req, res) => {
  res.json(Object.values(BRANDS).map(({ key, name }) => ({ key, name })));
});

app.get('/api/receipts', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(r.receipt_number ILIKE $${params.length + 1} OR r.student_name ILIKE $${params.length + 1} OR r.course_name ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (req.user.role === 'ops') {
      conditions.push(`r.created_by NOT IN (SELECT id FROM users WHERE role = 'admin')`);
    }
    let where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) as count FROM receipts r ${where}`, params);
    const result = await query(
      `SELECT r.*, u.name as created_by_name, e.total_amount as enrollment_total
       FROM receipts r
       LEFT JOIN users u ON r.created_by = u.id
       LEFT JOIN enrollments e ON r.enrollment_id = e.id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    res.json({ receipts: result.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/receipts/next-number', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { prefix } = req.query;
    const { number, seq } = await nextReceiptNumber(prefix);
    res.json({ number, prefix: prefix || 'NEO', sequence: seq });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/receipts/pending', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query(`
      SELECT e.id, e.student_id, e.course_name, e.category, e.total_amount, e.status, e.created_at,
        s.name as student_name, s.phone as student_phone, s.email as student_email, s.city as student_city,
        u.name as salesperson_name,
        COALESCE((
          SELECT SUM(p.amount_paid) FROM payments p
          WHERE p.enrollment_id = e.id AND p.status = 'approved'
        ), 0) as paid_amount,
        GREATEST(e.total_amount - COALESCE((
          SELECT SUM(p.amount_paid) FROM payments p
          WHERE p.enrollment_id = e.id AND p.status = 'approved'
        ), 0), 0) as pending_amount,
        (SELECT COUNT(*) FROM payments p WHERE p.enrollment_id = e.id AND p.status = 'approved') as payment_count
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN users u ON e.sales_user_id = u.id
      WHERE NOT EXISTS (SELECT 1 FROM receipts r WHERE r.enrollment_id = e.id)
      ORDER BY e.created_at ASC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/receipts/:id', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    if (req.user.role === 'ops') {
      const check = await query(`SELECT 1 FROM receipts WHERE id = $1 AND created_by NOT IN (SELECT id FROM users WHERE role = 'admin')`, [req.params.id]);
      if (!check.rows.length) return res.status(404).json({ error: 'Receipt not found' });
    }
    const result = await query('SELECT * FROM receipts WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Receipt not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function nextReceiptNumber(prefix) {
  const pre = prefix || 'NEO';
  const year = new Date().getFullYear();
  const res = await query(
    `SELECT COALESCE(MAX(sequence), 0) + 1 as next_seq FROM receipts WHERE prefix = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
    [pre, year]
  );
  const seq = parseInt(res.rows[0].next_seq);
  const number = `${pre}-${year}-${String(seq).padStart(4, '0')}`;
  return { number, seq };
}

app.post('/api/receipts', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const b = req.body;
    const prefix = COMPANY_PREFIX[b.company] || b.prefix || 'NEO';
    const { number, seq } = await nextReceiptNumber(prefix);
    const items = JSON.stringify(b.items || []);
    const result = await query(
      `INSERT INTO receipts (
         receipt_number, prefix, sequence, enrollment_id,
         student_name, student_phone, student_email, student_city, course_name,
         items, company, tax_rate, discount, subtotal, tax_amount, total_amount,
         received_amount, balance_amount, payment_mode, transaction_id,
         bank_account_name, bank_account_number, bank_name, bank_ifsc, notes,
         created_by
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15,
         $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
       ) RETURNING *`,
      [number, prefix, seq, b.enrollment_id || null,
       b.student_name, b.student_phone, b.student_email, b.student_city, b.course_name,
       items, b.company || 'neoskills', b.tax_rate || 0, b.discount || 0, b.subtotal || 0, b.tax_amount || 0, b.total_amount || 0,
       b.received_amount || 0, b.balance_amount || 0, b.payment_mode, b.transaction_id,
       b.bank_account_name, b.bank_account_number, b.bank_name, b.bank_ifsc, b.notes,
       req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/receipts/:id', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const b = req.body;
    const existing = await query('SELECT * FROM receipts WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Receipt not found' });
    const cur = existing.rows[0];

    const newCompany = b.company || cur.company || 'neoskills';
    const expectedPrefix = COMPANY_PREFIX[newCompany] || cur.prefix || 'NEO';
    let prefix = cur.prefix;
    let number = cur.receipt_number;
    let seq = cur.sequence;
    if (newCompany !== cur.company || prefix !== expectedPrefix) {
      const n = await nextReceiptNumber(expectedPrefix);
      prefix = expectedPrefix;
      number = n.number;
      seq = n.seq;
    }

    const items = JSON.stringify(b.items || []);
    const result = await query(
      `UPDATE receipts SET
         enrollment_id = $1, student_name = $2, student_phone = $3, student_email = $4,
         student_city = $5, course_name = $6, items = $7::jsonb, company = $8,
         tax_rate = $9, discount = $10, subtotal = $11, tax_amount = $12, total_amount = $13,
         received_amount = $14, balance_amount = $15, payment_mode = $16, transaction_id = $17,
         bank_account_name = $18, bank_account_number = $19, bank_name = $20, bank_ifsc = $21,
         notes = $22, receipt_number = $23, prefix = $24, sequence = $25
       WHERE id = $26 RETURNING *`,
      [b.enrollment_id || null, b.student_name, b.student_phone, b.student_email,
       b.student_city, b.course_name, items, newCompany, b.tax_rate || 0, b.discount || 0, b.subtotal || 0,
       b.tax_amount || 0, b.total_amount || 0, b.received_amount || 0, b.balance_amount || 0,
       b.payment_mode, b.transaction_id, b.bank_account_name, b.bank_account_number,
       b.bank_name, b.bank_ifsc, b.notes, number, prefix, seq, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/receipts/:id', auth(['admin']), async (req, res) => {
  try {
    const result = await query('DELETE FROM receipts WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Receipt not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/receipts/:id/pdf', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query('SELECT * FROM receipts WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Receipt not found' });
    const r = result.rows[0];
    const pdf = await generateInvoice({
      ...r,
      items: r.items,
      date: new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Receipt-${r.receipt_number}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Receipt templates
app.get('/api/receipt-templates', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query('SELECT * FROM receipt_templates ORDER BY name');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/receipt-templates', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const b = req.body;
    const result = await query(
      `INSERT INTO receipt_templates (name, prefix, payment_mode, bank_account_name, bank_account_number, bank_name, bank_ifsc, notes, company, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [b.name, b.prefix || 'NEO', b.payment_mode, b.bank_account_name, b.bank_account_number, b.bank_name, b.bank_ifsc, b.notes, b.company || 'neoskills', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/receipt-templates/:id', auth(['admin']), async (req, res) => {
  try {
    await query('DELETE FROM receipt_templates WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- GST Invoicing ----------
async function refreshEnrollmentStatus(enrollmentId) {
  const r = await query(`
    SELECT e.total_amount,
      COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'approved'), 0) as approved,
      COUNT(*) FILTER (WHERE p.status = 'pending_approval') as pending_count
    FROM enrollments e
    LEFT JOIN payments p ON p.enrollment_id = e.id
    WHERE e.id = $1
    GROUP BY e.id
  `, [enrollmentId]);
  if (!r.rows.length) return;
  const { total_amount, approved, pending_count } = r.rows[0];
  let status;
  if (Number(pending_count) > 0) status = 'waiting_approval';
  else if (parseFloat(approved) >= parseFloat(total_amount)) status = 'completed';
  else status = 'active';
  await query('UPDATE enrollments SET status = $1 WHERE id = $2', [status, enrollmentId]);
}

async function getGstSettings() {
  const r = await query('SELECT * FROM gst_settings WHERE id = 1');
  if (r.rows.length) return r.rows[0];
  await query('INSERT INTO gst_settings (id) VALUES (1)');
  return (await query('SELECT * FROM gst_settings WHERE id = 1')).rows[0];
}

async function nextGstInvoiceNumber(prefix, fyLabel) {
  const pre = prefix || 'NS';
  const res = await query(
    'SELECT COALESCE(MAX(sequence), 0) + 1 as n FROM gst_invoices WHERE prefix = $1 AND fiscal_year = $2',
    [pre, fyLabel]
  );
  const seq = parseInt(res.rows[0].n);
  return { number: `${pre}-${fyLabel}/${String(seq).padStart(4, '0')}`, seq };
}

function computeGstInvoice(b, settings) {
  const rate = Number(settings.tax_rate) || 18;
  const exportBill = String(b.state_code || '') === '99';
  const sameState = !exportBill && (String(b.state_code || '') === String(settings.state_code || ''));
  const items = (b.items || []).map((it) => {
    const participants = Number(it.participants) || 1;
    const unit_price = Number(it.unit_price) || 0;
    return { description: it.description || '', participants, unit_price, amount: Math.round((participants * unit_price) * 100) / 100 };
  });
  const taxable = items.reduce((s, it) => s + it.amount, 0);
  const g = buildGst({ taxable, rate, sameState, exportBill });
  return { items, ...g, rate, sameState, exportBill };
}

app.get('/api/gst-settings', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    res.json(await getGstSettings());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/gst-settings', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const b = req.body;
    const result = await query(
      `UPDATE gst_settings SET
        entity_name = $1, gstin = $2, pan = $3, sac = $4, sac_description = $5,
        address = $6, website = $7, city = $8, state = $9, state_code = $10,
        phone = $11, bank_account_name = $12, bank_account_number = $13,
        bank_ifsc = $14, bank_account_type = $15, jurisdiction = $16,
        tax_rate = $17, inclusive = $18, prefix = $19, terms = $20::jsonb,
        updated_at = NOW()
       WHERE id = 1 RETURNING *`,
      [b.entity_name, b.gstin, b.pan, b.sac, b.sac_description,
       b.address, b.website, b.city, b.state, b.state_code,
       b.phone, b.bank_account_name, b.bank_account_number,
       b.bank_ifsc, b.bank_account_type, b.jurisdiction,
       b.tax_rate || 18, b.inclusive !== false, b.prefix || 'NS',
       JSON.stringify(b.terms || [])]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Settings not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/gst-invoices', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(i.invoice_number ILIKE $${params.length + 1} OR i.student_name ILIKE $${params.length + 1} OR i.company ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (req.user.role === 'ops') {
      conditions.push(`i.created_by NOT IN (SELECT id FROM users WHERE role = 'admin')`);
    }
    let where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) as count FROM gst_invoices i ${where}`, params);
    const result = await query(
      `SELECT i.*, u.name as created_by_name
       FROM gst_invoices i
       LEFT JOIN users u ON i.created_by = u.id
       ${where}
       ORDER BY i.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    res.json({ invoices: result.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/gst-invoices/:id', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query('SELECT * FROM gst_invoices WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/gst-invoices', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const b = req.body;
    const settings = await getGstSettings();
    const fy = fiscalYearParts(b.invoice_date || new Date());
    const { number, seq } = await nextGstInvoiceNumber(b.prefix || settings.prefix, fy.label);
    const c = computeGstInvoice(b, settings);
    const result = await query(
      `INSERT INTO gst_invoices (
         invoice_number, prefix, sequence, fiscal_year, invoice_date, reference,
         student_name, company, location, city, state, state_code, customer_gstin, poc, status,
         items, sac, gst_type, cgst_rate, cgst, sgst_rate, sgst, igst_rate, igst,
         subtotal, round_off, total_amount, amount_in_words,
         supplier_gstin, supplier_address, bank_account_name, bank_account_number, bank_ifsc,
         enrollment_id, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,
         $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
       ) RETURNING *`,
      [number, b.prefix || settings.prefix, seq, fy.label, b.invoice_date || new Date(), b.reference,
       b.student_name, b.company, b.location, b.city, b.state, b.state_code, b.customer_gstin, b.poc, b.status || 'paid',
       JSON.stringify(c.items), b.sac || settings.sac, c.gst_type,
       c.cgstRate, c.cgst, c.sgstRate, c.sgst, c.igstRate, c.igst,
       c.subtotal, c.round_off, c.total, toWords(c.total),
       settings.gstin, settings.address, settings.bank_account_name, settings.bank_account_number, settings.bank_ifsc,
       b.enrollment_id || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/gst-invoices/:id', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const b = req.body;
    const settings = await getGstSettings();
    const c = computeGstInvoice(b, settings);
    const result = await query(
      `UPDATE gst_invoices SET
         invoice_date = $1, reference = $2, student_name = $3, company = $4,
         location = $5, city = $6, state = $7, state_code = $8, customer_gstin = $9,
         poc = $10, status = $11, items = $12::jsonb, sac = $13, gst_type = $14,
         cgst_rate = $15, cgst = $16, sgst_rate = $17, sgst = $18, igst_rate = $19, igst = $20,
         subtotal = $21, round_off = $22, total_amount = $23, amount_in_words = $24
       WHERE id = $25 RETURNING *`,
      [b.invoice_date || new Date(), b.reference, b.student_name, b.company,
       b.location, b.city, b.state, b.state_code, b.customer_gstin,
       b.poc, b.status || 'paid', JSON.stringify(c.items), b.sac || settings.sac, c.gst_type,
       c.cgstRate, c.cgst, c.sgstRate, c.sgst, c.igstRate, c.igst,
       c.subtotal, c.round_off, c.total, toWords(c.total), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/gst-invoices/:id', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query('DELETE FROM gst_invoices WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/gst-invoices/:id/pdf', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query('SELECT * FROM gst_invoices WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = result.rows[0];
    const settings = await getGstSettings();
    const pdf = await generateGstInvoice({
      ...inv,
      items: inv.items,
      entity_name: settings.entity_name,
      supplier_address: inv.supplier_address || settings.address,
      phone: settings.phone,
      pan: settings.pan,
      sac: inv.sac || settings.sac,
      sac_description: settings.sac_description,
      jurisdiction: settings.jurisdiction,
      bank_account_name: inv.bank_account_name || settings.bank_account_name,
      bank_account_number: inv.bank_account_number || settings.bank_account_number,
      bank_ifsc: inv.bank_ifsc || settings.bank_ifsc,
      bank_account_type: settings.bank_account_type,
      terms: settings.terms,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="GST-${inv.invoice_number}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard/summary', auth(), async (req, res) => {
  try {
    const role = req.user.role;
    let userFilter = '';
    let enrollFilter = '';
    let params = [];
    if (role === 'sales') {
      userFilter = 'AND p.sales_user_id = $1';
      enrollFilter = 'AND e.sales_user_id = $1';
      params.push(req.user.id);
    } else if (role === 'ops') {
      userFilter = "AND p.sales_user_id NOT IN (SELECT id FROM users WHERE role = 'admin')";
      enrollFilter = "AND e.sales_user_id NOT IN (SELECT id FROM users WHERE role = 'admin')";
    }
    let monthFilter = '';
    const month = req.query.month;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      params.push(month);
      monthFilter = ` AND to_char(e.created_at, 'YYYY-MM') = $${params.length} `;
    }

    const kpi = await query(`
      SELECT
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.status = 'approved' ${userFilter}) as total_revenue,
        (SELECT COALESCE(SUM(
           GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status = 'approved'
           ), 0), 0)
         ), 0)
         FROM enrollments e WHERE 1=1 ${enrollFilter}) as total_pending,
        (SELECT COUNT(*) FROM enrollments e WHERE e.status IN ('active', 'waiting_approval') ${enrollFilter}) as active_enrollments,
        (SELECT COUNT(*) FROM enrollments e WHERE 1=1 ${enrollFilter}) as total_enrollments,
        (SELECT COUNT(*) FROM enrollments e WHERE 1=1 ${enrollFilter} ${monthFilter}) as month_total_enrollments,
        (SELECT COUNT(*) FROM payments p WHERE p.status = 'pending_approval' ${userFilter}) as pending_approvals
    `, params);

    res.json(kpi.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard/team', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { month } = req.query;
    let monthE = '';
    let monthP = '';
    let params = [];
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      monthE = `AND date_trunc('month', e.created_at) = date_trunc('month', $1::date)`;
      monthP = `AND date_trunc('month', p.created_at) = date_trunc('month', $1::date)`;
      params.push(month + '-01');
    }
    const result = await query(`
      SELECT
        u.id, u.name, u.email, u.role, u.can_sell,
        (SELECT COUNT(*) FROM enrollments e WHERE e.sales_user_id = u.id ${monthE}) as deals_closed,
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'approved' ${monthP}) as revenue,
        (SELECT COALESCE(SUM(
           GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status = 'approved'
           ), 0), 0)
         ), 0)
         FROM enrollments e WHERE e.sales_user_id = u.id ${monthE}) as pending,
        (SELECT COUNT(*) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'pending_approval' ${monthP}) as pending_approvals
      FROM users u
      WHERE (u.role = 'sales' OR u.can_sell = true OR u.role = 'admin') AND u.status = 'active'
      ORDER BY deals_closed DESC, revenue DESC
    `, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard/trends', auth(), async (req, res) => {
  try {
    const role = req.user.role;
    let userFilter = '';
    let params = [];
    if (role === 'sales') {
      userFilter = 'AND p.sales_user_id = $1';
      params.push(req.user.id);
    }

    const result = await query(`
      SELECT
        DATE_TRUNC('month', p.created_at) as month,
        COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'approved'), 0) as revenue,
        COUNT(*) FILTER (WHERE p.status = 'approved') as deals
      FROM payments p
      WHERE 1=1 ${userFilter}
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard/source-analytics', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query(`
      SELECT e.source, COUNT(*) as count, COUNT(DISTINCT e.id) as enrollments
      FROM enrollments e
      WHERE e.source IS NOT NULL
      GROUP BY e.source
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard/pending-collections', auth(), async (req, res) => {
  try {
    const role = req.user.role;
    let salesFilter = '';
    let params = [];
    if (role === 'sales') {
      salesFilter = `AND e.sales_user_id = $${params.length + 1}`;
      params.push(req.user.id);
    } else if (role === 'ops') {
      salesFilter = `AND e.sales_user_id NOT IN (SELECT id FROM users WHERE role = 'admin')`;
    }
    const result = await query(`
      SELECT e.id as enrollment_id, s.name as student_name, s.phone as student_phone,
             s.email as student_email, s.city as student_city, e.course_name, e.batch_name,
             u.name as salesperson_name, e.total_amount,
             COALESCE((
               SELECT SUM(p2.amount_paid) FROM payments p2
               WHERE p2.enrollment_id = e.id AND p2.status = 'approved'
             ), 0) as paid_amount,
             GREATEST(e.total_amount - COALESCE((
               SELECT SUM(p2.amount_paid) FROM payments p2
               WHERE p2.enrollment_id = e.id AND p2.status = 'approved'
             ), 0), 0) as pending_amount
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN users u ON e.sales_user_id = u.id
      WHERE 1=1 ${salesFilter}
        AND GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status = 'approved'
           ), 0), 0) > 0
      ORDER BY pending_amount DESC, e.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/reports/salesperson', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.name as salesperson,
        (SELECT COUNT(*) FROM enrollments e WHERE e.sales_user_id = u.id) as enrollments,
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'approved') as collected,
        (SELECT COALESCE(SUM(
           GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status = 'approved'
           ), 0), 0)
         ), 0)
         FROM enrollments e WHERE e.sales_user_id = u.id) as pending_collection,
        (SELECT COUNT(*) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'pending_approval') as pending_approvals
      FROM users u
      WHERE (u.role = 'sales' OR u.can_sell = true OR u.role = 'admin') AND u.status = 'active'
      ORDER BY collected DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/reports/bank-wise', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query(`
      SELECT ba.account_name, ba.bank_name, ba.account_number,
             COUNT(p.id) as transactions,
             COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'approved'), 0) as total_collected
      FROM bank_accounts ba
      LEFT JOIN payments p ON p.bank_account_id = ba.id
      GROUP BY ba.id, ba.account_name, ba.bank_name, ba.account_number
      ORDER BY total_collected DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/reports/pending-payments', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const result = await query(`
      SELECT s.name as student_name, s.phone, e.course_name, u.name as salesperson,
             GREATEST(e.total_amount - COALESCE((
               SELECT SUM(p2.amount_paid) FROM payments p2
               WHERE p2.enrollment_id = e.id AND p2.status = 'approved'
             ), 0), 0) as pending_amount,
             (SELECT MAX(p3.created_at) FROM payments p3 WHERE p3.enrollment_id = e.id) as last_payment_date
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN users u ON e.sales_user_id = u.id
      WHERE GREATEST(e.total_amount - COALESCE((
              SELECT SUM(p2.amount_paid) FROM payments p2
              WHERE p2.enrollment_id = e.id AND p2.status = 'approved'
            ), 0), 0) > 0
      ORDER BY pending_amount DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/reports/category', auth(['admin', 'manager', 'ops']), async (req, res) => {
  try {
    const { category, status, from, to, sales_user_id } = req.query;
    const role = req.user.role;
    const conditions = [];
    const params = [];

    if (role === 'sales') {
      conditions.push(`e.sales_user_id = $${params.length + 1}`);
      params.push(req.user.id);
    } else if (role === 'ops') {
      conditions.push(`e.sales_user_id NOT IN (SELECT id FROM users WHERE role = 'admin')`);
    }
    if (category) {
      conditions.push(`e.category = $${params.length + 1}`);
      params.push(category);
    }
    if (sales_user_id) {
      conditions.push(`e.sales_user_id = $${params.length + 1}`);
      params.push(parseInt(sales_user_id));
    }
    if (status) {
      conditions.push(`e.status = $${params.length + 1}`);
      params.push(status);
    }
    if (from) {
      conditions.push(`e.created_at >= $${params.length + 1}`);
      params.push(new Date(from));
    }
    if (to) {
      conditions.push(`e.created_at <= $${params.length + 1}`);
      params.push(new Date(to));
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(`
      WITH base AS (
        SELECT e.id, COALESCE(NULLIF(e.category, ''), 'Training') as category,
               e.total_amount, e.created_at,
               COALESCE((
                 SELECT SUM(p.amount_paid) FROM payments p
                 WHERE p.enrollment_id = e.id AND p.status = 'approved'
               ), 0) as paid
        FROM enrollments e
        ${where}
      )
      SELECT category,
             COUNT(*) as enrollments,
             COALESCE(SUM(total_amount), 0) as total_amount,
             COALESCE(SUM(paid), 0) as collected,
             COALESCE(SUM(GREATEST(total_amount - paid, 0)), 0) as pending
      FROM base
      GROUP BY category
      ORDER BY enrollments DESC, category ASC
    `, params);

    const totals = result.rows.reduce((a, r) => ({
      enrollments: a.enrollments + Number(r.enrollments),
      total_amount: a.total_amount + Number(r.total_amount),
      collected: a.collected + Number(r.collected),
      pending: a.pending + Number(r.pending),
    }), { enrollments: 0, total_amount: 0, collected: 0, pending: 0 });

    res.json({ rows: result.rows, totals });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(express.static('dist'));
app.use((req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.resolve('dist/index.html'));
  }
});

async function init() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL set. Running in mock mode.');
    return;
  }
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'sales' CHECK (role IN ('sales', 'manager', 'admin', 'ops')),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
        phone TEXT,
        city TEXT,
        can_sell BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        city TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        sales_user_id INTEGER REFERENCES users(id),
        course_name TEXT NOT NULL,
        deal_type TEXT CHECK (deal_type IN ('training', 'exam', 'bundle')),
        category TEXT,
        training_fee DECIMAL(10,2) DEFAULT 0,
        exam_fee DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
        support_included BOOLEAN DEFAULT false,
        source TEXT,
        batch_name TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id SERIAL PRIMARY KEY,
        account_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        ifsc TEXT,
        branch TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        enrollment_id INTEGER REFERENCES enrollments(id),
        student_id INTEGER REFERENCES students(id),
        sales_user_id INTEGER REFERENCES users(id),
        amount_paid DECIMAL(10,2) NOT NULL,
        pending_amount DECIMAL(10,2) DEFAULT 0,
        payment_mode TEXT CHECK (payment_mode IN ('upi', 'card', 'neft', 'cash', 'cheque')),
        bank_account_id INTEGER REFERENCES bank_accounts(id),
        transaction_id TEXT,
        receipt_url TEXT,
        status TEXT DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sales_targets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        target_amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        receipt_number TEXT UNIQUE NOT NULL,
        prefix TEXT DEFAULT 'NEO',
        sequence INTEGER NOT NULL DEFAULT 0,
        enrollment_id INTEGER REFERENCES enrollments(id),
        student_name TEXT,
        student_phone TEXT,
        student_email TEXT,
        student_city TEXT,
        course_name TEXT,
        items JSONB DEFAULT '[]'::jsonb,
        company TEXT DEFAULT 'neoskills',
        tax_rate DECIMAL(5,2) DEFAULT 0,
        discount DECIMAL(10,2) DEFAULT 0,
        subtotal DECIMAL(10,2) DEFAULT 0,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        received_amount DECIMAL(10,2) DEFAULT 0,
        balance_amount DECIMAL(10,2) DEFAULT 0,
        payment_mode TEXT,
        transaction_id TEXT,
        bank_account_name TEXT,
        bank_account_number TEXT,
        bank_name TEXT,
        bank_ifsc TEXT,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS receipt_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        prefix TEXT DEFAULT 'NEO',
        payment_mode TEXT,
        bank_account_name TEXT,
        bank_account_number TEXT,
        bank_name TEXT,
        bank_ifsc TEXT,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS gst_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        entity_name TEXT DEFAULT 'Neoskills',
        gstin TEXT DEFAULT '27AAQFN8793B1ZP',
        pan TEXT DEFAULT 'AAQFN8793B',
        sac TEXT DEFAULT '999293',
        sac_description TEXT DEFAULT 'Commercial Training & Coaching Services',
        address TEXT DEFAULT 'Opp Sadanand Hotel Baner, Near Westside Mall, Near DMart, Laxman Nagar, Baner, Pune, Maharashtra 411045',
        website TEXT DEFAULT 'www.neoskills.co.in',
        city TEXT DEFAULT 'Pune',
        state TEXT DEFAULT 'Maharashtra',
        state_code TEXT DEFAULT '27',
        phone TEXT DEFAULT '+91-9767865254 / +91-8983690231',
        bank_account_name TEXT DEFAULT 'NeoSkills',
        bank_account_number TEXT DEFAULT '919020077472602',
        bank_ifsc TEXT DEFAULT 'UTIB0003284',
        bank_account_type TEXT DEFAULT 'Current Account',
        jurisdiction TEXT DEFAULT 'Pune, Maharashtra',
        tax_rate NUMERIC(5,2) DEFAULT 18,
        inclusive BOOLEAN DEFAULT true,
        prefix TEXT DEFAULT 'NS',
        terms JSONB DEFAULT '[
          "GST charged as applicable under SAC Code 999293 - Commercial Training & Coaching Services.",
          "Non-refundable and non-transferable once payment is made.",
          "Interest @18% p.a. applicable on delayed payments.",
          "Accuracy of GST details is the responsibility of the recipient for ITC eligibility.",
          "All disputes subject to Pune, Maharashtra jurisdiction.",
          "This is a system-generated invoice and does not require a physical signature."
        ]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS gst_invoices (
        id SERIAL PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        prefix TEXT DEFAULT 'NS',
        sequence INTEGER NOT NULL DEFAULT 0,
        fiscal_year TEXT NOT NULL,
        invoice_date DATE DEFAULT NOW(),
        reference TEXT,
        student_name TEXT,
        company TEXT,
        location TEXT,
        city TEXT,
        state TEXT,
        state_code TEXT,
        customer_gstin TEXT,
        poc TEXT,
        status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'unpaid', 'cancelled')),
        items JSONB DEFAULT '[]'::jsonb,
        sac TEXT DEFAULT '999293',
        gst_type TEXT DEFAULT 'igst',
        cgst_rate NUMERIC(5,2) DEFAULT 0,
        cgst NUMERIC(12,2) DEFAULT 0,
        sgst_rate NUMERIC(5,2) DEFAULT 0,
        sgst NUMERIC(12,2) DEFAULT 0,
        igst_rate NUMERIC(5,2) DEFAULT 0,
        igst NUMERIC(12,2) DEFAULT 0,
        subtotal NUMERIC(12,2) DEFAULT 0,
        round_off NUMERIC(12,2) DEFAULT 0,
        total_amount NUMERIC(12,2) DEFAULT 0,
        amount_in_words TEXT,
        supplier_gstin TEXT,
        supplier_address TEXT,
        bank_account_name TEXT,
        bank_account_number TEXT,
        bank_ifsc TEXT,
        enrollment_id INTEGER REFERENCES enrollments(id),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type TEXT DEFAULT 'enrollment_deleted',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS batches (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        course_name TEXT,
        trainer_name TEXT,
        start_date DATE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS batch_members (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE,
        enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE CASCADE,
        added_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (batch_id, enrollment_id)
      );
    `);
    console.log('Database tables created');

    try {
      await query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'neoskills'`);
      await query(`ALTER TABLE receipt_templates ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'neoskills'`);
      await query(`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS category TEXT`);
      await query(`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS support_included BOOLEAN DEFAULT false`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_sell BOOLEAN DEFAULT false`);
      await query(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_mode_check`);
      await query(`ALTER TABLE payments ADD CONSTRAINT payments_payment_mode_check CHECK (payment_mode IN ('upi', 'card', 'neft', 'cash', 'cheque', 'bank_transfer'))`);
      await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
      await query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('sales', 'manager', 'admin', 'ops'))`);
      await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check`);
      await query(`ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'pending', 'rejected', 'on_leave', 'inactive'))`);
      await query(`ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check`);
      await query(`ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check CHECK (status IN ('active', 'completed', 'waiting_approval'))`);
      await query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_urls JSONB`);
      await query(`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS telecrm_link TEXT`);
      await query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS zoom_link TEXT`);
      await query(`UPDATE enrollments e SET status = 'waiting_approval'
                   FROM payments p
                   WHERE p.enrollment_id = e.id AND p.status = 'pending_approval'`);
      console.log('Enrollment columns migrated');
    } catch (e) {
      console.log('Migration note:', e.message);
    }

    try {
      const s = await query('SELECT id FROM gst_settings WHERE id = 1');
      if (!s.rows.length) {
        await query('INSERT INTO gst_settings (id) VALUES (1)');
      }
    } catch (e) {
      console.log('GST settings note:', e.message);
    }

    const defaultAccounts = [
      { account_name: 'NSL HDFC', account_number: 'NSL-HDFC', bank_name: 'HDFC Bank' },
      { account_name: 'CareerVU HDFC', account_number: 'CV-HDFC', bank_name: 'HDFC Bank' },
      { account_name: 'Cash', account_number: 'CASH', bank_name: 'Cash' },
      { account_name: 'Credit Card (GST)', account_number: 'CARD-GST', bank_name: 'Credit Card' },
      { account_name: 'Credit Card (Non GST)', account_number: 'CARD-NONGST', bank_name: 'Credit Card' },
    ];
    for (const acc of defaultAccounts) {
      const exists = await query('SELECT id FROM bank_accounts WHERE LOWER(account_name) = LOWER($1)', [acc.account_name]);
      if (!exists.rows.length) {
        await query(
          'INSERT INTO bank_accounts (account_name, account_number, bank_name) VALUES ($1, $2, $3)',
          [acc.account_name, acc.account_number, acc.bank_name]
        );
      }
    }
    console.log('Default bank accounts ensured');

    const adminExists = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (!adminExists.rows.length) {
      const hash = await bcrypt.hash('admin123', 10);
      await query(
        "INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, $5)",
        ['Admin', 'admin@neoskills.co.in', hash, 'admin', 'active']
      );
      console.log('Default admin created: admin@neoskills.co.in / admin123');
    }
  } catch (e) {
    console.error('DB init error:', e.message);
  }
}

init().then(() => {
  app.listen(PORT, () => {
    console.log(`NeoOps server running on port ${PORT}`);
  });
});
