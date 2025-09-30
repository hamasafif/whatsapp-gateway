// server.js
import 'dotenv/config';
import express from 'express';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import qrcode from 'qrcode';
import fs from 'fs';
import { rmSync } from 'node:fs';
import path from 'path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import https from 'https';
import pino from 'pino';
import logger from './logger.js';

/* ---------- CONFIG ---------- */
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});
const PORT = process.env.PORT || 5001;

/* ---------- HELPERS ---------- */
let JWT_SECRET;
async function loadSecret() {
  if (JWT_SECRET) return JWT_SECRET;
  const [r] = await db.execute('SELECT v FROM settings WHERE k=?', ['jwt_secret']);
  if (!r.length) {
    const uuid = crypto.randomUUID();
    await db.execute(
      'INSERT INTO settings(k,v) VALUES(?,?) ON DUPLICATE KEY UPDATE v=?',
      ['jwt_secret', uuid, uuid]
    );
    JWT_SECRET = uuid;
  } else JWT_SECRET = r[0].v;
  return JWT_SECRET;
}
async function checkUser(username, plain) {
  const [rows] = await db.execute('SELECT id,password FROM users WHERE username=?', [username]);
  if (!rows.length) return false;
  const ok = await bcrypt.compare(plain, rows[0].password);
  return ok ? { id: rows[0].id, username } : false;
}
async function seedAdmin() {
  const [rows] = await db.execute('SELECT id FROM users WHERE username=?', ['wrjunior']);
  if (rows.length) return;
  const hash = await bcrypt.hash('Hamas@fif13', 12);
  await db.execute('INSERT INTO users(username,password) VALUES(?,?)', ['wrjunior', hash]);
  logger.success('✅ Admin default "wrjunior" berhasil dibuat');
}
async function checkApiKey(key) {
  if (!key) return false;
  const [rows] = await db.execute('SELECT id FROM api_keys WHERE `key`=?', [key]);
  return rows.length > 0;
}
async function syncDeviceStatus(number, pushname, status, accessToken = null) {
  await db.execute(
    `INSERT INTO devices(number,pushname,status,accesstoken)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE
        pushname=VALUES(pushname),
        status=VALUES(status),
        accesstoken=VALUES(accesstoken),
        updated_at=NOW()`,
    [number, pushname, status, accessToken]
  );
}

/* ---------- EXPRESS ---------- */
const app = express();
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let sock, qrBase64;
const savedSessions = './sessions';
function isWAConnected() {
  return sock && sock.user && sock.user.id ? true : false;
}

/* ---------- WEBHOOK ---------- */
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const webhookURLs = [process.env.WEBHOOK_URL, process.env.WEBHOOK_URL2].filter(Boolean);

async function sendWebhook(data) {
  for (const url of webhookURLs) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        agent: httpsAgent
      });
      logger.success(`📤 Webhook terkirim → ${url}`);
    } catch (e) {
      logger.error(`❌ Webhook gagal → ${url} : ${e.message}`);
    }
  }
}

/* ---------- BAILEYS ---------- */
async function connectWA() {
  const { state, saveCreds } = await useMultiFileAuthState(savedSessions);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }) // 🔇 Matikan log JSON bawaan Baileys
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrBase64 = await qrcode.toDataURL(qr);
      logger.info('📱 Menunggu QR Code');
    }
    if (connection === 'open') {
      qrBase64 = null;
      logger.success('📲 Device Berhasil Login');
      const number = sock.user.id.replace('@s.whatsapp.net', '');
      const pushname = sock.user.name ?? '';
      await syncDeviceStatus(number, pushname, 'CONNECTED', JSON.stringify(sock.authState.creds));
    } else if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      logger.warn(`❌ Connection closed ${shouldReconnect ? '→ reconnecting...' : ''}`);
      if (sock?.user?.id) {
        const n = sock.user.id.replace('@s.whatsapp.net', '');
        await syncDeviceStatus(n, null, 'DISCONNECTED');
      }
      if (shouldReconnect) setTimeout(connectWA, 3000);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (msg.key.fromMe || !msg.message) return;
    const cleanNumber = msg.key.remoteJid.replace('@s.whatsapp.net', '');
    logger.event(`📩 Pesan masuk Dari ${cleanNumber}`);
    const type = getMessageType(msg.message);
    await sendWebhook({
      rawJid: msg.key.remoteJid,
      Phone_number: cleanNumber,
      name: msg.pushName || 'Unknown',
      messageId: msg.key.id,
      type: type.type,
      text: type.text,
      caption: type.caption,
      mediaUrl: type.mediaUrl,
      timestamp: new Date().toISOString()
    });
  });

  function getMessageType(msg) {
    if (msg.conversation) return { type: 'text', text: msg.conversation, caption: '', mediaUrl: '' };
    if (msg.imageMessage)
      return { type: 'image', text: msg.imageMessage.caption || '', caption: msg.imageMessage.caption || '', mediaUrl: msg.imageMessage.url || '' };
    if (msg.videoMessage)
      return { type: 'video', text: msg.videoMessage.caption || '', caption: msg.videoMessage.caption || '', mediaUrl: msg.videoMessage.url || '' };
    if (msg.audioMessage)
      return { type: 'audio', text: '', caption: '', mediaUrl: msg.audioMessage.url || '' };
    if (msg.documentMessage)
      return { type: 'document', text: msg.documentMessage.caption || '', caption: msg.documentMessage.caption || '', mediaUrl: msg.documentMessage.url || '' };
    if (msg.stickerMessage)
      return { type: 'sticker', text: '', caption: '', mediaUrl: msg.stickerMessage.url || '' };
    return { type: 'unknown', text: '', caption: '', mediaUrl: '' };
  }
}
connectWA();

