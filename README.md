# 🚀 WhatsApp Gateway PM2 (Baileys)

A tiny, full-featured WhatsApp REST API using Baileys – no official API key needed!

&gt; ✨ Web UI, JWT/X-Api-Key auth, auto-reconnect, webhook, broadcast, poll & media sender – all in one repo.

---

## 📦 Fitur Cepat
- 🔐 Dual auth → JWT (web) **or** X-Api-Key (n8n/Postman)
- 🖥️ Web dashboard → QR live, send text/image/poll/broadcast
- 🔄 Auto-reconnect & session manager
- 🌐 Outgoing webhook → n8n, Zapier, etc
- 📁 `.env` based → zero hard-coded credential
- 🧑‍🎓 Simple register → buat akun sendiri
- ⚡ PM2 ready → run on boot, auto-restart

---

## 🏃‍♂️ Install & Run (Debian/Ubuntu)
```bash
# 1. Install Node 20 + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm i -g pm2

# 2. Clone & masuk
git clone https://github.com/YOUR_USER/wa-gateway.git
cd wa-gateway

# 3. Install deps
npm install

# 4. Isi .env (ikut template .env.example)
cp .env.example .env
nano .env
# ---- isi DB & webhook kamu ----

# 5. Buat DB (sekali)
sudo mariadb -u root -p &lt; sql/init.sql

# 6. Jalankan!
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
```
Buka http://ip-kamu:5001 → klik "Buat akun" → scan QR → ✅ online!

🔑 API Examples
Send message:
```bash
curl -X POST http://localhost:5001/send \
  -H "X-Api-Key: 1234567890abcdef" \
  -H "Content-Type: application/json" \
  -d '{"number":"628xxx@s.whatsapp.net","message":"Halo dari 🖥️"}'
```

🔧 Environment Variables
| Var          | Example                              | Note              |
| ------------ | ------------------------------------ | ----------------- |
| DB\_HOST     | localhost                            |                   |
| DB\_USER     | root                                 |                   |
| DB\_PASS     | s3cr3t                               |                   |
| DB\_NAME     | wagateway                            |                   |
| PORT         | 5001                                 |                   |
| WEBHOOK\_URL | <https://n8n.kamu.id/webhook>        | untuk pesan masuk |
| JWT\_SECRET  | 550e8400-e29b-41d4-a716-446655440000 | UUID bebas        |


📊 PM2 Everyday
```
pm2 list                 # lihat proses
pm2 logs wa-gateway      # tail log
pm2 restart wa-gateway   # restart setelah update
pm2 flush                # kosongkan log
```

🧑‍💻 Development
```
npm run dev       # alias: node server.js
```

🐛 Troubleshoot
QR tidak muncul → hapus folder sessions lalu restart.
Webhook gagal → pastikan URL bisa di-curl dari server; untuk SSL self-signed tambahkan rejectUnauthorized: false di .env → WEBHOOK_SKIP_SSL=true.
Table tidak ada → jalankan lagi sql/init.sql.

📄 Lisensi
MIT – bebas pakai & modifikasi.
⭐ Star repo ini kalau berguna!

Happy chatting! 💬🎉
