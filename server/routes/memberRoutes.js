const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../auth');

router.use(authenticate);

// GET /api/members
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let members;
        if (search) {
            members = await db.all(`
        SELECT m.*, COUNT(ir.id) as record_count, MAX(ir.measured_at) as last_measured
        FROM members m
        LEFT JOIN inbody_records ir ON m.id = ir.member_id
        WHERE m.name ILIKE $1 OR m.phone ILIKE $1
        GROUP BY m.id ORDER BY m.name
      `, [`%${search}%`]);
        } else {
            members = await db.all(`
        SELECT m.*, COUNT(ir.id) as record_count, MAX(ir.measured_at) as last_measured
        FROM members m
        LEFT JOIN inbody_records ir ON m.id = ir.member_id
        GROUP BY m.id ORDER BY m.name
      `);
        }
        res.json({ success: true, data: members });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /api/members/:id
router.get('/:id', async (req, res) => {
    try {
        const member = await db.get('SELECT * FROM members WHERE id = $1', [req.params.id]);
        if (!member) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
        res.json({ success: true, data: member });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /api/members
router.post('/', async (req, res) => {
    try {
        const { name, gender, birth_date, phone, memo } = req.body;
        if (!name) return res.status(400).json({ success: false, message: '이름은 필수입니다.' });

        const result = await db.run(
            'INSERT INTO members (name, gender, birth_date, phone, memo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, gender || null, birth_date || null, phone || null, memo || null]
        );
        const newMember = await db.get('SELECT * FROM members WHERE id = $1', [result.lastInsertRowid]);
        res.status(201).json({ success: true, data: newMember });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PUT /api/members/:id
router.put('/:id', async (req, res) => {
    try {
        const { name, gender, birth_date, phone, memo } = req.body;
        const existing = await db.get('SELECT id FROM members WHERE id = $1', [req.params.id]);
        if (!existing) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });

        await db.run(
            'UPDATE members SET name = $1, gender = $2, birth_date = $3, phone = $4, memo = $5 WHERE id = $6',
            [name, gender || null, birth_date || null, phone || null, memo || null, req.params.id]
        );
        const updated = await db.get('SELECT * FROM members WHERE id = $1', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /api/members/:id
router.delete('/:id', async (req, res) => {
    try {
        const existing = await db.get('SELECT id FROM members WHERE id = $1', [req.params.id]);
        if (!existing) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });

        await db.run('DELETE FROM members WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: '회원이 삭제되었습니다.' });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

module.exports = router;
