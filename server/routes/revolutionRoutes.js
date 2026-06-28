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

// POST /api/revolution/stop - 프로그램 중단
router.post('/stop', authenticate, async (req, res) => {
    try {
        const { memberId } = req.body;
        if (!memberId) {
            return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' });
        }

        // 권한 확인 (관리자 또는 본인)
        if (req.user.role !== 'admin' && req.user.id !== parseInt(memberId)) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        await db.run('UPDATE members SET revolution_start_date = NULL WHERE id = $1', [memberId]);
        res.json({ success: true, message: '프로그램이 중단되었습니다.' });
    } catch (err) {
        console.error('프로그램 중단 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /api/revolution/status/:memberId - 현재 상태 조회
router.get('/status/:memberId', authenticate, async (req, res) => {
    try {
        const memberId = req.params.memberId;
        const member = await db.get('SELECT revolution_start_date FROM members WHERE id = $1', [memberId]);

        if (!member || !member.revolution_start_date) {
            return res.json({ success: true, isStarted: false });
        }

        // 오늘 날짜 로그 가져오기
        const today = new Date().toISOString().split('T')[0];
        const log = await db.get('SELECT * FROM revolution_logs WHERE member_id = $1 AND date = $2', [memberId, today]);

        // 최근 인바디에서 체중 가져오기 (단백질 계산용)
        const inbody = await db.get('SELECT weight FROM inbody_records WHERE member_id = $1 ORDER BY measured_at DESC LIMIT 1', [memberId]);

        res.json({
            success: true,
            isStarted: true,
            startDate: member.revolution_start_date,
            todayLog: log || {
                sleep_start: '',
                sleep_end: '',
                sleep_score: null,
                diet_breakfast: false,
                diet_lunch: false,
                diet_dinner: false,
                diet_memo: '',
                water_cups: 0,
                exercise_type: '',
                exercise_duration: 0,
                exercise_intensity: '',
                gratitude_diary: ''
            },
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
        const {
            memberId, date,
            sleep_start, sleep_end, sleep_score,
            diet_breakfast, diet_lunch, diet_dinner, diet_memo,
            water_cups,
            exercise_type, exercise_duration, exercise_intensity,
            gratitude_diary
        } = req.body;

        if (req.user.role !== 'admin' && req.user.id !== parseInt(memberId)) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        await db.run(`
            INSERT INTO revolution_logs (
                member_id, date,
                sleep_start, sleep_end, sleep_score,
                diet_breakfast, diet_lunch, diet_dinner, diet_memo,
                water_cups,
                exercise_type, exercise_duration, exercise_intensity,
                gratitude_diary
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (member_id, date) DO UPDATE SET
                sleep_start = EXCLUDED.sleep_start,
                sleep_end = EXCLUDED.sleep_end,
                sleep_score = EXCLUDED.sleep_score,
                diet_breakfast = EXCLUDED.diet_breakfast,
                diet_lunch = EXCLUDED.diet_lunch,
                diet_dinner = EXCLUDED.diet_dinner,
                diet_memo = EXCLUDED.diet_memo,
                water_cups = EXCLUDED.water_cups,
                exercise_type = EXCLUDED.exercise_type,
                exercise_duration = EXCLUDED.exercise_duration,
                exercise_intensity = EXCLUDED.exercise_intensity,
                gratitude_diary = EXCLUDED.gratitude_diary
        `, [
            memberId, date,
            sleep_start, sleep_end, sleep_score,
            diet_breakfast, diet_lunch, diet_dinner, diet_memo,
            water_cups,
            exercise_type, exercise_duration, exercise_intensity,
            gratitude_diary
        ]);

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
