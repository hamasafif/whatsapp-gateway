// server.js — FINAL VERSION (LocalAuth + Stable Features)
const express = require('express');
const http = require('http');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = require('./db');
const { saveMessage, listRecent } = require('./models/messageModel');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(express.static('public'));
app.use(bodyParser.json());

const N8N_WEBHOOK = process.env.N8N_WEBHOOK || '';
const AUTH_DIR = path.join(__dirname, '.wwebjs_auth');
let client = null;
let clientReady = false;

/**
 * Initialize WhatsApp Client (LocalAuth)
 */
async function initClient() {
          if (client) {
                    try {
                              client.removeAllListeners();
                              await client.destroy();
                              console.log('♻️ Old client destroyed');
                    } catch (e) {
                              console.warn('Error destroying old client:', e.message);
                    }
          }

          console.log('🚀 Initializing WhatsApp Client with LocalAuth...');
          client = new Client({
                    authStrategy: new LocalAuth({
                              clientId: 'wagateway',
                              dataPath: AUTH_DIR, // tempat penyimpanan session
                    }),
                    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
          });

          // 🧩 Event: QR muncul
          client.on('qr', async (qr) => {
                    const qrImage = await qrcode.toDataURL(qr);
                    io.emit('qr', qrImage);
                    io.emit('status', 'QR_RECEIVED');
                    console.log('📱 QR code emitted to UI');
          });

          // 🧩 Event: berhasil login
          client.on('authenticated', () => {
                    console.log('🔐 Authenticated via LocalAuth');
                    io.emit('status', 'AUTHENTICATED');
          });

          // 🧩 Event: siap digunakan
          client.on('ready', () => {
                    clientReady = true;
                    console.log('✅ WhatsApp Client READY');
                    io.emit('status', 'READY');
          });

          // 🧩 Event: gagal login
          client.on('auth_failure', (msg) => {
                    console.error('❌ Authentication failure:', msg);
                    io.emit('status', 'AUTH_FAILURE');
          });

          // 🧩 Event: terima pesan
          client.on('message', async (msg) => {
                    const payload = {
                              from: msg.from,
                              to: msg.to,
                              body: msg.body,
                              id: msg.id._serialized,
                              isGroupMsg: !!msg.isGroupMsg,
                              direction: 'incoming',
                              timestamp: msg.timestamp,
                    };

                    try {
                              await saveMessage(payload);
                              io.emit('message', payload);
                              console.log(`💬 Message from ${msg.from}: ${msg.body}`);
                              if (N8N_WEBHOOK) await axios.post(N8N_WEBHOOK, payload);
                    } catch (err) {
                              console.error('saveMessage error:', err.message);
                    }
          });

          await client.initialize();
}

// 🚀 Jalankan Client
initClient();

/* =======================
   API ROUTES
======================= */

// Ambil log pesan
app.get('/api/recent', async (req, res) => {
          try {
                    const rows = await listRecent(100);
                    res.json(rows);
          } catch (err) {
                    res.status(500).json({ error: err.message });
          }
});

// Kirim pesan
// 📤 Kirim pesan dari Web UI atau Webhook eksternal
app.post('/api/send', async (req, res) => {
          try {
                    const { number, message, source } = req.body;
                    if (!number || !message)
                              return res.status(400).json({ error: 'Nomor dan pesan wajib diisi' });
                    if (!clientReady)
                              return res.status(503).json({ error: 'Client belum siap. Tunggu READY.' });

                    const chatId = `${number.replace(/\D/g, '')}@c.us`;
                    const sentMsg = await client.sendMessage(chatId, message);

                    const payload = {
                              from: 'me',
                              to: chatId,
                              body: message,
                              id: sentMsg.id._serialized,
                              direction: 'outgoing',
                              source: source || 'WEB_UI', // 📋 sumber pesan (UI / Webhook / API)
                              timestamp: Date.now(),
                    };

                    // Simpan ke DB & kirim ke UI log
                    await saveMessage(payload);
                    io.emit('message', payload);

                    console.log(`📤 [${payload.source}] ${number}: ${message}`);
                    res.json({ success: true });
          } catch (err) {
                    console.error('Error send message:', err.message);
                    res.status(500).json({ error: err.message });
          }
});

// 🌐 Kirim pesan via Webhook eksternal (misalnya dari n8n)
app.post('/webhook/send', async (req, res) => {
          try {
                    const { number, message } = req.body;
                    if (!number || !message)
                              return res.status(400).json({ error: 'Nomor dan pesan wajib diisi' });
                    if (!clientReady)
                              return res.status(503).json({ error: 'Client belum siap' });

                    const chatId = `${number.replace(/\D/g, '')}@c.us`;
                    const sentMsg = await client.sendMessage(chatId, message);

                    const payload = {
                              from: 'me',
                              to: chatId,
                              body: message,
                              id: sentMsg.id._serialized,
                              direction: 'outgoing',
                              source: 'WEBHOOK',
                              timestamp: Date.now(),
                    };

                    await saveMessage(payload);
                    io.emit('message', payload);
                    console.log(`🌐 [WEBHOOK] ${number}: ${message}`);

                    res.json({ success: true });
          } catch (err) {
                    console.error('❌ Webhook send error:', err.message);
                    res.status(500).json({ error: err.message });
          }
});



// Hapus semua chat logs
app.post('/api/clear-logs', async (req, res) => {
          try {
                    console.log('🧹 Clearing all chat logs...');
                    await pool.query('DELETE FROM messages');
                    io.emit('status', 'LOGS_CLEARED');
                    res.json({ success: true });
          } catch (err) {
                    console.error('❌ Failed to clear logs:', err.message);
                    res.status(500).json({ error: err.message });
          }
});

// Hapus session (hapus folder LocalAuth)
app.post('/api/clear-session', async (req, res) => {
          try {
                    console.log('🗑️ Clearing LocalAuth session...');
                    clientReady = false;
                    if (client) {
                              client.removeAllListeners();
                              await client.destroy();
                              client = null;
                    }

                    const sessionDir = path.join(AUTH_DIR, 'session-wagateway');
                    if (fs.existsSync(sessionDir)) {
                              fs.rmSync(sessionDir, { recursive: true, force: true });
                              console.log('✅ LocalAuth session folder deleted');
                    }

                    setTimeout(() => {
                              initClient(); // QR baru langsung muncul
                              io.emit('status', 'SESSION_RESET');
                    }, 2000);

                    res.json({ success: true });
          } catch (err) {
                    console.error('❌ Failed to clear session:', err.message);
                    res.status(500).json({ error: err.message });
          }
});

// Socket.io connection
io.on('connection', (socket) => {
          console.log('🌐 UI connected');
          socket.on('ping', () => socket.emit('pong'));
});

// Jalankan server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
