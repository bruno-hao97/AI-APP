const fs = require('fs');
const path = require('path');
const { ffmpeg } = require('./ffmpeg');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);

function listImages(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => path.join(dir, f));
}

/**
 * Tạo video slideshow từ thư mục ảnh.
 * @param {object} opts
 * @param {string} opts.inputDir - Thư mục chứa ảnh
 * @param {string} opts.outputPath - File .mp4 đầu ra
 * @param {number} [opts.durationPerImage=3] - Giây mỗi ảnh
 * @param {number} [opts.fps=30]
 * @param {string} [opts.size=1920x1080]
 * @param {string} [opts.audioPath] - Nhạc nền (tùy chọn)
 */
function createFromImages({
  inputDir,
  outputPath,
  durationPerImage = 3,
  fps = 30,
  size = '1920x1080',
  audioPath,
}) {
  const images = listImages(inputDir);
  if (images.length === 0) {
    return Promise.reject(new Error(`Không tìm thấy ảnh trong: ${inputDir}`));
  }

  const [width, height] = size.split('x').map(Number);
  const tmpDir = path.join(path.dirname(outputPath), '.tmp-frames');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const listFile = path.join(tmpDir, 'concat.txt');
  const lines = images.flatMap((img) => [
    `file '${img.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`,
    `duration ${durationPerImage}`,
  ]);
  lines.push(
    `file '${images[images.length - 1].replace(/\\/g, '/').replace(/'/g, "'\\''")}'`
  );
  fs.writeFileSync(listFile, lines.join('\n'));

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .videoFilters([
        `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
        'format=yuv420p',
      ])
      .outputOptions(['-pix_fmt yuv420p', `-r ${fps}`, '-movflags +faststart']);

    if (audioPath && fs.existsSync(audioPath)) {
      cmd = cmd
        .input(audioPath)
        .outputOptions([
          '-shortest',
          '-c:a aac',
          '-b:a 192k',
          '-map 0:v:0',
          '-map 1:a:0',
        ]);
    } else {
      cmd = cmd.outputOptions(['-an']);
    }

    cmd
      .on('start', (line) => console.log('FFmpeg:', line))
      .on('error', (err) => {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {}
        reject(err);
      })
      .on('end', () => {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {}
        console.log('Đã tạo:', outputPath);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

module.exports = { createFromImages, listImages };
