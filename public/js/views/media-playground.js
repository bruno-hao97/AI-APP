import { GommoClient } from '../gommo-client.js';
import { loadSettings, hasToken, saveSettings } from '../settings-store.js';
import { addHistoryEntry } from '../history-store.js';
import {
  modelSlug,
  analyzeModel,
  buildJobPayload,
  defaultSelections,
  lookupPrice,
  pollMediaForJobType,
  isModelAvailable,
} from '../model-schema.js';
import {
  FIELD_LABELS,
  JOB_TYPES,
  formatPrice,
  formatDurationOption,
  getModelCategory,
  progressMessage,
} from '../ui-labels.js';
import { navigate } from '../router.js';

const API_BASE = 'https://v2.api.gommo.net';
const PLAYGROUND_TYPES = new Set(JOB_TYPES.map((t) => t.value));

let jobType = 'image';
let models = [];
let currentModel = null;
let schema = null;
let lastResultUrl = null;
let escapeBound = false;

const $ = (id) => document.getElementById(id);

function typeMeta(type = jobType) {
  return JOB_TYPES.find((t) => t.value === type) || JOB_TYPES[0];
}

function client() {
  if (!hasToken()) throw new Error('Chưa có token API — vào Cài đặt.');
  return new GommoClient(loadSettings());
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function detectPreviewKind(url) {
  if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) return 'image';
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(url)) return 'audio';
  if (jobType === 'image') return 'image';
  if (jobType === 'video' || jobType === 'avatar-lipsync') return 'video';
  if (jobType === 'tts' || jobType === 'music') return 'audio';
  return 'file';
}

function setResponse(label, data) {
  const box = $('pgResponse');
  if (!box) return;
  const block = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  box.textContent = `// ${label}\n${block}`;
}

function setRequestPreview(modelId, payload) {
  const url = `${API_BASE}/ai/jobs/${jobType}/${modelId}`;
  $('pgRequestUrl').textContent = url;
  $('pgRequestBody').textContent = JSON.stringify(payload, null, 2);
  const s = loadSettings();
  $('pgAuthInfo').textContent = JSON.stringify(
    {
      domain: s.domain,
      project_id: s.projectId,
      access_token: s.accessToken ? `${s.accessToken.slice(0, 8)}…` : '(chưa có)',
    },
    null,
    2
  );
}

function inferProvider(model) {
  const name = (model.name || modelSlug(model)).toUpperCase();
  if (name.includes('GPT') || name.includes('OPENAI')) return 'OPENAI';
  if (name.includes('FLUX')) return 'FLUX';
  if (name.includes('GEMINI') || name.includes('GOOGLE') || name.includes('VEO')) return 'GOOGLE';
  if (name.includes('MIDJOURNEY') || name.includes('MJ')) return 'MIDJOURNEY';
  if (name.includes('KLING')) return 'KLING';
  if (name.includes('GROK')) return 'GROK';
  if (name.includes('SUNO')) return 'SUNO';
  return 'KHÁC';
}

function renderModelList(filter = '') {
  const list = $('pgModelList');
  if (!list) return;
  const q = filter.trim().toLowerCase();
  const available = models.filter((m) => {
    if (!isModelAvailable(m)) return false;
    if (!q) return true;
    const slug = modelSlug(m).toLowerCase();
    const name = (m.name || '').toLowerCase();
    return name.includes(q) || slug.includes(q);
  });

  const groups = new Map();
  available.forEach((m) => {
    const g = inferProvider(m);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(m);
  });

  if (!available.length) {
    list.innerHTML = '<p class="pg-empty">Không tìm thấy model.</p>';
    return;
  }

  list.innerHTML = [...groups.entries()]
    .map(([group, items]) => {
      const rows = items
        .map((m) => {
          const slug = modelSlug(m);
          const active = currentModel && modelSlug(currentModel) === slug;
          const price = formatPrice(m.price, m.sale);
          return `
          <button type="button" class="pg-model-row${active ? ' active' : ''}" data-slug="${escapeHtml(slug)}">
            <span class="pg-model-row-main">
              <strong>${escapeHtml(m.name || slug)}</strong>
              <span class="pg-model-slug">${escapeHtml(slug)}</span>
            </span>
            ${price ? `<span class="pg-model-price">${escapeHtml(price)}</span>` : ''}
          </button>`;
        })
        .join('');
      return `<div class="pg-model-group"><p class="pg-model-group-label">${escapeHtml(group)}</p>${rows}</div>`;
    })
    .join('');

  list.querySelectorAll('.pg-model-row').forEach((btn) => {
    btn.addEventListener('click', () => selectModel(btn.dataset.slug));
  });
}

