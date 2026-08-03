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

async function withTransaction(fn) {
  const p = getPool();
  if (!p) throw new Error('No database configured');
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { getPool, query, withTransaction };
