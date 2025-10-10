# 📱 WhatsApp Gateway — Node.js + LocalAuth + Web UI

Gateway WhatsApp modern berbasis **Node.js**, **Express**, dan **whatsapp-web.js**.  
Dilengkapi **UI realtime**, **integrasi webhook (n8n)**, serta **penyimpanan pesan di MySQL**.

---

## 🚀 Fitur Utama

✅ **LocalAuth Session (tanpa database)** — aman & auto-login  
✅ **UI modern** dengan log realtime & animasi emoji  
✅ **Hapus session & QR muncul otomatis kembali**  
✅ **Hapus chat logs langsung dari UI**  
✅ **Kirim & terima pesan (realtime)**  
✅ **Integrasi webhook n8n / API eksternal**  
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

## ⚙️ Instalasi Lokal (Windows / Linux)

### 1️⃣ Clone Repository
```bash
git clone https://github.com/yourusername/whatsapp-gateway.git
cd whatsapp-gateway
npm install
```

## Buat.env
```bash
PORT=3000
DB_HOST=localhost
DB_USER=wrjunior
DB_PASS=Hamas@fif13
DB_NAME=wagateway
N8N_WEBHOOK=https://example.com/webhook

```

## Setup Database
```bash
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

## Menjalankan Aplikasi
```bash

npm run dev

```