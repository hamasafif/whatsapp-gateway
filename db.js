/* db.js */
import mysql from 'mysql2/promise';
const pool = mysql.createPool({
  host            : 'localhost',
  user            : 'username',
  password        : 'Sup3RPassword!',
  database        : 'wagateway',
  waitForConnections : true,
  connectionLimit    : 10
});
export default pool;
