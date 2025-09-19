/* ----------  CEK TOKEN  ---------- */
const token = localStorage.getItem('token');
if (!token) {
  location.href = '/login';
  throw new Error('no_token');   // hentikan eksekusi lebih lanjut
}

/* ----------  REQUEST HELPER ---------- */
const authHeader = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

async function api(url, opt = {}) {
  opt.headers = { ...authHeader, ...opt.headers };
  const res = await fetch(url, opt);
  if (res.status === 401) {          // token expired / missing
    localStorage.removeItem('token');
    location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

/* ----------  FUNGSI UMUM  ---------- */
function logout() {
  localStorage.removeItem('token');
  location.href = '/login';
}
function scrollToId(id) {
  document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
}
function log(msg) {
  const box = document.getElementById('log');
  box.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + box.textContent;
}

/* ----------  KIRIM PESAN  ---------- */
async function send(type) {
  const number = document.getElementById('number').value;
  const text   = document.getElementById('text').value;
  const body   = { number, message: text, type };

  if (type === 'poll') {
    const values = prompt('Pilihan polling (pisah koma):', 'Ya,Tidak').split(',');
    body.options = { values };
  }
  if (type === 'image') {
    const file = document.getElementById('file').files[0];
    if (!file) return alert('Pilih gambar dulu');
    body.options = { path: file.path };
  }

  try {
    const out = await api('/send', { method: 'POST', body: JSON.stringify(body) });
    log(`Kirim: ${out.success ? 'ok' : out.error}`);
  } catch (e) {
    log('Gagal kirim: ' + e.message);
  }
}

/* ----------  BROADCAST  ---------- */
async function broadcast() {
  const nums = document.getElementById('bcnumbers').value.split(',').map(v => v.trim());
  const msg  = document.getElementById('bcmsg').value;
  try {
    const out = await api('/broadcast', {
      method: 'POST',
      body: JSON.stringify({ numbers: nums, message: msg, delay: 3000 })
    });
    log(`Broadcast: ${out.results.length} pesan`);
  } catch (e) {
    log('Gagal broadcast: ' + e.message);
  }
}

/* ----------  POLLING QR / STATUS / DEVICE  ---------- */
setInterval(async () => {
  try {
    const data = await api('/qr');
    const qrBox = document.getElementById('qrbox');
    if (data.qr) {
      qrBox.classList.remove('hidden');
      const canvas = document.getElementById('qrcanvas');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
      };
      img.src = data.qr;
    } else {
      qrBox.classList.add('hidden');
    }
  } catch (e) {
    console.warn('Gagal polling QR:', e.message);
  }
}, 3000);

setInterval(async () => {
  try {
    const data = await api('/status');
    document.getElementById('status').textContent = data.online ? '✅ Online' : '❌ Offline';
  } catch (e) {
    console.warn('Gagal polling status:', e.message);
  }
}, 5000);

setInterval(async () => {
  try {
    const dev = await api('/device');
    document.getElementById('deviceNumber').textContent = dev.number || 'Not paired';
    document.getElementById('deviceStatus').textContent = dev.status === 'CONNECTED' ? '✅' : '❌';
  } catch (e) {
    console.warn('Gagal polling device:', e.message);
  }
}, 5000);

/* ----------  HAPUS SESSION  ---------- */
async function deleteSession() {
  if (!confirm('Yakin hapus session? WA akan logout & QR muncul kembali.')) return;
  try {
    log('Menghapus session…');
    const out = await api('/session', { method: 'DELETE' });
    log(out.success ? 'Session terhapus – tunggu QR baru' : out.error);

    /* bersihkan tampilan lalu request QR segera */
    document.getElementById('qrbox').classList.add('hidden');
    document.getElementById('qrstatus').textContent = 'Menghubungkan…';

    setTimeout(async () => {
      try {
        const { qr } = await api('/qr');
        if (qr) {
          document.getElementById('qrbox').classList.remove('hidden');
          const img = new Image();
          img.onload = () => {
            const c = document.getElementById('qrcanvas');
            c.width = img.width;
            c.height = img.height;
            c.getContext('2d').drawImage(img, 0, 0);
          };
          img.src = qr;
        }
      } catch (e) {
        console.warn('Gagal langsung ambil QR:', e.message);
      }
    }, 1000);
  } catch (e) {
    log('Gagal hapus session: ' + e.message);
  }
}

/* ----------  ATTACH LISTENER  ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('delSessionBtn');
  if (btn) btn.addEventListener('click', deleteSession);
  else console.error('Elemen #delSessionBtn tidak ditemukan');
});