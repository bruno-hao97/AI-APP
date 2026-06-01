import { navigate } from '../router.js';
import { hasToken } from '../settings-store.js';
import { GommoClient } from '../gommo-client.js';
import { loadSettings } from '../settings-store.js';
import { pollMediaForJobType } from '../model-schema.js';
import {
  fetchAllModels,
  inferProvider,
  dryRunModel,
  schemaFieldSummary,
  modelSlug,
} from '../model-catalog.js';
import { JOB_TYPES, formatPrice } from '../ui-labels.js';
import { buildPageShell, bindPageShell, buildQuickNav, defaultPageActions } from '../page-shell.js';

let catalog = [];
let testAbort = false;
let filterType = '';
let filterProvider = '';
let filterQuery = '';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function filteredCatalog() {
  return catalog.filter((e) => {
    if (filterType && e.jobType !== filterType) return false;
    if (filterProvider && inferProvider(e) !== filterProvider) return false;
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      const hay = `${e.slug} ${e.raw.name || ''} ${e.jobType}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderStats(main) {
  const byType = Object.fromEntries(JOB_TYPES.map((t) => [t.value, 0]));
  catalog.forEach((e) => {
    byType[e.jobType] = (byType[e.jobType] || 0) + 1;
  });
  const el = main.querySelector('#matrixStats');
  if (!el) return;
  el.innerHTML = JOB_TYPES.map(
    (t) => `
    <div class="matrix-stat">
      <span class="matrix-stat-val">${byType[t.value] || 0}</span>
      <span class="matrix-stat-lbl">${t.icon} ${t.label}</span>
    </div>`
  ).join('');
  const total = main.querySelector('#matrixTotal');
  if (total) total.textContent = String(catalog.length);
}

function renderTable(main) {
  const tbody = main.querySelector('#matrixTbody');
  if (!tbody) return;
  const rows = filteredCatalog();

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="hint center">Không có model phù hợp bộ lọc.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((entry) => {
      const dry = dryRunModel(entry);
      const typeMeta = JOB_TYPES.find((t) => t.value === entry.jobType);
      const fields = schemaFieldSummary(entry.schema).join(', ') || '—';
      const price = formatPrice(entry.raw.price, entry.raw.sale) || '—';
      const status = entry.schema.available ? 'ON' : entry.schema.status || 'OFF';
      return `
      <tr data-slug="${escapeHtml(entry.slug)}" data-type="${entry.jobType}">
        <td><span class="matrix-type-tag">${typeMeta?.icon || ''} ${escapeHtml(typeMeta?.label || entry.jobType)}</span></td>
        <td>
          <strong>${escapeHtml(entry.raw.name || entry.slug)}</strong>
          <code class="matrix-slug">${escapeHtml(entry.slug)}</code>
        </td>
        <td><span class="matrix-prov">${escapeHtml(inferProvider(entry))}</span></td>
        <td class="matrix-fields" title="${escapeHtml(fields)}">${escapeHtml(fields)}</td>
        <td>${escapeHtml(price)}</td>
        <td><span class="matrix-status ${status === 'ON' ? 'ok' : 'off'}">${escapeHtml(status)}</span></td>
        <td>
          <span class="matrix-dry ${dry.ok ? 'ok' : 'fail'}">${dry.ok ? '✓ Payload OK' : escapeHtml(dry.error || 'Lỗi')}</span>
        </td>
        <td class="matrix-actions">
          <button type="button" class="secondary pg-sm" data-open="${entry.jobType}" data-model="${escapeHtml(entry.slug)}">Mở</button>
          <button type="button" class="secondary pg-sm" data-dry="${escapeHtml(entry.slug)}" data-type="${entry.jobType}">JSON</button>
        </td>
      </tr>`;
    })
    .join('');

  tbody.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slug = encodeURIComponent(btn.dataset.model);
      navigate(`/create/${btn.dataset.open}?model=${slug}`);
    });
  });

  tbody.querySelectorAll('[data-dry]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const entry = catalog.find((e) => e.slug === btn.dataset.dry && e.jobType === btn.dataset.type);
      if (!entry) return;
      const dry = dryRunModel(entry);
      const pre = main.querySelector('#matrixLog');
      if (pre) {
        pre.textContent = JSON.stringify(
          dry.ok
            ? { endpoint: dry.endpoint, payload: dry.payload, warnings: dry.warnings }
            : { error: dry.error },
          null,
          2
        );
      }
    });
  });
}

function appendLog(main, line) {
  const pre = main.querySelector('#matrixLog');
  if (!pre) return;
  pre.textContent += `${line}\n`;
  pre.scrollTop = pre.scrollHeight;
}

async function runDryRunAll(main) {
  const rows = filteredCatalog();
  appendLog(main, `\n=== DRY-RUN ${rows.length} models ===`);
  let ok = 0;
  let fail = 0;
  rows.forEach((entry, i) => {
    const dry = dryRunModel(entry);
    if (dry.ok) {
      ok += 1;
      appendLog(main, `[${i + 1}/${rows.length}] OK  ${entry.jobType}/${entry.slug}`);
    } else {
      fail += 1;
      appendLog(main, `[${i + 1}/${rows.length}] FAIL ${entry.jobType}/${entry.slug}: ${dry.error}`);
    }
  });
  appendLog(main, `=== Kết quả: ${ok} OK, ${fail} FAIL ===`);
}

async function runRealTestAll(main, { max = 5 } = {}) {
  if (!hasToken()) {
    appendLog(main, 'Cần token API.');
    return;
  }
  const rows = filteredCatalog().slice(0, max);
  if (!rows.length) return;

  const confirmed = window.confirm(
    `Chạy test THẬT cho ${rows.length} model đầu tiên (tốn credit). Tiếp tục?`
  );
  if (!confirmed) return;

  testAbort = false;
  const c = new GommoClient(loadSettings());
  appendLog(main, `\n=== REAL-RUN ${rows.length} models (max ${max}) ===`);

  for (let i = 0; i < rows.length; i++) {
    if (testAbort) {
      appendLog(main, 'Đã dừng.');
      break;
    }
    const entry = rows[i];
    const dry = dryRunModel(entry);
    if (!dry.ok) {
      appendLog(main, `[${i + 1}] SKIP ${entry.slug}: ${dry.error}`);
      continue;
    }

    try {
      appendLog(main, `[${i + 1}] POST ${entry.jobType}/${entry.slug}…`);
      const createEnv = await c.createJob(entry.jobType, entry.schema.slug, dry.payload);
      const { idBase, resultUrl } = c.extract(createEnv);

      if (resultUrl && !idBase) {
        appendLog(main, `  → SUCCESS (instant) ${resultUrl.slice(0, 60)}…`);
        continue;
      }
      if (!idBase) {
        appendLog(main, `  → FAIL: no id_base`);
        continue;
      }

      const media = pollMediaForJobType(entry.jobType);
      if (!media) {
        appendLog(main, `  → DONE (no poll) ${resultUrl || idBase}`);
        continue;
      }

      const poll = await c.pollUntilDone(idBase, media, {
        intervalMs: 4000,
        maxAttempts: 40,
        onProgress: ({ attempt, phase }) => {
          if (attempt % 5 === 0) appendLog(main, `  … poll #${attempt} ${phase}`);
        },
      });

      if (poll.success && poll.resultUrl) {
        appendLog(main, `  → SUCCESS ${poll.resultUrl.slice(0, 60)}…`);
      } else {
        appendLog(main, `  → FAIL ${poll.error || poll.timeout || 'unknown'}`);
      }
    } catch (e) {
      appendLog(main, `  → ERROR ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, 800));
  }
  appendLog(main, '=== REAL-RUN xong ===');
}

async function loadCatalog(main) {
  const loading = main.querySelector('#matrixLoading');
  const err = main.querySelector('#matrixError');
  loading.hidden = false;
  err.hidden = true;

  try {
    catalog = await fetchAllModels();
    const providers = [...new Set(catalog.map(inferProvider))].sort();
    const provSel = main.querySelector('#matrixFilterProvider');
    if (provSel) {
      provSel.innerHTML =
        '<option value="">Tất cả provider</option>' +
        providers.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    }
    renderStats(main);
    renderTable(main);
  } catch (e) {
    err.hidden = false;
    err.textContent = e.message || 'Không tải được catalog.';
  } finally {
    loading.hidden = true;
  }
}

export function renderModelMatrix({ main }) {
  const content = `
    <div class="page-body-inner is-wide">
      <div class="view-page view-matrix">
        <div id="matrixTokenWarn" class="banner warn" ${hasToken() ? 'hidden' : ''}>
          Chưa có token — <a href="#/settings">Cài đặt API</a> để quét model.
        </div>

        <div id="matrixLoading" class="loading" hidden>Đang quét model từ API…</div>
        <div id="matrixError" class="notice error" hidden></div>

        <div class="matrix-stats-row" id="matrixStats"></div>
        <p class="matrix-total-line">Tổng: <strong id="matrixTotal">0</strong> model</p>

        <div class="matrix-toolbar panel">
          <select id="matrixFilterType" class="matrix-select">
            <option value="">Tất cả loại</option>
            ${JOB_TYPES.map((t) => `<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
          </select>
          <select id="matrixFilterProvider" class="matrix-select">
            <option value="">Tất cả provider</option>
          </select>
          <input type="search" id="matrixSearch" class="matrix-search" placeholder="Tìm tên / slug…" />
          <button type="button" class="primary" id="matrixDryAll">Dry-run tất cả</button>
          <button type="button" class="secondary" id="matrixReal5">Test thật (5 model)</button>
          <button type="button" class="secondary" id="matrixStop">Dừng</button>
        </div>

        <div class="matrix-table-wrap panel">
          <table class="matrix-table">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Model</th>
                <th>Provider</th>
                <th>Inputs</th>
                <th>Giá</th>
                <th>Status</th>
                <th>Dry-run</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="matrixTbody"></tbody>
          </table>
        </div>

        <div class="panel matrix-log-panel">
          <div class="matrix-log-head">
            <strong>Log / Payload preview</strong>
            <button type="button" class="secondary pg-sm" id="matrixClearLog">Xóa log</button>
          </div>
          <pre class="log matrix-log" id="matrixLog">// Chọn Dry-run hoặc Test thật…</pre>
        </div>
      </div>
    </div>`;

  main.innerHTML = buildPageShell({
    kicker: 'API Lab',
    title: 'Model Matrix',
    lead: 'Toàn bộ model từ Gommo — dry-run payload, mở Studio, hoặc test hàng loạt.',
    backTo: '/models',
    subBar: buildQuickNav('/matrix'),
    actions: defaultPageActions({
      extra: '<button type="button" class="secondary pg-sm" id="matrixReload">Tải lại</button>',
    }),
    content,
  });

  bindPageShell(main);

  if (hasToken()) void loadCatalog(main);

  main.querySelector('#matrixReload')?.addEventListener('click', () => loadCatalog(main));

  main.querySelector('#matrixFilterType')?.addEventListener('change', (e) => {
    filterType = e.target.value;
    renderTable(main);
  });
  main.querySelector('#matrixFilterProvider')?.addEventListener('change', (e) => {
    filterProvider = e.target.value;
    renderTable(main);
  });
  main.querySelector('#matrixSearch')?.addEventListener('input', (e) => {
    filterQuery = e.target.value.trim();
    renderTable(main);
  });

  main.querySelector('#matrixDryAll')?.addEventListener('click', () => {
    main.querySelector('#matrixLog').textContent = '';
    void runDryRunAll(main);
  });
  main.querySelector('#matrixReal5')?.addEventListener('click', () => {
    void runRealTestAll(main, { max: 5 });
  });
  main.querySelector('#matrixStop')?.addEventListener('click', () => {
    testAbort = true;
  });
  main.querySelector('#matrixClearLog')?.addEventListener('click', () => {
    const pre = main.querySelector('#matrixLog');
    if (pre) pre.textContent = '';
  });
}
