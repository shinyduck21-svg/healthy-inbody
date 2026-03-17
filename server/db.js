const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase는 로컬/운영 모두 SSL 필요
  connectionTimeoutMillis: 30000
});

// DB 초기화: 테이블 생성 및 기본 관리자 계정 생성
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- admins 테이블 스키마 보정 (기존 테이블 대응)
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='email') THEN
          ALTER TABLE admins ADD COLUMN email TEXT UNIQUE;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS member_groups (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        gender TEXT CHECK(gender IN ('M', 'F')),
        age INTEGER,
        phone TEXT,
        memo TEXT,
        email TEXT UNIQUE,
        password_hash TEXT,
        group_id INTEGER REFERENCES member_groups(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(name, phone)
      );

      -- members 테이블 스키마 보정 (기존 테이블 대응)
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='email') THEN
          ALTER TABLE members ADD COLUMN email TEXT UNIQUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='password_hash') THEN
          ALTER TABLE members ADD COLUMN password_hash TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='group_id') THEN
          ALTER TABLE members ADD COLUMN group_id INTEGER REFERENCES member_groups(id) ON DELETE SET NULL;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS inbody_records (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        measured_at TEXT NOT NULL,
        weight REAL,
        skeletal_muscle REAL,
        body_fat REAL,
        body_fat_pct REAL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(member_id, measured_at)
      );

      -- 마이옵티멀 로그 테이블
      CREATE TABLE IF NOT EXISTS revolution_logs (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        shake_count INTEGER DEFAULT 0,
        hiit_done BOOLEAN DEFAULT FALSE,
        no_sugar BOOLEAN DEFAULT TRUE,
        no_alcohol BOOLEAN DEFAULT TRUE,
        fasting_hours INTEGER DEFAULT 0,
        weight REAL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(member_id, date)
      );

      -- members 테이블 스카마 보정 (revolution_start_date 추가)
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='revolution_start_date') THEN
          ALTER TABLE members ADD COLUMN revolution_start_date TEXT;
        END IF;
      END $$;

      -- 접속 로그 테이블 추가
      CREATE TABLE IF NOT EXISTS access_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER, -- members 또는 admins의 ID (nullable)
        user_role TEXT, -- 'admin' or 'member'
        ip TEXT,
        method TEXT,
        path TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 기본 관리자 계정 생성
    const existing = await client.query('SELECT id FROM admins WHERE email = $1', ['admin@mongfit.com']);
    if (existing.rowCount === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await client.query('INSERT INTO admins (email, password_hash) VALUES ($1, $2)', ['admin@mongfit.com', hash]);
      console.log('✅ 기본 관리자 계정 생성: admin@mongfit.com / admin123');
    }

    const existing2 = await client.query('SELECT id FROM admins WHERE email = $1', ['admin2@mongfit.com']);
    if (existing2.rowCount === 0) {
      const hash = bcrypt.hashSync('admin1234', 10);
      await client.query('INSERT INTO admins (email, password_hash) VALUES ($1, $2)', ['admin2@mongfit.com', hash]);
      console.log('✅ 추가 관리자 계정 생성: admin2@mongfit.com / admin1234');
    }

    console.log('✅ PostgreSQL(Supabase) DB 초기화 완료 (MongFit)');
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
