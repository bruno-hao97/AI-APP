import { listHistory, removeHistoryEntry, isMediaUrl } from './history-store.js';
import { formatPrice } from './ui-labels.js';

export const CREATE_TITLES = {
  image: 'Tạo Ảnh',
  video: 'Tạo Video',
  tts: 'Tạo Giọng nói',
  music: 'Tạo Nhạc',
  'avatar-lipsync': 'Tạo Avatar',
};

let galleryTab = 'current';
let gallerySort = 'new';
let gallerySearch = '';
let libraryGridCols = 4;
let libraryFilterModel = '';
let libraryFilterRatio = '';
/** @type {{ id: string, status: 'loading'|'done', resultUrl?: string, prompt: string, modelName: string, modelSlug: string, meta: Record<string,string>, createdAt: string, message?: string }[]} */
let sessionItems = [];

export function getGalleryTab() {
  return galleryTab;
}

export function setGalleryTab(tab) {
  galleryTab = tab;
}

export function resetSession() {
  sessionItems = [];
}

export function addLoadingSession(prompt, modelName, modelSlug, meta = {}) {
  const id = `loading-${Date.now()}`;
  sessionItems = [
    {
      id,
      status: 'loading',
      prompt,
      modelName,
      modelSlug,
      meta,
      createdAt: new Date().toISOString(),
      message: 'ĐANG TẠO…',
    },
    ...sessionItems.filter((s) => s.status !== 'loading'),
  ];
  return id;
}

export function finishLoadingSession(loadingId, resultUrl) {
  sessionItems = sessionItems.map((s) =>
    s.id === loadingId
      ? { ...s, status: 'done', resultUrl, message: undefined }
      : s
  );
}

export function removeLoadingSession(loadingId) {
  sessionItems = sessionItems.filter((s) => s.id !== loadingId);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function dateGroupLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = startOfDay(now) - startOfDay(d);
  if (diff === 0) return 'HÔM NAY';
  if (diff === 86400000) return 'HÔM QUA';
  const months = [
    'THÁNG 1', 'THÁNG 2', 'THÁNG 3', 'THÁNG 4', 'THÁNG 5', 'THÁNG 6',
    'THÁNG 7', 'THÁNG 8', 'THÁNG 9', 'THÁNG 10', 'THÁNG 11', 'THÁNG 12',
  ];
  return `${months[d.getMonth()]} NĂM ${d.getFullYear()}`;
}

