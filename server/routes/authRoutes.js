const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken } = require('../auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력하세요.' });

        // 1. 관리자 먼저 검색
        let user = await db.get('SELECT * FROM admins WHERE email = $1', [email]);
        let role = 'admin';

        // 2. 관리자가 아니면 회원 검색
        if (!user) {
            user = await db.get('SELECT * FROM members WHERE email = $1', [email]);
            role = 'member';
        }

        if (!user || !user.password_hash) {
            return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }

        const isValid = bcrypt.compareSync(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }

        const token = generateToken({ id: user.id, email: user.email, role: role });
        res.json({ success: true, token, email: user.email, role: role, id: user.id });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', require('../auth').authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const admin = await db.get('SELECT * FROM admins WHERE id = $1', [req.admin.id]);

        if (!bcrypt.compareSync(currentPassword, admin.password_hash))
            return res.status(400).json({ success: false, message: '현재 비밀번호가 올바르지 않습니다.' });

        const newHash = bcrypt.hashSync(newPassword, 10);
        await db.run('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, req.admin.id]);
        res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
