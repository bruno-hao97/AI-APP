/** Tải và phân tích catalog model từ Gommo API — dùng chung Matrix / Models / Playground */
import { GommoClient } from './gommo-client.js';
import { loadSettings, hasToken } from './settings-store.js';
import {
  analyzeModel,
  buildJobPayload,
  defaultSelections,
  isModelAvailable,
  modelSlug,
  parseModelsList,
} from './model-schema.js';
import { JOB_TYPES } from './ui-labels.js';

export { modelSlug, isModelAvailable, analyzeModel, buildJobPayload, defaultSelections };

/**
 * @typedef {Object} CatalogModel
 * @property {string} jobType
 * @property {string} slug
 * @property {object} raw
 * @property {ReturnType<typeof analyzeModel>} schema
 */

/** @returns {Promise<CatalogModel[]>} */
export async function fetchAllModels({ includeUnavailable = false } = {}) {
  if (!hasToken()) throw new Error('Chưa có token API — vào Cài đặt.');
  const c = new GommoClient(loadSettings());
  const out = [];

  for (const t of JOB_TYPES) {
    try {
      const env = await c.fetchModels(t.value);
      const list = parseModelsList(env).filter((m) => includeUnavailable || isModelAvailable(m));
      list.forEach((raw) => {
        const slug = modelSlug(raw);
        if (!slug) return;
        out.push({
          jobType: t.value,
          slug,
          raw,
          schema: analyzeModel(raw, t.value),
        });
      });
    } catch (e) {
      console.warn(`fetchModels(${t.value})`, e);
    }
  }

  return out;
}

/** @param {CatalogModel} entry */
export function inferProvider(entry) {
  const name = (entry.raw.name || entry.slug).toUpperCase();
  if (name.includes('GPT') || name.includes('OPENAI')) return 'OPENAI';
  if (name.includes('FLUX')) return 'FLUX';
  if (name.includes('GEMINI') || name.includes('GOOGLE') || name.includes('VEO')) return 'GOOGLE';
  if (name.includes('MIDJOURNEY') || name.includes(' MJ')) return 'MIDJOURNEY';
  if (name.includes('KLING')) return 'KLING';
  if (name.includes('GROK')) return 'GROK';
  if (name.includes('SUNO')) return 'SUNO';
  return 'KHÁC';
}

/** Prompt mẫu để dry-run / test thật */
export function samplePromptForType(jobType) {
  const map = {
    video: 'Cinematic product shot, slow camera move, studio lighting',
    image: 'Professional product photo on white background, 4k detail',
    tts: 'Xin chào, đây là bản demo giọng đọc AI từ AI Studio.',
    music: 'Upbeat corporate background music, modern and clean',
    'avatar-lipsync': 'Presenter introducing a new AI product, friendly tone',
  };
  return map[jobType] || 'Demo prompt from AI Studio matrix test';
}

/** @param {CatalogModel} entry */
export function buildTestSelections(entry) {
  const { jobType, schema } = entry;
  const defs = defaultSelections(schema);
  const base = {
    ...defs,
    prompt: samplePromptForType(jobType),
    text: jobType === 'tts' ? samplePromptForType(jobType) : undefined,
    name: jobType === 'music' ? 'Matrix Demo Track' : undefined,
    references: [],
    subjects: [],
    images: [],
  };
  return base;
}

/**
 * Dry-run: validate payload có build được không
 * @param {CatalogModel} entry
 */
export function dryRunModel(entry) {
  try {
    const sel = buildTestSelections(entry);
    const settings = loadSettings();
    const { payload, schema } = buildJobPayload(entry.raw, entry.jobType, sel, settings);
    const required = [];
    if (schema.fields.prompt && !payload.prompt) required.push('prompt');
    if (schema.fields.text && !payload.text) required.push('text');
    if (schema.fields.startFrame && !payload.images?.length) {
      // optional for dry-run — chỉ cảnh báo
    }
    return {
      ok: true,
      payload,
      schema,
      warnings: required.length ? `Thiếu: ${required.join(', ')}` : '',
      endpoint: `/ai/jobs/${entry.jobType}/${schema.slug}`,
    };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/** Liệt kê field keys bật cho UI matrix */
export function schemaFieldSummary(schema) {
  const f = schema.fields;
  const tags = [];
  if (f.prompt) tags.push('prompt');
  if (f.text) tags.push('text');
  if (f.musicName) tags.push('name');
  if (f.mode) tags.push(`mode(${schema.options.modes.length})`);
  if (f.resolution) tags.push(`res(${schema.options.resolutions.length})`);
  if (f.ratio) tags.push(`ratio(${schema.options.ratios.length})`);
  if (f.duration) tags.push(`dur(${schema.options.durations.length})`);
  if (f.startFrame) tags.push('startImage');
  if (f.endFrame) tags.push('endFrame');
  if (f.references) tags.push(`ref≤${schema.limits.maxReference}`);
  if (f.subjects) tags.push(`sub≤${schema.limits.maxSubject}`);
  if (f.templateId) tags.push('template');
  return tags;
}
