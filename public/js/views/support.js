import { SUPPORT_FAQ, SITE } from '../site-content.js';
import { navigate } from '../router.js';

export function renderSupport({ main }) {
  main.innerHTML = `
    <div class="view-page view-support">
      <header class="page-hero-sm">
        <p class="page-kicker">Hỗ trợ</p>
        <h1 class="hero-gradient font-display">Chúng tôi có thể giúp gì?</h1>
        <p class="page-lead center">FAQ và liên hệ cho ${SITE.name}.</p>
      </header>

      <div class="support-grid">
        <section class="panel">
          <h2 class="font-display">Liên hệ</h2>
          <ul class="support-contact">
            <li><strong>API / Token:</strong> Quản trị 79AI hoặc đội vận hành Gommo</li>
            <li><strong>Tài liệu:</strong> <a href="#/docs" class="inline-link">Hướng dẫn sử dụng</a></li>
            <li><strong>Endpoint:</strong> <code>https://v2.api.gommo.net</code></li>
          </ul>
        </section>

        <section class="panel">
          <h2 class="font-display">Câu hỏi thường gặp</h2>
          <div class="faq-list">
            ${SUPPORT_FAQ.map(
              (f) => `
              <details class="faq-item">
                <summary>${f.q}</summary>
                <p>${f.a}</p>
              </details>`
            ).join('')}
          </div>
        </section>
      </div>

      <section class="panel cta-band">
        <p>Chưa kết nối API?</p>
        <button type="button" class="primary" id="supportSettings">Mở Cài đặt token</button>
      </section>
    </div>
  `;

  main.querySelector('#supportSettings')?.addEventListener('click', () => navigate('/settings'));
  main.querySelector('a[href="#/docs"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/docs');
  });
}
