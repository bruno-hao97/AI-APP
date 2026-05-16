const fs = require('fs');
const path = require('path');
const { ffmpeg } = require('./ffmpeg');

/**
 * Tạo video chỉ có nền màu + chữ (không cần ảnh đầu vào).
 */
function createTextVideo({
  outputPath,
  text,
  duration = 5,
  size = '1920x1080',
  bgColor = '0x1a1a2e',
  fontSize = 64,
  fontColor = 'white',
  fps = 30,
}) {
  const [w, h] = size.split('x').map(Number);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const safe = text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=${bgColor}:s=${w}x${h}:d=${duration}:r=${fps}`)
      .inputFormat('lavfi')
      .videoFilters(
        `drawtext=text='${safe}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=(h-text_h)/2`
      )
      .outputOptions(['-pix_fmt yuv420p', '-movflags +faststart', '-t', String(duration)])
      .on('start', (line) => console.log('FFmpeg:', line))
      .on('error', reject)
      .on('end', () => {
        console.log('Đã tạo:', outputPath);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

module.exports = { createTextVideo };
