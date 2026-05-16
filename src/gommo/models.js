const { postForm, request } = require('./http');
const { DEFAULT_DOMAIN } = require('./config');
const {
  parseModelsList,
  modelSlug,
  analyzeModel,
  buildJobPayload,
  defaultSelections,
} = require('./model-schema');

const cache = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function cacheKey(type, domain, accessToken) {
  return `${type}:${domain}:${accessToken ? '1' : '0'}`;
}

/**
 * POST /ai/models (ưu tiên) — response: { data: GommoModel[] }
 * @returns {Promise<{ models: object[], envelope: object, runtime?: number }>}
 */
async function fetchModels({
  type,
  accessToken,
  domain = DEFAULT_DOMAIN,
  useCache = true,
  ttlMs = DEFAULT_TTL_MS,
}) {
  const key = cacheKey(type, domain, accessToken);
  if (useCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.result;
  }

  const query = `type=${encodeURIComponent(type)}&domain=${encodeURIComponent(domain)}`;
  let envelope;

  try {
    const result = await postForm(
      `/ai/models?${query}`,
      { type, domain },
      { accessToken }
    );
    envelope = result.envelope;
  } catch {
    try {
      const result = await postForm('/ai/models', { type, domain }, { accessToken });
      envelope = result.envelope;
    } catch {
      const result = await request(`/ai/models?${query}`, {
        method: 'GET',
        accessToken,
      });
      envelope = result.envelope;
    }
  }

  const models = parseModelsList(envelope);
  const out = {
    models,
    envelope,
    runtime: envelope?.runtime,
  };

  if (useCache) {
    cache.set(key, { result: out, at: Date.now() });
  }

  return out;
}

/** @returns {Promise<object[]>} */
async function fetchModelsList(opts) {
  const { models } = await fetchModels(opts);
  return models;
}

function invalidateModelsCache(type) {
  if (type) {
    for (const k of cache.keys()) {
      if (k.startsWith(`${type}:`)) cache.delete(k);
    }
  } else {
    cache.clear();
  }
}

function findModelBySlug(models, modelId) {
  const id = String(modelId).trim();
  return models.find((m) => modelSlug(m) === id);
}

function getModelSchema(model, jobType) {
  return analyzeModel(model, jobType);
}

function buildPayloadForModel(model, jobType, selections, ctx) {
  return buildJobPayload(model, jobType, selections, ctx);
}

module.exports = {
  fetchModels,
  fetchModelsList,
  invalidateModelsCache,
  findModelBySlug,
  getModelSchema,
  buildPayloadForModel,
  modelSlug,
  defaultSelections,
  parseModelsList,
};
