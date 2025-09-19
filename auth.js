/* auth.js – NEW VERSION */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import db from './db.js';

// read secret from DB (cache in module scope)
let JWT_SECRET;
async function loadSecret() {
  if (JWT_SECRET) return JWT_SECRET;
  const [rows] = await db.execute('SELECT v FROM settings WHERE k=?',['jwt_secret']);
  JWT_SECRET = rows[0].v;
  return JWT_SECRET;
}

/* Middleware – unchanged signature */
export async function auth(req, res, next) {
  const hdr = req.headers['authorization'];
  if (!hdr) return res.redirect('/login');
  const token = hdr.split(' ')[1];
  try {
    const secret = await loadSecret();
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    res.redirect('/login');
  }
}

/* Login check – now against DB */
export async function checkUser(username, plainPass) {
  const [rows] = await db.execute(
    'SELECT id, password FROM users WHERE username=?',
    [username]
  );
  if (!rows.length) return false;
  const match = await bcrypt.compare(plainPass, rows[0].password);
  return match ? { id: rows[0].id, username } : false;
}

/* Create default admin on first run – safe to call repeatedly */
export async function seedAdmin() {
  const [rows] = await db.execute('SELECT id FROM users WHERE username=?',['wrjunior']);
  if (rows.length) return;
  const hash = await bcrypt.hash('Hamas@fif13', 12);
  await db.execute('INSERT INTO users(username,password) VALUES(?,?)',['wrjunior',hash]);
}