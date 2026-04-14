const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../auth');

// 관리자 권한 확인 미들웨어 (이미 authenticate에서 req.user.role 확인 가능)
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
};

// GET /api/admin/logs - 최근 접속 로그 조회 (최대 100개)
router.get('/logs', authenticate, adminOnly, async (req, res) => {
    try {
        const logs = await db.all(`
            SELECT 
                l.*, 
                m.name as user_name 
            FROM access_logs l
            LEFT JOIN members m ON l.user_id = m.id AND l.user_role = 'member'
            ORDER BY l.created_at DESC 
            LIMIT 100
        `);
        res.json({ success: true, logs });
    } catch (err) {
        console.error('로그 조회 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// PATCH /api/admin/users/:id/reset-password - 회원 비밀번호를 ID + !123 으로 초기화
router.patch('/users/:id/reset-password', authenticate, adminOnly, async (req, res) => {
    try {
        const userId = req.params.id;
        const targetUser = await db.get('SELECT * FROM members WHERE id = $1', [userId]);

        if (!targetUser) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }

        // 새 비밀번호 생성 (이메일 앞부분(ID역할) + !123)
        // 이메일이 hong@gmail.com 이라면 hong!123 
        const emailPrefix = targetUser.email.split('@')[0];
        const newPassword = emailPrefix + '!123';
        
        // 비밀번호 암호화 및 업데이트 (bcrypt 사용)
        const bcrypt = require('bcryptjs');
        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        await db.run('UPDATE members SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

        res.json({ success: true, message: `비밀번호가 '${newPassword}' 로 초기화되었습니다.` });
    } catch (err) {
        console.error('비밀번호 초기화 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
