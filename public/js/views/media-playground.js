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
import { inferProvider } from '../model-catalog.js';
import {
  CREATE_TITLES,
  setGalleryTab,
  getGalleryTab,
  resetSession,
  addLoadingSession,
  finishLoadingSession,
  removeLoadingSession,
  renderGalleryBody,
  bindGalleryEvents,
  refreshGallery,
  setGalleryReuseHandler,
} from '../studio-gallery.js';
import { renderUploadGroup, bindStudioUploads } from '../studio-upload.js';

const API_BASE = 'https://v2.api.gommo.net';
const PLAYGROUND_TYPES = new Set(JOB_TYPES.map((t) => t.value));

let jobType = 'image';
let models = [];
let currentModel = null;
let schema = null;
let lastResultUrl = null;
let escapeBound = false;
let clickBound = false;
let preferredModelSlug = '';

const $ = (id) => document.getElementById(id);

function showPgError(message) {
  const el = $('pgError');
  if (!el) return;
  if (message) {
    el.hidden = false;
    el.textContent = message;
  } else {
    el.hidden = true;
    el.textContent = '';
  }
}

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
  const sub = $('pgRequestUrlSub');
  if (sub) sub.textContent = url;
  const body = $('pgRequestBody');
  if (body) body.textContent = JSON.stringify(payload, null, 2);
  const s = loadSettings();
  const auth = $('pgAuthInfo');
  if (auth) {
    auth.textContent = JSON.stringify(
      {
        domain: s.domain,
        project_id: s.projectId,
        access_token: s.accessToken ? `${s.accessToken.slice(0, 8)}…` : '(chưa có)',
      },
      null,
      2
    );
  }
}

function providerTag(model) {
  return inferProvider({ raw: model, slug: modelSlug(model) });
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
    const g = providerTag(m);
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
  const providers = ['TẤT CẢ', ...new Set(models.filter(isModelAvailable).map(providerTag))];
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

  const refZone = $('studioRefZone');
  const hasUploads =
    (fields.references && limits.maxReference > 0) ||
    (fields.subjects && limits.maxSubject > 0) ||
    fields.startFrame;

  if (refZone) {
    refZone.hidden = !hasUploads;
    const hint = refZone.querySelector('.studio-ref-hint');
    if (hint) {
      hint.textContent = hasUploads
        ? 'ẢNH THAM CHIẾU — Nhấp / Kéo thả / Dán ảnh (upload lên Gommo)'
        : '';
    }
  }

  renderUploadGroup($('pgRefs'), {
    dataAttr: 'data-ref',
    count: fields.references ? limits.maxReference : 0,
    groupLabel: FIELD_LABELS.references,
    itemLabel: (i) =>
      limits.maxReference > 1 ? `${FIELD_LABELS.references} ${i + 1}` : FIELD_LABELS.references,
  });

  renderUploadGroup($('pgSubjects'), {
    dataAttr: 'data-sub',
    count: fields.subjects ? limits.maxSubject : 0,
    groupLabel: FIELD_LABELS.subjects,
    itemLabel: (i) =>
      limits.maxSubject > 1 ? `${FIELD_LABELS.subjects} ${i + 1}` : FIELD_LABELS.subjects,
  });

  const frameCount = fields.startFrame ? (schema.fields.endFrame ? 2 : 1) : 0;
  renderUploadGroup($('pgImages'), {
    dataAttr: 'data-start',
    count: frameCount,
    groupLabel: FIELD_LABELS.images,
    itemLabel: (i) => (frameCount > 1 ? (i === 0 ? 'Khung đầu' : 'Khung cuối') : FIELD_LABELS.images),
  });

  bindStudioUploadZone();

  updateInputVisibility();
  updatePrice();
}

