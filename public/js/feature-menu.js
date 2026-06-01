import { navigate } from './router.js';
import { JOB_TYPES } from './ui-labels.js';

export const FEATURE_MENU_GROUPS = [
  {
    title: 'TRANG CHÍNH',
    items: [
      { id: 'dash', label: 'Dashboard', icon: '◫', path: '/', accent: 'home' },
      { id: 'feat', label: 'Tính năng', icon: '✦', path: '/features', accent: 'features' },
      { id: 'models', label: 'Danh sách Model', icon: '⬡', path: '/models', accent: 'models' },
      { id: 'matrix', label: 'Model Matrix', icon: '▦', path: '/matrix', accent: 'matrix' },
    ],
  },
  {
    title: 'TẠO AI',
    items: JOB_TYPES.map((t) => ({
      id: `create-${t.value}`,
      label: t.label,
      icon: t.icon,
      path: `/create/${t.value}`,
      accent: t.value,
    })),
  },
  {
    title: 'THƯ VIỆN',
    items: [
      { id: 'hist-all', label: 'Lịch sử tất cả', icon: '📚', path: '/history', accent: 'history' },
      ...JOB_TYPES.map((t) => ({
        id: `hist-${t.value}`,
        label: `Lịch sử ${t.label}`,
        icon: t.icon,
        path: `/history/${t.value}`,
        accent: t.value,
      })),
    ],
  },
  {
    title: 'TÀI LIỆU & HỖ TRỢ',
    items: [
      { id: 'docs', label: 'Hướng dẫn (Docs)', icon: '📖', path: '/docs', accent: 'docs' },
      { id: 'support', label: 'Support', icon: '💬', path: '/support', accent: 'support' },
      { id: 'privacy', label: 'Privacy', icon: '🔒', path: '/privacy', accent: 'privacy' },
      { id: 'settings', label: 'Cài đặt API', icon: '⚙', path: '/settings', accent: 'settings' },
    ],
  },
];

const ROUTE_LABELS = {
  '/': 'Dashboard',
  '/features': 'Tính năng',
  '/models': 'Models',
  '/matrix': 'Model Matrix',
  '/docs': 'Tài liệu',
  '/support': 'Support',
  '/privacy': 'Privacy',
  '/create': 'Studio',
  '/settings': 'Cài đặt',
  '/history': 'Lịch sử',
};

let open = false;

function $(id) {
  return document.getElementById(id);
}

function renderPanel() {
  const panel = $('featureMenuPanel');
  if (!panel) return;

  panel.innerHTML = FEATURE_MENU_GROUPS.map(
    (group) => `
    <div class="feature-menu-group">
      <p class="feature-menu-group-title">${group.title}</p>
      <ul class="feature-menu-list">
        ${group.items
          .map(
            (item) => `
          <li>
            <button type="button" class="feature-menu-item" data-path="${item.path}" data-accent="${item.accent || ''}">
              <span class="feature-menu-icon">${item.icon}</span>
              <span class="feature-menu-label">${item.label}</span>
            </button>
          </li>`
          )
          .join('')}
      </ul>
    </div>`
  ).join('');

  panel.querySelectorAll('.feature-menu-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.path);
      closeFeatureMenu();
    });
  });
}

export function closeFeatureMenu() {
  open = false;
  $('featureMenuPanel')?.classList.remove('is-open');
  $('featureMenuBackdrop')?.classList.remove('is-open');
  $('featureMenuToggle')?.classList.remove('is-open');
  $('featureMenuToggle')?.setAttribute('aria-expanded', 'false');
}

export function openFeatureMenu() {
  open = true;
  $('featureMenuPanel')?.classList.add('is-open');
  $('featureMenuBackdrop')?.classList.add('is-open');
  $('featureMenuToggle')?.classList.add('is-open');
  $('featureMenuToggle')?.setAttribute('aria-expanded', 'true');
}

export function toggleFeatureMenu(e) {
  e?.stopPropagation();
  if (open) closeFeatureMenu();
  else openFeatureMenu();
}

export function updateFeatureMenuRoute(segments) {
  const labelEl = $('featureMenuLabel');
  if (!labelEl) return;

  let label = 'Menu';
  let accent = '';

  if (segments.length === 0) {
    label = ROUTE_LABELS['/'];
    accent = 'home';
  } else if (segments[0] === 'create') {
    const t = JOB_TYPES.find((j) => j.value === segments[1]);
    label = t ? t.label : ROUTE_LABELS['/create'];
    accent = segments[1] || '';
  } else if (segments[0] === 'history') {
    const t = JOB_TYPES.find((j) => j.value === segments[1]);
    label = t ? `Lịch sử · ${t.label}` : ROUTE_LABELS['/history'];
    accent = segments[1] || 'history';
  } else {
    const path = `/${segments[0]}`;
    label = ROUTE_LABELS[path] || segments[0];
    accent = segments[0];
  }

  labelEl.textContent = label;
  const toggle = $('featureMenuToggle');
  if (toggle) {
    toggle.dataset.accent = accent;
    toggle.classList.toggle('has-accent', Boolean(accent));
  }

  const current = segments.length ? `#/${segments.join('/')}` : '#/';
  $('featureMenuPanel')?.querySelectorAll('.feature-menu-item').forEach((btn) => {
    const path = btn.dataset.path;
    const normalized = path === '/' ? '#/' : `#${path.startsWith('/') ? path : `/${path}`}`;
    btn.classList.toggle('active', normalized === current);
  });
}

let bound = false;

export function initFeatureMenu() {
  renderPanel();
  if (bound) return;
  bound = true;

  $('featureMenuToggle')?.addEventListener('click', toggleFeatureMenu);
  $('featureMenuBackdrop')?.addEventListener('click', closeFeatureMenu);
  $('featureMenuPanel')?.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFeatureMenu();
  });
  window.addEventListener('hashchange', () => closeFeatureMenu());
}
