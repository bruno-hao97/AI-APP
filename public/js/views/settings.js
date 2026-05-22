import { loadSettings, saveSettings, hasToken } from '../settings-store.js';
import { navigate } from '../router.js';

export function renderSettings({ main }) {
  const s = loadSettings();

  main.innerHTML = `
    <div class="view-settings">
      <header class="page-header">
        <div>
          <p class="page-kicker">Hệ thống</p>
          <h1 class="page-title font-display">Cài đặt tài khoản</h1>
          <p class="page-lead">Kết nối token Gommo — chìa khoá để gọi API tạo nội dung.</p>
        </div>
      </header>

      <section class="panel settings-panel">
        <form id="settings-form">
          <label class="field-block">
            <span class="field-label">Mã token <em>*</em></span>
            <span class="field-help">Dán nguyên chuỗi token từ 79AI. Không chia sẻ công khai.</span>
            <input type="password" id="token" autocomplete="off" placeholder="gommo_…" value="${escapeAttr(s.accessToken)}" />
          </label>

          <details class="advanced">
            <summary>Thiết lập nâng cao</summary>
            <label class="field-block">
              <span class="field-label">Tên miền website</span>
              <input type="text" id="domain" value="${escapeAttr(s.domain)}" readonly />
            </label>
            <label class="field-block">
              <span class="field-label">Mã dự án</span>
              <input type="text" id="projectId" value="${escapeAttr(s.projectId)}" />
            </label>
          </details>

          <div class="actions-row">
            <button type="submit" class="primary">Lưu &amp; sử dụng</button>
            <button type="button" id="clear" class="secondary">Xóa token</button>
            <button type="button" id="backDash" class="secondary">← Về dashboard</button>
          </div>
        </form>
        <p id="status" class="notice" hidden></p>
      </section>
    </div>
  `;

  const statusEl = main.querySelector('#status');

  main.querySelector('#settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings({
      accessToken: main.querySelector('#token').value.trim(),
      domain: main.querySelector('#domain').value.trim() || '79ai.net',
      projectId: main.querySelector('#projectId').value.trim() || 'default',
    });
    statusEl.hidden = false;
    statusEl.className = 'notice';
    statusEl.innerHTML = '<strong>Đã lưu!</strong> Quay lại dashboard hoặc chọn công cụ để tạo.';
    document.dispatchEvent(new CustomEvent('settings:saved'));
    refreshSidebarStatus();
  });

  main.querySelector('#clear').addEventListener('click', () => {
    main.querySelector('#token').value = '';
    saveSettings({ accessToken: '' });
    statusEl.hidden = false;
    statusEl.className = 'notice warn';
    statusEl.textContent = 'Đã xóa mã token.';
  });

  main.querySelector('#backDash').addEventListener('click', () => navigate('/'));
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function refreshSidebarStatus() {
  const el = document.getElementById('headerStatus') || document.getElementById('sidebarStatus');
  if (!el) return;
  const ok = hasToken();
  el.className = `header-status ${ok ? 'ok' : 'warn'}`;
  el.textContent = ok ? 'API kết nối' : 'Chưa có token';
}
