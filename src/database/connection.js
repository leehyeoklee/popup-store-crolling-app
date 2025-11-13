const mysql = require('mysql2/promise');

// DB 연결 설정
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1q2w3e4r!',
  database: process.env.DB_NAME || 'popup_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Connection Pool 생성
let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// DB 연결 테스트
async function testConnection() {
  try {
    const connection = await getPool().getConnection();
    console.log('[OK] MySQL 연결 성공!');
    connection.release();
    return true;
  } catch (error) {
    console.error('[ERROR] MySQL 연결 실패:', error.message);
    return false;
  }
}

module.exports = {
  getPool,
  testConnection
};