function bindStudioUploadZone() {
  const zone = $('studioRefZone');
  if (!zone) return;
  bindStudioUploads(zone, {
    hasToken,
    uploadFn: (file) => client().uploadImage(file),
  });
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

let typePickerOpen = false;
let activeLoadingId = null;

function closeModelPicker() {
  $('pgModelPicker')?.classList.remove('is-open');
  $('pgModelBackdrop')?.classList.remove('is-open');
  $('pgModelToggle')?.classList.remove('is-open');
  $('pgModelToggle')?.setAttribute('aria-expanded', 'false');
}

function openModelPicker() {
  closeTypePicker();
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

function closeTypePicker() {
  typePickerOpen = false;
  $('pgTypePanel')?.classList.remove('is-open');
  $('pgTypeToggle')?.classList.remove('is-open');
  $('pgTypeToggle')?.setAttribute('aria-expanded', 'false');
}

function openTypePicker() {
  closeModelPicker();
  typePickerOpen = true;
  $('pgTypePanel')?.classList.add('is-open');
  $('pgTypeToggle')?.classList.add('is-open');
  $('pgTypeToggle')?.setAttribute('aria-expanded', 'true');
}

function toggleTypePicker(e) {
  e?.stopPropagation();
  if (typePickerOpen) closeTypePicker();
  else openTypePicker();
}

function renderTypePanel() {
  const panel = $('pgTypePanel');
  if (!panel) return;
  panel.innerHTML = `
    <p class="pg-picker-group-label">TẠO AI</p>
    ${JOB_TYPES.map(
      (t) => `
      <button type="button" class="pg-type-row${t.value === jobType ? ' active' : ''}" data-pick-type="${t.value}">
        <span class="pg-type-row-icon">${t.icon}</span>
        <span class="pg-type-row-label">${escapeHtml(t.label)}</span>
      </button>`
    ).join('')}
  `;
  panel.querySelectorAll('[data-pick-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeTypePicker();
      const slug = currentModel ? modelSlug(currentModel) : preferredModelSlug;
      const q = slug ? `?model=${encodeURIComponent(slug)}` : '';
      if (btn.dataset.pickType !== jobType) navigate(`/create/${btn.dataset.pickType}${q}`);
    });
  });
}

function syncTypeTrigger() {
  const t = typeMeta();
  const icon = $('pgTypeIcon');
  const label = $('pgTypeLabel');
  if (icon) icon.textContent = t.icon;
  if (label) label.textContent = t.label;
}

function applyHistoryEntry(entry) {
  if (entry.prompt && $('pgPrompt')) $('pgPrompt').value = entry.prompt;
  if (entry.prompt && $('pgText')) $('pgText').value = entry.prompt;
  if (entry.modelSlug && models.some((m) => modelSlug(m) === entry.modelSlug)) {
    selectModel(entry.modelSlug);
  }
  const meta = entry.meta || {};
  ['mode', 'resolution', 'ratio', 'duration'].forEach((f) => {
    const val = meta[f];
    if (!val) return;
    document.querySelectorAll(`.chip[data-field="${f}"]`).forEach((c) => {
      c.classList.toggle('active', c.dataset.value === val);
    });
  });
  updatePrice();
  setGalleryTab('current');
  refreshStudioGallery();
}

function refreshStudioGallery() {
  renderGalleryBody(jobType);
  if (getGalleryTab() === 'api' && currentModel && schema) {
    updateModelMetaPanel();
    try {
      const sel = collectSelections();
      const { payload } = buildJobPayload(currentModel, jobType, sel, loadSettings());
      setRequestPreview(schema.slug, payload);
    } catch {
      /* form chưa đủ */
    }
  }
  const shell = document.querySelector('.studio-shell');
  if (shell) {
    bindGalleryEvents(shell, {
      jobType,
      onReuse: applyHistoryEntry,
      onRefresh: refreshStudioGallery,
    });
  }
}

