import { initStudio } from '../playground.js';

export function renderStudio({ main, params }) {
  if (params.type) window.__studioStartType = params.type;
  main.innerHTML = getStudioHtml();
  initStudio({ remount: true });
}

function getStudioHtml() {
  return `
    <div class="view-studio" id="view-studio">
      <header class="page-header compact">
        <div>
          <p class="page-kicker">Studio</p>
          <h1 class="page-title font-display">Tạo nội dung AI</h1>
        </div>
      </header>

      <div id="bannerNoToken" class="banner warn token-panel" hidden>
        <div class="token-panel-head">
          <strong>Kết nối API Gommo</strong>
          <p class="token-panel-lead">Dán mã token từ 79AI. Mỗi link public cần nhập token một lần.</p>
        </div>
        <form id="tokenQuickForm" class="token-quick-form">
          <label class="field-block token-field">
            <span class="field-label">Mã token</span>
            <input type="password" id="tokenQuick" autocomplete="off" placeholder="Dán mã token…" />
          </label>
          <div class="token-actions">
            <button type="submit" class="primary">Lưu &amp; kết nối</button>
          </div>
        </form>
        <p id="tokenQuickStatus" class="field-help" hidden></p>
      </div>

      <div class="wizard">
        <ol class="steps" aria-label="Các bước">
          <li class="step-item active" data-step="1"><span>1</span> Loại</li>
          <li class="step-item" data-step="2"><span>2</span> Công cụ</li>
          <li class="step-item" data-step="3"><span>3</span> Mô tả</li>
          <li class="step-item" data-step="4"><span>4</span> Kết quả</li>
        </ol>

        <section class="panel step-panel" id="step1">
          <h2 class="panel-hero-title font-display">Chọn loại nội dung</h2>
          <p class="lead">Mỗi loại có danh sách model AI riêng từ Gommo.</p>
          <div id="typeCards" class="card-grid"></div>
        </section>

        <section class="panel step-panel" id="step2" hidden>
          <div class="panel-head">
            <div>
              <h2 class="font-display">Chọn công cụ AI</h2>
              <p class="lead" id="step2Subtitle">Đang tải…</p>
            </div>
            <button type="button" class="secondary" id="btnBack1">← Quay lại</button>
          </div>
          <div id="modelLoading" class="loading" hidden>Đang tải công cụ…</div>
          <div id="modelCards" class="card-grid model-grid"></div>
          <p id="modelEmpty" class="hint" hidden>Không có công cụ khả dụng.</p>
        </section>

        <section class="panel step-panel" id="step3" hidden>
          <div class="panel-head">
            <div>
              <h2 class="font-display" id="selectedModelTitle">Thiết lập</h2>
              <p class="lead" id="selectedModelHint"></p>
            </div>
            <button type="button" class="secondary" id="btnBack2">← Công cụ khác</button>
          </div>
          <div id="modelNotice" class="notice" hidden></div>
          <label id="promptWrap" class="field-block">
            <span class="field-label">Mô tả nội dung <em>*</em></span>
            <span class="field-help">Tiếng Việt hoặc Anh — càng chi tiết càng đúng ý.</span>
            <textarea id="prompt" rows="4" placeholder="Ví dụ: Cô gái trên bãi biển lúc hoàng hôn, camera chậm, điện ảnh"></textarea>
          </label>
          <label id="textWrap" class="field-block" hidden>
            <span class="field-label">Văn bản cần đọc <em>*</em></span>
            <textarea id="text" rows="4"></textarea>
          </label>
          <label id="musicNameWrap" class="field-block" hidden>
            <span class="field-label">Tên bài</span>
            <input type="text" id="musicName" placeholder="Nhạc nền vui tươi" />
          </label>
          <div id="dynamicFields" class="options-grid"></div>
          <div id="mediaUrls" class="media-section" hidden>
            <h3 class="subsection font-display">Ảnh đính kèm</h3>
            <p class="field-help">Dán link ảnh đã upload trên 79AI.</p>
            <div id="urlInputs"></div>
          </div>
          <p id="estPrice" class="price-box" hidden></p>
          <details class="advanced">
            <summary>Chi tiết kỹ thuật</summary>
            <pre id="modelDetail" class="log compact"></pre>
          </details>
          <button type="button" id="createJob" class="primary large">Chạy tạo ngay →</button>
        </section>

        <section class="panel step-panel" id="step4" hidden>
          <h2 class="font-display">Kết quả</h2>
          <div id="progressWrap" class="progress-wrap" hidden>
            <div class="progress-bar"><div id="progressBar" class="progress-bar-fill"></div></div>
            <p id="progress" class="progress-text">Đang gửi…</p>
          </div>
          <div id="result" class="result-box" hidden>
            <p class="result-success font-display">Hoàn tất — xem hoặc tải file</p>
            <div class="result-actions">
              <a id="resultLink" class="btn-download" href="#" target="_blank" rel="noopener">Mở tab mới</a>
              <button type="button" id="btnDownload" class="btn-download secondary-style">Tải xuống</button>
            </div>
            <p id="downloadHint" class="field-help" hidden>Chuột phải vào preview → Lưu hình / Lưu video.</p>
            <video id="resultVideo" controls playsinline crossorigin="anonymous"></video>
            <img id="resultImage" alt="Kết quả" crossorigin="anonymous" />
          </div>
          <div id="resultError" class="notice error" hidden></div>
          <details id="techLogWrap" class="advanced" hidden>
            <summary>Log kỹ thuật</summary>
            <pre id="log" class="log"></pre>
          </details>
          <div class="actions-row">
            <button type="button" class="primary" id="btnNew">Tạo mới</button>
            <button type="button" class="secondary" id="btnBackEdit">← Sửa lại</button>
          </div>
        </section>
      </div>
    </div>
  `;
}
