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
const userRole = localStorage.getItem('mongfit_role');
document.getElementById('adminName').textContent = `${adminEmail} (${userRole === 'admin' ? '관리자' : '회원'})`;

// 관리자 전용 버튼 표시
if (userRole === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-block');

    // 특정 계정(admin)인 경우 접속 로그 버튼 숨김
    // admin 혹은 admin@mongfit.com 모두 체크
    const lowEmail = adminEmail ? adminEmail.toLowerCase().trim() : '';
    if (lowEmail === 'admin' || lowEmail === 'admin@mongfit.com') {
        const logBtn = document.getElementById('viewAccessLogsBtn');
        if (logBtn) logBtn.style.display = 'none';
    }
}

let allMembers = [];
// ... (생략된 변수들)

// ===== 접속 로그 모달 관련 =====
async function openAccessLogsModal() {
    document.getElementById('accessLogsModal').classList.add('active');
    await loadAccessLogs();
}

function closeAccessLogsModal() {
    document.getElementById('accessLogsModal').classList.remove('active');
}

/**
 * API 경로와 메소드를 기반으로 한글 설명을 반환
 */
function getLogDescription(method, path) {
    if (path === '/') return '메인 대시보드 접속';
    if (path === '/login') return '로그인 페이지 접속';
    if (path === '/signup') return '회원가입 페이지 접속';
    if (path.startsWith('/member?id=')) return '회원 상세 페이지 조회';
    if (path.startsWith('/api/auth/login')) return '로그인 시도';
    if (path.startsWith('/api/auth/change-password')) return '비밀번호 변경';
    if (path === '/api/user/me') return method === 'GET' ? '내 정보 조회' : '내 정보 수정';
    if (path === '/api/members') return method === 'GET' ? '회원 목록 조회' : '회원 추가';
    if (path.match(/^\/api\/members\/\d+$/)) {
        if (method === 'GET') return '회원 상세 정보 API';
        if (method === 'PUT') return '회원 정보 수정';
        if (method === 'DELETE') return '회원 삭제';
    }
    if (path.startsWith('/api/inbody/member/')) return method === 'GET' ? '인바디 기록 목록 조회' : '인바디 기록 추가';
    if (path.match(/^\/api\/inbody\/\d+$/)) {
        if (method === 'PUT') return '인바디 기록 수정';
        if (method === 'DELETE') return '인바디 기록 삭제';
    }
    if (path.startsWith('/api/revolution/status/')) return '내 몸 혁명 상태 조회';
    if (path === '/api/revolution/start') return '내 몸 혁명 시작';
    if (path === '/api/revolution/stop') return '내 몸 혁명 중단';
    if (path.startsWith('/api/revolution/logs/')) return '내 몸 혁명 기록 조회';
    if (path === '/api/groups') return method === 'GET' ? '그룹 목록 조회' : '그룹 추가';
    if (path.match(/^\/api\/groups\/\d+$/)) {
        if (method === 'PUT') return '그룹 수정';
        if (method === 'DELETE') return '그룹 삭제';
    }
    if (path === '/api/admin/logs') return '접속 로그 조회';

    return path; // 매핑되지 않은 경우 원래 경로 반환
}

function getMethodBadgeClass(method) {
    switch (method) {
        case 'GET': return 'badge-secondary'; // 조회: 회색
        case 'POST': return 'badge-success';   // 생성: 초록
        case 'PUT': return 'badge-primary';    // 수정: 파랑
        case 'DELETE': return 'badge-danger'; // 삭제: 빨강
        default: return 'badge-secondary';
    }
}