function selectModel(slug) {
  const m = models.find((x) => modelSlug(x) === slug);
  if (!m) return;
  currentModel = m;
  schema = analyzeModel(m, jobType);
  const cat = getModelCategory(m);

  closeModelPicker();
  const nameEl = $('pgModelName');
  if (nameEl) nameEl.textContent = m.name || slug;

  const notice = m.notices?.select || m.notices?.select1;
  const noticeEl = $('pgNotice');
  if (noticeEl) {
    if (notice?.message) {
      noticeEl.hidden = false;
      noticeEl.innerHTML = `<strong>${escapeHtml(notice.title || 'Lưu ý')}</strong><p>${escapeHtml(notice.message)}</p>`;
    } else {
      noticeEl.hidden = true;
    }
  }

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
  updateModelMetaPanel();
  if (getGalleryTab() === 'library') refreshStudioGallery();
}

function updateModelMetaPanel() {
  if (!currentModel || !schema) return;
  const slug = schema.slug;
  const metaId = $('pgMetaId');
  const metaServer = $('pgMetaServer');
  const metaPrice = $('pgMetaPrice');
  const metaType = $('pgMetaType');
  if (metaId) metaId.textContent = slug;
  if (metaServer) metaServer.textContent = providerTag(currentModel);
  if (metaPrice) metaPrice.textContent = formatPrice(currentModel.price, currentModel.sale) || '—';
  if (metaType) metaType.textContent = jobType;
  const schemaEl = $('pgSchemaJson');
  if (schemaEl) schemaEl.textContent = JSON.stringify(schema, null, 2);
}

function refreshAuthPanel() {
  const s = loadSettings();
  const d = $('pgDomain');
  const p = $('pgProjectId');
  if (d) d.value = s.domain || '79ai.net';
  if (p) p.value = s.projectId || 'default';
  const tok = $('pgTokenDisplay');
  if (tok) {
    tok.textContent = s.accessToken
      ? `${s.accessToken.slice(0, 12)}…${s.accessToken.slice(-4)}`
      : '(chưa có token)';
  }
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
  const img = $('pgPreviewImg');
  const vid = $('pgPreviewVideo');
  const aud = $('pgPreviewAudio');
  const file = $('pgPreviewFile');
  if (img) img.hidden = true;
  if (vid) vid.hidden = true;
  if (aud) aud.hidden = true;
  if (file) file.hidden = true;
}

function setPreviewState(state, { url, message } = {}) {
  if (state === 'result' && url) lastResultUrl = url;
  if (state === 'loading' && activeLoadingId) {
    const item = document.querySelector(`[data-entry-id="${activeLoadingId}"]`);
    const p = item?.querySelector('.sg-card-loading p');
    if (p && message) p.textContent = message;
  }
  if (state === 'result' || state === 'empty') refreshStudioGallery();
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
  const meta = {
    mode: sel.mode || '',
    resolution: sel.resolution || '',
    ratio: sel.ratio || '',
    duration: sel.duration || '',
  };
  if (activeLoadingId) {
    finishLoadingSession(activeLoadingId, url);
    activeLoadingId = null;
  }
  addHistoryEntry({
    type: jobType,
    resultUrl: url,
    prompt: sel.prompt || sel.text || sel.name || '',
    modelName: currentModel?.name || '',
    modelSlug: schema?.slug || '',
    meta,
  });
  refreshStudioGallery();
}

