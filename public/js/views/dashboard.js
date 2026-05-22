import { navigate } from '../router.js';
import { JOB_TYPES } from '../ui-labels.js';
import { HERO_CHIPS, SITE } from '../site-content.js';
import { hasToken } from '../settings-store.js';
import { countHistoryGrouped } from '../history-store.js';

export function renderDashboard({ main }) {
  const connected = hasToken();
  const hist = countHistoryGrouped();
  const totalHist = Object.values(hist).reduce((a, b) => a + b, 0);

  main.innerHTML = `
    <div class="view-dashboard landing">
      <section class="landing-hero">
        <span class="landing-badge">AI Content Operating System</span>

        <h1 class="landing-title font-display">
          <span>Tạo.</span>
          <span>Tự động.</span>
          <span>Mở rộng.</span>
        </h1>

        <p class="landing-lead">
          ${SITE.tagline} — một hệ điều phối nội dung AI cho video, hình ảnh, giọng nói, nhạc và avatar.
          Kết nối ${SITE.api} để triển khai pipeline sáng tạo end-to-end.
        </p>

        <div class="landing-agent-card">
          <div class="agent-card-head">
            <span class="agent-icon" aria-hidden="true">✦</span>
            <span class="agent-name font-display">Studio Agent</span>
            <span class="agent-status">
              <span class="status-dot${connected ? ' live' : ''}"></span>
              ${connected ? 'Đang hoạt động' : 'Chờ token API'}
            </span>
          </div>
          <div class="agent-card-body">
            <div class="agent-prompt-row">
              <input
                type="text"
                id="heroPrompt"
                placeholder="Mô tả ý tưởng của bạn… (vd: quảng cáo TikTok sản phẩm skincare, tone sang trọng)"
              />
              <button type="button" class="agent-prompt-btn" id="heroDraft">
                Định nội dung <span aria-hidden="true">→</span>
              </button>
            </div>
            <div class="landing-chips">
              ${HERO_CHIPS.map((c) => `<button type="button" class="landing-chip" data-chip="${c}">${c}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="landing-cta-row">
          <button type="button" class="landing-cta-primary" id="heroStart">
            Bắt đầu <span aria-hidden="true">→</span>
          </button>
          <button type="button" class="landing-cta-secondary" id="heroFeatures">
            <span class="play-icon" aria-hidden="true">▶</span> Xem tính năng
          </button>
        </div>
      </section>

      <section class="landing-section">
        <div class="landing-section-head">
          <p class="section-eyebrow">CÔNG CỤ</p>
          <h2 class="font-display section-title">Bắt đầu nhanh</h2>
        </div>
        <div class="landing-tools-scroll">
          ${JOB_TYPES.map(
            (t) => `
            <button type="button" class="landing-tool-card" data-type="${t.value}">
              <span class="landing-tool-icon">${t.icon}</span>
              <strong class="font-display">${t.label}</strong>
              <span>${t.desc}</span>
            </button>`
          ).join('')}
        </div>
      </section>

      <section class="landing-section landing-links-section">
        <div class="landing-links-grid">
          <a href="#/models" class="landing-link-card">
            <strong class="font-display">Danh sách Model</strong>
            <span>Video · Ảnh · TTS · Nhạc · Avatar</span>
          </a>
          <a href="#/docs" class="landing-link-card">
            <strong class="font-display">Tài liệu</strong>
            <span>Hướng dẫn từng tính năng</span>
          </a>
          <a href="#/history" class="landing-link-card">
            <strong class="font-display">Lịch sử</strong>
            <span>${totalHist} kết quả đã lưu</span>
          </a>
          <a href="#/support" class="landing-link-card">
            <strong class="font-display">Hỗ trợ</strong>
            <span>FAQ &amp; liên hệ</span>
          </a>
        </div>
      </section>

      <footer class="site-footer">
        <div class="site-footer-brand">
          <span class="site-logo-mark sm" aria-hidden="true"></span>
          <span class="font-display">AI STUDIO</span>
        </div>
        <nav class="site-footer-nav" aria-label="Footer">
          <a href="#/features">Tính năng</a>
          <a href="#/models">Models</a>
          <a href="#/docs">Docs</a>
          <a href="#/support">Support</a>
          <a href="#/privacy">Privacy</a>
        </nav>
        <p class="site-footer-copy">© ${new Date().getFullYear()} AI Studio · Powered by Gommo API</p>
      </footer>

      ${
        !connected
          ? `
      <div class="landing-token-hint">
        <p>Chưa kết nối API — <button type="button" class="inline-link-btn" id="dashGoSettings">dán token Gommo</button> để tải model và tạo nội dung.</p>
      </div>`
          : ''
      }
    </div>
  `;

  const heroPrompt = main.querySelector('#heroPrompt');

  function goCreate() {
    const p = heroPrompt?.value.trim();
    if (p) sessionStorage.setItem('hero_prompt', p);
    navigate('/create/image');
  }

  main.querySelector('#heroStart')?.addEventListener('click', goCreate);
  main.querySelector('#heroDraft')?.addEventListener('click', goCreate);
  main.querySelector('#heroFeatures')?.addEventListener('click', () => navigate('/features'));

  main.querySelectorAll('.landing-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (heroPrompt) heroPrompt.value = chip.dataset.chip;
    });
  });

  main.querySelectorAll('[data-type]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(`/create/${btn.dataset.type}`));
  });

  main.querySelector('#dashGoSettings')?.addEventListener('click', () => navigate('/settings'));

  main.querySelectorAll('.landing-link-card, .site-footer-nav a').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(a.getAttribute('href').slice(1));
    });
  });
}
