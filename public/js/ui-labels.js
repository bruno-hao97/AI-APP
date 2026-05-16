/** Nhãn thân thiện — tách khỏi logic API */

export const JOB_TYPES = [
  { value: 'video', label: 'Video', desc: 'Tạo hoặc chỉnh video bằng AI', icon: '🎬' },
  { value: 'image', label: 'Hình ảnh', desc: 'Tạo hoặc chỉnh ảnh từ mô tả', icon: '🖼️' },
  { value: 'tts', label: 'Giọng đọc', desc: 'Chuyển văn bản thành giọng nói', icon: '🔊' },
  { value: 'music', label: 'Nhạc AI', desc: 'Sáng tác nhạc nền', icon: '🎵' },
  { value: 'avatar-lipsync', label: 'Avatar nói', desc: 'Video nhân vật khớp miệng', icon: '👤' },
];

export const FIELD_LABELS = {
  ratio: 'Tỷ lệ khung hình',
  mode: 'Chế độ chất lượng',
  resolution: 'Độ nét (phân giải)',
  duration: 'Thời lượng',
  prompt: 'Mô tả nội dung',
  text: 'Văn bản cần đọc',
  musicName: 'Tên bài nhạc',
  templateId: 'Mẫu có sẵn (template)',
  images: 'Ảnh khung đầu',
  references: 'Ảnh / tài liệu tham chiếu',
  subjects: 'Ảnh nhân vật / chủ thể',
};

export function getModelCategory(model) {
  if (model.withUpscale) {
    return { tag: 'Nâng cấp', hint: 'Đưa video có sẵn để AI nâng độ nét' };
  }
  if (model.withMotion) {
    return { tag: 'Chuyển động', hint: 'Copy chuyển động từ video mẫu sang nhân vật' };
  }
  if (model.withEdit) {
    return { tag: 'Chỉnh sửa', hint: 'Sửa hoặc cắt video đã có' };
  }
  if (model.withLipsync) {
    return { tag: 'Lồng tiếng', hint: 'Khớp miệng nhân vật với âm thanh' };
  }
  const ref = model.configs?.reference;
  if (ref?.allowedTypes?.includes('video') || ref?.allowedTypes?.includes('audio')) {
    return { tag: 'Đa nguồn', hint: 'Kết hợp ảnh, video, âm thanh trong một clip' };
  }
  if (model.startImage || model.withReference) {
    return { tag: 'Từ ảnh', hint: 'Bắt đầu từ ảnh + mô tả chuyển động' };
  }
  return { tag: 'Tạo mới', hint: 'Mô tả bằng chữ là chính' };
}

export function formatPrice(price, sale) {
  if (price == null) return '';
  let s = `~${Number(price).toLocaleString('vi-VN')} điểm`;
  if (sale > 0) s += ` (đang giảm ${sale}%)`;
  return s;
}

export function formatDurationOption(opt) {
  const name = opt.label || opt.value;
  if (/^\d+$/.test(String(opt.value))) return `${opt.value} giây`;
  return name;
}

export function progressMessage(phase, attempt) {
  const map = {
    running: 'Đang xử lý trên máy chủ…',
    success: 'Hoàn tất!',
    failed: 'Không tạo được — thử đổi mô tả hoặc model khác',
    unknown: 'Đang kiểm tra tiến độ…',
  };
  const base = map[phase] || map.unknown;
  if (attempt > 1 && phase === 'running') {
    return `${base} (lần ${attempt}, thường 1–5 phút)`;
  }
  return base;
}
