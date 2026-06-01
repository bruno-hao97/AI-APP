import { navigate } from './router.js';

/** Quick nav — sub bar đồng bộ mọi trang */
export const APP_QUICK_NAV = [
  { label: 'Trang chủ', path: '/' },
  { label: 'Tính năng', path: '/features' },
  { label: 'Models', path: '/models' },
  { label: 'Matrix', path: '/matrix' },
  { label: 'Docs', path: '/docs' },
  { label: 'Lịch sử', path: '/history' },
];

/**
 * @param {{
 *   kicker?: string,
 *   title: string,
 *   lead?: string,
 *   backTo?: string | null,
 *   actions?: string,
 *   subBar?: string,
 *   content: string,
 *   extraClass?: string,
 *   bodyClass?: string,
 * }} opts
 */
export function buildPageShell({
  kicker = '',
  title,
  lead = '',
  backTo = '/',
  actions = defaultPageActions(),
  subBar = buildQuickNav('/'),
  content,
  extraClass = '',
  bodyClass = '',
}) {
  const backBtn =
    backTo != null
      ? `<button type="button" class="pg-back" data-page-back="${backTo}" title="Quay lại">←</button>`
      : '';

  return `
    <div class="page-shell pg-shell ${extraClass}">
      <header class="pg-bar pg-bar-top">
        <div class="pg-bar-left">
          ${backBtn}
          <div class="page-bar-titles">
            ${kicker ? `<span class="page-kicker-inline">${escapeHtml(kicker)}</span>` : ''}
            <span class="pg-bar-title font-display">${escapeHtml(title)}</span>
            ${lead ? `<p class="page-lead-inline">${escapeHtml(lead)}</p>` : ''}
          </div>
        </div>
        <div class="pg-bar-right page-bar-actions">${actions}</div>
      </header>
      ${subBar ? `<div class="pg-bar pg-bar-sub">${subBar}</div>` : ''}
      <div class="page-workspace ${bodyClass}">
        ${content}
      </div>
    </div>`;
}

export function defaultPageActions({ showStudio = true, extra = '' } = {}) {
  return `
    ${showStudio ? '<button type="button" class="secondary pg-sm" data-page-go="/create">Studio</button>' : ''}
    <button type="button" class="secondary pg-sm" data-page-go="/matrix">Matrix</button>
    <button type="button" class="secondary pg-sm" data-page-go="/settings">Token API</button>
    ${extra}`;
}

function normPath(p) {
  return p === '/' || p === '' ? '/' : p.replace(/\/$/, '');
}

function isNavActive(itemPath, current) {
  const item = normPath(itemPath);
  const cur = normPath(current);
  if (item === '/') return cur === '/';
  return cur === item || cur.startsWith(`${item}/`);
}

/** @param {string} activePath */
export function buildQuickNav(activePath) {
  return `
    <nav class="page-sub-nav" aria-label="Điều hướng">
      ${APP_QUICK_NAV.map((item) => {
        const active = isNavActive(item.path, activePath);
        return `<button type="button" class="page-sub-link${active ? ' active' : ''}" data-page-go="${item.path}">${escapeHtml(item.label)}</button>`;
      }).join('')}
    </nav>`;
}

/**
 * @param {{ value: string, label: string, icon?: string }[]} items
 * @param {string} active
 * @param {string} dataAttr
 * @param {(value: string) => void} onPick — optional; default navigates /base/{value}
 * @param {string} [basePath]
 */
export function buildSegmentTabs(items, active, dataAttr, basePath = '') {
  return `
    <div class="page-segment-tabs" role="tablist">
      ${items
        .map((item) => {
          const isActive = item.value === active;
          return `<button type="button" class="page-sub-link${isActive ? ' active' : ''}" data-${dataAttr}="${escapeHtml(item.value)}" role="tab">${item.icon ? `${item.icon} ` : ''}${escapeHtml(item.label)}</button>`;
        })
        .join('')}
    </div>`;
}

export function bindPageShell(main) {
  main.querySelector('[data-page-back]')?.addEventListener('click', () => {
    const to = main.querySelector('[data-page-back]')?.dataset.pageBack || '/';
    navigate(to);
  });
  bindPageActions(main);
}

export function bindPageActions(main) {
  main.querySelectorAll('[data-page-go]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.pageGo));
  });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}
