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
            ['김민수', 'M', 28, '010-1234-5678', '꾸준히 방문하는 우수 회원'],
            ['이영희', 'F', 32, '010-8765-4321', '체지방 감량이 주 목표'],
            ['박지성', 'M', 41, '010-5555-4444', null]
        ];

        for (const m of members) {
            const res = await client.query(
                'INSERT INTO members (name, gender, age, phone, memo) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name, phone) DO UPDATE SET age = EXCLUDED.age, memo = EXCLUDED.memo RETURNING id',
                m
            );
            const memberId = res.rows[0].id;
            const records = [
                [memberId, '2026-01-15', 78.5, 34.2, 18.5, 23.5, '초기 측정'],
                [memberId, '2026-02-28', 76.2, 35.8, 16.1, 21.1, '근력 증가 및 체지방 감소']
            ];
            for (const r of records) {
                await client.query(`
          INSERT INTO inbody_records 
          (member_id, measured_at, weight, skeletal_muscle, body_fat, body_fat_pct, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (member_id, measured_at) DO NOTHING
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
