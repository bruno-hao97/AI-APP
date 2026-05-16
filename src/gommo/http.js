const { BASE_URL } = require('./config');
const { authHeaders } = require('./auth');

class GommoApiError extends Error {
  constructor(message, { status, body, envelope } = {}) {
    super(message);
    this.name = 'GommoApiError';
    this.status = status;
    this.body = body;
    this.envelope = envelope;
  }
}

async function parseBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _rawText: text };
  }
}

/**
 * @returns {Promise<{ envelope, data, raw, success, message }>}
 */
async function request(path, options = {}) {
  const {
    method = 'GET',
    accessToken,
    headers = {},
    body,
    query,
    retries = 2,
    retryDelayMs = 1000,
  } = options;

  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const reqHeaders = {
    ...authHeaders(accessToken),
    ...headers,
  };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        method,
        headers: reqHeaders,
        body,
        signal: options.signal,
      });

      const envelope = await parseBody(res);

      if (res.status === 429 && attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1) * 2);
        continue;
      }

      if (!res.ok) {
        const msg =
          envelope?.message ||
          envelope?._rawText ||
          `HTTP ${res.status} ${res.statusText}`;
        throw new GommoApiError(msg, {
          status: res.status,
          body: envelope,
          envelope,
        });
      }

      if (envelope && envelope.success === false) {
        throw new GommoApiError(envelope.message || 'API trả success=false', {
          status: res.status,
          body: envelope,
          envelope,
        });
      }

      const data = envelope?.data ?? envelope;
      return {
        envelope,
        data,
        raw: envelope?.raw,
        success: envelope?.success !== false,
        message: envelope?.message,
        runtime: envelope?.runtime,
      };
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof TypeError ||
        (err instanceof GommoApiError &&
          err.status >= 500 &&
          attempt < retries);
      if (!retryable || attempt >= retries) throw err;
      await sleep(retryDelayMs * (attempt + 1));
    }
  }
  throw lastErr;
}

function toFormUrlEncoded(fields) {
  const params = new URLSearchParams();
  Object.entries(flattenFields(fields)).forEach(([k, v]) => {
    if (v != null && v !== '') params.append(k, String(v));
  });
  return params;
}

/** Hỗ trợ images[0][url], multi_prompt[0][prompt], … */
function flattenFields(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Buffer)
    ) {
      Object.assign(out, flattenFields(value, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          Object.assign(out, flattenFields(item, `${fullKey}[${i}]`));
        } else if (item != null && item !== '') {
          out[`${fullKey}[${i}]`] = item;
        }
      });
    } else if (value != null && value !== '') {
      out[fullKey] = value;
    }
  }
  return out;
}

async function postForm(path, fields, options = {}) {
  const body = toFormUrlEncoded(fields).toString();
  return request(path, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options.headers,
    },
    body,
  });
}

async function postJson(path, payload, options = {}) {
  return request(path, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(payload),
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  GommoApiError,
  request,
  postForm,
  postJson,
  toFormUrlEncoded,
  flattenFields,
};
