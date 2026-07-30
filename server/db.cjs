const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) return null;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  pool.on('error', (err) => console.error('Pool error:', err.message));
  return pool;
}

async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error('No database configured');
  return p.query(text, params);
}

module.exports = { getPool, query };
