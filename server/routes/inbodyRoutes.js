const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../auth');

router.use(authenticate);

// GET /api/inbody/member/:memberId
router.get('/member/:memberId', async (req, res) => {
    try {
        // 본인 데이터거나 관리자여야 함
        if (req.user.role !== 'admin' && req.user.id != req.params.memberId) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        const member = await db.get('SELECT id FROM members WHERE id = $1', [req.params.memberId]);
        if (!member) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });

        const records = await db.all(
            'SELECT * FROM inbody_records WHERE member_id = $1 ORDER BY measured_at DESC',
            [req.params.memberId]
        );
        res.json({ success: true, data: records });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /api/inbody/member/:memberId
router.post('/member/:memberId', async (req, res) => {
    try {
        // 본인 데이터거나 관리자여야 함
        if (req.user.role !== 'admin' && req.user.id != req.params.memberId) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        const member = await db.get('SELECT id FROM members WHERE id = $1', [req.params.memberId]);
        if (!member) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });

        const {
            measured_at, weight, skeletal_muscle, body_fat, body_fat_pct, visceral_fat, notes
        } = req.body;

        if (!measured_at) return res.status(400).json({ success: false, message: '측정일은 필수입니다.' });

        console.log('[DEBUG] POST InBody Request Body:', req.body);

        const getVal = (v) => (v === undefined || v === null || v === '') ? null : v;

        const result = await db.run(`
      INSERT INTO inbody_records
      (member_id, measured_at, weight, skeletal_muscle, body_fat, body_fat_pct, visceral_fat, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
            req.params.memberId, measured_at,
            getVal(weight), getVal(skeletal_muscle), getVal(body_fat), getVal(body_fat_pct),
            getVal(visceral_fat), getVal(notes)
        ]);

        const newRecord = await db.get('SELECT * FROM inbody_records WHERE id = $1', [result.lastInsertRowid]);
        res.status(201).json({ success: true, data: newRecord });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PUT /api/inbody/:id
router.put('/:id', async (req, res) => {
    try {
        const existing = await db.get('SELECT * FROM inbody_records WHERE id = $1', [req.params.id]);
        if (!existing) return res.status(404).json({ success: false, message: '기록을 찾을 수 없습니다.' });

        // 본인 데이터거나 관리자여야 함
        if (req.user.role !== 'admin' && req.user.id != existing.member_id) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        const {
            measured_at, weight, skeletal_muscle, body_fat, body_fat_pct, visceral_fat, notes
        } = req.body;

        console.log('[DEBUG] PUT InBody Request Body:', req.body);

        const getVal = (v) => (v === undefined || v === null || v === '') ? null : v;

        await db.run(`
      UPDATE inbody_records SET
      measured_at = $1, weight = $2, skeletal_muscle = $3, body_fat = $4, body_fat_pct = $5, visceral_fat = $6, notes = $7
      WHERE id = $8
    `, [
            measured_at, getVal(weight), getVal(skeletal_muscle), getVal(body_fat), getVal(body_fat_pct),
            getVal(visceral_fat), getVal(notes), req.params.id
        ]);

        const updated = await db.get('SELECT * FROM inbody_records WHERE id = $1', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /api/inbody/:id
router.delete('/:id', async (req, res) => {
    try {
        const existing = await db.get('SELECT * FROM inbody_records WHERE id = $1', [req.params.id]);
        if (!existing) return res.status(404).json({ success: false, message: '기록을 찾을 수 없습니다.' });

        // 본인 데이터거나 관리자여야 함
        if (req.user.role !== 'admin' && req.user.id != existing.member_id) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        await db.run('DELETE FROM inbody_records WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: '기록이 삭제되었습니다.' });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

module.exports = router;
