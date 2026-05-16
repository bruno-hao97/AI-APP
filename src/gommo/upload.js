const fs = require('fs');
const path = require('path');
const { BASE_URL, DEFAULT_DOMAIN, DEFAULT_PROJECT_ID } = require('./config');
const { authHeaders, resolveToken } = require('./auth');
const { GommoApiError } = require('./http');

async function parseUploadResponse(res) {
  const text = await res.text();
  let envelope = null;
  try {
    envelope = JSON.parse(text);
  } catch {
    envelope = { _rawText: text };
  }
  if (!res.ok) {
    throw new GommoApiError(envelope?.message || `Upload HTTP ${res.status}`, {
      status: res.status,
      body: envelope,
    });
  }
  const url =
    envelope?.data?.url ||
    envelope?.data?.result_url ||
    envelope?.url;
  return { url, envelope };
}

/**
 * POST /ai/upload/image — multipart field `file`
 */
async function uploadImage({
  filePath,
  domain = DEFAULT_DOMAIN,
  projectId = DEFAULT_PROJECT_ID,
  accessToken,
}) {
  const token = resolveToken(accessToken);
  const form = new FormData();
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  form.append('file', new Blob([buf]), name);
  form.append('domain', domain);
  form.append('project_id', projectId);

  const res = await fetch(`${BASE_URL}/ai/upload/image`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });
  return parseUploadResponse(res);
}

/**
 * POST /ai/upload/video — multipart field `video_file`
 */
async function uploadVideo({
  filePath,
  domain = DEFAULT_DOMAIN,
  projectId = DEFAULT_PROJECT_ID,
  accessToken,
}) {
  const token = resolveToken(accessToken);
  const form = new FormData();
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  form.append('video_file', new Blob([buf]), name);
  form.append('domain', domain);
  form.append('project_id', projectId);

  const res = await fetch(`${BASE_URL}/ai/upload/video`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });
  return parseUploadResponse(res);
}

module.exports = { uploadImage, uploadVideo };
