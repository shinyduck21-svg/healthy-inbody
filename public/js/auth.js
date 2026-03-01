/**
 * auth.js - 인증 토큰 관리 유틸리티
 * 로컬스토리지에 JWT 토큰을 저장/조회/삭제하고
 * 인증이 필요한 API 요청을 위한 헤더를 생성합니다.
 */

const TOKEN_KEY = 'mongfit_token';
const ADMIN_KEY = 'mongfit_admin';
const ROLE_KEY = 'mongfit_role';
const USER_ID_KEY = 'mongfit_user_id';

/**
 * 토큰 저장
 */
function saveToken(token, email, role, userId) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ADMIN_KEY, email); // 기존 키 재사용 (이메일 저장)
    localStorage.setItem(ROLE_KEY, role);
    localStorage.setItem(USER_ID_KEY, userId);
}

/**
 * 토큰 조회
 */
function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * 관리자 이름 조회
 */
function getAdminName() {
    return localStorage.getItem(ADMIN_KEY) || '관리자';
}

/**
 * 로그아웃 (토큰 삭제 후 리다이렉트)
 */
function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_ID_KEY);
    window.location.href = '/login';
}

/**
 * 인증 헤더 반환
 */
function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}

/**
 * 인증 체크 - 토큰 없으면 로그인 페이지로 이동
 */
function requireAuth() {
    if (!getToken()) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

/**
 * API 요청 헬퍼 - 401 응답 시 자동 로그아웃
 */
async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: { ...authHeaders(), ...options.headers }
    });

    if (res.status === 401) {
        logout();
        return null;
    }

    return res;
}

/**
 * 토스트 알림 표시
 * @param {string} message - 알림 메시지
 * @param {'success'|'error'|'info'} type - 알림 타입
 */
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 날짜 포맷 (YYYY-MM-DD → YYYY.MM.DD)
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    return dateStr.substring(0, 10).replace(/-/g, '.');
}

/**
 * 숫자 포맷 (소수점 1자리)
 */
function fmtNum(val, unit = '') {
    if (val === null || val === undefined) return '-';
    return `${parseFloat(val).toFixed(1)}${unit}`;
}
