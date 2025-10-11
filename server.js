const express = require("express");
const http = require("http");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const socketIo = require("socket.io");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const pool = require("./db");
const { saveMessage, listRecent } = require("./models/messageModel");

// 🌐 Express Setup
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });
app.use(express.static("public"));
app.use(bodyParser.json());

// 🔧 ENV Configuration
const AUTH_DIR = path.join(__dirname, ".wwebjs_auth");
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || null;
const N8N_WEBHOOK_TEST = process.env.N8N_WEBHOOK_TEST || "";
const N8N_WEBHOOK_PROD = process.env.N8N_WEBHOOK_PROD || "";

// 🔁 Global Variables
let client = null;
let clientReady = false;

/**
 * 🔢 Membersihkan dan memformat nomor WhatsApp
 * cleanNumber("082228687815") -> "6282228687815@c.us"
 */
function cleanNumber(number) {
  if (!number) return null;

  let clean = number.toString().replace(/\D/g, "");

  // Jika group id
  if (number.endsWith("@g.us")) return number;

  // Awalan 0 → ubah jadi 62
  if (clean.startsWith("0")) {
    clean = "62" + clean.substring(1);
  }

  // Tambahkan domain WhatsApp jika belum ada
  if (!clean.endsWith("@c.us")) {
    clean += "@c.us";
  }

  return clean;
}

/**
 * ✨ Membersihkan tampilan nomor di log & webhook payload
 * 6282228687815@c.us → 6282228687815
 */
function displayNumber(whatsappId) {
  if (!whatsappId) return "";
  return whatsappId.replace("@c.us", "").replace("@g.us", "");
}

/**
 * 🚀 Initialize WhatsApp Client with LocalAuth
 */
async function initClient() {
  if (client) {
    try {
      client.removeAllListeners();
      await client.destroy();
      console.log("♻️ Old client destroyed");
    } catch (e) {
      console.warn("⚠️ Error destroying old client:", e.message);
    }
  }

  console.log("🚀 Initializing WhatsApp Client with LocalAuth...");

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: process.env.SESSION_CLIENT_ID || "wagateway",
      dataPath: AUTH_DIR,
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-infobars",
        "--window-size=1280,800",
        "--single-process",
      ],
    },
  });

  // 📱 QR Code Event
  client.on("qr", async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    io.emit("qr", qrImage);
    io.emit("status", "QR_RECEIVED");
    console.log("📱 QR Code generated, sent to UI.");
  });

  // 🔐 Authenticated
  client.on("authenticated", () => {
    console.log("🔐 Authenticated successfully!");
    io.emit("status", "AUTHENTICATED");
  });

  // ✅ Ready
  client.on("ready", () => {
    clientReady = true;
    io.emit("status", "READY");
    io.emit("qr", null); // 🧩 Hapus QR otomatis saat READY
    console.log("✅ WhatsApp Client is READY.");
  });

  // ❌ Auth Failure
  client.on("auth_failure", (msg) => {
    console.error("❌ Authentication failed:", msg);
    io.emit("status", "AUTH_FAILURE");
  });

  // 💬 Incoming Messages
  client.on("message", async (msg) => {
    const payload = {
      from: msg.from,
      to: msg.to,
      body: msg.body,
      id: msg.id._serialized,
      isGroupMsg: !!msg.isGroupMsg,
      direction: "incoming",
      timestamp: msg.timestamp,
    };

    try {
      await saveMessage(payload);
      io.emit("message", payload);
      console.log(`💬 [INCOMING] ${displayNumber(msg.from)}: ${msg.body}`);

      // 🔧 Bersihkan payload sebelum dikirim ke n8n
      const cleanPayload = {
        ...payload,
        from: displayNumber(payload.from),
        to: displayNumber(payload.to),
        sent_at: new Date().toISOString(),
      };

      // 📤 Kirim ke dua webhook (test + prod)
      const requests = [];
      if (N8N_WEBHOOK_TEST)
        requests.push(
          axios.post(N8N_WEBHOOK_TEST, { ...cleanPayload, source: "WEBHOOK_TEST" }).catch((err) => {
            console.warn(`⚠️ Failed send to TEST webhook: ${err.message}`);
          })
        );
      if (N8N_WEBHOOK_PROD)
        requests.push(
          axios.post(N8N_WEBHOOK_PROD, { ...cleanPayload, source: "WEBHOOK_PROD" }).catch((err) => {
            console.warn(`⚠️ Failed send to PROD webhook: ${err.message}`);
          })
        );

      if (requests.length > 0) {
        await Promise.allSettled(requests);
        console.log(`📤 Forwarded incoming message to ${requests.length} webhook(s)`);
      }
    } catch (err) {
      console.error("❌ saveMessage error:", err.message);
    }
  });

  await client.initialize();
}

