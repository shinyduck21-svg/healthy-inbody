const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../auth');

router.use(authenticate);

// GET /api/members - 관리자용 전체 목록 조회
router.get('/', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }
        const { search, group_id } = req.query;
        let query = `
            SELECT m.*, g.name as group_name, COUNT(ir.id) as record_count, MAX(ir.measured_at) as last_measured,
            (SELECT mh.start_date FROM menstruation_history mh WHERE mh.member_id = m.id ORDER BY mh.start_date DESC LIMIT 1) as last_period_start,
            (SELECT mh.end_date FROM menstruation_history mh WHERE mh.member_id = m.id ORDER BY mh.start_date DESC LIMIT 1) as last_period_end
            FROM members m
            LEFT JOIN member_groups g ON m.group_id = g.id
            LEFT JOIN inbody_records ir ON m.id = ir.member_id
        `;
        let params = [];
        let where = [];

        if (search) {
            params.push(`%${search}%`);
            where.push(`(m.name ILIKE $${params.length} OR m.phone ILIKE $${params.length})`);
        }
        if (group_id) {
            params.push(group_id);
            where.push(`m.group_id = $${params.length}`);
        }

        if (where.length > 0) {
            query += ` WHERE ` + where.join(' AND ');
        }

        query += ` GROUP BY m.id, g.name ORDER BY m.name`;

        const members = await db.all(query, params);
        res.json({ success: true, data: members });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /api/members/:id
router.get('/:id', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.id != req.params.id) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        const member = await db.get(`
            SELECT m.*, g.name as group_name 
            FROM members m 
            LEFT JOIN member_groups g ON m.group_id = g.id 
            WHERE m.id = $1
        `, [req.params.id]);
        if (!member) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
        res.json({ success: true, data: member });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /api/members
router.post('/', async (req, res) => {
    try {
        const { name, gender, age, phone, memo, group_id } = req.body;
        if (!name) return res.status(400).json({ success: false, message: '이름은 필수입니다.' });

        const result = await db.run(
            'INSERT INTO members (name, gender, age, phone, memo, group_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [name, gender || null, age || null, phone || null, memo || null, group_id || null]
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
        const { name, gender, age, phone, memo, group_id } = req.body;
        const existing = await db.get('SELECT id FROM members WHERE id = $1', [req.params.id]);
        if (!existing) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });

        if (req.user.role !== 'admin' && req.user.id != req.params.id) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        await db.run(
            'UPDATE members SET name = $1, gender = $2, age = $3, phone = $4, memo = $5, group_id = $6 WHERE id = $7',
            [name, gender || null, age || null, phone || null, memo || null, group_id || null, req.params.id]
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
