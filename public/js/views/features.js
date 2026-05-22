import { navigate } from '../router.js';
import { FEATURE_CATEGORIES, FEATURE_STATS, SITE } from '../site-content.js';

function renderFeatureItem(item) {
  const path = item.path || '/docs';
  return `
    <button type="button" class="feat-card" data-go="${path}">
      <span class="feat-card-icon" aria-hidden="true">${item.icon}</span>
      <strong class="feat-card-title font-display">${item.title}</strong>
      <p class="feat-card-desc">${item.desc}</p>
    </button>`;
}

function renderCategory(cat) {
  const align = cat.align === 'right' ? ' is-right' : '';
  return `
    <section class="feat-section feat-theme-${cat.theme}${align}" id="feat-cat-${cat.id}">
      <div class="feat-section-inner">
        <header class="feat-section-head">
          <span class="feat-section-badge">
            <span class="feat-badge-icon" aria-hidden="true">${cat.badgeIcon}</span>
            ${cat.badge}
          </span>
          <h2 class="feat-section-title font-display">${cat.title}</h2>
          <p class="feat-section-desc">${cat.description}</p>
        </header>
        <div class="feat-items-row">
          ${cat.items.map(renderFeatureItem).join('')}
        </div>
      </div>
    </section>`;
}

export function renderFeatures({ main }) {
  main.innerHTML = `
    <div class="view-page view-features">
      <header class="feat-hero">
        <p class="feat-hero-kicker">Nền tảng</p>
        <h1 class="feat-hero-title font-display">Tính năng Nền tảng</h1>
        <p class="feat-hero-lead">
          ${SITE.tagline} — tích hợp ${SITE.api}. Một workspace cho video, hình ảnh,
          giọng nói, nhạc và avatar với catalog model thống nhất.
        </p>
        <div class="feat-stats-row">
          ${FEATURE_STATS.map(
            (s) => `
            <div class="feat-stat">
              <span class="feat-stat-value font-display">${s.value}</span>
              <span class="feat-stat-label">${s.label}</span>
            </div>`
          ).join('')}
        </div>
      </header>

      <div class="feat-sections">
        ${FEATURE_CATEGORIES.map(renderCategory).join('')}
      </div>

      <section class="feat-cta">
        <div class="feat-cta-inner">
          <span class="feat-cta-icon" aria-hidden="true">🚀</span>
          <h3 class="font-display">Sẵn sàng bắt đầu?</h3>
          <p>Kết nối token API và mở Studio — tạo nội dung trong vài phút.</p>
          <div class="feat-cta-actions">
            <button type="button" class="feat-cta-primary" data-go="/create/image">Bắt đầu miễn phí</button>
            <button type="button" class="feat-cta-secondary" data-go="/models">Xem Models</button>
          </div>
        </div>
      </section>
    </div>
  `;

  main.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.go));
  });
}
