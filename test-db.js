require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testConnection() {
    try {
        const res = await pool.query('SELECT count(*) FROM members');
        console.log('Member count:', res.rows[0].count);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

testConnection();
