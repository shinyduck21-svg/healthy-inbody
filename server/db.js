const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 30000 // 30초 타임아웃
});

// DB 초기화: 테이블 생성 및 기본 관리자 계정 생성
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        gender TEXT CHECK(gender IN ('M', 'F')),
        birth_date TEXT,
        phone TEXT,
        memo TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inbody_records (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        measured_at TEXT NOT NULL,
        weight REAL,
        skeletal_muscle REAL,
        body_fat REAL,
        body_fat_pct REAL,
        bmi REAL,
        bmr REAL,
        visceral_fat INTEGER,
        arm_right REAL,
        arm_left REAL,
        torso REAL,
        leg_right REAL,
        leg_left REAL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 기본 관리자 계정 생성
    const existing = await client.query('SELECT id FROM admins WHERE username = $1', ['admin']);
    if (existing.rowCount === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await client.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
      console.log('✅ 기본 관리자 계정 생성: admin / admin123');
    }

    console.log('✅ PostgreSQL(Supabase) DB 초기화 완료');
  } catch (err) {
    console.error('DB 초기화 오류:', err);
    throw err;
  } finally {
    client.release();
  }
}

// 단건 조회
async function get(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

// 목록 조회
async function all(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

// INSERT / UPDATE / DELETE
async function run(sql, params = []) {
  const result = await pool.query(sql, params);
  return {
    lastInsertRowid: result.rows[0]?.id || null,
    changes: result.rowCount
  };
}

module.exports = { get, all, run, initDB };
