/** Nội dung trang marketing / docs — tập trung một chỗ */
import { JOB_TYPES, FIELD_LABELS } from './ui-labels.js';

export const SITE = {
  name: 'AI Studio',
  tagline: 'Nền tảng sáng tạo AI chuyên nghiệp',
  api: 'Gommo v2 · 79AI',
};

export const HERO_CHIPS = [
  'Quảng cáo TikTok',
  'Logo 3D',
  'Avatar nói chuyện',
  'Nhạc nền podcast',
  'Ảnh sản phẩm',
  'Video cinematic',
];

export const FEATURE_STATS = [
  { value: '50+', label: 'AI Models' },
  { value: '5', label: 'Loại nội dung' },
  { value: '99.9%', label: 'Uptime API' },
  { value: '<100ms', label: 'Phản hồi' },
];

/**
 * Danh mục tính năng — mỗi section có badge, tiêu đề, mô tả và danh sách items (row ngang, xuống hàng).
 * @typedef {{ icon: string, title: string, desc: string, path?: string }} FeatureItem
 * @typedef {{ id: string, badge: string, badgeIcon: string, title: string, description: string, theme: string, align?: 'left'|'right', items: FeatureItem[] }} FeatureCategory
 */
export const FEATURE_CATEGORIES = [
  {
    id: 'video',
    badge: 'AI VIDEO STUDIO',
    badgeIcon: '▶',
    title: 'AI Video Studio',
    description: 'Tạo video chuyên nghiệp từ text, ảnh hoặc avatar — tích hợp Gommo API.',
    theme: 'purple',
    align: 'left',
    items: [
      { icon: '▶', title: 'Text-to-Video', desc: 'Mô tả bằng chữ, AI render clip hoàn chỉnh.', path: '/create/video' },
      { icon: '🖼', title: 'Image-to-Video', desc: 'Upload ảnh khung đầu, thêm chuyển động & hiệu ứng.', path: '/create/video' },
      { icon: '👤', title: 'Avatar Lip-sync', desc: 'Nhân vật nói khớp miệng với script hoặc audio.', path: '/create/avatar-lipsync' },
      { icon: '⬆', title: 'Video Upscale', desc: 'Nâng độ nét video qua model upscale (nếu có trên tài khoản).', path: '/models/video' },
    ],
  },
  {
    id: 'image',
    badge: 'THIẾT KẾ & TẠO ẢNH',
    badgeIcon: '◻',
    title: 'Thiết Kế & Tạo Ảnh',
    description: 'Sinh ảnh, poster, sản phẩm và chỉnh sửa visual cho chiến dịch marketing.',
    theme: 'blue',
    align: 'right',
    items: [
      { icon: '✦', title: 'AI Image Gen', desc: 'Tạo ảnh từ prompt — GPT Image, Flux, Midjourney…', path: '/create/image' },
      { icon: '✎', title: 'Image Editing', desc: 'Chỉnh sửa, inpaint và biến đổi ảnh có sẵn.', path: '/create/image' },
      { icon: '📢', title: 'Marketing Posters', desc: 'Poster quảng cáo, banner social theo brief.', path: '/create/image' },
      { icon: '👗', title: 'Virtual Fashion', desc: 'Thử trang phục, lookbook sản phẩm thời trang.', path: '/create/image' },
      { icon: '◌', title: 'Background Removal', desc: 'Tách nền, thay background sản phẩm.', path: '/create/image' },
      { icon: '⬆', title: 'Image Upscaling', desc: 'Nâng độ phân giải ảnh output.', path: '/models/image' },
    ],
  },
  {
    id: 'audio',
    badge: 'ÂM NHẠC & GIỌNG NÓI',
    badgeIcon: '♪',
    title: 'Âm Nhạc & Giọng Nói',
    description: 'Sáng tác nhạc nền, giọng đọc AI và hiệu ứng âm thanh cho video & podcast.',
    theme: 'orange',
    align: 'left',
    items: [
      { icon: '♪', title: 'Music Composition', desc: 'Tạo nhạc nền theo mood, genre từ mô tả.', path: '/create/music' },
      { icon: '🔊', title: 'Text-to-Speech', desc: 'Chuyển văn bản thành giọng nói tự nhiên.', path: '/create/tts' },
      { icon: '◎', title: 'Sound Effects', desc: 'Hiệu ứng âm thanh cho video & quảng cáo.', path: '/docs/music' },
      { icon: '📝', title: 'Speech-to-Text', desc: 'Chuyển giọng nói thành văn bản (qua API tương lai).', path: '/docs/tts' },
    ],
  },
  {
    id: 'creative',
    badge: 'CÔNG CỤ SÁNG TẠO',
    badgeIcon: '✦',
    title: 'Công Cụ Sáng Tạo',
    description: 'Lịch sử, template và workflow giúp team sản xuất nội dung nhanh hơn.',
    theme: 'pink',
    align: 'right',
    items: [
      { icon: '📋', title: 'AI Storyboard', desc: 'Phác thảo kịch bản visual trước khi render.', path: '/docs/video' },
      { icon: '📜', title: 'Script Writing', desc: 'Soạn kịch bản quảng cáo, TikTok, YouTube.', path: '/docs' },
      { icon: '🕘', title: 'Lịch sử Studio', desc: 'Xem lại mọi kết quả đã tạo, phân loại theo type.', path: '/history' },
      { icon: '▦', title: 'App Gallery', desc: 'Khám phá pipeline và mẫu từ Dashboard.', path: '/' },
    ],
  },
  {
    id: 'infra',
    badge: 'HẠ TẦNG & API',
    badgeIcon: '⬡',
    title: 'Hạ Tầng & API',
    description: 'Catalog model, tài liệu API và cấu hình token Gommo v2.',
    theme: 'teal',
    align: 'left',
    items: [
      { icon: '⬡', title: 'Unified API', desc: 'Một token — video, ảnh, TTS, nhạc, avatar.', path: '/settings' },
      { icon: '📖', title: 'Detailed Docs', desc: 'Hướng dẫn từng tính năng & tham số API.', path: '/docs' },
      { icon: '🔒', title: 'Token Security', desc: 'Lưu cục bộ trên trình duyệt, không backend.', path: '/privacy' },
      { icon: '⚡', title: 'Model Catalog', desc: 'Danh sách model theo Video, Ảnh, Audio…', path: '/models' },
    ],
  },
];