function renderProviderTabs() {
  const tabs = $('pgProviderTabs');
  if (!tabs) return;
  const providers = ['TẤT CẢ', ...new Set(models.filter(isModelAvailable).map(inferProvider))];
  tabs.innerHTML = providers
    .map(
      (p, i) =>
        `<button type="button" class="pg-tab${i === 0 ? ' active' : ''}" data-provider="${p === 'TẤT CẢ' ? '' : p}">${p}</button>`
    )
    .join('');

  tabs.querySelectorAll('.pg-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.pg-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const prov = tab.dataset.provider;
      const q = $('pgModelSearch')?.value || '';
      if (!prov) {
        renderModelList(q);
        return;
      }
      renderModelList(q);
      $('pgModelList')?.querySelectorAll('.pg-model-group').forEach((g) => {
        const label = g.querySelector('.pg-model-group-label')?.textContent;
        g.hidden = label !== prov;
      });
    });
  });
}

function chipGroup(id, label, options, { formatLabel } = {}) {
  if (!options?.length) return '';
  const fmt = formatLabel || ((o) => o.label);
  return `
    <div class="pg-field" id="wrap_${id}">
      <span class="pg-field-label">${label}</span>
      <div class="chip-group" role="group" aria-label="${label}">
        ${options
          .map(
            (o, i) =>
              `<button type="button" class="chip${i === 0 ? ' active' : ''}" data-field="${id}" data-value="${escapeHtml(o.value)}"${o.status === 'pause' ? ' disabled' : ''}>${escapeHtml(fmt(o))}</button>`
          )
          .join('')}
      </div>
    </div>`;
}

function getChipValue(field) {
  return document.querySelector(`.chip[data-field="${field}"].active`)?.dataset.value || '';
}

function updateInputVisibility() {
  if (!schema) return;
  const { fields } = schema;
  $('pgPromptWrap').hidden = !fields.prompt;
  $('pgTextWrap').hidden = !fields.text;
  $('pgMusicNameWrap').hidden = !fields.musicName;
}