async function runCreate() {
  if (!currentModel || !schema) return;
  const errEl = $('pgError');
  if (errEl) errEl.hidden = true;

  let payload;
  try {
    const sel = collectSelections();
    if (jobType === 'music' && !sel.name) sel.name = 'Bản nhạc';
    ({ payload } = buildJobPayload(currentModel, jobType, sel, loadSettings()));
  } catch (e) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = e.message;
    }
    return;
  }

  const modelId = schema.slug;
  setRequestPreview(modelId, payload);
  const sel = collectSelections();
  setGalleryTab('current');
  activeLoadingId = addLoadingSession(
    sel.prompt || sel.text || sel.name || '',
    currentModel?.name || '',
    modelId,
    {
      mode: sel.mode || '',
      resolution: sel.resolution || '',
      ratio: sel.ratio || '',
    }
  );
  refreshStudioGallery();
  const submitBtn = $('pgSubmit');
  if (submitBtn) submitBtn.disabled = true;

  const media = pollMediaForJobType(jobType);

  try {
    const c = client();
    const createEnv = await c.createJob(jobType, modelId, payload);
    setResponse(`POST /ai/jobs/${jobType}/${modelId}`, createEnv);

    const { idBase, resultUrl } = c.extract(createEnv);
    if (resultUrl && !idBase) {
      setPreviewState('result', { url: resultUrl });
      recordHistory(resultUrl);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (!idBase) throw new Error('Không nhận được id_base từ API.');

    if (!media) {
      if (resultUrl) {
        setPreviewState('result', { url: resultUrl });
        recordHistory(resultUrl);
      }
      setResponse('Kết quả cuối', createEnv);
      if (submitBtn) submitBtn.disabled = false;
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
      if (activeLoadingId) {
        removeLoadingSession(activeLoadingId);
        activeLoadingId = null;
      }
      setPreviewState('empty');
      showPgError(
        poll.timeout
          ? 'Hết thời gian chờ — thử lại sau.'
          : `Thất bại: ${poll.error || poll.status || 'unknown'}`
      );
      refreshStudioGallery();
    }
  } catch (e) {
    if (activeLoadingId) {
      removeLoadingSession(activeLoadingId);
      activeLoadingId = null;
    }
    setPreviewState('empty');
    setResponse('Lỗi', { message: e.message, envelope: e.envelope });
    showPgError(e.message || 'Lỗi kết nối API.');
    refreshStudioGallery();
  } finally {
    const submit = $('pgSubmit');
    if (submit) submit.disabled = false;
  }
}

async function loadModels() {
  const loading = $('pgModelLoading');
  const list = $('pgModelList');
  if (loading) loading.hidden = false;
  if (list) list.innerHTML = '';
  try {
    const c = client();
    const env = await c.fetchModels(jobType);
    models = c.listModels(env).filter(isModelAvailable);
    renderProviderTabs();
    renderModelList();
    if (models.length) {
      const preferred = preferredModelSlug
        ? models.find((m) => modelSlug(m) === preferredModelSlug)
        : null;
      selectModel(modelSlug(preferred || models[0]));
    }
    else {
      showPgError('Không có model khả dụng cho loại này.');
    }
  } catch (e) {
    showPgError(e.message || 'Không tải được danh sách model.');
  } finally {
    const loading = $('pgModelLoading');
    if (loading) loading.hidden = true;
  }
}

function bindEvents() {
  renderTypePanel();
  syncTypeTrigger();
  refreshStudioGallery();

  $('pgTypeToggle')?.addEventListener('click', toggleTypePicker);
  $('pgSideType')?.addEventListener('click', toggleTypePicker);
  $('pgGoHome')?.addEventListener('click', () => navigate('/'));
  $('pgGoBack')?.addEventListener('click', () => navigate('/'));

  $('pgClearPrompt')?.addEventListener('click', () => {
    if ($('pgPrompt')) $('pgPrompt').value = '';
    if ($('pgText')) $('pgText').value = '';
  });

  document.addEventListener('history:updated', () => {
    if (getGalleryTab() === 'history' || getGalleryTab() === 'library') refreshStudioGallery();
  });

  $('pgModelToggle')?.addEventListener('click', toggleModelPicker);
  $('pgModelBackdrop')?.addEventListener('click', () => {
    closeModelPicker();
    closeTypePicker();
  });
  $('pgClosePicker')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModelPicker();
  });
  $('pgModelPicker')?.addEventListener('click', (e) => e.stopPropagation());
  $('pgModelSearch')?.addEventListener('input', (e) => renderModelList(e.target.value));
  $('pgSubmit')?.addEventListener('click', runCreate);
  $('pgCopyUrl')?.addEventListener('click', () => {
    const url = $('pgRequestUrlSub')?.textContent || $('pgRequestUrl')?.textContent || '';
    navigator.clipboard?.writeText(url);
  });
  $('pgCopyAuth')?.addEventListener('click', () => {
    navigator.clipboard?.writeText($('pgAuthInfo')?.textContent || '');
  });
  $('pgCopyResponse')?.addEventListener('click', () => {
    navigator.clipboard?.writeText($('pgResponse')?.textContent || '');
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
    refreshAuthPanel();
    void loadModels();
  });

  $('pgDomain')?.addEventListener('change', () => {
    saveSettings({ domain: $('pgDomain')?.value.trim() });
    refreshAuthPanel();
  });
  $('pgProjectId')?.addEventListener('change', () => {
    saveSettings({ projectId: $('pgProjectId')?.value.trim() });
    refreshAuthPanel();
  });

  $('pgGoMatrix')?.addEventListener('click', () => navigate('/matrix'));

  if (!escapeBound) {
    escapeBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModelPicker();
        closeTypePicker();
      }
    });
  }

  if (!clickBound) {
    clickBound = true;
    document.addEventListener('click', () => {
      closeModelPicker();
      closeTypePicker();
    });
  }
}

