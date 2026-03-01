/**
 * dashboard.js - 메인 대시보드 로직
 */

// 일반 회원이 대시보드 접근 시 본인 상세 페이지로 리다이렉트
if (localStorage.getItem('mongfit_role') !== 'admin') {
    const userId = localStorage.getItem('mongfit_user_id');
    if (userId) {
        window.location.href = `/member?id=${userId}`;
    } else {
        logout();
    }
}

// 관리자 이메일 및 역할 표시
const adminEmail = getAdminName(); // auth.js에서 ADMIN_KEY(이메일)를 반환함
document.getElementById('adminName').textContent = `${adminEmail} (관리자)`;

let allMembers = [];
let currentGenderFilter = 'all'; // 'all', 'M', 'F'
let deletingMemberId = null;
let revolutionStatus = null;
const MY_ID = localStorage.getItem('mongfit_user_id');

// ===== 초기 로드 =====
async function init() {
    await loadMembers();
    setupFilters();
    if (MY_ID) await loadRevolutionStatus();
}

// ===== 회원 목록 불러오기 =====
async function loadMembers(search = '') {
    const url = search ? `/api/members?search=${encodeURIComponent(search)}` : '/api/members';
    const res = await apiFetch(url);
    if (!res) return;

    const data = await res.json();
    if (!data.success) return;

    allMembers = data.data;
    renderStats(allMembers);
    filterAndRender();
}

// ===== 필터링 및 렌더링 =====
function filterAndRender() {
    let filtered = allMembers;
    if (currentGenderFilter !== 'all') {
        filtered = allMembers.filter(m => m.gender === currentGenderFilter);
    }
    renderMembers(filtered);
    updateFilterUI();
}

// ===== 필터 UI 업데이트 =====
function updateFilterUI() {
    document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('active'));
    if (currentGenderFilter === 'all') document.getElementById('statCardTotal').classList.add('active');
    else if (currentGenderFilter === 'M') document.getElementById('statCardMale').classList.add('active');
    else if (currentGenderFilter === 'F') document.getElementById('statCardFemale').classList.add('active');
}

// ===== 필터 이벤트 설정 =====
function setupFilters() {
    document.getElementById('statCardTotal').addEventListener('click', () => {
        currentGenderFilter = 'all';
        filterAndRender();
    });
    document.getElementById('statCardMale').addEventListener('click', () => {
        currentGenderFilter = 'M';
        filterAndRender();
    });
    document.getElementById('statCardFemale').addEventListener('click', () => {
        currentGenderFilter = 'F';
        filterAndRender();
    });
}

// ===== 통계 렌더링 =====
function renderStats(members) {
    const male = members.filter(m => m.gender === 'M').length;
    const female = members.filter(m => m.gender === 'F').length;
    const totalRecords = members.reduce((sum, m) => sum + Number(m.record_count || 0), 0);

    document.getElementById('statTotal').textContent = members.length;
    document.getElementById('statMale').textContent = male;
    document.getElementById('statFemale').textContent = female;
    document.getElementById('statRecords').textContent = totalRecords;
}

// ===== 회원 카드 렌더링 =====
function renderMembers(members) {
    const grid = document.getElementById('membersGrid');
    const empty = document.getElementById('emptyState');

    if (members.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    grid.innerHTML = members.map(m => {
        const avatarClass = m.gender === 'M' ? 'avatar-male' : m.gender === 'F' ? 'avatar-female' : 'avatar-default';
        const initial = m.name.charAt(0);
        const genderLabel = m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : '-';
        const age = m.age ? m.age + '세' : '-';
        const lastMeasured = m.last_measured ? formatDate(m.last_measured) : '기록 없음';

        return `
      <div class="member-card" onclick="goToMember(${m.id})">
        <div class="flex-between mb-1">
          <div class="flex gap-1" style="align-items:center;">
            <div class="member-avatar ${avatarClass}">${initial}</div>
            <div>
              <div class="member-name">${m.name}</div>
              <div class="member-info">${genderLabel} · ${age} · ${m.phone || '연락처 없음'}</div>
            </div>
          </div>
          <div class="flex gap-1" onclick="event.stopPropagation()">
            <button class="btn btn-icon" title="편집" onclick="openEditModal(${m.id})">✏️</button>
            <button class="btn btn-icon" title="삭제" onclick="openDeleteModal(${m.id}, '${m.name}')">🗑️</button>
          </div>
        </div>
        <div class="member-stats">
          <div class="member-stat-item">
            <div class="member-stat-value">${m.record_count || 0}</div>
            <div class="member-stat-label">측정 횟수</div>
          </div>
          <div class="member-stat-item">
            <div class="member-stat-value" style="font-size:0.9rem;">${lastMeasured}</div>
            <div class="member-stat-label">최근 측정</div>
          </div>
        </div>
      </div>
    `;
    }).join('');
}


function goToMember(id) {
    window.location.href = `/member?id=${id}`;
}

// ===== 검색 =====
let searchTimer;
document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadMembers(e.target.value.trim()), 300);
});