async function loadAccessLogs() {
    const tableBody = document.getElementById('accessLogsTableBody');
    tableBody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);"><span class="spinner"></span> 로그를 불러오는 중...</td></tr>';

    try {
        const res = await apiFetch('/api/admin/logs');
        if (!res) return;
        const data = await res.json();

        if (data.success) {
            if (data.logs.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">기록된 로그가 없습니다.</td></tr>';
                return;
            }

            tableBody.innerHTML = data.logs.map(log => {
                const date = new Date(log.created_at).toLocaleString('ko-KR');
                const userDisplay = log.user_name ? `${log.user_name}(${log.user_role})` : (log.user_role === 'admin' ? `관리자(${log.user_id})` : '비회원');
                const ua = log.user_agent || '-';
                const shortUA = ua.length > 30 ? ua.substring(0, 30) + '...' : ua;
                const description = getLogDescription(log.method, log.path);
                const badgeClass = getMethodBadgeClass(log.method);

                return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 0.8rem 1rem; white-space: nowrap;">${date}</td>
                        <td style="padding: 0.8rem 1rem;">${userDisplay}</td>
                        <td style="padding: 0.8rem 1rem;">${log.ip}</td>
                        <td style="padding: 0.8rem 1rem;"><span class="badge ${badgeClass}" style="font-size: 0.7rem;">${log.method}</span></td>
                        <td style="padding: 0.8rem 1rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.path}">
                            <span style="font-weight: 600;">${description}</span><br>
                            <span style="font-size: 0.7rem; color: var(--text-muted);">${log.path}</span>
                        </td>
                        <td style="padding: 0.8rem 1rem; color: var(--text-muted); font-size: 0.8rem;" title="${ua}">${shortUA}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tableBody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--error);">${data.message}</td></tr>`;
        }
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--error);">로그를 불러오는 중 오류가 발생했습니다.</td></tr>';
    }
}
let allGroups = [];
let currentGenderFilter = 'all'; // 'all', 'M', 'F'
let currentGroupFilter = ''; // Group ID
let deletingMemberId = null;
let revolutionStatus = null;
const MY_ID = localStorage.getItem('mongfit_user_id');
let revolutionLogs = [];
let currentCalDate = new Date();

// ===== 초기 로드 =====
async function init() {
    await loadGroups();
    await loadMembers();
    setupFilters();
    if (MY_ID) await loadRevolutionStatus();
}

