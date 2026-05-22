import { DOC_SECTIONS, SITE } from '../site-content.js';
import { navigate } from '../router.js';

export function renderDocs({ main, params = {} }) {
  const activeId = params.section || 'start';

  main.innerHTML = `
    <div class="view-page view-docs">
      <header class="page-hero-sm">
        <p class="page-kicker">Tài liệu</p>
        <h1 class="hero-gradient font-display">Hướng dẫn sử dụng</h1>
        <p class="page-lead center">Chi tiết từng tính năng ${SITE.name}.</p>
      </header>

      <div class="docs-layout">
        <nav class="docs-nav panel" aria-label="Mục lục">
          ${DOC_SECTIONS.map(
            (s) => `
            <button type="button" class="docs-nav-item${activeId === s.id ? ' active' : ''}" data-section="${s.id}">
              ${s.title}
            </button>`
          ).join('')}
        </nav>
        <article class="panel docs-content" id="docsContent"></article>
      </div>
    </div>
  `;

  function showSection(id) {
    const sec = DOC_SECTIONS.find((s) => s.id === id) || DOC_SECTIONS[0];
    main.querySelector('#docsContent').innerHTML = `
      <h2 class="font-display">${sec.title}</h2>
      <div class="docs-prose">${sec.body}</div>
    `;
    main.querySelectorAll('.docs-nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.section === sec.id);
    });
  }

  main.querySelectorAll('.docs-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate(`/docs/${btn.dataset.section}`);
    });
  });

  showSection(activeId);
}
