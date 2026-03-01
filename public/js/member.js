/**
 * member.js - 회원 상세 페이지 로직
 * Chart.js를 활용한 인바디 변화 추이 차트 포함
 */

if (!requireAuth()) throw new Error('Not authenticated');
// 역할에 따른 UI 조정
const role = localStorage.getItem('mongfit_role');
if (role !== 'admin') {
    const adminDot = document.querySelector('.admin-dot');
    const adminNameSpan = document.getElementById('adminName');
    if (adminDot) adminDot.style.background = 'var(--success)';
    if (adminNameSpan) adminNameSpan.textContent = '회원';
} else {
    const adminNameSpan = document.getElementById('adminName');
    if (adminNameSpan) adminNameSpan.textContent = getAdminName();
}

// URL에서 회원 ID 파싱
const urlParams = new URLSearchParams(window.location.search);
const MEMBER_ID = urlParams.get('id');
if (!MEMBER_ID) window.location.href = '/';

let memberData = null;
let inbodyRecords = [];
let weightChartInstance = null;
let inbodyChartInstance = null;
let radarChartInstance = null;
let deletingRecordId = null;
let revolutionStatus = null; // 내 몸 혁명 상태 데이터

// ===== 초기화 =====
async function init() {
    await Promise.all([loadMember(), loadRecords(), loadRevolutionStatus()]);
}

// ===== 회원 정보 로드 =====
async function loadMember() {
    // 권한 체크: 관리자가 아닌데 남의 정보를 보려 할 경우
    const role = localStorage.getItem('mongfit_role');
    const myId = localStorage.getItem('mongfit_user_id');
    if (role !== 'admin' && myId != MEMBER_ID) {
        alert('권한이 없습니다.');
        window.location.href = `/member?id=${myId}`;
        return;
    }

    const res = await apiFetch(`/api/members/${MEMBER_ID}`);
    if (!res) return;
    const data = await res.json();
    if (!data.success) { window.location.href = '/'; return; }

    memberData = data.data;
    renderMemberInfo(memberData);
}

function renderMemberInfo(m) {
    document.title = `${m.name} - MongFit`;
    const genderLabel = m.gender === 'M' ? '남성' : m.gender === 'F' ? '여성' : '미기입';
    const avatarClass = m.gender === 'M' ? 'avatar-male' : m.gender === 'F' ? 'avatar-female' : 'avatar-default';

    document.getElementById('memberAvatarLarge').textContent = m.name.charAt(0);
    document.getElementById('memberAvatarLarge').className = `member-avatar ${avatarClass}`;
    document.getElementById('memberNameTitle').textContent = m.name;
    document.getElementById('memberSubtitle').textContent = `${genderLabel} · ${formatDate(m.created_at)} 등록`;

    document.getElementById('infoGender').textContent = genderLabel;
    document.getElementById('infoAge').textContent = m.age ? m.age + '세' : '-';
    document.getElementById('infoPhone').textContent = m.phone || '-';
    document.getElementById('infoCreated').textContent = formatDate(m.created_at);
    document.getElementById('infoMemo').textContent = m.memo || '메모 없음';
}

// ===== 인바디 기록 로드 =====
async function loadRecords() {
    const res = await apiFetch(`/api/inbody/member/${MEMBER_ID}`);
    if (!res) return;
    const data = await res.json();
    if (!data.success) return;

    inbodyRecords = data.data;
    renderLatestSummary(inbodyRecords);
    renderWeightChart(inbodyRecords);
    renderInbodyChart(inbodyRecords);
    renderRadarChart(inbodyRecords);
    renderRecordsTable(inbodyRecords);
}

