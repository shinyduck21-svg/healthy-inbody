const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function resetTable() {
    const client = await pool.connect();
    try {
        console.log('⏳ 기존 inbody_records 테이블 삭제 중...');
        await client.query('DROP TABLE IF EXISTS inbody_records CASCADE;');
        console.log('✅ 테이블 삭제 완료.');

        console.log('⏳ 신규 스키마로 테이블 생성 중...');
        await client.query(`
          CREATE TABLE inbody_records (
            id SERIAL PRIMARY KEY,
            member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            measured_at TEXT NOT NULL,
            weight REAL,
            skeletal_muscle REAL,
            body_fat REAL,
            body_fat_pct REAL,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);
        console.log('✅ 테이블 생성 완료.');
    } catch (err) {
        console.error('❌ 오류 발생:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

resetTable();
