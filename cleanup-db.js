require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function cleanup() {
    const client = await pool.connect();
    try {
        console.log('⏳ 중복 데이터 정리 시작...');

        // 1. 중복 회원 정리 (이름, 전화번호 동일 시 최신 ID만 남기고 삭제)
        // 최신 ID를 찾기 위해 ctid 또는 id 사용
        const memberCleanup = await client.query(`
      DELETE FROM members
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM members
        GROUP BY name, phone
      )
      RETURNING id, name;
    `);
        console.log(`✅ 중복 회원 ${memberCleanup.rowCount}명 삭제 완료.`);

        // 2. 중복 인바디 기록 정리 (동일 회원, 동일 측정일 시 최신 ID만 남기고 삭제)
        const inbodyCleanup = await client.query(`
      DELETE FROM inbody_records
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM inbody_records
        GROUP BY member_id, measured_at
      )
      RETURNING id;
    `);
        console.log(`✅ 중복 인바디 기록 ${inbodyCleanup.rowCount}개 삭제 완료.`);

        // 3. (옵션) 유니크 인덱스 추가하여 향후 중복 방지
        console.log('⏳ 중복 방지 제약 조건 추가 중...');
        try {
            await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_members_unique ON members(name, phone);');
            await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_inbody_unique ON inbody_records(member_id, measured_at);');
            console.log('✅ 중복 방지 제약 조건(Unique Index) 추가 완료.');
        } catch (e) {
            console.log('ℹ️ 제약 조건 추가 건너뜀 (이미 존재하거나 다른 이유):', e.message);
        }

    } catch (err) {
        console.error('❌ 정리 중 오류 발생:', err.message);
    } finally {
        client.release();
        await pool.end();
        console.log('👋 작업 완료.');
    }
}

cleanup();
