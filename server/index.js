const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const { initDB } = require('./db');
const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const inbodyRoutes = require('./routes/inbodyRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/inbody', inbodyRoutes);

app.get('*', (req, res) => {
    if (req.path === '/login') {
        return res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
    }
    if (req.path.startsWith('/member')) {
        return res.sendFile(path.join(__dirname, '..', 'public', 'member.html'));
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// DB 초기화 후 서버 시작
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Healty 서버가 실행 중입니다: http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('서버 시작 실패:', err);
    process.exit(1);
});
