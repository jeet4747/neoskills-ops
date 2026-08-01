require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { query } = require('./db.cjs');

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
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
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
        COUNT(DISTINCT e.id) FILTER (WHERE e.sales_user_id = u.id) as enrollments,
        COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'approved' AND p.sales_user_id = u.id), 0) as collected,
        COALESCE(SUM(p.pending_amount) FILTER (WHERE p.status IN ('pending_approval', 'approved') AND p.sales_user_id = u.id), 0) as pending,
        COUNT(*) FILTER (WHERE p.status = 'pending_approval' AND p.sales_user_id = u.id) as pending_approvals
      FROM users u
      LEFT JOIN enrollments e ON e.sales_user_id = u.id
      LEFT JOIN payments p ON p.sales_user_id = u.id
      GROUP BY u.id, u.name, u.email, u.role, u.status, u.phone, u.city, u.created_at
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
        COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'approved'), 0) as collected,
        COALESCE(SUM(p.pending_amount) FILTER (WHERE p.status IN ('pending_approval', 'approved')), 0) as pending,
        COUNT(DISTINCT e.id) as enrollments,
        COUNT(*) FILTER (WHERE p.status = 'pending_approval') as pending_approvals
      FROM users u
      LEFT JOIN enrollments e ON e.sales_user_id = u.id
      LEFT JOIN payments p ON p.sales_user_id = u.id
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
    const { student_id, course_name, deal_type, training_fee, exam_fee, total_amount, source, batch_name } = req.body;
    if (!student_id || !course_name || !total_amount)
      return res.status(400).json({ error: 'student_id, course_name, total_amount required' });
    const result = await query(
      `INSERT INTO enrollments (student_id, sales_user_id, course_name, deal_type, training_fee, exam_fee, total_amount, source, batch_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [student_id, req.user.id, course_name, deal_type || 'bundle', training_fee || 0, exam_fee || 0, total_amount, source, batch_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    const pending = Math.max(0, total - paid);

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
    let params = [];
    if (role === 'sales') {
      userFilter = 'AND p.sales_user_id = $1';
      params.push(req.user.id);
    }

    const kpi = await query(`
      SELECT
        COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'approved'), 0) as total_revenue,
        COALESCE(SUM(p.pending_amount) FILTER (WHERE p.status IN ('pending_approval', 'approved')), 0) as total_pending,
        COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'active') as active_enrollments,
        COUNT(DISTINCT e.id) as total_enrollments,
        COUNT(*) FILTER (WHERE p.status = 'pending_approval') as pending_approvals
      FROM payments p
      JOIN enrollments e ON p.enrollment_id = e.id
      WHERE 1=1 ${userFilter}
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
        COUNT(DISTINCT e.id) as deals_closed,
        COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'approved'), 0) as revenue,
        COALESCE(SUM(p.pending_amount) FILTER (WHERE p.status IN ('pending_approval', 'approved')), 0) as pending,
        COUNT(*) FILTER (WHERE p.status = 'pending_approval') as pending_approvals
      FROM users u
      LEFT JOIN enrollments e ON e.sales_user_id = u.id
      LEFT JOIN payments p ON p.sales_user_id = u.id
      WHERE u.role = 'sales' AND u.status = 'active'
      GROUP BY u.id, u.name, u.email
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
        COUNT(DISTINCT e.id) as enrollments,
        COALESCE(SUM(p.amount_paid) FILTER (WHERE p.status = 'approved'), 0) as collected,
        COALESCE(SUM(p.pending_amount) FILTER (WHERE p.status IN ('pending_approval', 'approved')), 0) as pending_collection,
        COUNT(*) FILTER (WHERE p.status = 'pending_approval') as pending_approvals
      FROM users u
      LEFT JOIN enrollments e ON e.sales_user_id = u.id
      LEFT JOIN payments p ON p.sales_user_id = u.id
      WHERE u.role = 'sales' AND u.status = 'active'
      GROUP BY u.name
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
             p.pending_amount, p.created_at as last_payment_date
      FROM payments p
      JOIN students s ON p.student_id = s.id
      JOIN enrollments e ON p.enrollment_id = e.id
      JOIN users u ON p.sales_user_id = u.id
      WHERE p.pending_amount > 0 AND p.status IN ('pending_approval', 'approved')
      ORDER BY p.pending_amount DESC
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
        training_fee DECIMAL(10,2) DEFAULT 0,
        exam_fee DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
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
