/**
 * member.js - 회원 상세 페이지 로직
 * Chart.js를 활용한 인바디 변화 추이 차트 포함
 */

if (!requireAuth()) throw new Error('Not authenticated');
document.getElementById('adminName').textContent = getAdminName();

// URL에서 회원 ID 파싱
const urlParams = new URLSearchParams(window.location.search);
const MEMBER_ID = urlParams.get('id');
if (!MEMBER_ID) window.location.href = '/';

let memberData = null;
let inbodyRecords = [];
let weightChartInstance = null;
let inbodyChartInstance = null;
let deletingRecordId = null;

// ===== 초기화 =====
async function init() {
    await Promise.all([loadMember(), loadRecords()]);
}

// ===== 회원 정보 로드 =====
async function loadMember() {
    const res = await apiFetch(`/api/members/${MEMBER_ID}`);
    if (!res) return;
    const data = await res.json();
    if (!data.success) { window.location.href = '/'; return; }

    memberData = data.data;
    renderMemberInfo(memberData);
}

function renderMemberInfo(m) {
    document.title = `Healty - ${m.name}`;
    const genderLabel = m.gender === 'M' ? '남성' : m.gender === 'F' ? '여성' : '미기입';
    const avatarClass = m.gender === 'M' ? 'avatar-male' : m.gender === 'F' ? 'avatar-female' : 'avatar-default';

    document.getElementById('memberAvatarLarge').textContent = m.name.charAt(0);
    document.getElementById('memberAvatarLarge').className = `member-avatar ${avatarClass}`;
    document.getElementById('memberNameTitle').textContent = m.name;
    document.getElementById('memberSubtitle').textContent = `${genderLabel} · ${formatDate(m.created_at)} 등록`;

    document.getElementById('infoGender').textContent = genderLabel;
    document.getElementById('infoBirth').textContent = m.birth_date ? formatDate(m.birth_date) : '-';
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
                pointRadius: 6,
                pointHoverRadius: 9,
                tension: 0.35,
                fill: true,
                borderWidth: 2.5,
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
                    tension: 0.35,
                    fill: true,
                    borderWidth: 2.5,
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
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    tension: 0.35,
                    fill: true,
                    borderWidth: 2.5,
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
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    tension: 0.35,
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
    const id = document.getElementById('editInbodyId').value;
    const measured_at = document.getElementById('ibMeasuredAt').value;
    if (!measured_at) { showToast('측정일을 입력해 주세요.', 'error'); return; }

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
    document.getElementById('editBirth').value = memberData.birth_date || '';
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
        birth_date: document.getElementById('editBirth').value || null,
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

init();
