import { loadSettings, saveSettings, hasToken } from '../settings-store.js';
import { navigate } from '../router.js';
import { buildPageShell, bindPageShell, buildQuickNav, defaultPageActions } from '../page-shell.js';

export function renderSettings({ main }) {
  const s = loadSettings();

  const content = `
    <div class="page-body-inner">
      <div class="view-settings">
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
            </div>
          </form>
          <p id="status" class="notice" hidden></p>
        </section>
      </div>
    </div>`;

  main.innerHTML = buildPageShell({
    kicker: 'Hệ thống',
    title: 'Cài đặt API',
    lead: 'Kết nối token Gommo — chìa khoá để gọi API tạo nội dung.',
    backTo: '/',
    subBar: buildQuickNav('/settings'),
    actions: defaultPageActions({ showStudio: true }),
    content,
  });

  bindPageShell(main);

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
