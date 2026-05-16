/** Browser ES module — logic đồng bộ với src/gommo/model-schema.js */

export const POLL_MEDIA = {
  image: 'image',
  video: 'video',
  tts: null,
  music: 'music',
  'avatar-lipsync': 'video',
};

export function parseModelsList(envelopeOrData) {
  if (Array.isArray(envelopeOrData)) return envelopeOrData;
  const root = envelopeOrData?.envelope ?? envelopeOrData;
  const d = root?.data ?? root;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.models)) return d.models;
  if (Array.isArray(d?.items)) return d.items;
  return [];
}

export function modelSlug(model) {
  return model?.model || model?.slug || model?.model_id || model?.id || '';
}

export function isModelAvailable(model) {
  const s = String(model?.status || 'ON').toUpperCase();
  return s === 'ON' || s === 'ACTIVE';
}

export function normalizeOptions(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.map((item) => {
    if (typeof item === 'string') return { value: item, label: item };
    const value = item.type ?? item.value ?? item.name;
    return {
      value: String(value),
      label: item.name ? String(item.name) : String(value),
      description: item.description,
      price: item.price,
      group: item.group,
    };
  });
}

export function getModesList(model) {
  if (Array.isArray(model.modes) && model.modes.length) {
    return normalizeOptions(model.modes);
  }
  if (Array.isArray(model.mode) && model.mode.length) {
    return normalizeOptions(model.mode);
  }
  return [];
}

function getReferenceLimit(model) {
  const c = model.configs || {};
  return (
    c.reference?.limits?.image ??
    c.templates?.override?.reference?.limits?.image ??
    (model.withReference ? 3 : 0)
  );
}

export function analyzeModel(model, jobType) {
  const ratios = normalizeOptions(model.ratios);
  const modes = getModesList(model);
  const resolutions = normalizeOptions(model.resolutions);
  const durations = normalizeOptions(model.durations || model.duration);
  const refLimit = getReferenceLimit(model);
  const maxSubject = Number(model.maxSubject) || 0;

  return {
    slug: modelSlug(model),
    name: model.name,
    status: model.status,
    statusMessage: model.status_message,
    available: isModelAvailable(model),
    description: model.description,
    basePrice: model.price,
    jobType,
    notices: model.notices,
    configs: model.configs || {},
    flags: {
      withSubject: Boolean(model.withSubject),
      startImage: Boolean(model.startImage),
      startImageAndEnd: Boolean(model.startImageAndEnd),
      withReference: Boolean(model.withReference) || refLimit > 0,
    },
    fields: {
      prompt: !['tts'].includes(jobType),
      text: jobType === 'tts',
      musicName: jobType === 'music',
      ratio: ratios.length > 0,
      mode: modes.length > 0,
      resolution: resolutions.length > 0,
      duration: durations.length > 0,
      templateId: Boolean(model.configs?.templates?.enabled),
      subjects: model.withSubject && maxSubject > 0,
      references: refLimit > 0 || model.withReference,
      startFrame: model.startImage,
      endFrame: model.startImageAndEnd,
    },
    limits: { maxSubject, maxReference: refLimit },
    options: { ratios, modes, resolutions, durations },
    prices: model.prices || [],
  };
}

export function buildJobPayload(model, jobType, selections, { domain, projectId } = {}) {
  const schema = analyzeModel(model, jobType);
  const payload = {
    domain: domain || '79ai.net',
    project_id: projectId || 'default',
  };

  if (!schema.available) {
    throw new Error(schema.statusMessage || `Model không khả dụng (${schema.status})`);
  }

  if (schema.fields.prompt && selections.prompt) payload.prompt = selections.prompt;
  if (schema.fields.text && selections.text) payload.text = selections.text;
  if (jobType === 'music') {
    if (selections.name) payload.name = selections.name;
    if (selections.prompt) payload.prompt = selections.prompt;
    if (selections.gender != null) payload.gender = selections.gender;
  }

  if (selections.ratio) payload.ratio = selections.ratio;
  if (selections.mode) payload.mode = selections.mode;
  if (selections.resolution) payload.resolution = selections.resolution;
  if (selections.duration) payload.duration = selections.duration;
  if (selections.template_id) payload.template_id = selections.template_id;

  const images = (selections.images || []).filter(Boolean);
  if (schema.fields.startFrame && images[0]) {
    payload.images = [{ url: images[0] }];
    if (schema.fields.endFrame && images[1]) payload.images.push({ url: images[1] });
  }

  const refs = (selections.references || []).filter(Boolean);
  if (schema.fields.references && refs.length) {
    payload.references = refs.map((url) => ({ url }));
  }

  const subjects = (selections.subjects || []).filter(Boolean);
  if (schema.fields.subjects && subjects.length) {
    payload.subjects = subjects.map((url) => ({ url }));
  }

  Object.assign(payload, selections.extra || {});
  return { payload, schema };
}

export function pollMediaForJobType(jobType) {
  return POLL_MEDIA[jobType] ?? 'video';
}

export function defaultSelections(schema) {
  const pick = (opts) => (opts.length ? opts[0].value : undefined);
  return {
    ratio: pick(schema.options.ratios),
    mode: pick(schema.options.modes),
    resolution: pick(schema.options.resolutions),
    duration: pick(schema.options.durations),
  };
}

export function lookupPrice(prices, mode, resolution) {
  if (!prices?.length) return null;
  const row = prices.find(
    (p) => (!mode || p.mode === mode) && (!resolution || p.resolution === resolution)
  );
  return row?.price ?? null;
}
