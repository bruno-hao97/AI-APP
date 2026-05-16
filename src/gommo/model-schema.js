/**
 * @typedef {{ name?: string, type: string, description?: string, price?: number, group?: string }} GommoOption
 * @typedef {{ mode?: string, resolution?: string, price: number }} GommoPriceRow
 *
 * @typedef {Object} GommoModel
 * @property {string} model
 * @property {string} [slug]
 * @property {string} name
 * @property {string} [status] ON | maintenance | ...
 * @property {string} [status_message]
 * @property {number} [price]
 * @property {string} [description]
 * @property {boolean} [withSubject]
 * @property {boolean} [withFace]
 * @property {boolean} [withSence]
 * @property {boolean} [withStyle]
 * @property {boolean} [withText]
 * @property {boolean} [startImage]
 * @property {boolean} [startImageAndEnd]
 * @property {boolean} [withReference]
 * @property {boolean} [withMotion]
 * @property {boolean} [withMultiShots]
 * @property {boolean} [withEdit]
 * @property {boolean} [extendVideo]
 * @property {number} [maxSubject]
 * @property {GommoOption[]} [ratios]
 * @property {GommoOption[]} [modes]
 * @property {GommoOption[]} [mode]
 * @property {GommoOption[]} [resolutions]
 * @property {GommoOption[]} [durations]
 * @property {GommoPriceRow[]} [prices]
 * @property {object} [configs]
 * @property {object} [notices]
 */

const JOB_TYPES = ['image', 'video', 'tts', 'music', 'avatar-lipsync'];

const POLL_MEDIA = {
  image: 'image',
  video: 'video',
  tts: null,
  music: 'music',
  'avatar-lipsync': 'video',
};

/** Parse envelope POST /ai/models — `data` là mảng model */
function parseModelsList(envelopeOrData) {
  if (Array.isArray(envelopeOrData)) return envelopeOrData;
  const root = envelopeOrData?.envelope ?? envelopeOrData;
  const d = root?.data ?? root;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.models)) return d.models;
  if (Array.isArray(d?.items)) return d.items;
  return [];
}

function modelSlug(model) {
  return model?.model || model?.slug || model?.model_id || model?.id || '';
}

function isModelAvailable(model) {
  const s = String(model?.status || 'ON').toUpperCase();
  return s === 'ON' || s === 'ACTIVE';
}

