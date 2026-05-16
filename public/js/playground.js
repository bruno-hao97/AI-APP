import { GommoClient } from './gommo-client.js';
import { loadSettings, hasToken } from './settings-store.js';
import {
  modelSlug,
  analyzeModel,
  buildJobPayload,
  defaultSelections,
  lookupPrice,
  pollMediaForJobType,
  isModelAvailable,
} from './model-schema.js';
import {
  JOB_TYPES,
  FIELD_LABELS,
  getModelCategory,
  formatPrice,
  formatDurationOption,
  progressMessage,
} from './ui-labels.js';

let modelsCache = [];
let currentType = 'video';
let currentModel = null;
let currentSchema = null;
let currentStep = 1;
/** @type {string|null} */
let lastResultUrl = null;

const $ = (id) => document.getElementById(id);

/**
 * @param {string} url
 * @param {boolean} isImage
 */
function guessResultFilename(url, isImage) {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop() || '';
    if (seg && /\.[a-z0-9]{2,5}$/i.test(seg)) {
      return decodeURIComponent(seg.split('?')[0]);
    }
  } catch {
    /* ignore */
  }
  return isImage ? `gommo-${Date.now()}.jpg` : `gommo-${Date.now()}.mp4`;
}

/** @param {string} filename */
function asPngDownloadName(filename) {
  const base = filename.replace(/\.[^./\\]+$/, '');
  return (base || 'gommo-image') + '.png';
}

/**
 * @param {string} url
 * @param {string} filename
 */
function downloadBlobFromUrl(url, filename) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = im.naturalWidth;
        c.height = im.naturalHeight;
        c.getContext('2d')?.drawImage(im, 0, 0);
        c.toBlob((blob) => {
          if (!blob) {
            reject(new Error('toBlob'));
            return;
          }
          const obj = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = obj;
          a.download = filename;
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(obj), 4000);
          resolve();
        }, 'image/png');
      } catch (e) {
        reject(e);
      }
    };
    im.onerror = () => reject(new Error('image load'));
    im.src = url;
  });
}

function triggerBlobDownload(blob, filename) {
  const obj = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = obj;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(obj), 4000);
}

/**
 * Tải file từ URL CDN: ưu tiên fetch (CORS), ảnh thì thử canvas, cuối cùng mở tab + gợi ý chuột phải.
 * @param {string} url
 */
async function downloadResult(url) {
  const isImage =
    currentType === 'image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
  const filename = guessResultFilename(url, isImage);
  const hint = $('downloadHint');
  if (hint) hint.hidden = true;

  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    triggerBlobDownload(blob, filename);
    return;
  } catch {
    /* CORS hoặc lỗi mạng — thử cách khác */
  }

  if (isImage) {
    try {
      await downloadBlobFromUrl(url, asPngDownloadName(filename));
      return;
    } catch {
      /* Ảnh có thể bị CORS — thử dùng thẻ preview đã load */
    }
    const imgEl = $('resultImage');
    if (imgEl && !imgEl.hidden && imgEl.complete && imgEl.naturalWidth) {
      try {
        const c = document.createElement('canvas');
        c.width = imgEl.naturalWidth;
        c.height = imgEl.naturalHeight;
        c.getContext('2d')?.drawImage(imgEl, 0, 0);
        const blob = await new Promise((resolve, reject) => {
          c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png');
        });
        triggerBlobDownload(blob, asPngDownloadName(filename));
        return;
      } catch {
        /* tainted canvas */
      }
    }
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (hint) hint.hidden = false;
}

function logTech(msg, obj) {
  const logEl = $('log');
  if (!logEl) return;
  const line = obj ? `${msg}\n${JSON.stringify(obj, null, 2)}` : msg;
  logEl.textContent = `${logEl.textContent}\n${line}`.trim();
}

function client() {
  if (!hasToken()) throw new Error('Chưa có mã đăng nhập. Vào Cài đặt tài khoản.');
  return new GommoClient(loadSettings());
}

function setStep(n) {
  currentStep = n;
  document.querySelectorAll('.step-item').forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle('active', s === n);
    el.classList.toggle('done', s < n);
  });
  ['step1', 'step2', 'step3', 'step4'].forEach((id, i) => {
    const panel = $(id);
    if (panel) panel.hidden = i + 1 !== n;
  });
}

