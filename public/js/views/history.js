import { listHistory, removeHistoryEntry, clearHistory, countHistoryGrouped, isMediaUrl } from '../history-store.js';
import { JOB_TYPES } from '../ui-labels.js';
import { navigate } from '../router.js';
import { buildPageShell, bindPageShell, buildQuickNav, defaultPageActions } from '../page-shell.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
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

function renderThumb(entry) {
  const media = isMediaUrl(entry.resultUrl, entry.type);
  if (media === 'image') {
    return `<img class="hist-thumb-img" src="${escapeHtml(entry.resultUrl)}" alt="" loading="lazy" />`;
  }
  if (media === 'video') {
    return `<video class="hist-thumb-vid" src="${escapeHtml(entry.resultUrl)}" muted preload="metadata"></video>`;
  }
  if (media === 'audio') {
    return `<span class="hist-thumb-icon">🔊</span>`;
  }
  const icon = JOB_TYPES.find((t) => t.value === entry.type)?.icon || '📄';
  return `<span class="hist-thumb-icon">${icon}</span>`;
}

function renderCard(entry) {
  const typeLabel = JOB_TYPES.find((t) => t.value === entry.type)?.label || entry.type;
  const prompt = entry.prompt?.slice(0, 120) || '(Không có prompt)';
  return `
    <article class="hist-card" data-id="${escapeHtml(entry.id)}">
      <a class="hist-thumb" href="${escapeHtml(entry.resultUrl)}" target="_blank" rel="noopener">
        ${renderThumb(entry)}
      </a>
      <div class="hist-body">
        <div class="hist-meta">
          <span class="hist-type-tag">${escapeHtml(typeLabel)}</span>
          <time class="hist-time">${formatDate(entry.createdAt)}</time>
        </div>
        <p class="hist-prompt" title="${escapeHtml(entry.prompt || '')}">${escapeHtml(prompt)}${entry.prompt?.length > 120 ? '…' : ''}</p>
        ${entry.modelName ? `<p class="hist-model">${escapeHtml(entry.modelName)}</p>` : ''}
        <div class="hist-actions">
          <a href="${escapeHtml(entry.resultUrl)}" target="_blank" rel="noopener" class="hist-btn">Mở</a>
          <button type="button" class="hist-btn danger" data-delete="${escapeHtml(entry.id)}">Xóa</button>
        </div>
      </div>
    </article>`;
}

function buildHistTabs(activeType, counts, total) {
  return `
    <div class="page-segment-tabs" role="tablist">
      <button type="button" class="page-sub-link${!activeType ? ' active' : ''}" data-hist-tab="" role="tab">
        Tất cả <span class="hist-count">${total}</span>
      </button>
      ${JOB_TYPES.map(
        (t) => `
      <button type="button" class="page-sub-link${activeType === t.value ? ' active' : ''}" data-hist-tab="${t.value}" role="tab">
        ${t.icon} ${t.label} <span class="hist-count">${counts[t.value] || 0}</span>
      </button>`
      ).join('')}
    </div>`;
}

function bindHistoryEvents(main, activeType) {
  main.querySelectorAll('[data-hist-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const t = tab.dataset.histTab;
      navigate(t ? `/history/${t}` : '/history');
    });
  });

  main.querySelector('#histClearType')?.addEventListener('click', () => {
    const label = JOB_TYPES.find((t) => t.value === activeType)?.label || activeType;
    if (!confirm(`Xóa toàn bộ lịch sử ${label}?`)) return;
    clearHistory(activeType);
    renderHistory({ main: document.getElementById('app-main'), params: { type: activeType } });
  });

  main.querySelector('#histClearAll')?.addEventListener('click', () => {
    if (!confirm('Xóa toàn bộ lịch sử mọi loại?')) return;
    clearHistory(null);
    renderHistory({ main: document.getElementById('app-main'), params: { type: activeType } });
  });

  main.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeHistoryEntry(btn.dataset.delete);
      renderHistory({ main: document.getElementById('app-main'), params: { type: activeType } });
    });
  });
}

export function renderHistory({ main, params }) {
  const activeType = params.type || null;
  const counts = countHistoryGrouped();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const entries = listHistory(activeType);
  const histPath = activeType ? `/history/${activeType}` : '/history';

  const clearActions =
    activeType || total > 0
      ? `${activeType ? '<button type="button" class="secondary pg-sm" id="histClearType">Xóa tab này</button>' : ''}${total > 0 ? '<button type="button" class="secondary pg-sm" id="histClearAll">Xóa tất cả</button>' : ''}`
      : '';

  const content = `
    <div class="page-body-inner is-wide">
      <div class="view-history">
        ${
          entries.length === 0
            ? `
        <div class="hist-empty panel">
          <span class="hist-empty-icon">📭</span>
          <p>Chưa có bản ghi${activeType ? ` cho loại <strong>${escapeHtml(JOB_TYPES.find((t) => t.value === activeType)?.label)}</strong>` : ''}.</p>
          <p class="hint">Tạo nội dung từ Studio — kết quả sẽ xuất hiện ở đây.</p>
        </div>`
            : `<div class="hist-grid">${entries.map(renderCard).join('')}</div>`
        }
      </div>
    </div>`;

  main.innerHTML = buildPageShell({
    kicker: 'Thư viện',
    title: 'Lịch sử tạo',
    lead: 'Kết quả được lưu tự động sau mỗi lần gen thành công.',
    backTo: '/',
    subBar: `${buildQuickNav(histPath)}${buildHistTabs(activeType, counts, total)}`,
    actions: defaultPageActions({ extra: clearActions }),
    content,
  });

  bindPageShell(main);
  bindHistoryEvents(main, activeType);
}
