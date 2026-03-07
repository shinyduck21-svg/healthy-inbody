const { run } = require('../db');

/**
 * 접속 로그 미들웨어
 */
async function accessLogger(req, res, next) {
    const path = req.path;

    // 로깅 제외 필터링
    // 1. 정적 자원 (확장자 기반)
    if (path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i)) {
        return next();
    }

    // 2. 기타 불필요한 경로 (선택 사항)
    if (path === '/favicon.ico' || path === '/robots.txt') {
        return next();
    }

    const logData = {
        user_id: req.user ? req.user.id : null,
        user_role: req.user ? req.user.role : null,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        method: req.method,
        path: req.path,
        user_agent: req.headers['user-agent']
    };

    // 응답이 끝난 후에 비동기로 DB에 기록 (요청 응담 속도에 영향 최소화)
    res.on('finish', async () => {
        try {
            await run(
                `INSERT INTO access_logs (user_id, user_role, ip, method, path, user_agent) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [logData.user_id, logData.user_role, logData.ip, logData.method, logData.path, logData.user_agent]
            );
        } catch (err) {
            console.error('접속 로그 기록 실패:', err);
        }
    });

    next();
}

module.exports = accessLogger;