/**
 * 🧩 Universal Webhook Sender Handler
 */
async function handleWebhookSend(req, res, sourceLabel) {
  try {
    const { number, message, token } = req.body;

    // 🔐 Token Check
    if (WEBHOOK_TOKEN && token !== WEBHOOK_TOKEN) {
      console.warn("⚠️ Token tidak cocok, tapi dilewati (non-strict mode)");
    }

    // ⚙️ Validasi
    if (!number || !message)
      return res.status(400).json({ success: false, error: "Nomor & pesan wajib diisi" });

    if (!clientReady)
      return res.status(503).json({ success: false, error: "Client WhatsApp belum siap" });

    // 📞 Format nomor
    const chatId = cleanNumber(number);

    // 📤 Kirim pesan
    const sentMsg = await client.sendMessage(chatId, message);

    const payload = {
      from: "me",
      to: chatId,
      body: message,
      id: sentMsg.id._serialized,
      direction: "outgoing",
      source: sourceLabel,
      timestamp: Date.now(),
    };

    await saveMessage(payload);
    io.emit("message", payload);
    console.log(`🌐 [${sourceLabel}] ${displayNumber(chatId)}: "${message}"`);

    res.json({ success: true, data: payload });
  } catch (err) {
    console.error(`❌ ${sourceLabel} error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 🌐 Webhook Production & Test
 */
app.post("/webhook/send", (req, res) => handleWebhookSend(req, res, "WEBHOOK_PROD"));
app.post("/webhook/test", (req, res) => handleWebhookSend(req, res, "WEBHOOK_TEST"));

/**
 * 📤 Kirim Pesan Manual via UI (tanpa token)
 */
app.post("/api/send", async (req, res) => handleWebhookSend(req, res, "WEB_UI"));

/**
 * 🧹 Hapus Semua Chat Logs
 */
app.post("/api/clear-logs", async (req, res) => {
  try {
    await pool.query("DELETE FROM messages");
    io.emit("status", "LOGS_CLEARED");
    console.log("🧹 All chat logs cleared.");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to clear logs:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🗑️ Hapus Session & Reinit Client
 */
app.post("/api/clear-session", async (req, res) => {
  try {
    console.log("🗑️ Clearing LocalAuth session...");
    clientReady = false;
    if (client) {
      client.removeAllListeners();
      await client.destroy();
      client = null;
    }

    const sessionDir = path.join(AUTH_DIR, "session-wagateway");
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log("✅ LocalAuth session deleted");
    }

    setTimeout(() => {
      initClient();
      io.emit("status", "SESSION_RESET");
    }, 1500);

    res.json({ success: true, message: "Session cleared, QR will regenerate" });
  } catch (err) {
    console.error("❌ Failed to clear session:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🧾 Ambil Pesan Terakhir
 */
app.get("/api/recent", async (req, res) => {
  try {
    const rows = await listRecent(100);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ⚡ Socket.IO Connection
 */
io.on("connection", (socket) => {
  console.log("🌐 UI Connected");
  socket.on("ping", () => socket.emit("pong"));
});

/**
 * 🚀 Start Server
 */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  initClient();
});
