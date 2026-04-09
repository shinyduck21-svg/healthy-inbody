const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../auth');

router.use(authenticate);

// 특정 회원의 월경 기록 조회
router.get('/:memberId', async (req, res) => {
    try {
        const { memberId } = req.params;
        // 관리자거나 본인인 경우만 조회 가능
        if (req.user.role !== 'admin' && req.user.id != memberId) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        const logs = await db.all(
            'SELECT * FROM menstruation_history WHERE member_id = $1 ORDER BY start_date DESC',
            [memberId]
        );
        res.json({ success: true, data: logs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 월경 시작일 기록 추가
router.post('/:memberId', async (req, res) => {
    try {
        const { memberId } = req.params;
        const { start_date, end_date } = req.body;

        if (!start_date) {
            return res.status(400).json({ success: false, message: '시작일을 입력해 주세요.' });
        }

        if (req.user.role !== 'admin' && req.user.id != memberId) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        await db.run(
            'INSERT INTO menstruation_history (member_id, start_date, end_date) VALUES ($1, $2, $3) ON CONFLICT(member_id, start_date) DO UPDATE SET end_date = $3',
            [memberId, start_date, end_date || null]
        );
        
        const logs = await db.all(
            'SELECT * FROM menstruation_history WHERE member_id = $1 ORDER BY start_date DESC',
            [memberId]
        );
        res.status(201).json({ success: true, data: logs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 월경 기록 삭제
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: '유효하지 않은 ID입니다.' });
        }
        
        // 해당 로그의 소유자 확인
        const log = await db.get('SELECT member_id FROM menstruation_history WHERE id = $1', [id]);
        if (!log) {
            console.log(`[DELETE] Log not found: ID=${id}`);
            return res.status(404).json({ success: false, message: '기록을 찾을 수 없습니다.' });
        }

        if (req.user.role !== 'admin' && req.user.id != log.member_id) {
            console.log(`[DELETE] Forbidden: User=${req.user.id}, Owner=${log.member_id}`);
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        await db.run('DELETE FROM menstruation_history WHERE id = $1', [id]);
        
        console.log(`[DELETE] Success: ID=${id}`);
        
        // 삭제 후 업데이트된 전체 목록 반환
        const updatedLogs = await db.all(
            'SELECT * FROM menstruation_history WHERE member_id = $1 ORDER BY start_date DESC',
            [log.member_id]
        );
        res.json({ success: true, message: '기록이 삭제되었습니다.', data: updatedLogs });
    } catch (err) {
        console.error('[DELETE] Server Error:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 월경 기록 수정
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { start_date, end_date } = req.body;

        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: '유효하지 않은 ID입니다.' });
        }
        
        if (!start_date) {
            return res.status(400).json({ success: false, message: '수정할 시작일을 입력해 주세요.' });
        }

        const log = await db.get('SELECT member_id FROM menstruation_history WHERE id = $1', [id]);
        if (!log) return res.status(404).json({ success: false, message: '기록을 찾을 수 없습니다.' });

        if (req.user.role !== 'admin' && req.user.id != log.member_id) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        await db.run(
            'UPDATE menstruation_history SET start_date = $1, end_date = $2 WHERE id = $3',
            [start_date, end_date || null, id]
        );
        
        // 수정 후 업데이트된 전체 목록 반환
        const updatedLogs = await db.all(
            'SELECT * FROM menstruation_history WHERE member_id = $1 ORDER BY start_date DESC',
            [log.member_id]
        );
        
        res.json({ success: true, message: '기록이 수정되었습니다.', data: updatedLogs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

module.exports = router;
