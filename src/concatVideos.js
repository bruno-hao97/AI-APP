const fs = require('fs');
const path = require('path');
const { ffmpeg } = require('./ffmpeg');

/**
 * Ghép nhiều video cùng codec thành một file.
 */
function concatVideos({ inputPaths, outputPath }) {
  const missing = inputPaths.filter((p) => !fs.existsSync(p));
  if (missing.length) {
    return Promise.reject(
      new Error(`Không tìm thấy: ${missing.join(', ')}`)
    );
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const listFile = path.join(path.dirname(outputPath), '.concat-list.txt');
  const content = inputPaths
    .map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(listFile, content);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy', '-movflags +faststart'])
      .on('start', (line) => console.log('FFmpeg:', line))
      .on('error', (err) => {
        try {
          fs.unlinkSync(listFile);
        } catch (_) {}
        reject(err);
      })
      .on('end', () => {
        try {
          fs.unlinkSync(listFile);
        } catch (_) {}
        console.log('Đã ghép:', outputPath);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

module.exports = { concatVideos };
