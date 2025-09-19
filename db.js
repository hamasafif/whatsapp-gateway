/* db.js */
import mysql from 'mysql2/promise';
const pool = mysql.createPool({
  host            : 'localhost',
  user            : 'wrjunior',
  password        : 'Hamas@fif13',
  database        : 'wagateway',
  waitForConnections : true,
  connectionLimit    : 10
});
export default pool;