function renderParamsForm() {
  const root = $('pgParams');
  if (!schema || !root) return;

  const { options, fields, limits } = schema;
  let html = '';

  if (fields.mode) {
    html += chipGroup('mode', FIELD_LABELS.mode, options.modes, {
      formatLabel: (o) => (o.group ? `${o.label} (${o.group})` : o.label),
    });
  }
  if (fields.resolution) {
    html += chipGroup('resolution', FIELD_LABELS.resolution, options.resolutions);
  }
  if (fields.ratio) {
    html += chipGroup('ratio', FIELD_LABELS.ratio, options.ratios);
  }
  if (fields.duration) {
    html += chipGroup('duration', FIELD_LABELS.duration, options.durations, {
      formatLabel: formatDurationOption,
    });
  }

  root.innerHTML = html;

  root.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (chip.disabled) return;
      root.querySelectorAll(`.chip[data-field="${chip.dataset.field}"]`).forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      updatePrice();
    });
  });

  const refs = $('pgRefs');
  if (fields.references && limits.maxReference > 0 && refs) {
    refs.hidden = false;
    refs.innerHTML = Array.from(
      { length: limits.maxReference },
      (_, i) => `
      <label class="field-block">
        <span class="field-label">${FIELD_LABELS.references} ${limits.maxReference > 1 ? i + 1 : ''}</span>
        <input type="url" data-ref="${i}" placeholder="https://…" />
      </label>`
    ).join('');
  } else if (refs) refs.hidden = true;

  const subs = $('pgSubjects');
  if (fields.subjects && limits.maxSubject > 0 && subs) {
    subs.hidden = false;
    subs.innerHTML = Array.from(
      { length: limits.maxSubject },
      (_, i) => `
      <label class="field-block">
        <span class="field-label">${FIELD_LABELS.subjects} ${limits.maxSubject > 1 ? i + 1 : ''}</span>
        <input type="url" data-sub="${i}" placeholder="https://…" />
      </label>`
    ).join('');
  } else if (subs) subs.hidden = true;

  const imgs = $('pgImages');
  if (fields.startFrame && imgs) {
    imgs.hidden = false;
    const n = schema.fields.endFrame ? 2 : 1;
    imgs.innerHTML = Array.from(
      { length: n },
      (_, i) => `
      <label class="field-block">
        <span class="field-label">${FIELD_LABELS.images} ${n > 1 ? (i === 0 ? '(đầu)' : '(cuối)') : ''}</span>
        <input type="url" data-start="${i}" placeholder="https://…" />
      </label>`
    ).join('');
  } else if (imgs) imgs.hidden = true;

  updateInputVisibility();
  updatePrice();
}

function updatePrice() {
  const el = $('pgPrice');
  if (!el || !schema) return;
  const mode = getChipValue('mode');
  const resolution = getChipValue('resolution');
  const duration = getChipValue('duration');
  let p = lookupPrice(schema.prices, mode, resolution);
  if (p == null && duration) {
    const row = schema.prices?.find(
      (r) =>
        (!mode || r.mode === mode) &&
        (!resolution || r.resolution === resolution) &&
        String(r.duration) === String(duration)
    );
    p = row?.price;
  }
  if (p == null) p = schema.basePrice;
  el.textContent = p != null ? formatPrice(p, currentModel?.sale) : '—';
}

function closeModelPicker() {
  $('pgModelPicker')?.classList.remove('is-open');
  $('pgModelBackdrop')?.classList.remove('is-open');
  $('pgModelToggle')?.classList.remove('is-open');
  $('pgModelToggle')?.setAttribute('aria-expanded', 'false');
}

function openModelPicker() {
  $('pgModelPicker')?.classList.add('is-open');
  $('pgModelBackdrop')?.classList.add('is-open');
  $('pgModelToggle')?.classList.add('is-open');
  $('pgModelToggle')?.setAttribute('aria-expanded', 'true');
  $('pgModelSearch')?.focus();
}

function toggleModelPicker(e) {
  e?.stopPropagation();
  if ($('pgModelPicker')?.classList.contains('is-open')) closeModelPicker();
  else openModelPicker();
}

function selectModel(slug) {
  const m = models.find((x) => modelSlug(x) === slug);
  if (!m) return;
  currentModel = m;
  schema = analyzeModel(m, jobType);
  const cat = getModelCategory(m);

  closeModelPicker();
  $('pgModelName').textContent = m.name || slug;
  $('pgModelSlug').textContent = slug;
  $('pgModelDesc').textContent = m.description || cat.hint;
  $('pgModelBadge').textContent = formatPrice(m.price, m.sale) || '—';

  const notice = m.notices?.select || m.notices?.select1;
  const noticeEl = $('pgNotice');
  if (notice?.message) {
    noticeEl.hidden = false;
    noticeEl.innerHTML = `<strong>${escapeHtml(notice.title || 'Lưu ý')}</strong><p>${escapeHtml(notice.message)}</p>`;
  } else noticeEl.hidden = true;

  renderModelList($('pgModelSearch')?.value || '');
  renderParamsForm();

  const defs = defaultSelections(schema);
  ['mode', 'resolution', 'ratio', 'duration'].forEach((f) => {
    const val = defs[f];
    if (!val) return;
    document.querySelectorAll(`.chip[data-field="${f}"]`).forEach((c) => {
      c.classList.toggle('active', c.dataset.value === val);
    });
  });
  updatePrice();
}