/* ---------- AUTH MIDDLEWARE ---------- */
async function auth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && await checkApiKey(apiKey)) return next();

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
  } catch {
    logger.error('❌ Token invalid atau expired');
    res.redirect('/login');
  }
}

/* ---------- ROUTES ---------- */
app.post('/register', async (req, res) => {
  const { user, pass } = req.body;
  if (!user || !pass) return res.status(400).json({ error: 'user & pass required' });
  try {
    const [rows] = await db.execute('SELECT id FROM users WHERE username=?', [user]);
    if (rows.length) return res.status(409).json({ error: 'username taken' });
    const hash = await bcrypt.hash(pass, 12);
    await db.execute('INSERT INTO users(username,password) VALUES(?,?)', [user, hash]);
    res.json({ success: true, msg: 'akun dibuat, silakan login' });
    logger.success(`✅ User baru "${user}" berhasil dibuat`);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/register', (_, res) => res.sendFile(path.resolve('public/register.html')));
app.get('/login', (_, res) => res.sendFile(path.resolve('public/login.html')));
app.get('/', auth, (_, res) => res.sendFile(path.resolve('public/index.html')));
app.post('/login', async (req, res) => {
  const { user, pass } = req.body;
  const usr = await checkUser(user, pass);
  if (!usr) {
    logger.warn(`⚠️ Login gagal untuk user "${user}"`);
    return res.status(401).json({ error: 'invalid creds' });
  }
  const secret = await loadSecret();
  const token = jwt.sign(usr, secret, { expiresIn: '7d' });
  res.json({ token });
  logger.success(`✅ ${user} Berhasil Login`);
});
app.get('/qr', auth, (_, res) => res.json({ qr: qrBase64 }));
app.get('/status', auth, (_, res) => res.json({ online: isWAConnected() }));
app.post('/send', auth, async (req, res) => {
  try {
    const { number, message, type = 'text', options } = req.body;
    const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    let sent;
    if (type === 'text') {
      sent = await sock.sendMessage(jid, { text: message });
      logger.info(`📨 Pesan dikirim ke nomor ${number}`);
    } else if (type === 'image') {
      const buffer = fs.readFileSync(options.path);
      sent = await sock.sendMessage(jid, { image: buffer, caption: message });
      logger.info(`📨 Pesan dikirim ke nomor ${number}`);
    } else if (type === 'poll') {
      sent = await sock.sendMessage(jid, { poll: { name: message, values: options.values } });
      logger.info(`📨 Poll dikirim ke nomor ${number}`);
    } else return res.status(400).json({ error: 'unsupported type' });
    res.json({ success: true, id: sent.key.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/broadcast', auth, async (req, res) => {
  const { numbers, message, delay = 3000 } = req.body;
  const results = [];
  for (const num of numbers) {
    try {
      const jid = num.includes('@') ? num : `${num}@s.whatsapp.net`;
      const sent = await sock.sendMessage(jid, { text: message });
      results.push({ num, status: 'ok', id: sent.key.id });
      logger.info(`📨 Pesan broadcast dikirim ke nomor ${num}`);
    } catch (e) {
      results.push({ num, status: 'fail', error: e.message });
    }
    await new Promise(r => setTimeout(r, delay));
  }
  res.json({ results });
});
app.get('/device', auth, async (_, res) => {
  const [rows] = await db.execute(
    'SELECT number,pushname,status,accesstoken FROM devices ORDER BY updated_at DESC LIMIT 1'
  );
  res.json(
    rows.length
      ? rows[0]
      : { number: null, pushname: null, status: 'DISCONNECTED', accesstoken: null }
  );
});
app.delete('/session', auth, async (req, res) => {
  try {
    if (sock?.user) {
      await sock.logout();
      logger.success(`❌ ${sock.user.id.replace('@s.whatsapp.net','')} Berhasil Logout`);
    }
    sock = null;
    qrBase64 = null;
    rmSync(savedSessions, { recursive: true, force: true });
    logger.success('🗑️ Device berhasil dihapus');
    connectWA();
    res.json({ success: true, msg: 'Session dihapus – tunggu QR baru' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- INIT ---------- */
await seedAdmin();
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server listening on http://127.0.0.1:${PORT}`);
});
