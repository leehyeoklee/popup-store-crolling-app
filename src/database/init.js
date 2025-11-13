const mysql = require('mysql2/promise');

async function createDatabase() {
  // DB 없이 연결 (DB 생성용)
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1q2w3e4r!'  // database.js와 동일한 비밀번호
  });

  try {
    // popup_db 생성
    await connection.query('CREATE DATABASE IF NOT EXISTS popup_db');
    console.log('✅ popup_db 데이터베이스 생성 완료!');
    
    // 사용
    await connection.query('USE popup_db');
    
    // schema.sql 실행
    const fs = require('fs');
    const path = require('path');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    
    const queries = schema.split(';').filter(q => q.trim());
    for (const query of queries) {
      if (query.trim()) {
        await connection.query(query);
      }
    }
    
    console.log('✅ 테이블 생성 완료!');
  } catch (error) {
    console.error('❌ 에러:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n비밀번호가 틀렸습니다. config/database.js의 password를 확인하세요.');
    }
  } finally {
    await connection.end();
  }
}

createDatabase();
