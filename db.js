// db.js
const mysql = require('mysql2/promise');
require('dotenv').config();


const pool = mysql.createPool({
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'wrjunior',
          password: process.env.DB_PASS || 'Hamas@fif13',
          database: process.env.DB_NAME || 'wagateway',
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0
});


module.exports = pool;