function initTypeCards() {
  const root = $('typeCards');
  root.innerHTML = '';
  JOB_TYPES.forEach((t) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pick-card' + (t.value === currentType ? ' selected' : '');
    card.innerHTML = `
      <span class="pick-icon">${t.icon}</span>
      <strong>${t.label}</strong>
      <span class="pick-desc">${t.desc}</span>
    `;
    card.addEventListener('click', () => {
      currentType = t.value;
      initTypeCards();
      loadModelsAndGoStep2();
    });
    root.appendChild(card);
  });
}

function renderModelCards() {
  const root = $('modelCards');
  const empty = $('modelEmpty');
  root.innerHTML = '';
  const available = modelsCache.filter((m) => isModelAvailable(m));
  empty.hidden = available.length > 0;

  available.forEach((m) => {
    const slug = modelSlug(m);
    const cat = getModelCategory(m);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pick-card model-card';
    const desc = (m.description || '').slice(0, 120);
    card.innerHTML = `
      <span class="tag">${cat.tag}</span>
      <strong>${m.name || slug}</strong>
      <span class="pick-desc">${cat.hint}</span>
      ${desc ? `<span class="pick-desc muted">${desc}${m.description.length > 120 ? '…' : ''}</span>` : ''}
      <span class="price-tag">${formatPrice(m.price, m.sale)}</span>
    `;
    card.addEventListener('click', () => selectModel(m));
    root.appendChild(card);
  });
}

function showModelNotice(model) {
  const box = $('modelNotice');
  const n = model.notices?.select || model.notices?.select1;
  if (!n?.message) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.className = 'notice' + (n.type === 'warning' ? ' warn' : '');
  box.innerHTML = `<strong>${n.title || 'Lưu ý'}</strong><p>${n.message}</p>`;
}

function makeFieldSelect(id, label, options, { required, formatLabel } = {}) {
  const wrap = document.createElement('label');
  wrap.className = 'field-block';
  wrap.htmlFor = id;
  const lbl = formatLabel || ((o) => o.label);
  wrap.innerHTML = `<span class="field-label">${label}${required ? ' <em>*</em>' : ''}</span>`;
  const sel = document.createElement('select');
  sel.id = id;
  if (options.length === 0) {
    sel.disabled = true;
    const opt = document.createElement('option');
    opt.textContent = 'Không có tùy chọn';
    sel.appendChild(opt);
  } else {
    options.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = lbl(o);
      if (o.description) opt.title = o.description;
      if (o.status === 'pause') {
        opt.disabled = true;
        opt.textContent += ' (tạm bảo trì)';
      }
      sel.appendChild(opt);
    });
  }
  wrap.appendChild(sel);
  return wrap;
}

function renderUrlInputs(container, id, label, count, help) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const wrap = document.createElement('label');
    wrap.className = 'field-block';
    wrap.innerHTML = `
      <span class="field-label">${label} ${count > 1 ? i + 1 : ''}</span>
      ${i === 0 && help ? `<span class="field-help">${help}</span>` : ''}
    `;
    const inp = document.createElement('input');
    inp.type = 'url';
    inp.dataset.array = id;
    inp.dataset.index = String(i);
    inp.placeholder = 'https://…';
    wrap.appendChild(inp);
    container.appendChild(wrap);
  }
}

