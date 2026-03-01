const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../auth');

// POST /api/revolution/start - 프로그램 시작
router.post('/start', authenticate, async (req, res) => {
    try {
        const { memberId, startDate } = req.body;
        if (!memberId || !startDate) {
            return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' });
        }

        // 권한 확인 (관리자 또는 본인)
        if (req.user.role !== 'admin' && req.user.id !== parseInt(memberId)) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        await db.run('UPDATE members SET revolution_start_date = $1 WHERE id = $2', [startDate, memberId]);
        res.json({ success: true, message: '프로그램이 시작되었습니다.' });
    } catch (err) {
        console.error('프로그램 시작 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /api/revolution/status/:memberId - 현재 상태 조회
router.get('/status/:memberId', authenticate, async (req, res) => {
    try {
        const memberId = req.params.memberId;
        const member = await db.get('SELECT revolution_start_date FROM members WHERE id = $1', [memberId]);

        if (!member || !member.revolution_start_date) {
            return res.json({ success: true, active: false });
        }

        // 오늘 날짜 로그 가져오기
        const today = new Date().toISOString().split('T')[0];
        const log = await db.get('SELECT * FROM revolution_logs WHERE member_id = $1 AND date = $2', [memberId, today]);

        // 최근 인바디에서 체중 가져오기 (단백질 계산용)
        const inbody = await db.get('SELECT weight FROM inbody_records WHERE member_id = $1 ORDER BY measured_at DESC LIMIT 1', [memberId]);

        res.json({
            success: true,
            active: true,
            startDate: member.revolution_start_date,
            todayLog: log || { shake_count: 0, hiit_done: false, no_sugar: true, no_alcohol: true, fasting_hours: 0 },
            lastWeight: inbody ? inbody.weight : null
        });
    } catch (err) {
        console.error('상태 조회 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /api/revolution/log - 일일 로그 기록/수정
router.post('/log', authenticate, async (req, res) => {
    try {
        const { memberId, date, shake_count, hiit_done, no_sugar, no_alcohol, fasting_hours, weight, notes } = req.body;

        if (req.user.role !== 'admin' && req.user.id !== parseInt(memberId)) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        await db.run(`
            INSERT INTO revolution_logs (member_id, date, shake_count, hiit_done, no_sugar, no_alcohol, fasting_hours, weight, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (member_id, date) DO UPDATE SET
                shake_count = EXCLUDED.shake_count,
                hiit_done = EXCLUDED.hiit_done,
                no_sugar = EXCLUDED.no_sugar,
                no_alcohol = EXCLUDED.no_alcohol,
                fasting_hours = EXCLUDED.fasting_hours,
                weight = EXCLUDED.weight,
                notes = EXCLUDED.notes
        `, [memberId, date, shake_count, hiit_done, no_sugar, no_alcohol, fasting_hours, weight, notes]);

        res.json({ success: true, message: '기록되었습니다.' });
    } catch (err) {
        console.error('로그 기록 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /api/revolution/logs/:memberId - 전체 로그 조회
router.get('/logs/:memberId', authenticate, async (req, res) => {
    try {
        const memberId = req.params.memberId;
        if (req.user.role !== 'admin' && req.user.id !== parseInt(memberId)) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        const logs = await db.all('SELECT * FROM revolution_logs WHERE member_id = $1 ORDER BY date DESC', [memberId]);
        res.json({ success: true, data: logs });
    } catch (err) {
        console.error('로그 조회 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

module.exports = router;
