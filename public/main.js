// public/main.js
const socket = io();

const statusBadge = document.getElementById('statusBadge');
const qrArea = document.getElementById('qrArea');
const logList = document.getElementById('logList');
const sendBtn = document.getElementById('sendBtn');
const inputNumber = document.getElementById('number');
const inputMessage = document.getElementById('message');
const clearBtn = document.getElementById('clearBtn');

function escapeHtml(s = '') {
          return String(s)
                    .replaceAll('&', '&amp;')
                    .replaceAll('<', '&lt;')
                    .replaceAll('>', '&gt;');
}

function formatTime(ts) {
          try {
                    const d = new Date(ts * 1000);
                    if (isNaN(d)) return new Date(ts).toLocaleString();
                    return d.toLocaleString();
          } catch {
                    return new Date().toLocaleString();
          }
}

function addMessageToList(payload, toEnd = true) {
          const li = document.createElement('li');
          li.className = payload.direction === 'outgoing' ? 'outgoing' : 'incoming';

          const meta = document.createElement('div');
          meta.className = 'meta';

          // Tambahkan sumber pesan (kalau ada)
          const sourceLabel = payload.source ? ` · ${payload.source}` : '';

          meta.textContent = `${payload.from || ''} → ${payload.to || ''}${sourceLabel} · ${formatTime(payload.timestamp || Date.now() / 1000)}`;

          const body = document.createElement('div');
          body.className = 'body';
          body.innerHTML = escapeHtml(payload.body || '');

          li.appendChild(body);
          li.appendChild(meta);

          if (toEnd) logList.appendChild(li); else logList.prepend(li);
          logList.scrollTop = logList.scrollHeight;
}


// socket events
socket.on('connect', () => console.log('socket connected'));
socket.on('qr', dataUrl => {
          qrArea.innerHTML = `<img src="${dataUrl}" alt="QR Code" />`;
          statusBadge.textContent = 'Scan QR untuk login 📱';
});
socket.on('status', (status) => {
          const map = {
                    READY: 'Terhubung ✅',
                    AUTHENTICATED: 'Terverifikasi 🔐',
                    AUTH_FAILURE: 'Gagal autentikasi ❌',
                    QR_RECEIVED: 'QR diterima — scan sekarang 📸',
                    SESSION_RESET: 'Session direset 🔄, menunggu QR...',
                    LOGS_CLEARED: 'Semua chat logs dihapus 🧹',
          };

          // Ubah teks status
          statusBadge.textContent = map[status] || status;

          // Hilangkan QR jika sudah login
          if (status === "READY" || status === "AUTHENTICATED") {
                    qrArea.classList.add("fade-out");
                    setTimeout(() => {
                              qrArea.innerHTML = "";
                              qrArea.classList.remove("fade-out");
                    }, 600); // waktu animasi 0.6 detik
          }

          // Tampilkan QR kosong saat session direset
          if (status === "SESSION_RESET") {
                    qrArea.innerHTML = "";
          }
});

socket.on('message', payload => {
          addMessageToList(payload, true);
});

// load recent logs on page load
(async function loadRecent() {
          try {
                    const res = await fetch('/api/recent');
                    if (!res.ok) return;
                    const rows = await res.json();
                    // recent rows come DESC order; we want oldest first
                    rows.reverse().forEach(r => addMessageToList({
                              from: r.from_number || r.from,
                              to: r.to_number || r.to,
                              body: r.body,
                              timestamp: Math.floor(new Date(r.created_at || r.timestamp || Date.now()).getTime() / 1000),
                              direction: r.direction || (r.from_number ? 'incoming' : 'outgoing')
                    }, true));
          } catch (e) {
                    console.error('Failed to load recent logs', e);
          }
})();

// send message
sendBtn.addEventListener('click', async () => {
          const number = inputNumber.value.trim();
          const message = inputMessage.value.trim();
          if (!number || !message) {
                    alert('Nomor dan pesan wajib diisi!');
                    return;
          }

          sendBtn.disabled = true;
          sendBtn.textContent = 'Mengirim... 🚀';

          try {
                    const res = await fetch('/api/send', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ number, message })
                    });

                    if (!res.ok) {
                              const err = await res.json().catch(() => ({ error: 'Unknown' }));
                              alert('Gagal mengirim: ' + (err.error || res.statusText));
                    } else {
                              inputMessage.value = '';
                              // optional: optimistic UI — actual outgoing will be emitted by server
                    }
          } catch (e) {
                    alert('Gagal mengirim: ' + e.message);
          } finally {
                    sendBtn.disabled = false;
                    sendBtn.textContent = 'Kirim ✉️';
          }
});

// clear session
clearBtn.addEventListener('click', async () => {
          if (!confirm('Hapus session WhatsApp? Kamu harus scan QR ulang setelah ini.')) return;

          clearBtn.disabled = true;
          clearBtn.textContent = 'Menghapus...';

          try {
                    const res = await fetch('/api/clear-session', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                    if (res.ok) {
                              statusBadge.textContent = 'Session dihapus — menunggu QR baru...';
                              qrArea.innerHTML = '';
                    } else {
                              const err = await res.json().catch(() => ({ error: 'Unknown' }));
                              alert('Gagal menghapus session: ' + (err.error || 'error'));
                    }
          } catch (e) {
                    alert('Gagal menghapus session: ' + e.message);
          } finally {
                    clearBtn.disabled = false;
                    clearBtn.textContent = '🗑️ Hapus Session';
          }
});

// Hapus semua chat logs
const clearLogsBtn = document.getElementById("clearLogsBtn");

clearLogsBtn.addEventListener("click", async () => {
          if (!confirm("Hapus semua riwayat chat?")) return;

          clearLogsBtn.disabled = true;
          clearLogsBtn.textContent = "Menghapus...";

          try {
                    const res = await fetch("/api/clear-logs", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                    });

                    if (res.ok) {
                              logList.innerHTML = "";
                              statusBadge.textContent = "Semua chat logs telah dihapus 🧹";
                    } else {
                              const err = await res.json();
                              alert("Gagal menghapus logs: " + err.error);
                    }
          } catch (e) {
                    alert("Gagal menghapus logs: " + e.message);
          } finally {
                    clearLogsBtn.disabled = false;
                    clearLogsBtn.textContent = "🧹 Hapus Chat Logs";
          }
});

// Tampilkan notifikasi jika logs dihapus dari tempat lain
socket.on("status", (status) => {
          if (status === "LOGS_CLEARED") {
                    logList.innerHTML = "";
                    statusBadge.textContent = "Semua chat logs dihapus 🧹";
          }
});