export const FEATURE_DETAILS = JOB_TYPES.map((t) => ({
  ...t,
  title: t.label,
  bullets: getFeatureBullets(t.value),
  steps: getFeatureSteps(t.value),
}));

function getFeatureBullets(type) {
  const map = {
    video: [
      'Text-to-Video và Image-to-Video qua API Gommo',
      'Tùy chọn ratio, độ phân giải, thời lượng theo từng model',
      'Hỗ trợ ảnh khung đầu, tham chiếu nhân vật',
      'Playground 3 cột: cấu hình · preview · response JSON',
    ],
    image: [
      'Tạo ảnh từ prompt tiếng Việt hoặc Anh',
      'Chọn model GPT Image, Flux, Midjourney… từ catalog API',
      'Chip chọn mode, resolution, tỷ lệ khung hình',
      'Tải xuống & lưu lịch sử tự động',
    ],
    tts: [
      'Chuyển văn bản thành giọng nói tự nhiên',
      'Phù hợp voice-over, quảng cáo, audiobook ngắn',
      'Tích hợp pipeline Gommo — không cần server riêng',
    ],
    music: [
      'Sáng tác nhạc nền từ mô tả phong cách',
      'Đặt tên bài, prompt mood/genre',
      'Preview audio ngay trong studio',
    ],
    'avatar-lipsync': [
      'Video nhân vật khớp miệng với audio/text',
      'Kết hợp ảnh/video nguồn + script',
      'Ideal cho MC ảo, giới thiệu sản phẩm',
    ],
  };
  return map[type] || [];
}

function getFeatureSteps(type) {
  return [
    'Vào Cài đặt → dán token Gommo từ 79AI',
    `Mở Studio → ${JOB_TYPES.find((j) => j.value === type)?.label || type}`,
    'Chọn model trong dropdown, nhập prompt / tham số',
    'Bấm Tạo Request → xem preview & response',
    'Tải file hoặc xem lại trong Lịch sử',
  ];
}

