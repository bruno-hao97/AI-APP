const { postForm, postJson } = require('./http');
const { DEFAULT_DOMAIN, DEFAULT_PROJECT_ID } = require('./config');
const {
  fetchModels,
  findModelBySlug,
  invalidateModelsCache,
  buildPayloadForModel,
} = require('./models');
const { pollMediaForJobType } = require('./model-schema');
const { pollJobUntilDone } = require('./polling');

async function createJob({
  type,
  modelId,
  fields = {},
  domain = DEFAULT_DOMAIN,
  projectId = DEFAULT_PROJECT_ID,
  accessToken,
  asJson = false,
}) {
  const path = `/ai/jobs/${encodeURIComponent(type)}/${encodeURIComponent(modelId)}`;
  const body = {
    domain,
    project_id: projectId,
    ...fields,
  };

  if (asJson) {
    return postJson(path, body, { accessToken });
  }
  return postForm(path, body, { accessToken });
}

/**
 * Load model từ POST /ai/models, build payload đúng schema, tạo job.
 */
async function createJobFromModel({
  type,
  modelId,
  selections = {},
  domain = DEFAULT_DOMAIN,
  projectId = DEFAULT_PROJECT_ID,
  accessToken,
}) {
  const { models } = await fetchModels({ type, accessToken, domain });
  const model = findModelBySlug(models, modelId);
  if (!model) {
    invalidateModelsCache(type);
    throw new Error(`Model "${modelId}" không có trong /ai/models?type=${type}`);
  }

  const fields = buildPayloadForModel(model, type, selections, {
    domain,
    projectId,
  });

  const createResult = await createJob({
    type,
    modelId,
    fields,
    domain,
    projectId,
    accessToken,
  });

  return { createResult, model, fields };
}

function extractJobId(createResult) {
  const d = createResult.data || {};
  return (
    d.id_base ||
    d.job_id ||
    d.id ||
    createResult.envelope?.data?.id_base ||
    createResult.envelope?.data?.job_id
  );
}

async function createJobAndWait({
  type,
  modelId,
  selections = {},
  domain = DEFAULT_DOMAIN,
  projectId = DEFAULT_PROJECT_ID,
  accessToken,
  onProgress,
  signal,
}) {
  const { createResult, fields } = await createJobFromModel({
    type,
    modelId,
    selections,
    domain,
    projectId,
    accessToken,
  });

  const media = pollMediaForJobType(type);
  const jobId = extractJobId(createResult);

  if (!jobId) {
    const directUrl = createResult.data?.result_url;
    if (directUrl) {
      return {
        create: createResult,
        poll: null,
        jobId: null,
        resultUrl: directUrl,
        success: true,
        fields,
      };
    }
    throw new Error('Không nhận được id_base từ response tạo job');
  }

  if (!media) {
    return {
      create: createResult,
      poll: null,
      jobId,
      resultUrl: createResult.data?.result_url,
      success: Boolean(createResult.data?.result_url),
      fields,
    };
  }

  const pollResult = await pollJobUntilDone({
    jobId,
    media,
    type,
    domain,
    projectId,
    accessToken,
    onProgress,
    signal,
  });

  return {
    create: createResult,
    poll: pollResult,
    jobId,
    resultUrl: pollResult.resultUrl,
    success: pollResult.success,
    fields,
  };
}

/** @deprecated dùng createJobAndWait */
async function createVideoJobAndWait(opts) {
  return createJobAndWait({ type: 'video', ...opts, selections: { prompt: opts.prompt, ...opts.fields } });
}

async function checkHealth({ accessToken } = {}) {
  return require('./http').request('/health', {
    method: 'GET',
    accessToken,
    retries: 0,
  });
}

module.exports = {
  createJob,
  createJobFromModel,
  createJobAndWait,
  createVideoJobAndWait,
  extractJobId,
  checkHealth,
};
