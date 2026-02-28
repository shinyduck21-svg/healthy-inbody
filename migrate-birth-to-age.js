require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('⏳ 데이터 마이그레이션 시작 (birth_date → age)...');

        // 1. age 컬럼 추가 (이미 있으면 무시)
        await client.query('ALTER TABLE members ADD COLUMN IF NOT EXISTS age INTEGER;');
        console.log('✅ age 컬럼 추가 완료.');

        // 2. 기존 birth_date를 기반으로 나이 계산하여 업데이트
        // birth_date 형식: YYYY-MM-DD
        const members = await client.query('SELECT id, birth_date FROM members WHERE birth_date IS NOT NULL AND (age IS NULL OR age = 0)');

        console.log(`📊 처리할 회원 수: ${members.rowCount}명`);

        const today = new Date();
        const currentYear = today.getFullYear();

        for (const row of members.rows) {
            try {
                const birth = new Date(row.birth_date);
                let age = currentYear - birth.getFullYear();

                // 만나이 계산 (옵션, 한국식 세는 나이 원하면 +1)
                const m = today.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                    age--;
                }

                await client.query('UPDATE members SET age = $1 WHERE id = $2', [age, row.id]);
            } catch (e) {
                console.error(`⚠️ ID ${row.id}의 생년월일 처리 실패: ${row.birth_date}`);
            }
        }

        console.log('✅ 나이 계산 및 데이터 전송 완료.');

        // 3. (선택 사항) birth_date 컬럼을 삭제하거나 이름을 변경하여 혼선 방지
        // 여기서는 안전을 위해 삭제 대신 컬럼에 주석을 달거나 그대로 둡니다.
        // 사용자가 완전히 필요 없다고 할 경우 ALTER TABLE members DROP COLUMN birth_date 수행 가능.

    } catch (err) {
        console.error('❌ 마이그레이션 중 오류 발생:', err.message);
    } finally {
        client.release();
        await pool.end();
        console.log('👋 작업 완료.');
    }
}

migrate();
