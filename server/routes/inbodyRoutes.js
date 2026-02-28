const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../auth');

router.use(authenticate);

// GET /api/inbody/member/:memberId
router.get('/member/:memberId', async (req, res) => {
    try {
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
        const member = await db.get('SELECT id FROM members WHERE id = $1', [req.params.memberId]);
        if (!member) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });

        const {
            measured_at, weight, skeletal_muscle, body_fat, body_fat_pct,
            bmi, bmr, visceral_fat, arm_right, arm_left, torso, leg_right, leg_left, notes
        } = req.body;

        if (!measured_at) return res.status(400).json({ success: false, message: '측정일은 필수입니다.' });

        const result = await db.run(`
      INSERT INTO inbody_records
      (member_id, measured_at, weight, skeletal_muscle, body_fat, body_fat_pct, bmi, bmr, visceral_fat, arm_right, arm_left, torso, leg_right, leg_left, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `, [
            req.params.memberId, measured_at,
            weight || null, skeletal_muscle || null, body_fat || null, body_fat_pct || null,
            bmi || null, bmr || null, visceral_fat || null,
            arm_right || null, arm_left || null, torso || null, leg_right || null, leg_left || null,
            notes || null
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
        const existing = await db.get('SELECT id FROM inbody_records WHERE id = $1', [req.params.id]);
        if (!existing) return res.status(404).json({ success: false, message: '기록을 찾을 수 없습니다.' });

        const {
            measured_at, weight, skeletal_muscle, body_fat, body_fat_pct,
            bmi, bmr, visceral_fat, arm_right, arm_left, torso, leg_right, leg_left, notes
        } = req.body;

        await db.run(`
      UPDATE inbody_records SET
      measured_at = $1, weight = $2, skeletal_muscle = $3, body_fat = $4, body_fat_pct = $5,
      bmi = $6, bmr = $7, visceral_fat = $8, arm_right = $9, arm_left = $10,
      torso = $11, leg_right = $12, leg_left = $13, notes = $14
      WHERE id = $15
    `, [
            measured_at, weight || null, skeletal_muscle || null, body_fat || null, body_fat_pct || null,
            bmi || null, bmr || null, visceral_fat || null,
            arm_right || null, arm_left || null, torso || null, leg_right || null, leg_left || null,
            notes || null, req.params.id
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
        const existing = await db.get('SELECT id FROM inbody_records WHERE id = $1', [req.params.id]);
        if (!existing) return res.status(404).json({ success: false, message: '기록을 찾을 수 없습니다.' });

        await db.run('DELETE FROM inbody_records WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: '기록이 삭제되었습니다.' });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

module.exports = router;
