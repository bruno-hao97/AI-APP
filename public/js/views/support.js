import { SUPPORT_FAQ, SITE } from '../site-content.js';
import { navigate } from '../router.js';
import { buildPageShell, bindPageShell, buildQuickNav, defaultPageActions } from '../page-shell.js';

export function renderSupport({ main }) {
  const content = `
    <div class="page-body-inner">
      <div class="view-page view-support">
        <div class="support-grid">
          <section class="panel">
            <h2 class="font-display">Liên hệ</h2>
            <ul class="support-contact">
              <li><strong>API / Token:</strong> Quản trị 79AI hoặc đội vận hành Gommo</li>
              <li><strong>Tài liệu:</strong> <a href="#/docs" class="inline-link" id="supportDocsLink">Hướng dẫn sử dụng</a></li>
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
    </div>`;

  main.innerHTML = buildPageShell({
    kicker: 'Hỗ trợ',
    title: 'FAQ & Liên hệ',
    lead: `Hỗ trợ cho ${SITE.name}.`,
    backTo: '/',
    subBar: buildQuickNav('/support'),
    actions: defaultPageActions(),
    content,
  });

  bindPageShell(main);
  main.querySelector('#supportSettings')?.addEventListener('click', () => navigate('/settings'));
  main.querySelector('#supportDocsLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/docs');
  });
}
