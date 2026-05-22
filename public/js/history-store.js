/** Lịch sử tạo nội dung — lưu localStorage theo loại (image, video, …). */
const STORAGE_KEY = 'ai_studio_history';
const MAX_PER_TYPE = 80;

/** @typedef {'image'|'video'|'tts'|'music'|'avatar-lipsync'} HistoryType */

/**
 * @typedef {Object} HistoryEntry
 * @property {string} id
 * @property {HistoryType} type
 * @property {string} resultUrl
 * @property {string} [prompt]
 * @property {string} [modelName]
 * @property {string} [modelSlug]
 * @property {string} createdAt
 * @property {Record<string, string>} [meta]
 */

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveAll(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {Omit<HistoryEntry, 'id'|'createdAt'> & { id?: string, createdAt?: string }} entry
 * @returns {HistoryEntry}
 */
export function addHistoryEntry(entry) {
  const all = loadAll();
  const item = {
    id: entry.id || newId(),
    type: entry.type,
    resultUrl: entry.resultUrl,
    prompt: entry.prompt || '',
    modelName: entry.modelName || '',
    modelSlug: entry.modelSlug || '',
    createdAt: entry.createdAt || new Date().toISOString(),
    meta: entry.meta || {},
  };

  const withoutDup = all.filter(
    (e) => !(e.resultUrl === item.resultUrl && e.type === item.type)
  );
  const sameType = withoutDup.filter((e) => e.type === item.type);
  const otherTypes = withoutDup.filter((e) => e.type !== item.type);
  const merged = [...[item, ...sameType].slice(0, MAX_PER_TYPE), ...otherTypes];

  saveAll(merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

  document.dispatchEvent(new CustomEvent('history:updated', { detail: item }));
  return item;
}

/** @param {HistoryType|null} [type] */
export function listHistory(type = null) {
  const all = loadAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!type) return all;
  return all.filter((e) => e.type === type);
}

/** @param {HistoryType} type */
export function countHistory(type) {
  return listHistory(type).length;
}

/** @returns {Record<string, number>} */
export function countHistoryGrouped() {
  const counts = { image: 0, video: 0, tts: 0, music: 0, 'avatar-lipsync': 0 };
  loadAll().forEach((e) => {
    if (counts[e.type] != null) counts[e.type] += 1;
  });
  return counts;
}

/** @param {string} id */
export function removeHistoryEntry(id) {
  saveAll(loadAll().filter((e) => e.id !== id));
  document.dispatchEvent(new CustomEvent('history:updated'));
}

/** @param {HistoryType|null} [type] */
export function clearHistory(type = null) {
  if (!type) {
    saveAll([]);
  } else {
    saveAll(loadAll().filter((e) => e.type !== type));
  }
  document.dispatchEvent(new CustomEvent('history:updated'));
}

/** @param {string} url @param {HistoryType} type */
export function isMediaUrl(url, type) {
  if (type === 'image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) return 'image';
  if (type === 'video' || type === 'avatar-lipsync' || /\.(mp4|webm|mov)(\?|$)/i.test(url))
    return 'video';
  if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url)) return 'audio';
  return 'file';
}
