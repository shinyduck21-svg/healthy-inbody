const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../auth');
const { getPhotoExt, uploadPhotoToStorage, deletePhotoFromStorage } = require('../storage');

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

// POST /api/inbody/photo - 인바디 사진 업로드
router.post('/photo', async (req, res) => {
    try {
        const { memberId, measuredAt, fileName, mimeType, data, previousPhotoUrl } = req.body;
        if (!memberId || !measuredAt || !mimeType || !data) {
            return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' });
        }
        if (req.user.role !== 'admin' && req.user.id !== parseInt(memberId)) {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }

        const ext = getPhotoExt(mimeType);
        if (!ext) {
            return res.status(400).json({ success: false, message: '이미지 파일만 업로드할 수 있습니다.' });
        }

        const buffer = Buffer.from(data, 'base64');
        if (buffer.length > 10 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: '사진은 10MB 이하만 업로드할 수 있습니다.' });
        }

        const safeDate = String(measuredAt).replace(/[^0-9-]/g, '');
        const originalName = String(fileName || 'inbody')
            .replace(/\.[^.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 30) || 'inbody';
        const storedName = `${safeDate}-${Date.now()}-${originalName}.${ext}`;
        const objectPath = `inbody/${memberId}/${storedName}`;

        const photoUrl = await uploadPhotoToStorage(objectPath, buffer, mimeType);

        if (previousPhotoUrl && previousPhotoUrl !== photoUrl) {
            await deletePhotoFromStorage(previousPhotoUrl);
        }

        res.json({ success: true, photoUrl });
    } catch (err) {
        console.error('인바디 사진 업로드 오류:', err.message);
        res.status(500).json({ success: false, message: err.message || '서버 오류' });
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
            measured_at, weight, skeletal_muscle, body_fat, body_fat_pct, visceral_fat, notes, photo_url
        } = req.body;

        if (!measured_at) return res.status(400).json({ success: false, message: '측정일은 필수입니다.' });

        console.log('[DEBUG] POST InBody Request Body:', req.body);

        const getVal = (v) => (v === undefined || v === null || v === '') ? null : v;

        const result = await db.run(`
      INSERT INTO inbody_records
      (member_id, measured_at, weight, skeletal_muscle, body_fat, body_fat_pct, visceral_fat, notes, photo_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
            req.params.memberId, measured_at,
            getVal(weight), getVal(skeletal_muscle), getVal(body_fat), getVal(body_fat_pct),
            getVal(visceral_fat), getVal(notes), getVal(photo_url)
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
            measured_at, weight, skeletal_muscle, body_fat, body_fat_pct, visceral_fat, notes,
            photo_url, admin_feedback
        } = req.body;

        console.log('[DEBUG] PUT InBody Request Body:', req.body);

        const getVal = (v) => (v === undefined || v === null || v === '') ? null : v;

        // 사진이 변경되었거나 삭제된 경우 이전 사진 Storage 삭제
        const nextPhotoUrl = photo_url !== undefined ? getVal(photo_url) : existing.photo_url;
        if (existing.photo_url && nextPhotoUrl !== existing.photo_url) {
            await deletePhotoFromStorage(existing.photo_url);
        }

        // 관리자 피드백 처리 및 검증
        let feedbackSql = '';
        let feedbackParams = [];
        if (admin_feedback !== undefined) {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: '피드백은 관리자만 작성할 수 있습니다.' });
            }
            
            // 5대 지표 검증 (기존 값 + 새 값 조합)
            const vWeight = getVal(weight) !== null ? getVal(weight) : existing.weight;
            const vMuscle = getVal(skeletal_muscle) !== null ? getVal(skeletal_muscle) : existing.skeletal_muscle;
            const vFat = getVal(body_fat) !== null ? getVal(body_fat) : existing.body_fat;
            const vFatPct = getVal(body_fat_pct) !== null ? getVal(body_fat_pct) : existing.body_fat_pct;
            const vVisceral = getVal(visceral_fat) !== null ? getVal(visceral_fat) : existing.visceral_fat;

            if (!vWeight || !vMuscle || !vFat || !vFatPct || !vVisceral) {
                return res.status(400).json({ success: false, message: '모든 지표(체중, 골격근, 체지방, 체지방률, 내장지방)가 입력되어야 피드백 작성이 가능합니다.' });
            }
            
            feedbackSql = ', admin_feedback = $9, feedback_at = NOW()';
            feedbackParams = [admin_feedback];
        }

        const sql = `
      UPDATE inbody_records SET
      measured_at = $1, weight = $2, skeletal_muscle = $3, body_fat = $4, body_fat_pct = $5, visceral_fat = $6, notes = $7, photo_url = $8
      ${feedbackSql}
      WHERE id = ${admin_feedback !== undefined ? '$10' : '$9'}
    `;

        const params = [
            measured_at, getVal(weight), getVal(skeletal_muscle), getVal(body_fat), getVal(body_fat_pct),
            getVal(visceral_fat), getVal(notes), nextPhotoUrl, ...feedbackParams, req.params.id
        ];

        await db.run(sql, params);

        const updated = await db.get('SELECT * FROM inbody_records WHERE id = $1', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (err) {
        console.error('인바디 수정 오류:', err);
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

        if (existing.photo_url) {
            await deletePhotoFromStorage(existing.photo_url);
        }

        await db.run('DELETE FROM inbody_records WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: '기록이 삭제되었습니다.' });
    } catch (err) {
        console.error('인바디 삭제 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

module.exports = router;
