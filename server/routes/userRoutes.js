const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate } = require('../auth');

// POST /api/user/signup - 회원가입
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name, gender, age, phone } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ success: false, message: '필수 정보를 모두 입력해주세요.' });
        }

        // 이메일 형식 체크
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: '올바른 이메일 형식이 아닙니다.' });
        }

        // 중복 아이디 체크
        const existing = await db.get('SELECT id FROM members WHERE email = $1', [email]);
        if (existing) {
            return res.status(400).json({ success: false, message: '이미 사용 중인 아이디입니다.' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        const result = await db.run(
            'INSERT INTO members (email, password_hash, name, gender, age, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [email, hashedPassword, name, gender || null, age || null, phone || null]
        );

        res.status(201).json({ success: true, message: '회원가입이 완료되었습니다.' });
    } catch (err) {
        console.error('회원가입 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// GET /api/user/me - 내 정보 조회
router.get('/me', authenticate, async (req, res) => {
    try {
        // authenticate 미들웨어가 JWT 페이로드를 req.user에 담습니다.
        const userId = req.user.id;
        const user = await db.get('SELECT id, email, name, gender, age, phone, memo, created_at FROM members WHERE id = $1', [userId]);

        if (!user) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }

        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

module.exports = router;
