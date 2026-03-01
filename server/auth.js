const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'mongfit_secret_key_2024_very_long_string';
const JWT_EXPIRES_IN = '8h';

/**
 * 토큰 생성
 * payload: { id, email, role }
 */
function generateToken(payload) {
    return jwt.sign(payload, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 인증 미들웨어 - Authorization: Bearer <token> 헤더 확인
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // { id, email, role }

        // 하위 호환성 유지
        if (decoded.role === 'admin') {
            req.admin = decoded;
        }

        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }
}

module.exports = { generateToken, authenticate };
