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

module.exports = router;
