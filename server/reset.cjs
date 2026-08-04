require('dotenv').config();
const { getPool } = require('./db.cjs');

async function reset() {
  const pool = getPool();
  if (!pool) {
    console.log('No DATABASE_URL set. Nothing to reset.');
    process.exit(0);
  }
  try {
    await pool.query(`
      TRUNCATE TABLE payments, sales_targets, enrollments, students, users, bank_accounts RESTART IDENTITY CASCADE;
    `);
    console.log('All data cleared. Tables: users, students, enrollments, payments, bank_accounts, sales_targets');
    console.log('Default admin + bank accounts will be recreated on next server start.');
    process.exit(0);
  } catch (e) {
    console.error('Reset error:', e.message);
    process.exit(1);
  }
}

reset();
