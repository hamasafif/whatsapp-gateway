// models/sessionModel.js
const pool = require('../db');

async function getSession() {
          const [rows] = await pool.query('SELECT data FROM sessions LIMIT 1');
          if (!rows || rows.length === 0) return null;
          try {
                    return JSON.parse(rows[0].data);
          } catch {
                    return null;
          }
}

async function saveSession(sessionObj) {
          if (!sessionObj) {
                    console.warn("⚠️ Attempted to save empty session");
                    return;
          }
          const data = JSON.stringify(sessionObj);
          console.log("🧩 Session JSON length:", data.length);
          const [rows] = await pool.query("SELECT id FROM sessions LIMIT 1");
          if (rows.length === 0) {
                    await pool.query("INSERT INTO sessions (data, updated_at) VALUES (?, NOW())", [data]);
          } else {
                    await pool.query("UPDATE sessions SET data=?, updated_at=NOW() WHERE id=?", [data, rows[0].id]);
          }
}


module.exports = { getSession, saveSession };