/** Chuẩn hoá ratios | modes | resolutions → { value, label, meta } */
function normalizeOptions(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.map((item) => {
    if (typeof item === 'string') {
      return { value: item, label: item };
    }
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

/** API dùng `modes` hoặc `mode` (upscale model) */
function getModesList(model) {
  if (Array.isArray(model.modes) && model.modes.length) {
    return normalizeOptions(model.modes);
  }
  if (Array.isArray(model.mode) && model.mode.length) {
    return normalizeOptions(model.mode);
  }
  return [];
}

function getDurationsList(model) {
  return normalizeOptions(model.durations || model.duration);
}

function getReferenceLimit(model) {
  const c = model.configs || {};
  return (
    c.reference?.limits?.image ??
    c.templates?.override?.reference?.limits?.image ??
    (model.withReference ? 3 : 0)
  );
}

function inferImageCase(model) {
  if (model.withMotion) return 'V5';
  if (model.withEdit) return 'V6';
  if (model.extendVideo) return 'V7';
  if (model.withMultiShots) return 'V8';
  if (model.configs?.reference?.allowedTypes || model.configs?.templates) return 'V9';
  if (model.startImageAndEnd) return 'C';
  if (model.startImage) return 'B';
  if (model.withReference) return 'D';
  if (model.withSubject && (model.maxSubject || 0) > 0) return 'E';
  if (model.configs?.templates?.enabled) return 'F';
  return 'A';
}

function inferVideoCase(model) {
  if (model.withMotion) return 'V5';
  if (model.withEdit) return 'V6';
  if (model.extendVideo) return 'V7';
  if (model.withMultiShots) return 'V8';
  if (model.configs?.reference) return 'V9';
  if (model.startImageAndEnd) return 'V3';
  if (model.startImage) return 'V2';
  if (model.withReference) return 'V4';
  if (model.withSubject && (model.maxSubject || 0) > 0) return 'V4';
  return 'V1';
}

/**
 * Schema UI + ràng buộc payload theo model & job type
 * @param {GommoModel} model
 * @param {string} jobType
 */
function analyzeModel(model, jobType) {
  const ratios = normalizeOptions(model.ratios);
  const modes = getModesList(model);
  const resolutions = normalizeOptions(model.resolutions);
  const durations = getDurationsList(model);
  const refLimit = getReferenceLimit(model);
  const maxSubject = Number(model.maxSubject) || 0;

  const imageCase = jobType === 'image' ? inferImageCase(model) : null;
  const videoCase = jobType === 'video' || jobType === 'avatar-lipsync' ? inferVideoCase(model) : null;

  const needsPrompt = !['tts'].includes(jobType);
  const needsText = jobType === 'tts';

  return {
    slug: modelSlug(model),
    name: model.name,
    status: model.status,
    statusMessage: model.status_message,
    available: isModelAvailable(model),
    server: model.server,
    description: model.description,
    basePrice: model.price,
    jobType,
    imageCase,
    videoCase,
    notices: model.notices,
    configs: model.configs || {},
    flags: {
      withSubject: Boolean(model.withSubject),
      withFace: Boolean(model.withFace),
      withSence: Boolean(model.withSence),
      withStyle: Boolean(model.withStyle),
      withText: Boolean(model.withText),
      startImage: Boolean(model.startImage),
      startImageAndEnd: Boolean(model.startImageAndEnd),
      withReference: Boolean(model.withReference) || refLimit > 0,
      withMotion: Boolean(model.withMotion),
      withMultiShots: Boolean(model.withMultiShots),
      withEdit: Boolean(model.withEdit),
      extendVideo: Boolean(model.extendVideo),
    },
    fields: {
      prompt: needsPrompt && jobType !== 'music',
      text: needsText,
      musicName: jobType === 'music',
      musicGender: jobType === 'music',
      ratio: ratios.length > 0,
      mode: modes.length > 0,
      resolution: resolutions.length > 0,
      duration: durations.length > 0 || jobType === 'video',
      templateId: Boolean(model.configs?.templates?.enabled),
      subjects: model.withSubject && maxSubject > 0,
      references: refLimit > 0 || model.withReference,
      startFrame: model.startImage,
      endFrame: model.startImageAndEnd,
      voiceId: jobType === 'tts',
    },
    limits: {
      maxSubject,
      maxReference: refLimit,
      maxStartImages: model.startImageAndEnd ? 2 : model.startImage ? 1 : 0,
    },
    options: { ratios, modes, resolutions, durations },
    prices: Array.isArray(model.prices) ? model.prices : [],
  };
}

function lookupPrice(prices, mode, resolution) {
  if (!prices?.length) return null;
  const row = prices.find(
    (p) =>
      (!mode || p.mode === mode) &&
      (!resolution || p.resolution === resolution)
  );
  return row?.price ?? null;
}

/**
 * Build body job từ model schema + lựa chọn user (value = `type` trong API)
 * @param {object} selections
 */
function buildJobPayload(model, jobType, selections, { domain, projectId } = {}) {
  const schema = analyzeModel(model, jobType);
  const payload = {
    domain: domain || '79ai.net',
    project_id: projectId || 'default',
  };

  if (!schema.available) {
    throw new Error(
      schema.statusMessage || `Model "${schema.name}" không khả dụng (${schema.status})`
    );
  }

  if (schema.fields.prompt && selections.prompt) {
    payload.prompt = selections.prompt;
  }

  if (schema.fields.text && selections.text) {
    payload.text = selections.text;
  }

  if (jobType === 'music') {
    if (selections.name) payload.name = selections.name;
    if (selections.prompt) payload.prompt = selections.prompt;
    if (selections.gender != null) payload.gender = selections.gender;
    if (selections.styles) payload.styles = selections.styles;
  }

  if (selections.ratio) payload.ratio = selections.ratio;
  if (selections.mode) payload.mode = selections.mode;
  if (selections.resolution) payload.resolution = selections.resolution;
  if (selections.duration) payload.duration = selections.duration;
  if (selections.template_id) payload.template_id = selections.template_id;

  if (selections.voice_id) payload.voice_id = selections.voice_id;

  const images = (selections.images || []).filter(Boolean);
  if (schema.fields.startFrame && images[0]) {
    payload.images = [{ url: images[0] }];
    if (schema.fields.endFrame && images[1]) {
      payload.images.push({ url: images[1] });
    }
  }

  const refs = (selections.references || []).filter(Boolean);
  if (schema.fields.references && refs.length) {
    payload.references = refs.map((url) => ({ url }));
  }

  const subjects = (selections.subjects || []).filter(Boolean);
  if (schema.fields.subjects && subjects.length) {
    payload.subjects = subjects.map((url) => ({ url }));
  }

  if (selections.multi_shots) {
    payload.multi_shots = true;
    if (selections.multi_shot_mode) payload.multi_shot_mode = selections.multi_shot_mode;
    if (selections.multi_prompt) payload.multi_prompt = selections.multi_prompt;
  }

  Object.assign(payload, selections.extra || {});

  validatePayload(schema, payload, selections);
  return payload;
}

function validatePayload(schema, payload, selections) {
  if (schema.fields.prompt && !payload.prompt && schema.jobType !== 'music') {
    throw new Error('Thiếu prompt (bắt buộc cho model này)');
  }
  if (schema.fields.text && !payload.text) {
    throw new Error('Thiếu text (TTS)');
  }
  if (schema.fields.ratio && schema.options.ratios.length && !payload.ratio) {
    throw new Error('Chọn ratio (giá trị type từ /ai/models)');
  }
  if (schema.fields.mode && schema.options.modes.length && !payload.mode) {
    throw new Error('Chọn mode (giá trị type từ /ai/models)');
  }
  if (
    schema.fields.resolution &&
    schema.options.resolutions.length &&
    !payload.resolution
  ) {
    throw new Error('Chọn resolution (giá trị type từ /ai/models)');
  }
  if (schema.fields.startFrame && !(selections.images || [])[0]) {
    throw new Error('Model yêu cầu ảnh first frame (images[0][url])');
  }
  if (schema.fields.endFrame && !(selections.images || [])[1]) {
    throw new Error('Model yêu cầu ảnh end frame (images[1][url])');
  }
  if (schema.fields.references && schema.limits.maxReference > 0) {
    const n = (selections.references || []).filter(Boolean).length;
    if (n === 0 && schema.flags.withReference) {
      throw new Error('Model yêu cầu ít nhất một ảnh tham chiếu');
    }
  }
}

function pollMediaForJobType(jobType) {
  return POLL_MEDIA[jobType] ?? 'video';
}

function defaultSelections(schema) {
  const pick = (opts) => (opts.length ? opts[0].value : undefined);
  return {
    ratio: pick(schema.options.ratios),
    mode: pick(schema.options.modes),
    resolution: pick(schema.options.resolutions),
    duration: pick(schema.options.durations),
  };
}

module.exports = {
  JOB_TYPES,
  POLL_MEDIA,
  parseModelsList,
  modelSlug,
  isModelAvailable,
  normalizeOptions,
  getModesList,
  analyzeModel,
  buildJobPayload,
  lookupPrice,
  pollMediaForJobType,
  defaultSelections,
  inferImageCase,
  inferVideoCase,
};