function groupByDate(entries) {
  const groups = new Map();
  entries.forEach((e) => {
    const key = dateGroupLabel(e.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });
  return groups;
}

function filterEntries(entries) {
  let list = [...entries];
  const q = gallerySearch.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (e) =>
        (e.prompt || '').toLowerCase().includes(q) ||
        (e.modelName || '').toLowerCase().includes(q) ||
        (e.modelSlug || '').toLowerCase().includes(q)
    );
  }
  if (libraryFilterModel) {
    list = list.filter((e) => (e.modelSlug || '') === libraryFilterModel);
  }
  if (libraryFilterRatio) {
    list = list.filter((e) => (e.meta?.ratio || '') === libraryFilterRatio);
  }
  if (gallerySort === 'old') {
    list = [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else {
    list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return list;
}

function metaTags(entry) {
  const parts = [];
  if (entry.modelName) parts.push(entry.modelName);
  if (entry.meta?.resolution) parts.push(entry.meta.resolution);
  else if (entry.meta?.mode) parts.push(entry.meta.mode);
  return parts.join(' · ') || entry.modelSlug || '—';
}

function renderMediaThumb(entry, jobType) {
  if (entry.status === 'loading') {
    return `
      <div class="sg-card-loading">
        <div class="sg-spinner"></div>
        <p>${escapeHtml(entry.message || 'ĐANG TẠO…')}</p>
      </div>`;
  }
  const url = entry.resultUrl;
  if (!url) return `<span class="sg-card-placeholder">${jobType === 'image' ? '🖼️' : '📄'}</span>`;
  const kind = isMediaUrl(url, jobType);
  if (kind === 'image') {
    return `<img src="${escapeHtml(url)}" alt="" loading="lazy" />`;
  }
  if (kind === 'video') {
    return `<video src="${escapeHtml(url)}" muted preload="metadata"></video>`;
  }
  if (kind === 'audio') {
    return `<span class="sg-card-audio">🔊 Audio</span>`;
  }
  return `<span class="sg-card-placeholder">📄</span>`;
}

function renderGridCard(entry, jobType, { showOverlay = true } = {}) {
  const prompt = (entry.prompt || '(Không có mô tả)').slice(0, 80);
  const overlay = showOverlay
    ? `<div class="sg-card-badges">
        <span class="sg-badge-model">${escapeHtml(metaTags(entry))}</span>
        ${entry.meta?.resolution ? `<span class="sg-badge-res">${escapeHtml(entry.meta.resolution)}</span>` : ''}
      </div>`
    : '';
  const clickable = entry.resultUrl
    ? `data-open-url="${escapeHtml(entry.resultUrl)}"`
    : entry.status === 'loading'
      ? ''
      : '';
  return `
    <article class="sg-card${entry.status === 'loading' ? ' is-loading' : ''}" data-entry-id="${escapeHtml(entry.id)}" ${clickable}>
      <div class="sg-card-media">${renderMediaThumb(entry, jobType)}</div>
      ${overlay}
      ${entry.prompt ? `<p class="sg-card-prompt" title="${escapeHtml(entry.prompt)}">${escapeHtml(prompt)}</p>` : ''}
    </article>`;
}

function renderHistoryPromptCard(entry) {
  const prompt = entry.prompt || '(Không có mô tả)';
  return `
    <article class="sg-hist-card" data-reuse-id="${escapeHtml(entry.id)}" title="Nhấn để dùng lại prompt">
      <p class="sg-hist-prompt">${escapeHtml(prompt)}</p>
      <div class="sg-hist-foot">
        <time>${formatTime(entry.createdAt)}</time>
        <div class="sg-hist-actions">
          ${entry.resultUrl ? `<button type="button" class="sg-hist-btn ok" data-open-url="${escapeHtml(entry.resultUrl)}" title="Mở kết quả">✓</button>` : ''}
          <button type="button" class="sg-hist-btn danger" data-delete-id="${escapeHtml(entry.id)}" title="Xóa">✕</button>
        </div>
      </div>
    </article>`;
}

function renderDateSections(entries, jobType, renderItem, listClass = 'sg-grid') {
  if (!entries.length) return '';
  const groups = groupByDate(entries);
  const cols = listClass === 'sg-grid' ? ` style="--sg-cols:${libraryGridCols}"` : '';
  return [...groups.entries()]
    .map(([label, items]) => {
      return `
        <section class="sg-date-group">
          <h3 class="sg-date-head"><span class="sg-date-icon">📅</span> ${escapeHtml(label)} <span class="sg-date-count">(${items.length})</span></h3>
          <div class="${listClass}${listClass === 'sg-grid' ? ' sg-date-grid' : ''}"${cols}>${items.map((e) => renderItem(e, jobType)).join('')}</div>
        </section>`;
    })
    .join('');
}

function renderCurrentPanel(jobType) {
  const done = sessionItems.filter((s) => s.status === 'done' && s.resultUrl);
  const loading = sessionItems.filter((s) => s.status === 'loading');
  const items = [...loading, ...done];
  if (!items.length) {
    return `
      <div class="sg-empty">
        <span class="sg-empty-icon">${jobType === 'image' ? '🖼️' : '✨'}</span>
        <p>Chưa có kết quả phiên này.</p>
        <p class="hint">Nhập mô tả bên trái và nhấn <strong>${escapeHtml(CREATE_TITLES[jobType] || 'Tạo')}</strong></p>
      </div>`;
  }
  const grid = items.map((e) => renderGridCard(e, jobType)).join('');
  return `
    <div class="sg-panel sg-panel-current">
      <div class="sg-panel-toolbar">
        <span class="sg-panel-title">Phiên hiện tại (${items.length})</span>
        ${done.length ? `<button type="button" class="sg-tool-btn" id="sgSelectAll">Chọn tất cả ${done.length} mục</button>` : ''}
      </div>
      <div class="sg-grid" style="--sg-cols:${libraryGridCols}">${grid}</div>
      <p class="sg-end-hint">— Đã hiển thị tất cả —</p>
    </div>`;
}

function renderHistoryPanel(jobType) {
  const entries = filterEntries(listHistory(jobType));
  if (!entries.length) {
    return `
      <div class="sg-empty">
        <span class="sg-empty-icon">📭</span>
        <p>Chưa có lịch sử ${escapeHtml(CREATE_TITLES[jobType] || jobType)}.</p>
      </div>`;
  }
  return `
    <div class="sg-panel sg-panel-history">
      <div class="sg-hist-list">
        ${renderDateSections(entries, jobType, (e) => renderHistoryPromptCard(e), 'sg-hist-row')}
      </div>
    </div>`;
}

function renderLibraryPanel(jobType) {
  const entries = filterEntries(listHistory(jobType));
  const models = [...new Set(entries.map((e) => e.modelSlug).filter(Boolean))];
  const ratios = [...new Set(entries.map((e) => e.meta?.ratio).filter(Boolean))];

  if (!entries.length) {
    return `
      <div class="sg-empty">
        <span class="sg-empty-icon">🗂️</span>
        <p>Thư viện trống — tạo nội dung để lưu vào đây.</p>
      </div>`;
  }

  const grid = renderDateSections(entries, jobType, (e) => renderGridCard(e, jobType));

  return `
    <div class="sg-panel sg-panel-library">
      <div class="sg-lib-filters">
        <input type="search" class="sg-lib-search" id="sgLibSearch" placeholder="Tìm trong thư viện…" value="${escapeHtml(gallerySearch)}" />
        <select id="sgFilterModel" class="sg-filter-select">
          <option value="">Tất cả Model</option>
          ${models.map((m) => `<option value="${escapeHtml(m)}"${libraryFilterModel === m ? ' selected' : ''}>${escapeHtml(m)}</option>`).join('')}
        </select>
        <select id="sgFilterRatio" class="sg-filter-select">
          <option value="">Tất cả tỷ lệ</option>
          ${ratios.map((r) => `<option value="${escapeHtml(r)}"${libraryFilterRatio === r ? ' selected' : ''}>${escapeHtml(r)}</option>`).join('')}
        </select>
      </div>
      <div class="sg-lib-stack">${grid}</div>
    </div>`;
}

function renderApiPanel() {
  return `
    <div class="sg-panel sg-panel-api">
      <div class="sg-api-meta" id="pgMetaGrid">
        <div class="pg-meta-inline"><span>Model ID</span><strong id="pgMetaId">—</strong></div>
        <div class="pg-meta-inline"><span>Server</span><strong id="pgMetaServer">—</strong></div>
        <div class="pg-meta-inline"><span>Price</span><strong id="pgMetaPrice">—</strong></div>
        <div class="pg-meta-inline"><span>Type</span><strong id="pgMetaType">—</strong></div>
      </div>
      <div class="sg-api-endpoint">
        <span class="pg-method">POST</span>
        <code class="pg-url" id="pgRequestUrlSub">—</code>
        <button type="button" class="pg-copy" id="pgCopyUrl" title="Copy URL">⧉</button>
      </div>
      <details class="sg-api-block" open>
        <summary>Request body</summary>
        <pre class="log compact" id="pgRequestBody">{}</pre>
      </details>
      <details class="sg-api-block">
        <summary>Response</summary>
        <pre class="log pg-response" id="pgResponse">// Chưa có response</pre>
      </details>
      <details class="sg-api-block">
        <summary>Schema</summary>
        <pre class="log compact" id="pgSchemaJson">{}</pre>
      </details>
    </div>`;
}

function renderGalleryTools(jobType) {
  if (galleryTab === 'history') {
    return `
      <input type="search" class="sg-toolbar-search" id="sgHistSearch" placeholder="Tìm trong lịch sử…" value="${escapeHtml(gallerySearch)}" />
      <button type="button" class="sg-sort-btn${gallerySort === 'new' ? ' active' : ''}" data-sort="new">Mới</button>
      <button type="button" class="sg-sort-btn${gallerySort === 'old' ? ' active' : ''}" data-sort="old">Cũ</button>`;
  }
  if (galleryTab === 'library') {
    return `
      <label class="sg-grid-slider-label">
        <span>Cột</span>
        <input type="range" id="sgGridCols" min="2" max="6" value="${libraryGridCols}" />
        <span id="sgGridColsVal">${libraryGridCols}</span>
      </label>`;
  }
  if (galleryTab === 'current') {
    return `
      <button type="button" class="sg-view-btn active" title="Lưới">▦</button>
      <label class="sg-grid-slider-label">
        <input type="range" id="sgGridCols" min="2" max="6" value="${libraryGridCols}" />
      </label>`;
  }
  return '';
}

export function renderGalleryBody(jobType) {
  const body = document.getElementById('studioGalleryBody');
  const tools = document.getElementById('studioGalleryTools');
  if (!body) return;

  let html = '';
  if (galleryTab === 'current') html = renderCurrentPanel(jobType);
  else if (galleryTab === 'history') html = renderHistoryPanel(jobType);
  else if (galleryTab === 'library') html = renderLibraryPanel(jobType);
  else if (galleryTab === 'api') html = renderApiPanel(jobType);

  body.innerHTML = html;
  if (tools) tools.innerHTML = renderGalleryTools(jobType);

  document.querySelectorAll('[data-sg-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sgTab === galleryTab);
  });

  const histTitle = document.getElementById('sgHistCount');
  if (histTitle) {
    const n = filterEntries(listHistory(jobType)).length;
    histTitle.textContent = n > 0 ? `Lịch sử (${n})` : 'Lịch sử';
  }
}

export function syncGalleryTabs() {
  document.querySelectorAll('[data-sg-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sgTab === galleryTab);
  });
}

