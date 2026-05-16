/** localStorage — chỉ dùng demo / nội bộ (rủi ro XSS). */
const KEYS = {
  token: 'gommo_access_token',
  domain: 'gommo_domain',
  projectId: 'gommo_project_id',
};

const DEFAULTS = {
  domain: '79ai.net',
  projectId: 'default',
};

export function loadSettings() {
  return {
    accessToken: localStorage.getItem(KEYS.token) || '',
    domain: localStorage.getItem(KEYS.domain) || DEFAULTS.domain,
    projectId: localStorage.getItem(KEYS.projectId) || DEFAULTS.projectId,
  };
}

export function saveSettings({ accessToken, domain, projectId }) {
  if (accessToken != null) {
    if (accessToken) localStorage.setItem(KEYS.token, accessToken);
    else localStorage.removeItem(KEYS.token);
  }
  if (domain != null) localStorage.setItem(KEYS.domain, domain || DEFAULTS.domain);
  if (projectId != null) {
    localStorage.setItem(KEYS.projectId, projectId || DEFAULTS.projectId);
  }
}

export function hasToken() {
  return Boolean(loadSettings().accessToken?.trim());
}
