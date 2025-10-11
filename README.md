# 📱 WhatsApp Gateway — Node.js + LocalAuth + Web UI

Gateway WhatsApp modern berbasis **Node.js**, **Express**, dan **whatsapp-web.js**.  
Dilengkapi **UI realtime**, **integrasi webhook (n8n)**, serta **penyimpanan pesan di MySQL**.

---

## 🚀 Fitur Utama

✅ **LocalAuth Session (tanpa database)** — aman & auto-login  
✅ **UI modern** dengan log realtime & animasi emoji  
✅ **QR hilang otomatis saat client READY**  
✅ **Hapus session & QR muncul otomatis kembali**  
✅ **Hapus chat logs langsung dari UI**  
✅ **Kirim & terima pesan (realtime)**  
✅ **Integrasi webhook n8n (TEST & PROD)**  
✅ **Auto-restart & logging dengan PM2**  
✅ **Kompatibel Windows, Ubuntu, & Docker**

---

## 🧩 Teknologi Utama

| Komponen | Deskripsi |
|-----------|------------|
| [Node.js](https://nodejs.org) | Runtime utama |
| [Express](https://expressjs.com) | REST API & Web Server |
| [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) | Library WhatsApp Web |
| [Socket.IO](https://socket.io) | Realtime komunikasi |
| [MySQL](https://www.mysql.com) | Penyimpanan pesan |
| [PM2](https://pm2.keymetrics.io/) | Process manager untuk Node.js |

---

## ⚙️ Instalasi di Linux (Ubuntu)

### 1️⃣ Persiapan System Dependencies

Puppeteer membutuhkan Chromium dan beberapa library sistem agar bisa berjalan.  
Jalankan perintah berikut sebelum `npm install`:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y wget unzip git curl

# 🧩 Dependencies Chromium untuk Puppeteer
sudo apt install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libx11-xcb1 \
  libxcb-dri3-0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libxshmfence1 \
  libgtk-3-0 \
  libdrm2 \
  libpangocairo-1.0-0 \
  libpango-1.0-0 \
  libcups2 \
  libxkbcommon0 \
  libxext6
```

---

### 2️⃣ Clone Repository & Install Dependencies

```bash
git clone https://github.com/hamasafif/whatsapp-gateway.git
cd whatsapp-gateway
npm install
```

---

### 3️⃣ Buat File `.env`

Buat file bernama `.env` di root folder project:

```bash
PORT=3000

DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=wagateway

WEBHOOK_TOKEN=rahasia123
N8N_WEBHOOK_TEST=https://example.com/webhook-test
N8N_WEBHOOK_PROD=https://example.com/webhook-prod
```

---

### 4️⃣ Setup Database MySQL

```bash
mysql -u root -p
```

```sql
CREATE DATABASE IF NOT EXISTS wagateway;
USE wagateway;

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_number VARCHAR(255),
  to_number VARCHAR(255),
  body TEXT,
  message_id VARCHAR(255),
  is_group BOOLEAN DEFAULT 0,
  direction VARCHAR(20),
  source VARCHAR(50) DEFAULT 'UNKNOWN',
  raw LONGTEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 5️⃣ Menjalankan Aplikasi (Development)

```bash
npm run dev
```

Atau:

```bash
node server.js
```

Buka di browser:  
👉 http://localhost:3000

---

### 6️⃣ Menjalankan dengan PM2 (Production)

```bash
sudo npm install -g pm2
```

```js
module.exports = {
  apps: [
    {
      name: "whatsapp-gateway",
      script: "server.js",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

### 7️⃣ Tes API Kirim Pesan via Postman / n8n

```
POST http://localhost:3000/webhook/send
```

Header:

```
Content-Type: application/json
```

Body JSON:

```json
{
  "token": "rahasia123",
  "number": "6288888888888",
  "message": "Halo dari n8n 🚀"
}
```

---

### 8️⃣ Hapus Session atau Chat Logs

```bash
POST http://localhost:3000/api/clear-logs
POST http://localhost:3000/api/clear-session
```

---

## 🔐 Tips Keamanan

- Gunakan firewall / reverse proxy (Nginx)
- Ganti `WEBHOOK_TOKEN` secara berkala
- Gunakan HTTPS di production
- Tambahkan `.env`, `.wwebjs_auth/`, dan `/node_modules/` ke `.gitignore`

---

## 💬 Workflow n8n (Contoh Request)

| Field | Value |
|--------|--------|
| Method | POST |
| URL | http://<IP_SERVER>:3000/webhook/send |
| Authentication | None |
| Headers | Content-Type: application/json |
| Body Type | JSON |

Body JSON:

```json
{
  "token": "rahasia123",
  "number": "6288888888888",
  "message": "Halo dari n8n 🚀"
}
```

---

## 💙 Kontribusi

Pull request sangat diterima!  
Silakan fork project ini dan bantu kembangkan fitur seperti multi-device, multi-session, dan auto-reply via n8n/AI.

---

## 🧾 Lisensi

MIT License © 2025 — [yourusername](https://github.com/yourusername)
