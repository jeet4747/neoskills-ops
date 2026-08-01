require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../db.cjs');

const users = [
  { name: 'Aanagha', email: 'aanagha@neoskills.co.in', role: 'sales' },
  { name: 'Mayur', email: 'Mayur@neoskills.co.in', role: 'sales' },
  { name: 'Garima', email: 'garima@neoskills.co.in', role: 'sales' },
  { name: 'Meenakshi', email: 'meenakshi@neoskills.co.in', role: 'sales' },
  { name: 'Neha', email: 'neha@neoskills.co.in', role: 'sales' },
  { name: 'Suhana', email: 'suhana@neoskills.co.in', role: 'sales' },
  { name: 'Janhavi', email: 'janhavi@neoskills.co.in', role: 'sales' },
  { name: 'Pankaj', email: 'pankaj@neoskills.co.in', role: 'sales' },
  { name: 'Puja', email: 'pujamohd@neoskills.co.in', role: 'sales' },
  { name: 'Pooja', email: 'pooja@neoskills.co.in', role: 'sales' },
  { name: 'Pallavi', email: 'pallavi@neoskills.co.in', role: 'sales' },
  { name: 'Preeti', email: 'preeti@neoskills.co.in', role: 'manager' },
  { name: 'Kunal', email: 'kunal@neoskills.co.in', role: 'admin' },
  { name: 'Developer', email: 'contact@neoskills.co.in', role: 'admin' },
];

function genPassword(name) {
  const num = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${name}@Neo${num}`;
}

(async () => {
  const results = [];
  for (const u of users) {
    const pass = genPassword(u.name);
    const hash = await bcrypt.hash(pass, 10);
    const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [u.email]);
    if (existing.rows.length) {
      await query(
        "UPDATE users SET role = $1, status = 'active', password = $2, name = $3 WHERE id = $4",
        [u.role, hash, u.name, existing.rows[0].id]
      );
      results.push({ ...u, pass, existed: true });
    } else {
      await query(
        "INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, 'active')",
        [u.name, u.email, hash, u.role]
      );
      results.push({ ...u, pass, existed: false });
    }
  }
  console.log('USER\tEMAIL\tPASSWORD\tROLE\tSTATUS');
  results.forEach((r) => {
    console.log(`${r.name}\t${r.email}\t${r.pass}\t${r.role}\t${r.existed ? 'updated' : 'created'}`);
  });
  process.exit(0);
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
