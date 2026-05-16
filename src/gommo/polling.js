const { postForm, request } = require('./http');
const { DEFAULT_DOMAIN, DEFAULT_PROJECT_ID, POLL_MEDIA } = require('./config');

const SUCCESS_STATUSES = new Set([
  'SUCCESS',
  'SUCCEEDED',
  'DONE',
  'COMPLETED',
]);

const RUNNING_STATUSES = new Set([
  'PROCESSING',
  'PENDING',
  'QUEUED',
  'ACTIVE',
]);

const FAILED_STATUSES = new Set([
  'FAILED',
  'ERROR',
  'CANCELLED',
  'REJECTED',
]);

function normalizeStatus(status) {
  if (status == null || status === '') return '';
  return String(status).toUpperCase().trim();
}

function isValidResultUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

/**
 * Phân loại trạng thái poll gateway (lớp A).
 * @returns {'success'|'running'|'failed'|'unknown'}
 */
function classifyGatewayStatus(status, resultUrl) {
  const s = normalizeStatus(status);

  if (isValidResultUrl(resultUrl) && !RUNNING_STATUSES.has(s)) {
    return 'success';
  }
  if (SUCCESS_STATUSES.has(s)) return 'success';
  if (RUNNING_STATUSES.has(s)) return 'running';
  if (FAILED_STATUSES.has(s)) return 'failed';
  if (isValidResultUrl(resultUrl)) return 'success';
  return 'unknown';
}

function extractPollPayload(envelopeResult) {
  const { data, raw } = envelopeResult;
  const inner = data || {};
  const status =
    inner.status ||
    raw?.imageInfo?.status ||
    raw?.videoInfo?.status ||
    '';
  const resultUrl =
    inner.result_url ||
    raw?.imageInfo?.result_url ||
    raw?.videoInfo?.result_url ||
    raw?.videoInfo?.url ||
    null;
  const idBase =
    inner.id_base ||
    inner.job_id ||
    data?.id_base ||
    data?.job_id;

  return { status, resultUrl, idBase, data: inner, raw };
}

/**
 * Poll một lần: POST /ai/jobs/{id}?media=...
 */
async function pollJobOnce({
  jobId,
  media = 'video',
  domain = DEFAULT_DOMAIN,
  projectId = DEFAULT_PROJECT_ID,
  accessToken,
}) {
  const fields = {
    domain,
    ...(media === 'music' && projectId ? { project_id: projectId } : {}),
  };

  const path = `/ai/jobs/${encodeURIComponent(jobId)}?media=${encodeURIComponent(media)}`;

  try {
    return await postForm(path, fields, { accessToken });
  } catch {
    return await request(path, {
      method: 'GET',
      accessToken,
      query: { media, domain, ...(fields.project_id ? { project_id: fields.project_id } : {}) },
    });
  }
}

/**
 * Poll đến khi success / failed / timeout.
 */
async function pollJobUntilDone({
  jobId,
  media,
  type,
  domain = DEFAULT_DOMAIN,
  projectId = DEFAULT_PROJECT_ID,
  accessToken,
  intervalMs = 3500,
  maxAttempts = 80,
  onProgress,
  signal,
}) {
  const pollMedia = media || POLL_MEDIA[type] || 'video';
  let lastSnapshot = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Poll đã bị hủy');
    }

    const result = await pollJobOnce({
      jobId,
      media: pollMedia,
      domain,
      projectId,
      accessToken,
    });

    const snapshot = extractPollPayload(result);
    lastSnapshot = { ...snapshot, attempt, envelope: result.envelope };
    const phase = classifyGatewayStatus(snapshot.status, snapshot.resultUrl);

    if (onProgress) {
      onProgress({ phase, ...lastSnapshot });
    }

    if (phase === 'success') {
      return {
        done: true,
        success: true,
        resultUrl: snapshot.resultUrl,
        status: snapshot.status,
        data: snapshot.data,
        raw: snapshot.raw,
        attempts: attempt,
      };
    }

    if (phase === 'failed') {
      return {
        done: true,
        success: false,
        status: snapshot.status,
        data: snapshot.data,
        raw: snapshot.raw,
        attempts: attempt,
        error: `Job thất bại: ${snapshot.status || 'unknown'}`,
      };
    }

    await sleep(intervalMs);
  }

  return {
    done: false,
    success: false,
    timeout: true,
    error: `Hết thời gian poll sau ${maxAttempts} lần (~${Math.round((maxAttempts * 3500) / 60000)} phút)`,
    last: lastSnapshot,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  classifyGatewayStatus,
  extractPollPayload,
  pollJobOnce,
  pollJobUntilDone,
  SUCCESS_STATUSES,
  RUNNING_STATUSES,
  FAILED_STATUSES,
};
