const fs = require('fs');
const path = require('path');
const { ffmpeg } = require('./ffmpeg');

function escapeDrawtext(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%');
}

/**
 * Thêm chữ overlay lên video.
 */
function addText({
  inputPath,
  outputPath,
  text,
  fontSize = 48,
  fontColor = 'white',
  x = '(w-text_w)/2',
  y = 'h-th-80',
  startTime = 0,
  duration,
}) {
  if (!fs.existsSync(inputPath)) {
    return Promise.reject(new Error(`Không tìm thấy file: ${inputPath}`));
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const safe = escapeDrawtext(text);
  let enable = `gte(t,${startTime})`;
  if (duration != null) {
    enable += `*lte(t,${startTime + duration})`;
  }

  const filter = `drawtext=text='${safe}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}:enable='${enable}'`;

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(filter)
      .outputOptions(['-c:a copy', '-movflags +faststart'])
      .on('start', (line) => console.log('FFmpeg:', line))
      .on('error', reject)
      .on('end', () => {
        console.log('Đã tạo:', outputPath);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

module.exports = { addText };