// ===== 회원 추가 모달 =====
document.getElementById('addMemberBtn').addEventListener('click', () => {
    document.getElementById('memberModalTitle').textContent = '회원 추가';
    document.getElementById('editMemberId').value = '';
    document.getElementById('memberName').value = '';
    document.getElementById('memberGender').value = '';
    document.getElementById('memberAge').value = '';
    document.getElementById('memberPhone').value = '';
    document.getElementById('memberMemo').value = '';
    document.getElementById('memberModal').classList.add('active');
});

function closeMemberModal() {
    document.getElementById('memberModal').classList.remove('active');
}

// ===== 회원 편집 모달 =====
function openEditModal(id) {
    const member = allMembers.find(m => m.id === id);
    if (!member) return;

    document.getElementById('memberModalTitle').textContent = '회원 정보 편집';
    document.getElementById('editMemberId').value = member.id;
    document.getElementById('memberName').value = member.name;
    document.getElementById('memberGender').value = member.gender || '';
    document.getElementById('memberAge').value = member.age || '';
    document.getElementById('memberPhone').value = member.phone || '';
    document.getElementById('memberMemo').value = member.memo || '';
    document.getElementById('memberModal').classList.add('active');
}

// ===== 회원 저장 (추가/편집) =====
async function saveMember() {
    const id = document.getElementById('editMemberId').value;
    const name = document.getElementById('memberName').value.trim();
    if (!name) { showToast('이름을 입력해 주세요.', 'error'); return; }

    const body = {
        name,
        gender: document.getElementById('memberGender').value || null,
        age: document.getElementById('memberAge').value || null,
        phone: document.getElementById('memberPhone').value.trim() || null,
        memo: document.getElementById('memberMemo').value.trim() || null,
    };

    const saveBtn = document.getElementById('saveMemberBtn');
    saveBtn.innerHTML = '<span class="spinner"></span>';
    saveBtn.disabled = true;

    try {
        const res = id
            ? await apiFetch(`/api/members/${id}`, { method: 'PUT', body: JSON.stringify(body) })
            : await apiFetch('/api/members', { method: 'POST', body: JSON.stringify(body) });

        if (!res) return;
        const data = await res.json();

        if (data.success) {
            showToast(id ? '회원 정보가 수정되었습니다.' : '회원이 추가되었습니다.', 'success');
            closeMemberModal();
            await loadMembers();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
        saveBtn.innerHTML = '저장';
        saveBtn.disabled = false;
    }
}

// ===== 회원 삭제 =====
function openDeleteModal(id, name) {
    deletingMemberId = id;
    document.getElementById('deleteMemberName').textContent = name;
    document.getElementById('deleteModal').classList.add('active');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!deletingMemberId) return;

    const btn = document.getElementById('confirmDeleteBtn');
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
        const res = await apiFetch(`/api/members/${deletingMemberId}`, { method: 'DELETE' });
        if (!res) return;
        const data = await res.json();

        if (data.success) {
            showToast('회원이 삭제되었습니다.', 'success');
            document.getElementById('deleteModal').classList.remove('active');
            await loadMembers();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
        btn.innerHTML = '삭제';
        btn.disabled = false;
        deletingMemberId = null;
    }
});

// 모달 외부 클릭 시 닫기
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
    });
});

// ===== 내 정보 (마이페이지) 로직 =====
document.getElementById('myProfileBtn').addEventListener('click', openMyProfileModal);

