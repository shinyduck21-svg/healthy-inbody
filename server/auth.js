const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mongfit_secret_key_2024_very_long_string';
const JWT_EXPIRES_IN = '8h';

/**
 * JWT 토큰 생성
 */
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: '토큰이 만료되었거나 유효하지 않습니다.' });
    }
}

module.exports = { generateToken, authenticate };