// ===== 최신 요약 카드 =====
function renderLatestSummary(records) {
    const card = document.getElementById('latestInbodyCard');
    if (records.length === 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    const latest = records[0]; // 최신순 정렬 -> 첫 번째가 최신
    const prev = records[1];

    const items = [
        { label: '체중', value: fmtNum(latest.weight, 'kg'), key: 'weight' },
        { label: '골격근량', value: fmtNum(latest.skeletal_muscle, 'kg'), key: 'skeletal_muscle' },
        { label: '체지방량', value: fmtNum(latest.body_fat, 'kg'), key: 'body_fat' },
        { label: '체지방률', value: fmtNum(latest.body_fat_pct, '%'), key: 'body_fat_pct' }
    ];

    document.getElementById('latestSummary').innerHTML = items.map(item => {
        let diffHtml = '';
        if (prev && latest[item.key] != null && prev[item.key] != null) {
            const diff = (parseFloat(latest[item.key]) - parseFloat(prev[item.key])).toFixed(1);
            const isGood = (item.key === 'weight' || item.key === 'body_fat' || item.key === 'body_fat_pct')
                ? parseFloat(diff) <= 0 : parseFloat(diff) >= 0;
            const color = parseFloat(diff) === 0 ? 'var(--text-muted)' : (isGood ? 'var(--success)' : 'var(--danger)');
            const arrow = parseFloat(diff) > 0 ? '▲' : parseFloat(diff) < 0 ? '▼' : '—';
            diffHtml = `<span style="font-size:0.75rem; color:${color}; margin-left:0.3rem;">${arrow} ${Math.abs(diff)}</span>`;
        }
        return `
      <div class="stat-card" style="padding:1rem;">
        <div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.3rem;">${item.label}</div>
          <div style="font-size:1.1rem;font-weight:700;">${item.value}${diffHtml}</div>
        </div>
      </div>
    `;
    }).join('');
}

// ===== 공통 차트 옵션 =====
function commonChartOptions(tooltipCallbacks) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1a2235',
                titleColor: '#94a3b8',
                bodyColor: '#f1f5f9',
                borderColor: 'rgba(99,102,241,0.3)',
                borderWidth: 1,
                padding: 12,
                callbacks: tooltipCallbacks
            }
        }
    };
}

const COMMON_X_SCALE = {
    grid: { color: 'rgba(255,255,255,0.04)' },
    ticks: { color: '#64748b', font: { size: 11 } },
    border: { color: 'rgba(255,255,255,0.06)' }
};

function makeYScale(unit, extraOpts) {
    return Object.assign({
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
            color: '#64748b',
            font: { size: 11 },
            callback: v => v + unit
        },
        border: { color: 'rgba(255,255,255,0.06)' }
    }, extraOpts || {});
}

// ===== 체중 그래프 =====
function renderWeightChart(records) {
    const card = document.getElementById('weightChartCard');
    const valid = records.filter(r => r.weight != null).slice().reverse();

    if (valid.length < 2) {
        card.style.display = valid.length === 1 ? 'block' : 'none';
        if (weightChartInstance) { weightChartInstance.destroy(); weightChartInstance = null; }
        return;
    }
    card.style.display = 'block';

    const labels = valid.map(r => r.measured_at.substring(0, 10));
    const values = valid.map(r => parseFloat(r.weight));

    const ctx = document.getElementById('weightChart').getContext('2d');
    if (weightChartInstance) weightChartInstance.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, '#6366f140');
    gradient.addColorStop(1, '#6366f100');

    const opts = commonChartOptions({
        label: item => ` 체중 ${item.parsed.y} kg`
    });
    opts.scales = {
        x: COMMON_X_SCALE,
        y: makeYScale('kg')
    };

    weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '체중 (kg)',
                data: values,
                borderColor: '#6366f1',
                backgroundColor: gradient,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#0a0f1e',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 8,
                tension: 0.4,
                fill: true,
                borderWidth: 3,
            }]
        },
        options: opts
    });
}

