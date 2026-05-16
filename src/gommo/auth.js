/**
 * Xây header/query/body auth — không log token.
 */
function resolveToken(explicit) {
  const t = explicit || process.env.GOMMO_ACCESS_TOKEN;
  if (!t || !String(t).trim()) {
    throw new Error(
      'Thiếu access token. Đặt GOMMO_ACCESS_TOKEN hoặc truyền accessToken.'
    );
  }
  return String(t).trim();
}

function authHeaders(accessToken) {
  const token = resolveToken(accessToken);
  return {
    Authorization: `Bearer ${token}`,
  };
}

/** Gộp token vào body form (khi gateway yêu cầu) */
function withTokenForm(fields, accessToken) {
  const token = resolveToken(accessToken);
  return { ...fields, access_token: token };
}

module.exports = { resolveToken, authHeaders, withTokenForm };
