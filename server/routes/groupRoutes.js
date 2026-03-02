const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../auth');

router.use(authenticate);

// GET /api/groups - 전체 목록 조회
router.get('/', async (req, res) => {
    try {
        const groups = await db.all('SELECT * FROM member_groups ORDER BY name');
        res.json({ success: true, data: groups });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /api/groups - 신규 생성
router.post('/', async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: '그룹명은 필수입니다.' });

        await db.run('INSERT INTO member_groups (name) VALUES ($1)', [name]);
        const newGroup = await db.get('SELECT * FROM member_groups WHERE name = $1', [name]);
        res.status(201).json({ success: true, data: newGroup });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ success: false, message: '이미 존재하는 그룹명입니다.' });
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PUT /api/groups/:id - 수정
router.put('/:id', async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: '그룹명은 필수입니다.' });

        await db.run('UPDATE member_groups SET name = $1 WHERE id = $2', [name, req.params.id]);
        res.json({ success: true, message: '수정되었습니다.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /api/groups/:id - 삭제
router.delete('/:id', async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        await db.run('DELETE FROM member_groups WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: '삭제되었습니다.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

module.exports = router;
