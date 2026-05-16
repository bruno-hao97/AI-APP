const BASE_URL = 'https://v2.api.gommo.net';

const SUCCESS = new Set(['SUCCESS', 'SUCCEEDED', 'DONE', 'COMPLETED']);
const RUNNING = new Set(['PROCESSING', 'PENDING', 'QUEUED', 'ACTIVE']);
const FAILED = new Set(['FAILED', 'ERROR', 'CANCELLED', 'REJECTED']);

export class GommoClient {
  constructor({ accessToken, domain = '79ai.net', projectId = 'default' } = {}) {
    this.accessToken = accessToken;
    this.domain = domain;
    this.projectId = projectId;
  }

  headers(extra = {}) {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      ...extra,
    };
  }

  async parse(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { _rawText: text };
    }
  }

  async request(path, { method = 'GET', body, headers } = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: this.headers(headers),
      body,
    });
    const envelope = await this.parse(res);
    if (!res.ok || envelope.success === false) {
      const err = new Error(envelope.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.envelope = envelope;
      throw err;
    }
    return envelope;
  }

  flatten(obj, prefix = '') {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      const k = prefix ? `${prefix}[${key}]` : key;
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(out, this.flatten(value, k));
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (item != null && typeof item === 'object') {
            Object.assign(out, this.flatten(item, `${k}[${i}]`));
          } else if (item != null) out[`${k}[${i}]`] = item;
        });
      } else if (value != null && value !== '') {
        out[k] = value;
      }
    }
    return out;
  }

  toForm(fields) {
    const p = new URLSearchParams();
    Object.entries(this.flatten(fields)).forEach(([k, v]) => p.append(k, String(v)));
    return p.toString();
  }

  async postForm(path, fields) {
    return this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: this.toForm(fields),
    });
  }

  /** POST /ai/models — response { data: Model[] } */
  async fetchModels(type) {
    const q = `type=${encodeURIComponent(type)}&domain=${encodeURIComponent(this.domain)}`;
    try {
      return await this.postForm(`/ai/models?${q}`, {
        type,
        domain: this.domain,
      });
    } catch {
      return await this.request(`/ai/models?${q}`);
    }
  }

  listModels(envelope) {
    const d = envelope?.data ?? envelope;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.models)) return d.models;
    return [];
  }

  async createJob(type, modelId, fields) {
    return this.postForm(`/ai/jobs/${type}/${modelId}`, {
      domain: this.domain,
      project_id: this.projectId,
      ...fields,
    });
  }

  async pollOnce(jobId, media) {
    return this.postForm(`/ai/jobs/${encodeURIComponent(jobId)}?media=${media}`, {
      domain: this.domain,
      ...(media === 'music' ? { project_id: this.projectId } : {}),
    });
  }

  classify(status, resultUrl) {
    const s = String(status || '').toUpperCase();
    if (resultUrl && /^https?:\/\//i.test(resultUrl) && !RUNNING.has(s)) return 'success';
    if (SUCCESS.has(s)) return 'success';
    if (RUNNING.has(s)) return 'running';
    if (FAILED.has(s)) return 'failed';
    if (resultUrl && /^https?:\/\//i.test(resultUrl)) return 'success';
    return 'unknown';
  }

  extract(envelope) {
    const data = envelope.data || {};
    const raw = envelope.raw || {};
    return {
      status: data.status || raw.imageInfo?.status || raw.videoInfo?.status || '',
      resultUrl:
        data.result_url ||
        raw.imageInfo?.result_url ||
        raw.videoInfo?.result_url ||
        raw.videoInfo?.url ||
        null,
      idBase: data.id_base || data.job_id,
    };
  }

  async pollUntilDone(jobId, media, { intervalMs = 3500, maxAttempts = 80, onProgress } = {}) {
    for (let i = 1; i <= maxAttempts; i++) {
      const envelope = await this.pollOnce(jobId, media);
      const snap = this.extract(envelope);
      const phase = this.classify(snap.status, snap.resultUrl);
      onProgress?.({ attempt: i, phase, ...snap, envelope });
      if (phase === 'success') return { success: true, ...snap };
      if (phase === 'failed') {
        return { success: false, error: snap.status, ...snap };
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return { success: false, timeout: true };
  }
}