// ===== 인바디 복합 그래프 (골격근량 + 체지방량 + 체지방률) =====
function renderInbodyChart(records) {
    const card = document.getElementById('inbodyChartCard');
    const valid = records.filter(
        r => r.skeletal_muscle != null || r.body_fat != null || r.body_fat_pct != null
    ).slice().reverse();

    if (valid.length < 2) {
        card.style.display = valid.length === 1 ? 'block' : 'none';
        if (inbodyChartInstance) { inbodyChartInstance.destroy(); inbodyChartInstance = null; }
        return;
    }
    card.style.display = 'block';

    const labels = valid.map(r => r.measured_at.substring(0, 10));
    const muscleVals = valid.map(r => r.skeletal_muscle != null ? parseFloat(r.skeletal_muscle) : null);
    const fatVals = valid.map(r => r.body_fat != null ? parseFloat(r.body_fat) : null);
    const fatPctVals = valid.map(r => r.body_fat_pct != null ? parseFloat(r.body_fat_pct) : null);

    const ctx = document.getElementById('inbodyComboChart').getContext('2d');
    if (inbodyChartInstance) inbodyChartInstance.destroy();

    // 그라데이션
    const gMuscle = ctx.createLinearGradient(0, 0, 0, 260);
    gMuscle.addColorStop(0, '#22d3ee30'); gMuscle.addColorStop(1, '#22d3ee00');
    const gFat = ctx.createLinearGradient(0, 0, 0, 260);
    gFat.addColorStop(0, '#ef444430'); gFat.addColorStop(1, '#ef444400');

    const opts = commonChartOptions({
        label: item => {
            const suffix = item.datasetIndex === 2 ? ' %' : ' kg';
            return ` ${item.dataset.label}: ${item.parsed.y}${suffix}`;
        }
    });
    opts.scales = {
        x: COMMON_X_SCALE,
        yKg: Object.assign(makeYScale('kg', { position: 'left' }), {
            title: { display: true, text: 'kg', color: '#64748b', font: { size: 10 } }
        }),
        yPct: Object.assign(makeYScale('%', { position: 'right', grid: { drawOnChartArea: false } }), {
            title: { display: true, text: '%', color: '#64748b', font: { size: 10 } }
        })
    };

    inbodyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '골격근량',
                    data: muscleVals,
                    yAxisID: 'yKg',
                    borderColor: '#22d3ee',
                    backgroundColor: gMuscle,
                    pointBackgroundColor: '#22d3ee',
                    pointBorderColor: '#0a0f1e',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    tension: 0.4,
                    fill: true,
                    borderWidth: 3,
                    spanGaps: true,
                },
                {
                    label: '체지방량',
                    data: fatVals,
                    yAxisID: 'yKg',
                    borderColor: '#ef4444',
                    backgroundColor: gFat,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#0a0f1e',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 8,
                    tension: 0.4,
                    fill: true,
                    borderWidth: 3,
                    spanGaps: true,
                },
                {
                    label: '체지방률',
                    data: fatPctVals,
                    yAxisID: 'yPct',
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    pointBackgroundColor: '#f59e0b',
                    pointBorderColor: '#0a0f1e',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 8,
                    tension: 0.4,
                    fill: false,
                    borderWidth: 2,
                    borderDash: [5, 4],
                    spanGaps: true,
                }
            ]
        },
        options: opts
    });
}

// ===== 체성분 밸런스(Radar) 차트 =====
function renderRadarChart(records) {
    const card = document.getElementById('radarChartCard');
    if (records.length === 0) {
        card.style.display = 'none';
        return;
    }

    const latest = records[0];
    // 필수 데이터가 없으면 숨김
    if (latest.weight == null || latest.skeletal_muscle == null || latest.body_fat == null) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    const ctx = document.getElementById('radarChart').getContext('2d');
    if (radarChartInstance) radarChartInstance.destroy();

    // Radar 차트는 스케일 조정을 위해 데이터 정규화가 필요할 수 있으나, 
    // 여기선 직관적인 값을 그대로 보여주되 각 축의 범위를 자동 조절하게 함
    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['체중(kg)', '골격근량(kg)', '체지방량(kg)'],
            datasets: [{
                label: '체성분 밸런스',
                data: [latest.weight, latest.skeletal_muscle, latest.body_fat],
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderColor: '#6366f1',
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#6366f1',
                borderWidth: 3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: {
                        color: '#94a3b8',
                        font: { size: 12, weight: '600' }
                    },
                    ticks: {
                        display: false,
                        stepSize: 20
                    },
                    suggestedMin: 0
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a2235',
                    padding: 10,
                    callbacks: {
                        label: (item) => ` ${item.label}: ${item.raw} ${item.label.includes('%') ? '%' : 'kg'}`
                    }
                }
            }
        }
    });
}

