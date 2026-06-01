import { DOC_SECTIONS, SITE } from '../site-content.js';
import { navigate } from '../router.js';
import { buildPageShell, bindPageShell, buildQuickNav, defaultPageActions } from '../page-shell.js';

export function renderDocs({ main, params = {} }) {
  const activeId = params.section || 'start';

  const content = `
    <nav class="page-split-nav panel docs-nav" aria-label="Mục lục">
      ${DOC_SECTIONS.map(
        (s) => `
        <button type="button" class="docs-nav-item${activeId === s.id ? ' active' : ''}" data-section="${s.id}">
          ${s.title}
        </button>`
      ).join('')}
    </nav>
    <article class="page-split-main panel docs-content" id="docsContent"></article>`;

  main.innerHTML = buildPageShell({
    kicker: 'Tài liệu',
    title: 'Hướng dẫn sử dụng',
    lead: `Chi tiết từng tính năng ${SITE.name}.`,
    backTo: '/',
    subBar: buildQuickNav(`/docs/${activeId}`),
    actions: defaultPageActions(),
    bodyClass: 'is-split',
    content,
  });

  bindPageShell(main);

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
