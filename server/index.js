const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const { initDB } = require('./db');
const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const inbodyRoutes = require('./routes/inbodyRoutes');
const userRoutes = require('./routes/userRoutes');
const revolutionRoutes = require('./routes/revolutionRoutes');
const groupRoutes = require('./routes/groupRoutes');
const adminRoutes = require('./routes/adminRoutes');
const menstruationRoutes = require('./routes/menstruationRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// 접속 로그 미들웨어 적용
const accessLogger = require('./middleware/logger');
const { authenticate } = require('./auth');

// 토큰이 있는 경우 정보를 추출하기 위해 옵셔널하게 인증 시도 (오류시 무시)
app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mongfit_secret_key_2024_very_long_string');
            req.user = decoded;
        } catch (e) {
            // 토큰이 잘못되어도 서비스 이용은 가능하므로 무시
        }
    }
    next();
});

app.use(accessLogger);

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/inbody', inbodyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/revolution', revolutionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/menstruation', menstruationRoutes);

app.get('*', (req, res) => {
    if (req.path === '/login') {
        return res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
    }
    if (req.path === '/signup') {
        return res.sendFile(path.join(__dirname, '..', 'public', 'signup.html'));
    }
    if (req.path === '/dashboard') {
        return res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
    }
    if (req.path.startsWith('/member')) {
        return res.sendFile(path.join(__dirname, '..', 'public', 'member.html'));
    }
    // 기본 루트(/) 및 알 수 없는 경로는 랜딩 페이지(index.html)로 연결
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// DB 초기화 후 서버 시작
initDB().then(() => {
    app.listen(PORT, () => {
        console.log('🚀 MongFit 서버가 실행 중입니다: http://localhost:' + PORT);
    });
}).catch(err => {
    console.error('서버 시작 실패:', err);
    process.exit(1);
});