async function openMyProfileModal() {
    const res = await apiFetch('/api/user/me');
    if (!res) return;
    const data = await res.json();
    if (!data.success) return;

    const user = data.data;
    const role = localStorage.getItem('mongfit_role');

    document.getElementById('myEmail').value = user.email;
    document.getElementById('myName').value = user.name;

    // 관리자면 성별/나이/연락처 필드 숨김
    const memberFields = document.querySelectorAll('.member-only-field');
    if (role === 'admin') {
        memberFields.forEach(f => f.style.display = 'none');
    } else {
        memberFields.forEach(f => f.style.display = 'block');
        document.getElementById('myGender').value = user.gender || '';
        document.getElementById('myAge').value = user.age || '';
        document.getElementById('myPhone').value = user.phone || '';
    }

    document.getElementById('myProfileModal').classList.add('active');
}

function closeMyProfileModal() {
    document.getElementById('myProfileModal').classList.remove('active');
}

async function saveMyProfile() {
    const role = localStorage.getItem('mongfit_role');
    const id = localStorage.getItem('mongfit_user_id');
    const name = document.getElementById('myName').value.trim();
    if (!name) { showToast('이름을 입력해 주세요.', 'error'); return; }

    const body = { name };
    if (role !== 'admin') {
        body.gender = document.getElementById('myGender').value || null;
        body.age = document.getElementById('myAge').value || null;
        body.phone = document.getElementById('myPhone').value.trim() || null;
    }

    const saveBtn = document.getElementById('saveMyProfileBtn');
    saveBtn.innerHTML = '<span class="spinner"></span>';
    saveBtn.disabled = true;

    try {
        const res = await apiFetch('/api/user/me', { method: 'PUT', body: JSON.stringify(body) });
        if (!res) return;
        const data = await res.json();

        if (data.success) {
            showToast('내 정보가 수정되었습니다.', 'success');
            closeMyProfileModal();
            // 관리자 이름 표시 업데이트
            if (role === 'admin') {
                document.getElementById('adminName').textContent = `${user.email} (관리자)`;
            }
            location.reload(); // 간단하게 페이지 갱신
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
        saveBtn.innerHTML = '저장';
        saveBtn.disabled = false;
    }
}

// ===== 비밀번호 변경 로직 =====
function openChangePasswordModal() {
    // 기존 입력 초기화
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    document.getElementById('changePasswordModal').classList.add('active');
}

function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.remove('active');
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (!currentPassword || !newPassword) {
        showToast('비밀번호를 입력해 주세요.', 'error');
        return;
    }
    if (newPassword !== confirmNewPassword) {
        showToast('새 비밀번호가 일치하지 않습니다.', 'error');
        return;
    }

    const btn = document.getElementById('changePasswordBtn');
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
        const res = await apiFetch('/api/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        if (!res) return;
        const data = await res.json();

        if (data.success) {
            showToast('비밀번호가 성공적으로 변경되었습니다.', 'success');
            closeChangePasswordModal();
            closeMyProfileModal();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('비밀번호 변경 중 오류가 발생했습니다.', 'error');
    } finally {
        btn.innerHTML = '비밀번호 변경';
        btn.disabled = false;
    }
}

// ===== 내 몸 혁명 (Revolution) 로직 =====

async function loadRevolutionStatus() {
    try {
        const res = await apiFetch(`/api/revolution/status/${MY_ID}`);
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            revolutionStatus = data;
            updateRevolutionUI();
        }
    } catch (err) {
        console.error('혁명 상태 로드 오류:', err);
    }
}

function updateRevolutionUI() {
    const dashboard = document.getElementById('revolutionDashboard');
    const banner = document.getElementById('startRevolutionBanner');

    if (!revolutionStatus || !revolutionStatus.active) {
        dashboard.style.display = 'none';
        banner.style.display = 'block';
        return;
    }

    dashboard.style.display = 'block';
    banner.style.display = 'none';

    // 진행 일수 계산
    const start = new Date(revolutionStatus.startDate);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    const phaseInfo = getRevolutionPhase(diffDays);
    const progress = Math.min(100, (diffDays / 28) * 100).toFixed(1);

    document.getElementById('revDayCount').textContent = diffDays;
    document.getElementById('revPhaseTitle').textContent = phaseInfo.title;
    document.getElementById('revPhaseDesc').textContent = phaseInfo.desc;
    document.getElementById('revStartDate').textContent = revolutionStatus.startDate;
    document.getElementById('revProgressBar').style.width = `${progress}%`;
    document.getElementById('revProgressPercent').textContent = progress;
}

