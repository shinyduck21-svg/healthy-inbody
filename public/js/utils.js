/**
 * utils.js
 * MongFit 공통 유틸리티 함수
 * RULES.md 규정에 따른 필수 함수 정의
 */

/**
 * 별점 시각적 업데이트 (ReferenceError 방지용 기본 구현)
 */
function updateStarVisuals(container, value) {
    if (!container) return;
    const stars = container.querySelectorAll('.star');
    stars.forEach(s => {
        if (parseInt(s.dataset.value) <= value) {
            s.classList.add('selected');
        } else {
            s.classList.remove('selected');
        }
    });
}

/**
 * 별점 기능 설정 (ReferenceError 방지용 기본 구현)
 */
function setupStarRating(containerId, inputId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    if (!container || !input) return;

    const stars = container.querySelectorAll('.star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const value = parseInt(star.dataset.value);
            input.value = value;
            updateStarVisuals(container, value);
        });
    });
}

// 전역 노출
window.updateStarVisuals = updateStarVisuals;
window.setupStarRating = setupStarRating;
