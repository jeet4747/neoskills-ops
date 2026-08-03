require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { query, withTransaction } = require('./db.cjs');
const { generateReceipt } = require('./receipt.cjs');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'neosecret2026';

app.use(cors({ origin: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });
app.use('/uploads', express.static('uploads'));

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
    if (user.status !== 'active')
      return res.status(403).json({ error: 'Account not yet approved. Contact manager.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', auth(), (req, res) => {
  res.json(req.user);
});

app.get('/api/auth/pending-users', auth(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query(
      "SELECT id, name, email, role, status, created_at FROM users WHERE status = 'pending' ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/approve/:id', auth(['admin', 'manager']), async (req, res) => {
  try {
    const { action } = req.body;
    const status = action === 'reject' ? 'rejected' : 'active';
    await query('UPDATE users SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users', auth(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.id, u.name, u.email, u.role, u.status, u.phone, u.city, u.created_at,
        (SELECT COUNT(*) FROM enrollments e WHERE e.sales_user_id = u.id) as enrollments,
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'approved') as collected,
        (SELECT COALESCE(SUM(
           GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status IN ('pending_approval', 'approved')
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

app.get('/api/users/:id/profile', auth(), async (req, res) => {
  try {
    const userResult = await query('SELECT id, name, email, role FROM users WHERE id = $1', [req.params.id]);
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });

    const stats = await query(`
      SELECT
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'approved') as collected,
        (SELECT COALESCE(SUM(
           GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status IN ('pending_approval', 'approved')
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
    const { student_id, course_name, deal_type, category, training_fee, exam_fee, total_amount, source, batch_name, support_included } = req.body;
    if (!student_id || !course_name || !total_amount)
      return res.status(400).json({ error: 'student_id, course_name, total_amount required' });
    const result = await query(
      `INSERT INTO enrollments (student_id, sales_user_id, course_name, deal_type, category, training_fee, exam_fee, total_amount, support_included, source, batch_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [student_id, req.user.id, course_name, deal_type || 'bundle', category, training_fee || 0, exam_fee || 0, total_amount, !!support_included, source, batch_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/enrollments/combined', auth(), async (req, res) => {
  try {
    const { student_name, student_email, student_phone, course_name, category, deal_type,
            training_fee, exam_fee, total_amount, support_included, source, batch_name,
            amount_paid, payment_mode, bank_account_id, transaction_id } = req.body;

    if (!student_name || !course_name)
      return res.status(400).json({ error: 'student_name and course_name required' });
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

      const existing = await client.query(
        `SELECT id FROM enrollments WHERE student_id = $1 AND LOWER(course_name) = LOWER($2) AND status = 'active'`,
        [student.id, course_name]
      );
      if (existing.rows.length) {
        const err = new Error(`This student already has an active enrollment in ${course_name}`);
        err.statusCode = 409;
        throw err;
      }

      const enroll = await client.query(
        `INSERT INTO enrollments (student_id, sales_user_id, course_name, deal_type, category, training_fee, exam_fee, total_amount, support_included, source, batch_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [student.id, req.user.id, course_name, deal_type || 'bundle', category, training_fee || 0, exam_fee || 0, total_amount, !!support_included, source, batch_name]
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

      const pay = await client.query(
        `INSERT INTO payments (enrollment_id, student_id, sales_user_id, amount_paid, pending_amount, payment_mode, bank_account_id, transaction_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_approval') RETURNING *`,
        [enrollment.id, student.id, req.user.id, paid, pending, payment_mode, bank_account_id || null, transaction_id || null]
      );

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
          WHERE p.enrollment_id = e.id AND p.status IN ('pending_approval', 'approved')
        ), 0) as paid_amount,
        GREATEST(e.total_amount - COALESCE((
          SELECT SUM(p.amount_paid) FROM payments p
          WHERE p.enrollment_id = e.id AND p.status IN ('pending_approval', 'approved')
        ), 0), 0) as pending_amount
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN users u ON e.sales_user_id = u.id
    `;
    let params = [];
    const conditions = [];

    if (role === 'sales') {
      conditions.push(`e.sales_user_id = $${params.length + 1}`);
      params.push(req.user.id);
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

app.get('/api/enrollments/:id/receipt', auth(['admin', 'manager']), async (req, res) => {
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

    const considered = paysResult.rows.filter((p) => p.status === 'approved' || p.status === 'pending_approval');
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
    const isManager = req.user.role === 'manager' || req.user.role === 'admin';
    if (!isManager && enroll.sales_user_id !== req.user.id)
      return res.status(403).json({ error: 'You can only edit your own enrollments' });

    const { student_id, course_name, deal_type, category, training_fee, exam_fee, total_amount, support_included, source, batch_name } = req.body;

    const newTotal = total_amount !== undefined
      ? parseFloat(total_amount)
      : (parseFloat(training_fee) || 0) + (parseFloat(exam_fee) || 0);

    const updateEnroll = await query(
      `UPDATE enrollments SET
         course_name = $1, deal_type = $2, category = $3,
         training_fee = $4, exam_fee = $5, total_amount = $6,
         support_included = $7, source = $8, batch_name = $9
       WHERE id = $10 RETURNING *`,
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

app.get('/api/bank-accounts', auth(), async (req, res) => {
  try {
    const result = await query('SELECT * FROM bank_accounts WHERE is_active = true ORDER BY bank_name');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/bank-accounts', auth(['admin']), async (req, res) => {
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

app.delete('/api/bank-accounts/:id', auth(['admin']), async (req, res) => {
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
    const { enrollment_id, student_id, amount_paid, payment_mode, bank_account_id, transaction_id } = req.body;
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

    const result = await query(
      `INSERT INTO payments (enrollment_id, student_id, sales_user_id, amount_paid, pending_amount, payment_mode, bank_account_id, transaction_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_approval') RETURNING *`,
      [enrollment_id, student_id, req.user.id, paid, pending, payment_mode, bank_account_id, transaction_id]
    );
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

app.post('/api/approvals/:id/approve', auth(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query(
      `UPDATE payments SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2 AND status = 'pending_approval' RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Payment not found or already processed' });

    const payment = result.rows[0];
    const enrollPayments = await query(
      "SELECT SUM(amount_paid) as total_paid FROM payments WHERE enrollment_id = $1 AND status = 'approved'",
      [payment.enrollment_id]
    );
    const totalPaid = parseFloat(enrollPayments.rows[0].total_paid || 0);
    const enroll = await query('SELECT total_amount FROM enrollments WHERE id = $1', [payment.enrollment_id]);
    if (enroll.rows.length && totalPaid >= parseFloat(enroll.rows[0].total_amount)) {
      await query("UPDATE enrollments SET status = 'completed' WHERE id = $1", [payment.enrollment_id]);
    }

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/approvals/:id/reject', auth(['admin', 'manager']), async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await query(
      `UPDATE payments SET status = 'rejected', approved_by = $1, rejection_reason = $2 WHERE id = $3 AND status = 'pending_approval' RETURNING *`,
      [req.user.id, reason || 'No reason provided', req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Payment not found or already processed' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/approvals/pending', auth(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, s.name as student_name, s.email as student_email, s.phone as student_phone,
              e.course_name, u.name as salesperson_name, ba.account_name as bank_account_name
       FROM payments p
       JOIN students s ON p.student_id = s.id
       JOIN enrollments e ON p.enrollment_id = e.id
       JOIN users u ON p.sales_user_id = u.id
       LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
       WHERE p.status = 'pending_approval'
       ORDER BY p.created_at ASC`
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/approvals/count', auth(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query(
      "SELECT COUNT(*) as count FROM payments WHERE status = 'pending_approval'"
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/payments/:id/receipt', auth(), upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    await query('UPDATE payments SET receipt_url = $1 WHERE id = $2', [url, req.params.id]);
    res.json({ receipt_url: url });
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
    }

    const kpi = await query(`
      SELECT
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.status = 'approved' ${userFilter}) as total_revenue,
        (SELECT COALESCE(SUM(
           GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status IN ('pending_approval', 'approved')
           ), 0), 0)
         ), 0)
         FROM enrollments e ${enrollFilter}) as total_pending,
        (SELECT COUNT(*) FROM enrollments e WHERE e.status = 'active' ${enrollFilter}) as active_enrollments,
        (SELECT COUNT(*) FROM enrollments e ${enrollFilter}) as total_enrollments,
        (SELECT COUNT(*) FROM payments p WHERE p.status = 'pending_approval' ${userFilter}) as pending_approvals
    `, params);

    res.json(kpi.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard/team', auth(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.id, u.name, u.email,
        (SELECT COUNT(*) FROM enrollments e WHERE e.sales_user_id = u.id) as deals_closed,
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'approved') as revenue,
        (SELECT COALESCE(SUM(
           GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status IN ('pending_approval', 'approved')
           ), 0), 0)
         ), 0)
         FROM enrollments e WHERE e.sales_user_id = u.id) as pending,
        (SELECT COUNT(*) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'pending_approval') as pending_approvals
      FROM users u
      WHERE u.role = 'sales' AND u.status = 'active'
      ORDER BY revenue DESC
    `);
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

app.get('/api/dashboard/source-analytics', auth(['admin', 'manager']), async (req, res) => {
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

app.get('/api/reports/salesperson', auth(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.name as salesperson,
        (SELECT COUNT(*) FROM enrollments e WHERE e.sales_user_id = u.id) as enrollments,
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'approved') as collected,
        (SELECT COALESCE(SUM(
           GREATEST(e.total_amount - COALESCE((
             SELECT SUM(p2.amount_paid) FROM payments p2
             WHERE p2.enrollment_id = e.id AND p2.status IN ('pending_approval', 'approved')
           ), 0), 0)
         ), 0)
         FROM enrollments e WHERE e.sales_user_id = u.id) as pending_collection,
        (SELECT COUNT(*) FROM payments p WHERE p.sales_user_id = u.id AND p.status = 'pending_approval') as pending_approvals
      FROM users u
      WHERE u.role = 'sales' AND u.status = 'active'
      ORDER BY collected DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/reports/bank-wise', auth(['admin', 'manager']), async (req, res) => {
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

app.get('/api/reports/pending-payments', auth(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query(`
      SELECT s.name as student_name, s.phone, e.course_name, u.name as salesperson,
             GREATEST(e.total_amount - COALESCE((
               SELECT SUM(p2.amount_paid) FROM payments p2
               WHERE p2.enrollment_id = e.id AND p2.status IN ('pending_approval', 'approved')
             ), 0), 0) as pending_amount,
             (SELECT MAX(p3.created_at) FROM payments p3 WHERE p3.enrollment_id = e.id) as last_payment_date
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN users u ON e.sales_user_id = u.id
      WHERE GREATEST(e.total_amount - COALESCE((
              SELECT SUM(p2.amount_paid) FROM payments p2
              WHERE p2.enrollment_id = e.id AND p2.status IN ('pending_approval', 'approved')
            ), 0), 0) > 0
      ORDER BY pending_amount DESC
    `);
    res.json(result.rows);
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
        role TEXT DEFAULT 'sales' CHECK (role IN ('sales', 'manager', 'admin')),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
        phone TEXT,
        city TEXT,
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
    `);
    console.log('Database tables created');

    try {
      await query(`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS category TEXT`);
      await query(`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS support_included BOOLEAN DEFAULT false`);
      await query(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_mode_check`);
      await query(`ALTER TABLE payments ADD CONSTRAINT payments_payment_mode_check CHECK (payment_mode IN ('upi', 'card', 'neft', 'cash', 'cheque', 'bank_transfer'))`);
      console.log('Enrollment columns migrated');
    } catch (e) {
      console.log('Migration note:', e.message);
    }

    const defaultAccounts = [
      { account_name: 'Neoskills GST', account_number: 'GST-ACCT', bank_name: 'Neoskills' },
      { account_name: 'NSL HDFC', account_number: 'NSL-HDFC', bank_name: 'HDFC Bank' },
      { account_name: 'CareerVU HDFC', account_number: 'CV-HDFC', bank_name: 'HDFC Bank' },
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