function collectSelections() {
  const refs = [...document.querySelectorAll('[data-ref]')]
    .map((i) => i.value.trim())
    .filter(Boolean);
  const subjects = [...document.querySelectorAll('[data-sub]')]
    .map((i) => i.value.trim())
    .filter(Boolean);
  const images = [...document.querySelectorAll('[data-start]')]
    .sort((a, b) => Number(a.dataset.start) - Number(b.dataset.start))
    .map((i) => i.value.trim())
    .filter(Boolean);
  return {
    prompt: $('pgPrompt')?.value.trim(),
    text: $('pgText')?.value.trim(),
    name: $('pgMusicName')?.value.trim(),
    mode: getChipValue('mode') || undefined,
    resolution: getChipValue('resolution') || undefined,
    ratio: getChipValue('ratio') || undefined,
    duration: getChipValue('duration') || undefined,
    references: refs,
    subjects,
    images,
  };
}

function hideAllPreviewMedia() {
  $('pgPreviewImg').hidden = true;
  $('pgPreviewVideo').hidden = true;
  $('pgPreviewAudio').hidden = true;
  $('pgPreviewFile').hidden = true;
}

function setPreviewState(state, { url, message } = {}) {
  const meta = typeMeta();
  $('pgPreviewEmpty').hidden = state !== 'empty';
  $('pgPreviewLoading').hidden = state !== 'loading';
  $('pgPreviewResult').hidden = state !== 'result';

  if (state === 'empty') {
    $('pgPreviewIcon').textContent = meta.icon;
  }

  if (state === 'loading') {
    const t = $('pgPreviewLoadingText');
    if (t) t.textContent = message || 'Đang xử lý…';
  }

  if (state === 'result' && url) {
    lastResultUrl = url;
    $('pgResultLink').href = url;
    hideAllPreviewMedia();

    const kind = detectPreviewKind(url);
    if (kind === 'image') {
      const img = $('pgPreviewImg');
      img.src = url;
      img.hidden = false;
    } else if (kind === 'video') {
      const vid = $('pgPreviewVideo');
      vid.src = url;
      vid.hidden = false;
    } else if (kind === 'audio') {
      const aud = $('pgPreviewAudio');
      aud.src = url;
      aud.hidden = false;
    } else {
      $('pgPreviewFile').hidden = false;
      $('pgPreviewFileLink').href = url;
      $('pgPreviewFileLink').textContent = url.split('/').pop()?.split('?')[0] || 'Tải file';
    }
  }
}

async function downloadResult(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = url.split('/').pop()?.split('?')[0] || 'download';
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank');
  }
}

function recordHistory(url) {
  const sel = collectSelections();
  addHistoryEntry({
    type: jobType,
    resultUrl: url,
    prompt: sel.prompt || sel.text || sel.name || '',
    modelName: currentModel?.name || '',
    modelSlug: schema?.slug || '',
    meta: {
      mode: sel.mode || '',
      resolution: sel.resolution || '',
      ratio: sel.ratio || '',
      duration: sel.duration || '',
    },
  });
}