function renderStep3Form() {
  const schema = currentSchema;
  const dynamic = $('dynamicFields');
  const mediaSection = $('mediaUrls');
  const urlRoot = $('urlInputs');
  dynamic.innerHTML = '';

  if (!schema) return;

  const { options, fields, limits } = schema;

  if (fields.ratio) {
    dynamic.appendChild(
      makeFieldSelect('selRatio', FIELD_LABELS.ratio, options.ratios, { required: true })
    );
  }
  if (fields.resolution) {
    dynamic.appendChild(
      makeFieldSelect('selResolution', FIELD_LABELS.resolution, options.resolutions, {
        required: true,
      })
    );
  }
  if (fields.duration) {
    dynamic.appendChild(
      makeFieldSelect('selDuration', FIELD_LABELS.duration, options.durations, {
        formatLabel: formatDurationOption,
      })
    );
  }
  if (fields.mode) {
    const modes = options.modes.filter((m) => m.status !== 'pause');
    dynamic.appendChild(
      makeFieldSelect('selMode', FIELD_LABELS.mode, modes.length ? modes : options.modes, {
        required: modes.length > 0,
        formatLabel: (o) => (o.group ? `${o.label} (${o.group})` : o.label),
      })
    );
  }

  if (fields.startFrame || fields.references || fields.subjects) {
    mediaSection.hidden = false;
    urlRoot.innerHTML = '';
    if (fields.startFrame) {
      const n = limits.maxStartImages || 1;
      renderUrlInputs(
        urlRoot,
        'images',
        FIELD_LABELS.images,
        n,
        'Ảnh đầu tiên — video sẽ bắt đầu từ khung hình này.'
      );
    }
    if (fields.references && limits.maxReference > 0) {
      const refPart = document.createElement('div');
      refPart.className = 'url-group';
      urlRoot.appendChild(refPart);
      renderUrlInputs(
        refPart,
        'references',
        FIELD_LABELS.references,
        limits.maxReference,
        'Thêm ảnh minh hoạ nhân vật, sản phẩm hoặc phong cách.'
      );
    }
    if (fields.subjects && limits.maxSubject > 0) {
      const subPart = document.createElement('div');
      subPart.className = 'url-group';
      urlRoot.appendChild(subPart);
      renderUrlInputs(subPart, 'subjects', FIELD_LABELS.subjects, limits.maxSubject);
    }
  } else {
    mediaSection.hidden = true;
  }

  dynamic.querySelectorAll('select').forEach((node) => {
    node.addEventListener('change', updatePriceBox);
  });

  const defs = defaultSelections(schema);
  if ($('selRatio')) $('selRatio').value = defs.ratio || '';
  if ($('selMode')) $('selMode').value = defs.mode || '';
  if ($('selResolution')) $('selResolution').value = defs.resolution || '';
  if ($('selDuration')) $('selDuration').value = defs.duration || '';

  $('promptWrap').hidden = !fields.prompt;
  $('textWrap').hidden = !fields.text;
  $('musicNameWrap').hidden = !fields.musicName;

  $('modelDetail').textContent = JSON.stringify(
    { tool: schema.slug, needs: schema.fields },
    null,
    2
  );

  updatePriceBox();
}

function updatePriceBox() {
  const box = $('estPrice');
  if (!currentSchema) {
    box.hidden = true;
    return;
  }
  const mode = $('selMode')?.value;
  const resolution = $('selResolution')?.value;
  const duration = $('selDuration')?.value;
  let p = lookupPrice(currentSchema.prices, mode, resolution);
  if (p == null && duration) {
    const row = currentSchema.prices?.find(
      (r) =>
        (!mode || r.mode === mode) &&
        (!resolution || r.resolution === resolution) &&
        String(r.duration) === String(duration)
    );
    p = row?.price;
  }
  const text =
    p != null
      ? formatPrice(p, currentModel?.sale)
      : currentSchema.basePrice
        ? formatPrice(currentSchema.basePrice, currentModel?.sale)
        : '';
  box.hidden = !text;
  box.innerHTML = text ? `<strong>Chi phí ước tính:</strong> ${text}` : '';
}

function collectArrayUrls(name) {
  return [...document.querySelectorAll(`input[data-array="${name}"]`)]
    .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
    .map((i) => i.value.trim())
    .filter(Boolean);
}

function collectSelections() {
  const s = {
    prompt: $('prompt')?.value.trim(),
    text: $('text')?.value.trim(),
    name: $('musicName')?.value.trim(),
    ratio: $('selRatio')?.value,
    mode: $('selMode')?.value,
    resolution: $('selResolution')?.value,
    duration: $('selDuration')?.value,
    images: collectArrayUrls('images'),
    references: collectArrayUrls('references'),
    subjects: collectArrayUrls('subjects'),
  };
  if (currentType === 'music' && !s.name) s.name = 'Bản nhạc';
  return s;
}

function selectModel(m) {
  currentModel = m;
  currentSchema = analyzeModel(m, currentType);
  const cat = getModelCategory(m);

  $('selectedModelTitle').textContent = m.name || modelSlug(m);
  $('selectedModelHint').textContent = cat.hint;
  showModelNotice(m);
  renderStep3Form();
  setStep(3);
}

