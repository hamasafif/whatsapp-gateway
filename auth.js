/* auth.js */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import db from './db.js';
import logger from './logger.js';

// cache secret di module scope
let JWT_SECRET;
async function loadSecret() {
  if (JWT_SECRET) return JWT_SECRET;
  const [rows] = await db.execute('SELECT v FROM settings WHERE k=?',['jwt_secret']);
  JWT_SECRET = rows[0].v;
  return JWT_SECRET;
}

/* Middleware – validasi JWT */
export async function auth(req, res, next) {
  const hdr = req.headers['authorization'];
  if (!hdr) {
    logger.warn('⚠️ Tidak ada Authorization header, redirect ke /login');
    return res.redirect('/login');
  }
  const token = hdr.split(' ')[1];
  try {
    const secret = await loadSecret();
    req.user = jwt.verify(token, secret);
    next();
  } catch (err) {
    logger.error(`❌ Token invalid atau expired: ${err.message}`);
    res.redirect('/login');
  }
}

/* Cek login user di DB */
export async function checkUser(username, plainPass) {
  const [rows] = await db.execute(
    'SELECT id, password FROM users WHERE username=?',
    [username]
  );
  if (!rows.length) {
    logger.warn(`⚠️ Login gagal, user "${username}" tidak ditemukan`);
    return false;
  }
  const match = await bcrypt.compare(plainPass, rows[0].password);
  if (!match) {
    logger.warn(`⚠️ Login gagal, password salah untuk user "${username}"`);
    return false;
  }
  return { id: rows[0].id, username };
}

/* Buat admin default jika belum ada */
export async function seedAdmin() {
  const [rows] = await db.execute('SELECT id FROM users WHERE username=?',['wrjunior']);
  if (rows.length) return;
  const hash = await bcrypt.hash('Hamas@fif13', 12);
  await db.execute('INSERT INTO users(username,password) VALUES(?,?)',['wrjunior',hash]);
  logger.success('✅ Admin default "wrjunior" berhasil dibuat');
}