async function runCreate() {
  if (!currentModel || !schema) return;
  $('pgError').hidden = true;

  let payload;
  try {
    const sel = collectSelections();
    if (jobType === 'music' && !sel.name) sel.name = 'Bản nhạc';
    ({ payload } = buildJobPayload(currentModel, jobType, sel, loadSettings()));
  } catch (e) {
    $('pgError').hidden = false;
    $('pgError').textContent = e.message;
    return;
  }

  const modelId = schema.slug;
  setRequestPreview(modelId, payload);
  setPreviewState('loading', { message: 'Đang gửi request…' });
  $('pgSubmit').disabled = true;

  const media = pollMediaForJobType(jobType);

  try {
    const c = client();
    const createEnv = await c.createJob(jobType, modelId, payload);
    setResponse(`POST /ai/jobs/${jobType}/${modelId}`, createEnv);

    const { idBase, resultUrl } = c.extract(createEnv);
    if (resultUrl && !idBase) {
      setPreviewState('result', { url: resultUrl });
      recordHistory(resultUrl);
      $('pgSubmit').disabled = false;
      return;
    }
    if (!idBase) throw new Error('Không nhận được id_base từ API.');

    if (!media) {
      if (resultUrl) {
        setPreviewState('result', { url: resultUrl });
        recordHistory(resultUrl);
      }
      setResponse('Kết quả cuối', createEnv);
      $('pgSubmit').disabled = false;
      return;
    }

    setPreviewState('loading', { message: progressMessage('running', 1) });
    const poll = await c.pollUntilDone(idBase, media, {
      onProgress: ({ attempt, phase, envelope }) => {
        setPreviewState('loading', {
          message: phase === 'running' ? progressMessage('running', attempt) : progressMessage(phase),
        });
        setResponse(`GET poll #${attempt}`, envelope);
      },
    });

    if (poll.success && poll.resultUrl) {
      setPreviewState('result', { url: poll.resultUrl });
      recordHistory(poll.resultUrl);
      setResponse('Kết quả cuối', poll);
    } else {
      setPreviewState('empty');
      $('pgError').hidden = false;
      $('pgError').textContent = poll.timeout
        ? 'Hết thời gian chờ — thử lại sau.'
        : `Thất bại: ${poll.error || poll.status || 'unknown'}`;
    }
  } catch (e) {
    setPreviewState('empty');
    setResponse('Lỗi', { message: e.message, envelope: e.envelope });
    $('pgError').hidden = false;
    $('pgError').textContent = e.message || 'Lỗi kết nối API.';
  } finally {
    $('pgSubmit').disabled = false;
  }
}

async function loadModels() {
  $('pgModelLoading').hidden = false;
  $('pgModelList').innerHTML = '';
  try {
    const c = client();
    const env = await c.fetchModels(jobType);
    models = c.listModels(env).filter(isModelAvailable);
    renderProviderTabs();
    renderModelList();
    if (models.length) selectModel(modelSlug(models[0]));
    else {
      $('pgError').hidden = false;
      $('pgError').textContent = 'Không có model khả dụng cho loại này.';
    }
  } catch (e) {
    $('pgError').hidden = false;
    $('pgError').textContent = e.message || 'Không tải được danh sách model.';
  } finally {
    $('pgModelLoading').hidden = true;
  }
}

function bindEvents() {
  $('pgModelToggle')?.addEventListener('click', toggleModelPicker);
  $('pgModelBackdrop')?.addEventListener('click', closeModelPicker);
  $('pgClosePicker')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModelPicker();
  });
  $('pgModelPicker')?.addEventListener('click', (e) => e.stopPropagation());
  $('pgModelSearch')?.addEventListener('input', (e) => renderModelList(e.target.value));
  $('pgSubmit')?.addEventListener('click', runCreate);
  $('pgCopyUrl')?.addEventListener('click', () => {
    navigator.clipboard?.writeText($('pgRequestUrl')?.textContent || '');
  });
  $('pgCopyBody')?.addEventListener('click', () => {
    navigator.clipboard?.writeText($('pgRequestBody')?.textContent || '');
  });
  $('pgDownload')?.addEventListener('click', () => {
    if (lastResultUrl) void downloadResult(lastResultUrl);
  });
  $('pgTokenForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const token = $('pgToken')?.value.trim();
    if (!token) return;
    saveSettings({ accessToken: token });
    document.dispatchEvent(new CustomEvent('settings:saved'));
    $('pgTokenBanner').hidden = true;
    void loadModels();
  });

  if (!escapeBound) {
    escapeBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModelPicker();
    });
  }
}