// ===== 회원 목록 불러오기 =====
async function loadMembers(search = '') {
    const groupId = document.getElementById('groupFilter').value;
    let url = `/api/members?`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (groupId) url += `group_id=${groupId}&`;

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
        const groupTag = m.group_name ? `<span class="badge badge-primary" style="margin-left: 5px; font-size: 0.7rem;">${m.group_name}</span>` : '';

        return `
      <div class="member-card" onclick="goToMember(${m.id})">
        <div class="flex-between mb-1">
          <div class="flex gap-1" style="align-items:center;">
            <div class="member-avatar ${avatarClass}">${initial}</div>
            <div>
              <div class="member-name">${m.name}${groupTag}</div>
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
function debounceSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        const searchInput = document.getElementById('memberSearch');
        const search = searchInput ? searchInput.value.trim() : '';
        loadMembers(search);
    }, 300);
}

// ===== 회원 추가 모달 =====
document.getElementById('addMemberBtn').addEventListener('click', () => {
    document.getElementById('memberModalTitle').textContent = '회원 추가';
    document.getElementById('editMemberId').value = '';
    document.getElementById('memberName').value = '';
    document.getElementById('memberGender').value = '';
    document.getElementById('memberAge').value = '';
    document.getElementById('memberPhone').value = '';
    document.getElementById('memberMemo').value = '';
    renderGroupSelect('memberGroup', '');
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
    renderGroupSelect('memberGroup', member.group_id || '');
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
        group_id: document.getElementById('memberGroup').value || null,
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

    document.getElementById('myCurrentPassword').value = '';
    document.getElementById('myNewPassword').value = '';
    document.getElementById('myConfirmNewPassword').value = '';
    document.getElementById('myProfileModal').classList.add('active');
}

function closeMyProfileModal() {
    document.getElementById('myProfileModal').classList.remove('active');
}

async function saveMyProfile() {
    const role = localStorage.getItem('mongfit_role');
    const name = document.getElementById('myName').value.trim();
    if (!name) { showToast('이름을 입력해 주세요.', 'error'); return; }

    const curPwd = document.getElementById('myCurrentPassword').value;
    const newPwd = document.getElementById('myNewPassword').value;
    const confPwd = document.getElementById('myConfirmNewPassword').value;

    const saveBtn = document.getElementById('saveMyProfileBtn');
    saveBtn.innerHTML = '<span class="spinner"></span>';
    saveBtn.disabled = true;

    try {
        // 1. 비밀번호 변경 시도 (입력된 경우에만)
        if (curPwd || newPwd || confPwd) {
            if (!curPwd || !newPwd) {
                showToast('현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.', 'error');
                return;
            }
            if (newPwd !== confPwd) {
                showToast('새 비밀번호가 일치하지 않습니다.', 'error');
                return;
            }

            const pwdRes = await apiFetch('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd })
            });
            if (!pwdRes) return;
            const pwdData = await pwdRes.json();
            if (!pwdData.success) {
                showToast(pwdData.message, 'error');
                return;
            }
        }

        // 2. 다른 프로필 정보 변경
        const body = { name };
        if (role !== 'admin') {
            body.gender = document.getElementById('myGender').value || null;
            body.age = document.getElementById('myAge').value || null;
            body.phone = document.getElementById('myPhone').value.trim() || null;
        }

        const res = await apiFetch('/api/user/me', { method: 'PUT', body: JSON.stringify(body) });
        if (!res) return;
        const data = await res.json();

        if (data.success) {
            showToast('정보가 성공적으로 수정되었습니다.', 'success');
            closeMyProfileModal();
            setTimeout(() => location.reload(), 500);
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

    if (revolutionStatus && revolutionStatus.isStarted) {
        if (banner) banner.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';

        const calContainer = document.getElementById('revCalendarContainer');
        if (calContainer) calContainer.style.display = 'block';

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

        apiFetch(`/api/revolution/logs/${MY_ID}`).then(res => res.json()).then(data => {
            if (data.success) {
                revolutionLogs = data.data;
                renderRevCalendar();
            }
        });
    } else {
        if (banner) banner.style.display = 'block';
        if (dashboard) dashboard.style.display = 'none';
        const calContainer = document.getElementById('revCalendarContainer');
        if (calContainer) calContainer.style.display = 'none';
    }
}

function getRevolutionPhase(day) {
    if (day <= 3) return { title: '1단계: 체내 지방 차단 (비움)', desc: '3일간 단백질 셰이크만 4번 섭취하여 대사를 초기화합니다.' };
    if (day <= 7) return { title: '2단계: 가속기 가동 (충전)', desc: '점심 한 끼는 일반식(탄수화물 제한)을 즐기세요.' };
    if (day <= 21) return { title: '3단계: 지방 연로 가동 (리셋)', desc: '본격적인 체지방 연소 단계! 주 1회 24시간 단식이 포함됩니다.' };
    if (day <= 28) return { title: '4단계: 세트포인트 안착 (유지)', desc: '안정적인 체중 유지 능력을 길러 요요를 방지합니다.' };
    return { title: '프로그램 완료!', desc: '4주간의 혁명을 성공적으로 마쳤습니다! 고생하셨습니다.' };
}

async function startRevolutionProgram() {
    const modal = document.getElementById('startRevModal');
    const dateInput = document.getElementById('revStartDateInput');
    if (modal && dateInput) {
        // 기본값으로 오늘 날짜 설정
        dateInput.value = new Date().toISOString().split('T')[0];
        modal.classList.add('active');
    }
}

function closeStartRevModal() {
    const modal = document.getElementById('startRevModal');
    if (modal) modal.classList.remove('active');
}

async function submitStartRevolution() {
    const startDate = document.getElementById('revStartDateInput').value;
    if (!startDate) {
        showToast('시작 날짜를 선택해 주세요.', 'error');
        return;
    }

    const btn = document.getElementById('confirmStartRevBtn');
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
        const res = await apiFetch('/api/revolution/start', {
            method: 'POST',
            body: JSON.stringify({ memberId: MY_ID, startDate })
        });
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            showToast('혁명이 시작되었습니다! 화이팅!', 'success');
            closeStartRevModal();
            await loadRevolutionStatus();
        } else {
            showToast(data.message || '시작 중 오류가 발생했습니다.', 'error');
        }
    } catch (err) {
        showToast('시작 중 오류가 발생했습니다.', 'error');
    } finally {
        btn.innerHTML = '시작하기';
        btn.disabled = false;
    }
}

async function stopRevolutionProgram() {
    if (!confirm('정말로 내 몸 혁명 프로그램을 중단하시겠습니까?\n프로그램 시작 날짜가 초기화됩니다.')) return;

    try {
        const res = await apiFetch('/api/revolution/stop', {
            method: 'POST',
            body: JSON.stringify({ memberId: MY_ID })
        });
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            showToast('프로그램이 중단되었습니다.', 'success');
            await loadRevolutionStatus();
        } else {
            showToast(data.message || '중단 중 오류가 발생했습니다.', 'error');
        }
    } catch (err) {
        showToast('중단 중 오류가 발생했습니다.', 'error');
    }
}

// 미션 모달 관련
let currentShakeCount = 0;

async function openRevMissionModal(targetDateStr) {
    if (!revolutionStatus) return;

    const dateStr = targetDateStr || new Date().toISOString().split('T')[0];
    const targetDate = new Date(dateStr);
    const startDate = new Date(revolutionStatus.startDate);

    // 차수 계산
    const diffTime = targetDate - startDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays < 1) {
        showToast('프로그램 시작 전 날짜입니다.', 'info');
        return;
    }

    // 해당 날짜 로그 찾기
    const log = revolutionLogs.find(l => l.date.split('T')[0] === dateStr) || {};

    const dayText = diffDays > 28 ? '완료' : `Day ${diffDays}`;
    document.getElementById('revMissionDate').textContent = `${dateStr} (${dayText})`;

    // 목표 셰이크 계산
    const target = (diffDays <= 3) ? 4 : (diffDays <= 7) ? 3 : 2;

    // 단백질 목표 계산
    const weight = revolutionStatus.lastWeight || 0;
    const proteinTarget = weight ? Math.round(weight * 1.2) : 0;

    // 권장 단식 시간
    const fastingTarget = (diffDays >= 15 && (diffDays % 7 === 1 || diffDays % 7 === 0)) ? 24 : 14;

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

    currentShakeCount = log.shake_count || 0;

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
    const dateText = document.getElementById('revMissionDate').textContent;
    const targetDateStr = dateText.split(' ')[0];

    const body = {
        memberId: MY_ID,
        date: targetDateStr,
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
                ${log.hiit_done ? '🏃' : ''} ${log.no_sugar !== false ? '💧' : ''} ${log.no_alcohol !== false ? '🌙' : ''}
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

// 캘린더 로직
function renderRevCalendar() {
    const container = document.getElementById('revCalendar');
    const monthLabel = document.getElementById('revCalendarMonth');
    if (!container) return;

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    monthLabel.textContent = `${year}.${String(month + 1).padStart(2, '0')}`;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();

    let html = '';
    const dayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    dayLabels.forEach(label => html += `<div class="rev-cal-day-label">${label}</div>`);

    // 이전 달 공백
    for (let i = firstDay; i > 0; i--) {
        html += `<div class="rev-cal-day other-month">${prevLastDate - i + 1}</div>`;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // 이번 달 날짜
    for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const log = revolutionLogs.find(l => l.date.split('T')[0] === dateStr);
        const isToday = dateStr === todayStr;
        const hasLog = !!log;

        // 미션 누락 체크 (오늘 포함 이전 날짜 중 시작일 이후인 경우)
        let isMissed = false;
        if (revolutionStatus && revolutionStatus.startDate && !hasLog) {
            if (dateStr >= revolutionStatus.startDate && dateStr <= todayStr) {
                isMissed = true;
            }
        }

        // 시작일 표시 체크
        const isStartDate = revolutionStatus && revolutionStatus.startDate === dateStr;

        html += `
            <div class="rev-cal-day ${isToday ? 'today' : ''} ${hasLog ? 'has-log' : ''} ${isMissed ? 'missed' : ''} ${isStartDate ? 'start-day' : ''}" 
                 onclick="openRevMissionModal('${dateStr}')">
                ${d}
                ${hasLog ? '<div class="rev-cal-dot active"></div>' : ''}
            </div>
        `;
    }

    // 다음 달 공백 (총 42칸 기준)
    const currentTotal = html.split('rev-cal-day').length - 1;
    for (let i = 1; i <= (42 - currentTotal + 7); i++) {
        if (html.split('rev-cal-day').length - 7 > 42) break;
        html += `<div class="rev-cal-day other-month">${i}</div>`;
    }

    container.innerHTML = html;
}

function changeRevMonth(val) {
    currentCalDate.setMonth(currentCalDate.getMonth() + val);
    renderRevCalendar();
}

init();
// ===== 그룹 관리 로직 =====
function openGroupModal() {
    document.getElementById('groupModal').classList.add('active');
    renderGroupList();
}

function closeGroupModal() {
    document.getElementById('groupModal').classList.remove('active');
}

async function loadGroups() {
    const res = await apiFetch('/api/groups');
    if (!res) return;
    const data = await res.json();
    if (data.success) {
        allGroups = data.data;
        renderGroupFilter();
    }
}

function renderGroupFilter() {
    const filter = document.getElementById('groupFilter');
    if (!filter) return;
    const currentValue = filter.value;
    filter.innerHTML = '<option value="">모든 그룹</option>' +
        allGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    filter.value = currentValue;
}

function renderGroupSelect(elementId, selectedId) {
    const select = document.getElementById(elementId);
    select.innerHTML = '<option value="">그룹 없음</option>' +
        allGroups.map(g => `<option value="${g.id}" ${g.id == selectedId ? 'selected' : ''}>${g.name}</option>`).join('');
}

function renderGroupList() {
    const container = document.getElementById('groupListContainer');
    if (allGroups.length === 0) {
        container.innerHTML = '<div class="text-muted p-3 text-center">등록된 그룹이 없습니다.</div>';
        return;
    }

    container.innerHTML = allGroups.map(g => `
        <div class="flex-between p-2 mb-1" style="background:rgba(255,255,255,0.05); border-radius:8px;">
            <span>${g.name}</span>
            <div class="flex gap-1">
                <button class="btn btn-icon btn-sm" onclick="editGroup(${g.id}, '${g.name}')">✏️</button>
                <button class="btn btn-icon btn-sm" onclick="confirmDeleteGroup(${g.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function addGroup() {
    const nameInput = document.getElementById('newGroupName');
    const name = nameInput.value.trim();
    if (!name) return;

    const res = await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name })
    });
    if (!res) return;
    const data = await res.json();
    if (data.success) {
        showToast('그룹이 추가되었습니다.', 'success');
        nameInput.value = '';
        await loadGroups();
        renderGroupList();
    } else {
        showToast(data.message, 'error');
    }
}

async function editGroup(id, currentName) {
    const newName = prompt('그룹 이름을 수정합니다:', currentName);
    if (!newName || newName === currentName) return;

    const res = await apiFetch(`/api/groups/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName })
    });
    if (!res) return;
    const data = await res.json();
    if (data.success) {
        showToast('수정되었습니다.', 'success');
        await loadGroups();
        renderGroupList();
        await loadMembers();
    }
}

async function confirmDeleteGroup(id) {
    if (!confirm('그룹을 삭제하시겠습니까? 소속된 회원은 그룹 없음 상태가 됩니다.')) return;

    const res = await apiFetch(`/api/groups/${id}`, { method: 'DELETE' });
    if (!res) return;
    const data = await res.json();
    if (data.success) {
        showToast('삭제되었습니다.', 'success');
        await loadGroups();
        renderGroupList();
        await loadMembers();
    }
}