function getRevolutionPhase(day) {
    if (day <= 3) return { title: '1단계: 체내 지방 차단 (비움)', desc: '3일간 단백질 셰이크만 4번 섭취하여 대사를 초기화합니다.' };
    if (day <= 7) return { title: '2단계: 가속기 가동 (충전)', desc: '점심 한 끼는 일반식(탄수화물 제한)을 즐기세요.' };
    if (day <= 21) return { title: '3단계: 지방 연로 가동 (리셋)', desc: '본격적인 체지방 연소 단계! 주 1회 24시간 단식이 포함됩니다.' };
    if (day <= 28) return { title: '4단계: 세트포인트 안착 (유지)', desc: '안정적인 체중 유지 능력을 길러 요요를 방지합니다.' };
    return { title: '프로그램 완료!', desc: '4주간의 혁명을 성공적으로 마쳤습니다! 고생하셨습니다.' };
}

async function startRevolutionProgram() {
    if (!confirm('박용우 교수님의 4주 내 몸 혁명을 오늘부터 시작하시겠습니까?')) return;

    const startDate = new Date().toISOString().split('T')[0];
    try {
        const res = await apiFetch('/api/revolution/start', {
            method: 'POST',
            body: JSON.stringify({ memberId: MY_ID, startDate })
        });
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            showToast('혁명이 시작되었습니다! 화이팅!', 'success');
            await loadRevolutionStatus();
        }
    } catch (err) {
        showToast('시작 중 오류가 발생했습니다.', 'error');
    }
}

// 미션 모달 관련
let currentShakeCount = 0;

function openRevMissionModal() {
    if (!revolutionStatus || !revolutionStatus.todayLog) return;

    const log = revolutionStatus.todayLog;
    const start = new Date(revolutionStatus.startDate);
    const today = new Date();
    const diffDays = Math.ceil(Math.abs(today - start) / (1000 * 60 * 60 * 24)) || 1;

    document.getElementById('revMissionDate').textContent = `${new Date().toLocaleDateString()} (Day ${diffDays})`;

    // 목표 셰이크 계산
    const target = (diffDays <= 3) ? 4 : (diffDays <= 7) ? 3 : 2;

    // 단백질 목표 계산 (최근 체중 기반)
    const weight = revolutionStatus.lastWeight || 0;
    const proteinTarget = weight ? Math.round(weight * 1.2) : 0;

    // 권장 단식 시간
    const fastingTarget = (diffDays >= 15 && (diffDays % 7 === 1 || diffDays % 7 === 0)) ? 24 : 14;

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

    setTxt('targetShake', target);
    setTxt('targetProtein', proteinTarget);
    setTxt('targetFasting', fastingTarget);
    setTxt('currentShake', currentShakeCount);
    setVal('missFasting', log.fasting_hours || '');
    setChk('missHiit', log.hiit_done);
    setChk('missNoSugar', log.no_sugar !== false);
    setChk('missNoAlcohol', log.no_alcohol !== false);
    setVal('revNotes', log.notes || '');

    const modal = document.getElementById('revMissionModal');
    if (modal) modal.classList.add('active');
}

function closeRevMissionModal() {
    document.getElementById('revMissionModal').classList.remove('active');
}

function adjustShake(val) {
    currentShakeCount = Math.max(0, currentShakeCount + val);
    document.getElementById('currentShake').textContent = currentShakeCount;
}

async function saveRevLog() {
    const body = {
        memberId: MY_ID,
        date: new Date().toISOString().split('T')[0],
        shake_count: currentShakeCount,
        fasting_hours: parseInt(document.getElementById('missFasting').value) || 0,
        hiit_done: document.getElementById('missHiit').checked,
        no_sugar: document.getElementById('missNoSugar').checked,
        no_alcohol: document.getElementById('missNoAlcohol').checked,
        notes: document.getElementById('revNotes').value.trim()
    };

    const btn = document.getElementById('saveRevLogBtn');
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
        const res = await apiFetch('/api/revolution/log', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            showToast('오늘의 미션이 기록되었습니다.', 'success');
            closeRevMissionModal();
            await loadRevolutionStatus();
        }
    } catch (err) {
        showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
        btn.innerHTML = '오늘 기록 저장';
        btn.disabled = false;
    }
}