export const DOC_SECTIONS = [
  {
    id: 'start',
    title: 'Bắt đầu nhanh',
    body: `
      <ol>
        <li>Lấy token API từ quản trị 79AI hoặc tài khoản Gommo.</li>
        <li>Mở <strong>Cài đặt API</strong> → dán token → Lưu.</li>
        <li>Chọn loại nội dung từ Dashboard hoặc menu <strong>Tính năng</strong>.</li>
        <li>Mỗi domain (localhost, Cloudflare…) lưu token riêng trong trình duyệt.</li>
      </ol>
    `,
  },
  ...JOB_TYPES.map((t) => ({
    id: t.value,
    title: `Hướng dẫn: ${t.label}`,
    body: `
      <p>${t.desc}</p>
      <h4>Các bước</h4>
      <ol>${getFeatureSteps(t.value).map((s) => `<li>${s}</li>`).join('')}</ol>
      <h4>Tham số thường gặp</h4>
      <ul>
        ${t.value !== 'tts' ? `<li><strong>${FIELD_LABELS.prompt}</strong> — mô tả chi tiết càng tốt</li>` : ''}
        ${t.value === 'tts' ? `<li><strong>${FIELD_LABELS.text}</strong> — văn bản cần đọc</li>` : ''}
        ${['video', 'image', 'avatar-lipsync'].includes(t.value) ? `<li>${FIELD_LABELS.ratio}, ${FIELD_LABELS.resolution}, ${FIELD_LABELS.mode}</li>` : ''}
        ${t.value === 'video' ? `<li>${FIELD_LABELS.duration}, ${FIELD_LABELS.images}</li>` : ''}
        ${t.value === 'music' ? `<li>${FIELD_LABELS.musicName}</li>` : ''}
      </ul>
      <p><a href="#/create/${t.value}" class="inline-link">Mở Studio ${t.label} →</a></p>
    `,
  })),
  {
    id: 'history',
    title: 'Lịch sử & tải file',
    body: `
      <p>Mỗi lần gen thành công, kết quả được lưu trong <strong>Lịch sử</strong>, phân tab theo loại.</p>
      <p>Dữ liệu nằm trên trình duyệt (localStorage) — không đồng bộ cloud.</p>
    `,
  },
];

export const SUPPORT_FAQ = [
  {
    q: 'Token lấy ở đâu?',
    a: 'Từ trang 79AI hoặc quản trị viên Gommo. Dán vào Cài đặt API trong AI Studio.',
  },
  {
    q: 'Tại sao không tải được model?',
    a: 'Kiểm tra token còn hạn, domain đúng (79ai.net), và mạng tới v2.api.gommo.net.',
  },
  {
    q: 'Link Cloudflare có cần nhập token lại?',
    a: 'Có — mỗi origin (localhost vs trycloudflare.com) có localStorage riêng.',
  },
  {
    q: 'Gen bị timeout?',
    a: 'Video thường 1–5 phút. Thử lại hoặc kiểm tra job trên 79AI.',
  },
];

export const PRIVACY_SECTIONS = [
  {
    title: 'Dữ liệu lưu trữ',
    text: 'Token API và lịch sử gen được lưu cục bộ trên trình duyệt (localStorage). Chúng tôi không vận hành backend riêng để thu thập dữ liệu người dùng trong bản demo này.',
  },
  {
    title: 'API bên thứ ba',
    text: 'Mọi request tạo nội dung gửi trực tiếp tới Gommo API (v2.api.gommo.net). Vui lòng xem chính sách của 79AI/Gommo đối với nội dung upload và prompt.',
  },
  {
    title: 'Token & bảo mật',
    text: 'Không chia sẻ token công khai. Không commit token vào git. Trên máy dùng chung, nên xóa token sau khi dùng (Cài đặt → Xóa token).',
  },
  {
    title: 'Cookie',
    text: 'Ứng dụng SPA này không dùng cookie theo dõi; chỉ localStorage cho cấu hình.',
  },
];
