import { PRIVACY_SECTIONS, SITE } from '../site-content.js';

export function renderPrivacy({ main }) {
  main.innerHTML = `
    <div class="view-page view-privacy">
      <header class="page-hero-sm">
        <p class="page-kicker">Pháp lý</p>
        <h1 class="hero-gradient font-display">Chính sách quyền riêng tư</h1>
        <p class="page-lead center">Cập nhật cho ${SITE.name} — bản demo SPA chạy trên trình duyệt.</p>
      </header>

      <article class="panel legal-doc">
        ${PRIVACY_SECTIONS.map(
          (s) => `
          <section class="legal-section">
            <h2 class="font-display">${s.title}</h2>
            <p>${s.text}</p>
          </section>`
        ).join('')}
        <p class="legal-foot hint">Nếu triển khai production, cần bổ sung policy theo quy định pháp luật và nhà cung cấp API.</p>
      </article>
    </div>
  `;
}