function getHtml() {
  const meta = typeMeta();
  return `
    <div class="view-media-playground view-image-playground">
      <header class="pg-topbar">
        <div class="pg-topbar-left">
          <span class="pg-topbar-badge">${meta.icon} ${escapeHtml(meta.label)}</span>
          <div class="pg-model-select">
            <button type="button" class="pg-model-trigger" id="pgModelToggle" aria-expanded="false" aria-haspopup="listbox" aria-controls="pgModelPicker">
              <span id="pgModelName">Chọn model…</span>
              <span class="pg-chevron" aria-hidden="true">▾</span>
            </button>
            <div id="pgModelBackdrop" class="pg-model-backdrop" aria-hidden="true"></div>
            <div id="pgModelPicker" class="pg-model-dropdown panel" role="listbox" aria-label="Danh sách model">
              <div class="pg-picker-head">
                <input type="search" id="pgModelSearch" class="pg-search" placeholder="Tìm model theo tên, id…" />
                <button type="button" class="icon-btn pg-close-picker" id="pgClosePicker" aria-label="Đóng">✕</button>
              </div>
              <div class="pg-provider-tabs" id="pgProviderTabs"></div>
              <div id="pgModelLoading" class="loading" hidden>Đang tải model…</div>
              <div id="pgModelList" class="pg-model-list"></div>
            </div>
          </div>
        </div>
        <div class="pg-topbar-right">
          <button type="button" class="secondary pg-sm" id="pgGoSettings">Token API</button>
        </div>
      </header>

      <div id="pgTokenBanner" class="banner warn token-panel" hidden>
        <form id="pgTokenForm" class="token-quick-form">
          <label class="field-block token-field">
            <span class="field-label">Mã token Gommo</span>
            <input type="password" id="pgToken" placeholder="Dán token…" />
          </label>
          <button type="submit" class="primary">Kết nối</button>
        </form>
      </div>

      <div class="playground-layout">
        <aside class="playground-left panel">
          <div class="pg-model-head">
            <div>
              <p class="pg-model-slug" id="pgModelSlug">—</p>
              <p class="pg-model-desc" id="pgModelDesc">Chọn model từ danh sách phía trên.</p>
            </div>
            <span class="pg-model-badge" id="pgModelBadge">—</span>
          </div>

          <div id="pgNotice" class="notice" hidden></div>

          <label id="pgPromptWrap" class="field-block">
            <span class="field-label">${FIELD_LABELS.prompt} <em>*</em></span>
            <textarea id="pgPrompt" rows="5" placeholder="Nhập mô tả / prompt…"></textarea>
          </label>

          <label id="pgTextWrap" class="field-block" hidden>
            <span class="field-label">${FIELD_LABELS.text} <em>*</em></span>
            <textarea id="pgText" rows="5" placeholder="Nhập văn bản cần đọc…"></textarea>
          </label>

          <label id="pgMusicNameWrap" class="field-block" hidden>
            <span class="field-label">${FIELD_LABELS.musicName}</span>
            <input type="text" id="pgMusicName" placeholder="Tên bài nhạc (tuỳ chọn)" />
          </label>

          <div id="pgParams"></div>
          <div id="pgImages" class="pg-refs" hidden></div>
          <div id="pgRefs" class="pg-refs" hidden></div>
          <div id="pgSubjects" class="pg-refs" hidden></div>

          <p class="pg-price-line">Chi phí ước tính: <strong id="pgPrice">—</strong></p>
          <button type="button" class="primary pg-submit" id="pgSubmit">Tạo Request</button>
          <p id="pgError" class="notice error" hidden></p>
        </aside>

        <section class="playground-center panel">
          <div class="pg-preview-header">
            <span class="pg-preview-tag">Preview</span>
            <span id="pgPreviewProgress" class="pg-preview-status"></span>
          </div>
          <div class="pg-preview-stage">
            <div id="pgPreviewEmpty" class="pg-preview-empty">
              <span class="pg-preview-icon" id="pgPreviewIcon">${meta.icon}</span>
              <p>Kết quả <strong>${escapeHtml(meta.label)}</strong> sẽ hiển thị ở đây sau khi bấm <strong>Tạo Request</strong></p>
            </div>
            <div id="pgPreviewLoading" class="pg-preview-loading" hidden>
              <div class="pg-spinner"></div>
              <p id="pgPreviewLoadingText">Đang xử lý…</p>
            </div>
            <div id="pgPreviewResult" class="pg-preview-result" hidden>
              <img id="pgPreviewImg" alt="Kết quả" crossorigin="anonymous" hidden />
              <video id="pgPreviewVideo" controls playsinline crossorigin="anonymous" hidden></video>
              <audio id="pgPreviewAudio" controls crossorigin="anonymous" hidden></audio>
              <p id="pgPreviewFile" class="pg-preview-file" hidden>
                <a id="pgPreviewFileLink" class="btn-download" href="#" target="_blank" rel="noopener">Tải file kết quả</a>
              </p>
              <div class="pg-preview-actions">
                <a id="pgResultLink" class="btn-download" href="#" target="_blank" rel="noopener">Mở tab mới</a>
                <button type="button" class="btn-download secondary-style" id="pgDownload">Tải xuống</button>
              </div>
            </div>
          </div>
        </section>

        <aside class="playground-right">
          <div class="panel pg-api-block">
            <div class="pg-api-head">
              <span class="pg-method">POST</span>
              <code class="pg-url" id="pgRequestUrl">${API_BASE}/ai/jobs/${jobType}/…</code>
              <button type="button" class="pg-copy" id="pgCopyUrl" title="Copy URL">⧉</button>
            </div>
            <details open class="pg-details">
              <summary>Auth &amp; Body</summary>
              <pre class="log compact" id="pgAuthInfo">{}</pre>
              <div class="pg-api-head sub">
                <span>Body</span>
                <button type="button" class="pg-copy" id="pgCopyBody">Copy</button>
              </div>
              <pre class="log compact" id="pgRequestBody">{}</pre>
            </details>
          </div>
          <div class="panel pg-api-block">
            <div class="pg-api-head">
              <strong class="font-display">Response</strong>
            </div>
            <pre class="log pg-response" id="pgResponse">// Chưa có response</pre>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function renderTypePicker(main) {
  main.innerHTML = `
    <div class="view-history">
      <header class="page-header">
        <div>
          <p class="page-kicker">Studio</p>
          <h1 class="page-title font-display">Chọn loại nội dung</h1>
          <p class="page-lead">Mỗi loại mở playground 3 cột — cấu hình trái, preview giữa, API phải.</p>
        </div>
      </header>
      <div class="tool-grid">
        ${JOB_TYPES.map(
          (t, i) => `
          <button type="button" class="tool-card accent-${['cyan', 'violet', 'pink', 'lime', 'cyan'][i % 5]}" data-pick-type="${t.value}">
            <span class="tool-icon">${t.icon}</span>
            <span class="tool-body">
              <strong class="font-display">${t.label}</strong>
              <span>${t.desc}</span>
            </span>
            <span class="tool-arrow">→</span>
          </button>`
        ).join('')}
      </div>
    </div>
  `;
  main.querySelectorAll('[data-pick-type]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(`/create/${btn.dataset.pickType}`));
  });
}

/** @param {{ main: HTMLElement, params?: { type?: string } }} ctx */
export function renderMediaPlayground({ main, params = {} }) {
  const type = params.type;
  if (!type || !PLAYGROUND_TYPES.has(type)) {
    renderTypePicker(main);
    return;
  }

  jobType = type;
  models = [];
  currentModel = null;
  schema = null;
  lastResultUrl = null;

  main.innerHTML = getHtml();
  bindEvents();
  $('pgGoSettings')?.addEventListener('click', () => navigate('/settings'));

  setPreviewState('empty');
  setRequestPreview('model_id', { domain: loadSettings().domain, project_id: loadSettings().projectId });

  if (!hasToken()) {
    $('pgTokenBanner').hidden = false;
    return;
  }
  void loadModels();
}

export function renderImagePlayground(ctx) {
  renderMediaPlayground({ ...ctx, params: { type: 'image', ...ctx.params } });
}