// ===== 기록 테이블 =====
function renderRecordsTable(records) {
    const empty = document.getElementById('recordsEmpty');
    const table = document.getElementById('recordsTable');
    const tbody = document.getElementById('recordsTbody');
    const badge = document.getElementById('recordCountBadge');

    badge.textContent = `${records.length}건`;

    if (records.length === 0) {
        empty.style.display = 'block';
        table.style.display = 'none';
        return;
    }
    empty.style.display = 'none';
    table.style.display = 'block';

    tbody.innerHTML = records.map(r => `
    <tr>
      <td><strong>${formatDate(r.measured_at)}</strong></td>
      <td>${fmtNum(r.weight)}</td>
      <td>${fmtNum(r.skeletal_muscle)}</td>
      <td>${fmtNum(r.body_fat)}</td>
      <td>${fmtNum(r.body_fat_pct)}</td>
      <td style="text-align:center;">
        <div class="flex gap-1" style="justify-content:center;">
          <button class="btn btn-icon btn-sm" title="편집" onclick="openEditInbody(${r.id})">✏️</button>
          <button class="btn btn-icon btn-sm" title="삭제" onclick="openDeleteRecord(${r.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ===== 인바디 추가 모달 =====
document.getElementById('addInbodyBtn').addEventListener('click', () => {
    document.getElementById('inbodyModalTitle').textContent = '인바디 기록 추가';
    document.getElementById('editInbodyId').value = '';
    clearInbodyForm();
    document.getElementById('ibMeasuredAt').value = new Date().toISOString().split('T')[0];
    document.getElementById('inbodyModal').classList.add('active');
});

function closeInbodyModal() {
    document.getElementById('inbodyModal').classList.remove('active');
}

function clearInbodyForm() {
    ['ibMeasuredAt', 'ibWeight', 'ibSkeletal', 'ibBodyFat', 'ibBodyFatPct', 'ibNotes']
        .forEach(id => document.getElementById(id).value = '');
}

// ===== 인바디 편집 모달 =====
function openEditInbody(id) {
    const r = inbodyRecords.find(r => r.id === id);
    if (!r) return;

    document.getElementById('inbodyModalTitle').textContent = '인바디 기록 편집';
    document.getElementById('editInbodyId').value = r.id;
    document.getElementById('ibMeasuredAt').value = r.measured_at.substring(0, 10);
    document.getElementById('ibWeight').value = r.weight ?? '';
    document.getElementById('ibSkeletal').value = r.skeletal_muscle ?? '';
    document.getElementById('ibBodyFat').value = r.body_fat ?? '';
    document.getElementById('ibBodyFatPct').value = r.body_fat_pct ?? '';
    document.getElementById('ibNotes').value = r.notes ?? '';
    document.getElementById('inbodyModal').classList.add('active');
}

// ===== 인바디 저장 =====
async function saveInbody() {
    let id = document.getElementById('editInbodyId').value;
    const measured_at = document.getElementById('ibMeasuredAt').value;
    if (!measured_at) { showToast('측정일을 입력해 주세요.', 'error'); return; }

    // 신규 추가 시 중복 날짜 체크
    if (!id) {
        const existingRecord = inbodyRecords.find(r => r.measured_at.substring(0, 10) === measured_at);
        if (existingRecord) {
            const confirmUpdate = confirm(`${measured_at} 날짜에 이미 기록이 존재합니다.\n기존 기록을 수정하시겠습니까?`);
            if (!confirmUpdate) return;
            id = existingRecord.id; // 기존 ID를 사용하여 업데이트 모드로 전환
        }
    }

    const body = {
        measured_at,
        weight: document.getElementById('ibWeight').value || null,
        skeletal_muscle: document.getElementById('ibSkeletal').value || null,
        body_fat: document.getElementById('ibBodyFat').value || null,
        body_fat_pct: document.getElementById('ibBodyFatPct').value || null,
        notes: document.getElementById('ibNotes').value || null,
    };

    const btn = document.getElementById('saveInbodyBtn');
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
        const url = id ? `/api/inbody/${id}` : `/api/inbody/member/${MEMBER_ID}`;
        const method = id ? 'PUT' : 'POST';
        const res = await apiFetch(url, { method, body: JSON.stringify(body) });
        if (!res) return;
        const data = await res.json();

        if (data.success) {
            showToast(id ? '기록이 수정되었습니다.' : '기록이 추가되었습니다.', 'success');
            closeInbodyModal();
            await loadRecords();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
        btn.innerHTML = '저장';
        btn.disabled = false;
    }
}

// ===== 기록 삭제 =====
function openDeleteRecord(id) {
    deletingRecordId = id;
    document.getElementById('deleteRecordModal').classList.add('active');
}

document.getElementById('confirmDeleteRecordBtn').addEventListener('click', async () => {
    if (!deletingRecordId) return;
    const btn = document.getElementById('confirmDeleteRecordBtn');
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
        const res = await apiFetch(`/api/inbody/${deletingRecordId}`, { method: 'DELETE' });
        if (!res) return;
        const data = await res.json();

        if (data.success) {
            showToast('기록이 삭제되었습니다.', 'success');
            document.getElementById('deleteRecordModal').classList.remove('active');
            await loadRecords();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
        btn.innerHTML = '삭제';
        btn.disabled = false;
        deletingRecordId = null;
    }
});

// ===== 회원 정보 편집 =====
document.getElementById('editMemberInfoBtn').addEventListener('click', () => {
    if (!memberData) return;
    document.getElementById('editName').value = memberData.name;
    document.getElementById('editGender').value = memberData.gender || '';
    document.getElementById('editAge').value = memberData.age || '';
    document.getElementById('editPhone').value = memberData.phone || '';
    document.getElementById('editMemo').value = memberData.memo || '';
    document.getElementById('editMemberModal').classList.add('active');
});

async function saveMemberInfo() {
    const name = document.getElementById('editName').value.trim();
    if (!name) { showToast('이름을 입력해 주세요.', 'error'); return; }

    const body = {
        name,
        gender: document.getElementById('editGender').value || null,
        age: document.getElementById('editAge').value || null,
        phone: document.getElementById('editPhone').value.trim() || null,
        memo: document.getElementById('editMemo').value.trim() || null,
    };

    const res = await apiFetch(`/api/members/${MEMBER_ID}`, { method: 'PUT', body: JSON.stringify(body) });
    if (!res) return;
    const data = await res.json();

    if (data.success) {
        memberData = data.data;
        renderMemberInfo(memberData);
        showToast('회원 정보가 수정되었습니다.', 'success');
        document.getElementById('editMemberModal').classList.remove('active');
    } else {
        showToast(data.message, 'error');
    }
}

// 모달 외부 클릭 시 닫기
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
    });
});

// ===== 내 정보 (마이페이지) 로직 =====
const myProfileBtn = document.getElementById('myProfileBtn');
if (myProfileBtn) {
    myProfileBtn.addEventListener('click', openMyProfileModal);
}

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
            location.reload();
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
        const res = await apiFetch(`/api/revolution/status/${MEMBER_ID}`);
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
            body: JSON.stringify({ memberId: MEMBER_ID, startDate })
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

    // 단백질 목표 계산 (체중 * 1.2g)
    const weight = revolutionStatus.lastWeight || (memberData ? memberData.weight : 0);
    const proteinTarget = weight ? Math.round(weight * 1.2) : 0;

    // 권장 단식 시간 (주 1회 24시간 단식은 3주차부터)
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
        memberId: MEMBER_ID,
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

// 리포트 모달 관련
async function openRevReportModal() {
    try {
        const res = await apiFetch(`/api/revolution/logs/${MEMBER_ID}`);
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
    const today = new Date();

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

init();
