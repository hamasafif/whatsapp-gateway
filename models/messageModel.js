// models/messageModel.js
const pool = require('../db'); // koneksi ke MySQL

/**
 * Simpan pesan ke tabel messages
 */
async function saveMessage(payload) {
          const sql = `
    INSERT INTO messages 
    (from_number, to_number, body, message_id, is_group, direction, raw, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `;
          const raw = JSON.stringify(payload);
          await pool.query(sql, [
                    payload.from || null,
                    payload.to || null,
                    payload.body || null,
                    payload.id || null,
                    payload.isGroupMsg ? 1 : 0,
                    payload.direction || 'incoming',
                    raw,
          ]);
}

/**
 * Ambil pesan terakhir (limit default = 50)
 */
async function listRecent(limit = 50) {
          const [rows] = await pool.query(
                    'SELECT * FROM messages ORDER BY id DESC LIMIT ?',
                    [limit]
          );
          return rows;
}

module.exports = {
          saveMessage,
          listRecent,
};
