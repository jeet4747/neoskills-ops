require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./db.cjs');

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL set. Skipping seed.');
    process.exit(0);
  }

  try {
    const existing = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (existing.rows.length) {
      console.log('Admin user already exists. Skipping seed.');
      process.exit(0);
    }

    const hash = await bcrypt.hash('admin123', 10);
    await query(
      "INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, $5)",
      ['Admin', 'admin@neoskills.co.in', hash, 'admin', 'active']
    );
    console.log('Admin user created: admin@neoskills.co.in / admin123');
    process.exit(0);
  } catch (e) {
    console.error('Seed error:', e.message);
    process.exit(1);
  }
}

seed();
