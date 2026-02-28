require('dotenv').config();
const { Pool } = require('pg');
const dns = require('node:dns');

// IPv6가 지원되지 않는 환경에서 Supabase 연결 지연 방지
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

async function seed() {
    console.log('⏳ Connecting to Supabase (IPv4 First)...');
    let client;
    try {
        client = await pool.connect();
        console.log('✅ Connected! Inserting sample data...');

        const members = [
            ['김철수', 'M', '1985-05-20', '010-1111-2222', '꾸준히 운동하시는 회원님'],
            ['이영희', 'F', '1992-11-10', '010-3333-4444', '다이어트 목적으로 등록'],
            ['박민수', 'M', '1978-02-15', '010-5555-6666', '재활 및 근력 강화']
        ];

        for (const m of members) {
            const res = await client.query(
                'INSERT INTO members (name, gender, birth_date, phone, memo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                m
            );
            const memberId = res.rows[0].id;
            const records = [
                [memberId, '2026-01-15', 78.5, 34.2, 18.5, 23.5, 25.1, 1680, 7, '초기 측정'],
                [memberId, '2026-02-28', 76.2, 35.8, 16.1, 21.1, 24.2, 1720, 6, '근력 증가 및 체지방 감소']
            ];
            for (const r of records) {
                await client.query(`
          INSERT INTO inbody_records 
          (member_id, measured_at, weight, skeletal_muscle, body_fat, body_fat_pct, bmi, bmr, visceral_fat, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, r);
            }
        }
        console.log('✅ Sample data inserted successfully!');
    } catch (err) {
        console.error('❌ Error during seeding:', err.message);
    } finally {
        if (client) client.release();
        await pool.end();
        console.log('👋 Database connection closed.');
    }
}

seed();
