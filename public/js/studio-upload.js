/**
 * Upload ảnh tham chiếu qua POST /ai/upload/image — UI kiểu 79.ai
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function uploadSlotHtml(dataAttr, index, label) {
  return `
    <div class="studio-upload-slot" data-upload-slot="${dataAttr}-${index}">
      <span class="studio-upload-slot-label">${escapeHtml(label)}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="studio-upload-input" hidden />
      <input type="hidden" ${dataAttr}="${index}" value="" />
      <button type="button" class="studio-upload-tile" data-upload-pick aria-label="Chọn ảnh">
        <span class="studio-upload-plus">+</span>
        <img class="studio-upload-thumb" alt="" hidden />
        <span class="studio-upload-loading" hidden>…</span>
      </button>
      <button type="button" class="studio-upload-remove" hidden title="Xóa ảnh">✕</button>
    </div>`;
}

/**
 * @param {HTMLElement} el
 * @param {{ dataAttr: string, count: number, groupLabel: string, itemLabel: (i: number) => string }} opts
 */
export function renderUploadGroup(el, { dataAttr, count, groupLabel, itemLabel }) {
  if (!el) return;
  if (!count || count <= 0) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  const labelFn = itemLabel || ((i) => `${groupLabel} ${i + 1}`);
  el.innerHTML = `
    <p class="studio-upload-group-label">${escapeHtml(groupLabel)}</p>
    <div class="studio-upload-grid">
      ${Array.from({ length: count }, (_, i) => uploadSlotHtml(dataAttr, i, labelFn(i))).join('')}
    </div>`;
}

function slotHiddenInput(slot) {
  return slot.querySelector('input[type="hidden"]');
}

function setSlotState(slot, { url, previewSrc, loading, error }) {
  const tile = slot.querySelector('.studio-upload-tile');
  const thumb = slot.querySelector('.studio-upload-thumb');
  const plus = slot.querySelector('.studio-upload-plus');
  const loadEl = slot.querySelector('.studio-upload-loading');
  const removeBtn = slot.querySelector('.studio-upload-remove');
  const hidden = slotHiddenInput(slot);

  if (loading) {
    tile?.classList.add('is-loading');
    if (loadEl) loadEl.hidden = false;
    if (plus) plus.hidden = true;
    if (thumb) thumb.hidden = true;
    if (removeBtn) removeBtn.hidden = true;
    return;
  }

  tile?.classList.remove('is-loading');
  if (loadEl) loadEl.hidden = true;

  if (url && hidden) hidden.value = url;

  if (url && (previewSrc || url)) {
    tile?.classList.add('has-image');
    if (thumb) {
      thumb.src = previewSrc || url;
      thumb.hidden = false;
    }
    if (plus) plus.hidden = true;
    if (removeBtn) removeBtn.hidden = false;
  } else {
    tile?.classList.remove('has-image');
    if (hidden) hidden.value = '';
    if (thumb) {
      thumb.removeAttribute('src');
      thumb.hidden = true;
    }
    if (plus) plus.hidden = false;
    if (removeBtn) removeBtn.hidden = true;
  }

  if (error) {
    tile?.classList.add('has-error');
    tile?.setAttribute('title', error);
  } else {
    tile?.classList.remove('has-error');
    tile?.removeAttribute('title');
  }
}

function clearSlot(slot) {
  setSlotState(slot, { url: '', previewSrc: '', loading: false });
}

function firstEmptySlot(root) {
  return [...root.querySelectorAll('.studio-upload-slot')].find((slot) => {
    const v = slotHiddenInput(slot)?.value?.trim();
    return !v;
  });
}

async function uploadToSlot(slot, file, uploadFn) {
  if (!file.type.startsWith('image/')) {
    setSlotState(slot, { error: 'Chỉ hỗ trợ file ảnh.' });
    return;
  }
  setSlotState(slot, { loading: true, error: null });
  try {
    const { url } = await uploadFn(file);
    const previewSrc = URL.createObjectURL(file);
    setSlotState(slot, { url, previewSrc, loading: false });
  } catch (e) {
    setSlotState(slot, { loading: false, error: e.message || 'Upload thất bại' });
  }
}

/**
 * @param {HTMLElement} root — .studio-ref-zone hoặc container chứa slots
 * @param {{ uploadFn: (file: File) => Promise<{ url: string }>, hasToken: () => boolean }} opts
 */
export function bindStudioUploads(root, { uploadFn, hasToken }) {
  if (!root) return;

  root.querySelectorAll('.studio-upload-slot').forEach((slot) => {
    const input = slot.querySelector('.studio-upload-input');
    const pick = slot.querySelector('[data-upload-pick]');
    const remove = slot.querySelector('.studio-upload-remove');

    pick?.addEventListener('click', () => {
      if (!hasToken()) {
        alert('Chưa có token API — vào Cài đặt để kết nối.');
        return;
      }
      input?.click();
    });

    input?.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) void uploadToSlot(slot, file, uploadFn);
      input.value = '';
    });

    remove?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSlot(slot);
    });
  });

  const onFiles = (files) => {
    if (!files?.length) return;
    if (!hasToken()) {
      alert('Chưa có token API — vào Cài đặt để kết nối.');
      return;
    }
    [...files].forEach((file) => {
      const slot = firstEmptySlot(root);
      if (slot && file.type.startsWith('image/')) void uploadToSlot(slot, file, uploadFn);
    });
  };

  root.addEventListener('dragover', (e) => {
    e.preventDefault();
    root.classList.add('is-dragover');
  });
  root.addEventListener('dragleave', () => root.classList.remove('is-dragover'));
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    root.classList.remove('is-dragover');
    onFiles(e.dataTransfer?.files);
  });

  root.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      onFiles(files);
    }
  });
}