function getHtml() {
  const meta = typeMeta();
  const createTitle = CREATE_TITLES[jobType] || 'Studio';
  return `
    <div class="view-media-playground studio-shell pg-shell page-shell">
      <div id="pgTokenBanner" class="banner warn token-panel studio-token-banner" hidden>
        <form id="pgTokenForm" class="token-quick-form">
          <label class="field-block token-field">
            <span class="field-label">Mã token Gommo</span>
            <input type="password" id="pgToken" placeholder="Dán token…" />
          </label>
          <button type="submit" class="primary">Kết nối</button>
        </form>
      </div>

      <div class="studio-workspace pg-workspace">
        <aside class="studio-sidebar panel">
          <header class="studio-side-head">
            <button type="button" class="pg-back" id="pgGoBack" title="Trang chủ">←</button>
            <h2 class="studio-side-title font-display">${escapeHtml(createTitle)}</h2>
            <button type="button" class="studio-type-btn" id="pgSideType" title="Đổi loại">
              <span id="pgTypeIcon">${meta.icon}</span>
            </button>
            <div id="pgTypePanel" class="pg-type-panel panel studio-type-panel" role="listbox"></div>
          </header>

          <div class="studio-side-scroll">
          <div class="studio-mode-pills">
            <button type="button" class="studio-pill active">Đơn</button>
            <button type="button" class="studio-pill" disabled title="Sắp có">Auto Mode</button>
          </div>

          <div class="studio-field studio-model-field">
            <span class="studio-field-label">MODEL</span>
            <div class="pg-model-select studio-model-select">
              <button type="button" class="studio-model-trigger" id="pgModelToggle" aria-expanded="false">
                <span id="pgModelName">Chọn model…</span>
                <span class="pg-chevron">▾</span>
              </button>
              <div id="pgModelBackdrop" class="pg-model-backdrop"></div>
              <div id="pgModelPicker" class="pg-model-dropdown panel" role="listbox">
                <div class="pg-picker-head">
                  <input type="search" id="pgModelSearch" class="pg-search" placeholder="Tìm model…" />
                  <button type="button" class="icon-btn pg-close-picker" id="pgClosePicker">✕</button>
                </div>
                <div class="pg-provider-tabs" id="pgProviderTabs"></div>
                <div id="pgModelLoading" class="loading" hidden>Đang tải…</div>
                <div id="pgModelList" class="pg-model-list"></div>
              </div>
            </div>
          </div>

          <div id="pgParams" class="studio-params"></div>
          <div id="pgNotice" class="notice studio-notice" hidden></div>

          <div class="studio-ref-zone" id="studioRefZone">
            <p class="studio-ref-hint">ẢNH THAM CHIẾU — Nhấp / Kéo thả / Dán ảnh</p>
            <div id="pgImages" class="pg-refs studio-refs" hidden></div>
            <div id="pgRefs" class="pg-refs studio-refs" hidden></div>
            <div id="pgSubjects" class="pg-refs studio-refs" hidden></div>
          </div>

          <div class="studio-prompt-block">
            <div class="studio-prompt-head">
              <span class="studio-field-label">MÔ TẢ</span>
              <div class="studio-prompt-tools">
                <button type="button" class="studio-icon-btn" id="pgClearPrompt" title="Xóa">🗑</button>
              </div>
            </div>
            <label id="pgPromptWrap" class="field-block">
              <textarea id="pgPrompt" class="studio-prompt-area" rows="5" placeholder="Mô tả nội dung bạn muốn tạo…"></textarea>
            </label>
            <label id="pgTextWrap" class="field-block" hidden>
              <textarea id="pgText" class="studio-prompt-area" rows="5" placeholder="Văn bản cần đọc…"></textarea>
            </label>
            <label id="pgMusicNameWrap" class="field-block" hidden>
              <input type="text" id="pgMusicName" placeholder="Tên bài nhạc" />
            </label>
          </div>

          <details class="studio-advanced">
            <summary>API &amp; xác thực</summary>
            <div class="pg-auth-grid">
              <label class="field-block"><span class="field-label">DOMAIN</span><input type="text" id="pgDomain" /></label>
              <label class="field-block"><span class="field-label">PROJECT_ID</span><input type="text" id="pgProjectId" /></label>
            </div>
            <p class="pg-token-display"><code id="pgTokenDisplay">—</code></p>
            <button type="button" class="secondary pg-sm" id="pgGoSettings">Token API</button>
            <button type="button" class="secondary pg-sm" id="pgGoMatrix">Matrix</button>
          </details>
          </div>

          <footer class="studio-side-footer">
            <div class="studio-price-row">
              <span class="studio-coin">◆</span>
              <strong id="pgPrice">—</strong>
            </div>
            <button type="button" class="primary studio-submit" id="pgSubmit">⚡ ${escapeHtml(createTitle)}</button>
            <p id="pgError" class="notice error" hidden></p>
          </footer>
        </aside>

        <section class="studio-main panel">
          <div class="studio-gallery-bar">
            <div class="studio-gallery-tabs" role="tablist">
              <button type="button" class="studio-gtab active" data-sg-tab="current" role="tab">Hiện tại</button>
              <button type="button" class="studio-gtab" data-sg-tab="history" role="tab"><span id="sgHistCount">Lịch sử</span></button>
              <button type="button" class="studio-gtab" data-sg-tab="library" role="tab">Thư viện</button>
              <button type="button" class="studio-gtab" data-sg-tab="api" role="tab">API</button>
            </div>
            <div class="studio-gallery-tools" id="studioGalleryTools"></div>
          </div>
          <div class="studio-gallery-body" id="studioGalleryBody"></div>
        </section>
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

/** @param {{ main: HTMLElement, params?: { type?: string }, query?: { model?: string } }} ctx */
export function renderMediaPlayground({ main, params = {}, query = {} }) {
  const type = params.type || 'image';
  preferredModelSlug = String(query.model || '').trim();
  if (!PLAYGROUND_TYPES.has(type)) {
    navigate('/create/image');
    return;
  }

  jobType = type;
  setGalleryTab('current');
  resetSession();
  activeLoadingId = null;
  models = [];
  currentModel = null;
  schema = null;
  lastResultUrl = null;

  main.innerHTML = getHtml();
  bindEvents();
  refreshAuthPanel();
  setGalleryReuseHandler(applyHistoryEntry);
  $('pgTypePanel')?.addEventListener('click', (e) => e.stopPropagation());

  setRequestPreview('model_id', { domain: loadSettings().domain, project_id: loadSettings().projectId });
  refreshStudioGallery();

  if (!hasToken()) {
    $('pgTokenBanner').hidden = false;
    return;
  }
  void loadModels();
}

export function renderImagePlayground(ctx) {
  renderMediaPlayground({ ...ctx, params: { type: 'image', ...ctx.params } });
}
