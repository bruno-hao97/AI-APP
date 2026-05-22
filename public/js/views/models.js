import { GommoClient } from '../gommo-client.js';
import { loadSettings, hasToken } from '../settings-store.js';
import { modelSlug, isModelAvailable } from '../model-schema.js';
import { JOB_TYPES, formatPrice, getModelCategory } from '../ui-labels.js';
import { navigate } from '../router.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** @param {{ main: HTMLElement, params?: { type?: string } }} ctx */
export function renderModels({ main, params = {} }) {
  const activeType = params.type || JOB_TYPES[0].value;

  main.innerHTML = `
    <div class="view-page view-models">
      <header class="page-hero-sm">
        <p class="page-kicker">Catalog</p>
        <h1 class="hero-gradient font-display">Danh sách Model</h1>
        <p class="page-lead center">Model AI theo từng loại nội dung — lấy trực tiếp từ API Gommo khi đã kết nối token.</p>
      </header>

      <div class="model-page-tabs" role="tablist">
        ${JOB_TYPES.map(
          (t) => `
          <button type="button" class="pg-tab${activeType === t.value ? ' active' : ''}" data-type="${t.value}">
            ${t.icon} ${t.label}
          </button>`
        ).join('')}
      </div>

      <div id="modelsTokenWarn" class="banner warn" ${hasToken() ? 'hidden' : ''}>
        <strong>Chưa có token.</strong> Vào <a href="#/settings">Cài đặt API</a> để tải danh sách model thật.
      </div>

      <div id="modelsLoading" class="loading" hidden>Đang tải model…</div>
      <div id="modelsError" class="notice error" hidden></div>
      <div id="modelsGrid" class="models-catalog-grid"></div>
    </div>
  `;

  main.querySelectorAll('[data-type]').forEach((tab) => {
    tab.addEventListener('click', () => navigate(`/models/${tab.dataset.type}`));
  });

  if (hasToken()) void loadModelsCatalog(main, activeType);
  else renderModelsPlaceholder(main, activeType);
}

async function loadModelsCatalog(main, type) {
  const grid = main.querySelector('#modelsGrid');
  const loading = main.querySelector('#modelsLoading');
  const errEl = main.querySelector('#modelsError');
  loading.hidden = false;
  errEl.hidden = true;
  grid.innerHTML = '';

  try {
    const c = new GommoClient(loadSettings());
    const env = await c.fetchModels(type);
    const list = c.listModels(env).filter(isModelAvailable);
    if (!list.length) {
      grid.innerHTML = '<p class="hint center">Không có model khả dụng cho loại này.</p>';
      return;
    }
    grid.innerHTML = list
      .map((m) => {
        const slug = modelSlug(m);
        const cat = getModelCategory(m);
        const price = formatPrice(m.price, m.sale);
        return `
        <article class="model-catalog-card">
          <span class="tag">${escapeHtml(cat.tag)}</span>
          <h3 class="font-display">${escapeHtml(m.name || slug)}</h3>
          <p class="model-catalog-slug">${escapeHtml(slug)}</p>
          <p class="model-catalog-desc">${escapeHtml((m.description || cat.hint).slice(0, 140))}${(m.description || '').length > 140 ? '…' : ''}</p>
          ${price ? `<p class="model-catalog-price">${escapeHtml(price)}</p>` : ''}
          <button type="button" class="secondary pg-sm" data-use="${type}" data-slug="${escapeHtml(slug)}">Dùng model →</button>
        </article>`;
      })
      .join('');

    grid.querySelectorAll('[data-use]').forEach((btn) => {
      btn.addEventListener('click', () => navigate(`/create/${btn.dataset.use}`));
    });
  } catch (e) {
    errEl.hidden = false;
    errEl.textContent = e.message || 'Không tải được model.';
  } finally {
    loading.hidden = true;
  }
}

function renderModelsPlaceholder(main, type) {
  const t = JOB_TYPES.find((j) => j.value === type);
  main.querySelector('#modelsGrid').innerHTML = `
    <div class="panel models-placeholder">
      <p>Tab <strong>${t?.label || type}</strong> — kết nối token để xem danh sách model thực tế từ Gommo.</p>
      <p class="hint">Ví dụ catalog: GPT Image, Flux, Kling, Suno, v.v. tùy tài khoản 79AI.</p>
      <button type="button" class="primary" id="modelsGoSettings">Kết nối API</button>
    </div>
  `;
  main.querySelector('#modelsGoSettings')?.addEventListener('click', () => navigate('/settings'));
}