async function loadModelsAndGoStep2() {
  setStep(2);
  $('modelLoading').hidden = false;
  $('modelCards').innerHTML = '';
  $('step2Subtitle').textContent = 'Đang tải danh sách công cụ…';

  try {
    const c = client();
    const envelope = await c.fetchModels(currentType);
    modelsCache = c.listModels(envelope);
    const typeLabel = JOB_TYPES.find((t) => t.value === currentType)?.label || currentType;
    $('step2Subtitle').textContent = `${modelsCache.length} công cụ cho ${typeLabel}`;
    renderModelCards();
    logTech('models loaded', { type: currentType, count: modelsCache.length });
  } catch (e) {
    $('step2Subtitle').textContent = 'Không tải được danh sách.';
    $('modelEmpty').hidden = false;
    $('modelEmpty').textContent =
      e.message || 'Lỗi kết nối. Kiểm tra mã đăng nhập trong Cài đặt tài khoản.';
    logTech('load error', { message: e.message });
  } finally {
    $('modelLoading').hidden = true;
  }
}

function setProgress(percent, text) {
  $('progressWrap').hidden = false;
  $('progressBar').style.width = `${Math.min(100, percent)}%`;
  $('progress').textContent = text;
}

async function runCreate() {
  $('log').textContent = '';
  $('techLogWrap').hidden = false;
  $('result').hidden = true;
  $('resultError').hidden = true;
  setStep(4);

  if (!currentModel || !currentSchema) return;

  let payload;
  try {
    const selections = collectSelections();
    ({ payload } = buildJobPayload(currentModel, currentType, selections, loadSettings()));
    logTech('payload', payload);
  } catch (e) {
    $('resultError').hidden = false;
    $('resultError').textContent = e.message;
    return;
  }

  const media = pollMediaForJobType(currentType);
  setProgress(5, 'Đang gửi yêu cầu tạo…');

  try {
    const c = client();
    const createEnv = await c.createJob(currentType, currentSchema.slug, payload);
    logTech('create', createEnv);

    const { idBase, resultUrl } = c.extract(createEnv);
    if (resultUrl && !idBase) {
      setProgress(100, progressMessage('success'));
      showResult(resultUrl);
      return;
    }
    if (!idBase) throw new Error('Hệ thống chưa trả về mã theo dõi. Thử lại sau vài phút.');

    if (!media) {
      if (resultUrl) showResult(resultUrl);
      setProgress(100, 'Hoàn tất!');
      return;
    }

    let pollPercent = 10;
    const poll = await c.pollUntilDone(idBase, media, {
      onProgress: ({ attempt, phase, status }) => {
        pollPercent = Math.min(95, 10 + attempt * 1.1);
        const friendly =
          phase === 'running' || phase === 'unknown'
            ? progressMessage('running', attempt)
            : progressMessage(phase);
        setProgress(pollPercent, friendly);
        logTech(`poll #${attempt}`, { phase, status });
      },
    });

    logTech('poll done', poll);

    if (poll.success && poll.resultUrl) {
      setProgress(100, progressMessage('success'));
      showResult(poll.resultUrl);
    } else {
      $('resultError').hidden = false;
      $('resultError').textContent =
        poll.timeout
          ? 'Đã chờ quá lâu. Video có thể vẫn đang xử lý — thử kiểm tra lại trên 79AI.'
          : `Không thành công (${poll.error || poll.status || 'lỗi không xác định'}).`;
      setProgress(100, progressMessage('failed'));
    }
  } catch (e) {
    $('resultError').hidden = false;
    $('resultError').textContent =
      e.message || 'Có lỗi xảy ra. Kiểm tra mạng và mã đăng nhập.';
    setProgress(0, '');
    logTech('error', { message: e.message, envelope: e.envelope });
  }
}

function showResult(url) {
  lastResultUrl = url;
  const box = $('result');
  const link = $('resultLink');
  const video = $('resultVideo');
  const img = $('resultImage');
  const hint = $('downloadHint');
  if (hint) hint.hidden = true;
  link.href = url;
  const isImage =
    currentType === 'image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
  video.hidden = isImage;
  img.hidden = !isImage;
  video.src = isImage ? '' : url;
  img.src = isImage ? url : '';
  box.hidden = false;
}

$('btnBack1')?.addEventListener('click', () => setStep(1));
$('btnBack2')?.addEventListener('click', () => setStep(2));
$('btnBackEdit')?.addEventListener('click', () => setStep(3));
$('btnNew')?.addEventListener('click', () => {
  setStep(1);
  currentModel = null;
  currentSchema = null;
});
$('createJob')?.addEventListener('click', runCreate);
$('btnDownload')?.addEventListener('click', () => {
  if (lastResultUrl) void downloadResult(lastResultUrl);
});

if (!hasToken()) {
  $('bannerNoToken').hidden = false;
} else {
  initTypeCards();
  setStep(1);
}