// 리포트 모달 관련 (관리자 본인용)
async function openRevReportModal() {
    try {
        const res = await apiFetch(`/api/revolution/logs/${MY_ID}`);
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            renderRevReport(data.data);
            document.getElementById('revReportModal').classList.add('active');
        }
    } catch (err) {
        showToast('리포트를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

function closeRevReportModal() {
    document.getElementById('revReportModal').classList.remove('active');
}

function renderRevReport(logs) {
    if (!revolutionStatus) return;

    const start = new Date(revolutionStatus.startDate);

    let hiitCount = 0;
    let shakeTotal = 0;
    let shakeTargetTotal = 0;
    let fastingSuccess = 0;
    let totalScore = 0;

    logs.forEach(log => {
        if (log.hiit_done) hiitCount++;
        const logDate = new Date(log.date);
        const dayDiff = Math.ceil(Math.abs(logDate - start) / (1000 * 60 * 60 * 24)) + 1;
        const targetShake = (dayDiff <= 3) ? 4 : (dayDiff <= 7) ? 3 : 2;
        const targetFasting = (dayDiff >= 15 && (dayDiff % 7 === 1 || dayDiff % 7 === 0)) ? 24 : 14;

        shakeTotal += Math.min(targetShake, log.shake_count || 0);
        shakeTargetTotal += targetShake;
        if ((log.fasting_hours || 0) >= targetFasting) fastingSuccess++;

        let dayScore = 0;
        if ((log.shake_count || 0) >= targetShake) dayScore += 40;
        if (log.hiit_done) dayScore += 20;
        if ((log.fasting_hours || 0) >= targetFasting) dayScore += 20;
        if (log.no_sugar !== false) dayScore += 10;
        if (log.no_alcohol !== false) dayScore += 10;
        totalScore += dayScore;
    });

    const avgAchievement = logs.length > 0 ? Math.round(totalScore / logs.length) : 0;
    const shakePct = shakeTargetTotal > 0 ? Math.round((shakeTotal / shakeTargetTotal) * 100) : 0;
    const fastingPct = logs.length > 0 ? Math.round((fastingSuccess / logs.length) * 100) : 0;

    document.getElementById('repAchievement').textContent = avgAchievement;
    document.getElementById('repTotalDays').textContent = `${logs.length}일`;
    document.getElementById('repHiitCount').textContent = `${hiitCount}회`;
    document.getElementById('repShakePct').textContent = `${shakePct}%`;
    document.getElementById('repBarShake').style.width = `${shakePct}%`;
    document.getElementById('repFastingPct').textContent = `${fastingPct}%`;
    document.getElementById('repBarFasting').style.width = `${fastingPct}%`;

    const recentLogs = logs.slice(0, 7);
    document.getElementById('repLogList').innerHTML = recentLogs.map(log => `
        <div style="padding:0.5rem; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
            <div>
                <span style="font-weight:bold;">${log.date.substring(5)}</span>
                <span style="margin-left:0.5rem; color:var(--text-muted);">🥛${log.shake_count || 0} ⏳${log.fasting_hours || 0}h</span>
            </div>
            <div>
                ${log.hiit_done ? '🏃' : ''} ${log.no_sugar !== false ? '🍭' : ''} ${log.no_alcohol !== false ? '🍺' : ''}
            </div>
        </div>
    `).join('') || '<div class="text-muted p-2">기록이 없습니다.</div>';
}

// 가이드 모달 관련
function openRevGuideModal() {
    document.getElementById('revGuideModal').classList.add('active');
}

function closeRevGuideModal() {
    document.getElementById('revGuideModal').classList.remove('active');
}

function switchRevGuideTab(el, tab) {
    const tabs = document.querySelectorAll('.rev-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');

    const contents = document.querySelectorAll('.rev-tab-content');
    contents.forEach(c => c.classList.remove('active'));

    if (tab === 'food') document.getElementById('guideTabFood').classList.add('active');
    else document.getElementById('guideTabWorkout').classList.add('active');
}

init();
