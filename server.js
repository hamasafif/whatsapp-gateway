/**
 * WhatsApp Gateway v2 — Dual Webhook Edition
 * Author: @wrjunior (2025)
 */

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

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static("public"));
app.use(bodyParser.json());

const N8N_WEBHOOK = process.env.N8N_WEBHOOK || "";
const AUTH_DIR = path.join(__dirname, ".wwebjs_auth");

let client = null;
let clientReady = false;

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
         clientId: "wagateway",
         dataPath: AUTH_DIR,
      }),
      puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
   });

   client.on("qr", async (qr) => {
      const qrImage = await qrcode.toDataURL(qr);
      io.emit("qr", qrImage);
      io.emit("status", "QR_RECEIVED");
      console.log("📱 QR code emitted to UI");
   });

   client.on("authenticated", () => {
      console.log("🔐 Authenticated via LocalAuth");
      io.emit("status", "AUTHENTICATED");
   });

   client.on("ready", () => {
      clientReady = true;
      console.log("✅ WhatsApp Client READY");
      io.emit("status", "READY");
   });

   client.on("auth_failure", (msg) => {
      console.error("❌ Authentication failure:", msg);
      io.emit("status", "AUTH_FAILURE");
   });

   // 💬 Terima pesan masuk
   // 💬 Terima pesan masuk
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
         // Simpan ke DB & broadcast ke UI
         await saveMessage(payload);
         io.emit("message", payload);
         console.log(`💬 [INCOMING] ${msg.from}: ${msg.body}`);

         // Kirim ke N8N test dan production (jika diatur)
         const testWebhook = process.env.N8N_WEBHOOK_TEST;
         const prodWebhook = process.env.N8N_WEBHOOK_PROD;

         const requests = [];

         if (testWebhook) {
            requests.push(
               axios.post(testWebhook, { ...payload, source: "WEBHOOK_TEST" }).catch((err) => {
                  console.warn(`⚠️ Failed send to TEST webhook: ${err.message}`);
               })
            );
         }

         if (prodWebhook) {
            requests.push(
               axios.post(prodWebhook, { ...payload, source: "WEBHOOK_PROD" }).catch((err) => {
                  console.warn(`⚠️ Failed send to PROD webhook: ${err.message}`);
               })
            );
         }

         // Jalankan paralel
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

// 🟢 Jalankan client pertama kali
initClient();

/**
 * 🧩 Fungsi umum untuk handle dua webhook
 */
async function handleWebhookSend(req, res, sourceLabel) {
   try {
      const { number, message, token } = req.body;

      // 🔐 Token optional
      if (process.env.WEBHOOK_TOKEN) {
         if (!token || token !== process.env.WEBHOOK_TOKEN) {
            console.warn(`🚫 Unauthorized ${sourceLabel} request`);
            return res.status(403).json({ success: false, error: "Unauthorized: Invalid token" });
         }
      }

      // 🧾 Validasi input
      if (!number || !message) {
         return res.status(400).json({
            success: false,
            error: "Nomor dan pesan wajib diisi",
         });
      }

      if (!clientReady) {
         return res.status(503).json({
            success: false,
            error: "Client WhatsApp belum siap. Tunggu status READY.",
         });
      }

      // 🔢 Normalisasi nomor
      const cleanNumber = number.toString().replace(/\D/g, "");
      const chatId = cleanNumber.includes("@g.us") ? cleanNumber : `${cleanNumber}@c.us`;

      // 🚀 Kirim pesan
      const sentMsg = await client.sendMessage(chatId, message);

      // 💾 Payload
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

      console.log(`🌐 [${sourceLabel}] ${cleanNumber}: "${message}"`);

      res.status(200).json({
         success: true,
         message: `Pesan berhasil dikirim (${sourceLabel})`,
         data: payload,
      });
   } catch (err) {
      console.error(`❌ ${sourceLabel} error:`, err.message);
      res.status(500).json({
         success: false,
         error: err.message,
      });
   }
}

/**
 * 🌐 Webhook Production (utama)
 */
app.post("/webhook/send", (req, res) => handleWebhookSend(req, res, "WEBHOOK_PROD"));

/**
 * 🌐 Webhook Testing (sandbox)
 */
app.post("/webhook/test", (req, res) => handleWebhookSend(req, res, "WEBHOOK_TEST"));

/**
 * 🧹 Bersihkan Chat Logs
 */
app.post("/api/clear-logs", async (req, res) => {
   try {
      console.log("🧹 Clearing chat logs...");
      await pool.query("DELETE FROM messages");
      io.emit("status", "LOGS_CLEARED");
      res.json({ success: true });
   } catch (err) {
      console.error("❌ Failed to clear logs:", err.message);
      res.status(500).json({ error: err.message });
   }
});

/**
 * 🗑️ Hapus Session WhatsApp (LocalAuth)
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
         console.log("✅ LocalAuth session folder deleted");
      }

      setTimeout(() => {
         initClient();
         io.emit("status", "SESSION_RESET");
      }, 2000);

      res.json({ success: true });
   } catch (err) {
      console.error("❌ Failed to clear session:", err.message);
      res.status(500).json({ error: err.message });
   }
});

/**
 * 🧾 Ambil log pesan terakhir
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
 * 📤 Kirim pesan manual dari UI
 */
app.post("/api/send", async (req, res) => {
   try {
      const { number, message } = req.body;
      if (!number || !message)
         return res.status(400).json({ error: "Nomor dan pesan wajib diisi" });
      if (!clientReady)
         return res.status(503).json({ error: "Client belum siap. Tunggu READY." });

      const chatId = `${number.replace(/\D/g, "")}@c.us`;
      const sentMsg = await client.sendMessage(chatId, message);

      const payload = {
         from: "me",
         to: chatId,
         body: message,
         id: sentMsg.id._serialized,
         direction: "outgoing",
         source: "WEB_UI",
         timestamp: Date.now(),
      };

      await saveMessage(payload);
      io.emit("message", payload);
      console.log(`📤 [WEB_UI] ${number}: ${message}`);

      res.json({ success: true });
   } catch (err) {
      console.error("❌ Error send message:", err.message);
      res.status(500).json({ error: err.message });
   }
});

/**
 * ⚡ Socket.IO Connection
 */
io.on("connection", (socket) => {
   console.log("🌐 UI connected");
   socket.on("ping", () => socket.emit("pong"));
});

/**
 * 🚀 Start Server
 */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