/**
 * @param {HTMLElement} root
 * @param {{ jobType: string, onReuse: (entry: object) => void, onRefresh: () => void }} opts
 */
export function bindGalleryEvents(root, { jobType, onReuse, onRefresh }) {
  root.querySelectorAll('[data-sg-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setGalleryTab(btn.dataset.sgTab);
      renderGalleryBody(jobType);
      bindGalleryEvents(root, { jobType, onReuse, onRefresh });
    });
  });

  root.querySelector('#sgHistSearch')?.addEventListener('input', (e) => {
    gallerySearch = e.target.value;
    renderGalleryBody(jobType);
    bindGalleryEvents(root, { jobType, onReuse, onRefresh });
  });

  root.querySelector('#sgLibSearch')?.addEventListener('input', (e) => {
    gallerySearch = e.target.value;
    renderGalleryBody(jobType);
    bindGalleryEvents(root, { jobType, onReuse, onRefresh });
  });

  root.querySelectorAll('[data-sort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      gallerySort = btn.dataset.sort;
      renderGalleryBody(jobType);
      bindGalleryEvents(root, { jobType, onReuse, onRefresh });
    });
  });

  root.querySelector('#sgFilterModel')?.addEventListener('change', (e) => {
    libraryFilterModel = e.target.value;
    renderGalleryBody(jobType);
    bindGalleryEvents(root, { jobType, onReuse, onRefresh });
  });

  root.querySelector('#sgFilterRatio')?.addEventListener('change', (e) => {
    libraryFilterRatio = e.target.value;
    renderGalleryBody(jobType);
    bindGalleryEvents(root, { jobType, onReuse, onRefresh });
  });

  root.querySelector('#sgGridCols')?.addEventListener('input', (e) => {
    libraryGridCols = Number(e.target.value) || 4;
    const val = root.querySelector('#sgGridColsVal');
    if (val) val.textContent = String(libraryGridCols);
    renderGalleryBody(jobType);
    bindGalleryEvents(root, { jobType, onReuse, onRefresh });
  });

  root.querySelectorAll('[data-reuse-id]').forEach((el) => {
    const id = el.dataset.reuseId;
    if (!id) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const entry = listHistory(jobType).find((x) => x.id === id);
      if (entry) onReuse(entry);
    };
    el.addEventListener('click', handler);
  });

  root.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeHistoryEntry(btn.dataset.deleteId);
      onRefresh();
    });
  });

  root.querySelectorAll('[data-open-url]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (el.dataset.deleteId || el.dataset.reuseId) return;
      const url = el.dataset.openUrl;
      if (url) window.open(url, '_blank', 'noopener');
    });
  });

  root.querySelectorAll('.sg-card[data-open-url]').forEach((card) => {
    card.addEventListener('click', () => {
      const url = card.dataset.openUrl;
      if (url) window.open(url, '_blank', 'noopener');
    });
  });
}

let _onReuse = () => {};

export function setGalleryReuseHandler(fn) {
  _onReuse = fn;
}

export function refreshGallery(jobType) {
  renderGalleryBody(jobType);
  const shell = document.querySelector('.studio-shell');
  if (shell) {
    bindGalleryEvents(shell, {
      jobType,
      onReuse: (entry) => _onReuse(entry),
      onRefresh: () => refreshGallery(jobType),
    });
  }
}
