import { PRIVACY_SECTIONS, SITE } from '../site-content.js';
import { buildPageShell, bindPageShell, buildQuickNav, defaultPageActions } from '../page-shell.js';

export function renderPrivacy({ main }) {
  const content = `
    <div class="page-body-inner">
      <div class="view-page view-privacy">
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
    </div>`;

  main.innerHTML = buildPageShell({
    kicker: 'Pháp lý',
    title: 'Quyền riêng tư',
    lead: `Cập nhật cho ${SITE.name} — SPA chạy trên trình duyệt.`,
    backTo: '/',
    subBar: buildQuickNav('/privacy'),
    actions: defaultPageActions(),
    content,
  });

  bindPageShell(main);
}
