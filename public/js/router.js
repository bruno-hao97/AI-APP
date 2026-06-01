/** Hash router */
import { updateFeatureMenuRoute } from './feature-menu.js';

const routes = new Map();

export function route(path, handler) {
  routes.set(path, handler);
}

function parseHash() {
  const raw = (location.hash || '#/').slice(1);
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
  return { segments, query };
}

function matchRoute(segments) {
  const joined = segments.join('/');
  if (routes.has(joined)) return { handler: routes.get(joined), params: {} };

  const dynamic = [
    ['create', 'type'],
    ['history', 'type'],
    ['models', 'type'],
    ['docs', 'section'],
  ];

  for (const [base, paramKey] of dynamic) {
    if (segments[0] === base) {
      const h = routes.get(base);
      if (h) return { handler: h, params: { [paramKey]: segments[1] || null } };
    }
  }

  const h = routes.get('') || routes.get('/');
  return h ? { handler: h, params: {} } : null;
}

export function navigate(path) {
  const clean = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
  if (location.hash === clean) {
    dispatch();
    return;
  }
  location.hash = clean;
}

export function dispatch() {
  const { segments, query } = parseHash();
  const match = matchRoute(segments);
  const main = document.getElementById('app-main');
  if (!main || !match) return;

  document.body.classList.toggle('is-landing-page', segments.length === 0);
  document.body.classList.toggle('shell-active', true);
  document.body.classList.toggle('pg-active', segments[0] === 'create');
  document.body.dataset.page = segments[0] || 'home';

  document.querySelectorAll('[data-topnav]').forEach((el) => {
    const path = el.dataset.topnav.replace(/^\//, '').split('/')[0] || 'home';
    const current = segments[0] || 'home';
    el.classList.toggle('active', path === current || (path === 'home' && !segments.length));
  });

  main.classList.toggle('is-landing', segments.length === 0);
  main.classList.toggle(
    'is-wide',
    segments.length === 0 ||
      ['create', 'history', 'models', 'matrix', 'features', 'docs', 'support', 'privacy'].includes(segments[0])
  );

  try {
    match.handler({ main, params: match.params, query, segments });
  } catch (err) {
    console.error('[router]', segments.join('/'), err);
    main.innerHTML = `
      <div class="panel notice error" style="margin:1.5rem">
        <strong>Lỗi render trang</strong>
        <p>${String(err?.message || err)}</p>
        <p class="hint">Mở DevTools (F12) → Console để xem chi tiết. Thử Ctrl+F5 tải lại.</p>
      </div>`;
  }
  updateFeatureMenuRoute(segments);
}

export function startRouter() {
  window.addEventListener('hashchange', dispatch);
  if (!location.hash || location.hash === '#') location.hash = '#/';
  else dispatch();
}
