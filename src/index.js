#!/usr/bin/env node
const path = require('path');
const { program } = require('commander');
const { createFromImages } = require('./createFromImages');
const { addText } = require('./addText');
const { concatVideos } = require('./concatVideos');
const { createTextVideo } = require('./createTextVideo');
const { registerGommoCommands } = require('./cli/gommo');

program
  .name('demo-video')
  .description('Công cụ tạo video bằng Node.js + FFmpeg')
  .version('1.0.0');

program
  .command('from-images')
  .description('Tạo slideshow từ thư mục ảnh')
  .requiredOption('-i, --input <dir>', 'Thư mục ảnh')
  .requiredOption('-o, --output <file>', 'File MP4 đầu ra')
  .option('-d, --duration <sec>', 'Giây mỗi ảnh', '3')
  .option('--fps <n>', 'FPS', '30')
  .option('--size <WxH>', 'Kích thước', '1920x1080')
  .option('-a, --audio <file>', 'Nhạc nền')
  .action(async (opts) => {
    await createFromImages({
      inputDir: path.resolve(opts.input),
      outputPath: path.resolve(opts.output),
      durationPerImage: Number(opts.duration),
      fps: Number(opts.fps),
      size: opts.size,
      audioPath: opts.audio ? path.resolve(opts.audio) : undefined,
    });
  });

program
  .command('add-text')
  .description('Thêm chữ lên video có sẵn')
  .requiredOption('-i, --input <file>', 'Video đầu vào')
  .requiredOption('-o, --output <file>', 'Video đầu ra')
  .requiredOption('-t, --text <string>', 'Nội dung chữ')
  .option('--font-size <n>', 'Cỡ chữ', '48')
  .option('--start <sec>', 'Thời điểm bắt đầu', '0')
  .option('--duration <sec>', 'Thời lượng hiển thị (bỏ trống = đến hết)')
  .action(async (opts) => {
    await addText({
      inputPath: path.resolve(opts.input),
      outputPath: path.resolve(opts.output),
      text: opts.text,
      fontSize: Number(opts.fontSize),
      startTime: Number(opts.start),
      duration: opts.duration != null ? Number(opts.duration) : undefined,
    });
  });

program
  .command('text-video')
  .description('Tạo video nền + chữ (không cần ảnh)')
  .requiredOption('-o, --output <file>', 'File MP4 đầu ra')
  .requiredOption('-t, --text <string>', 'Nội dung chữ')
  .option('-d, --duration <sec>', 'Độ dài video', '5')
  .option('--size <WxH>', 'Kích thước', '1920x1080')
  .action(async (opts) => {
    await createTextVideo({
      outputPath: path.resolve(opts.output),
      text: opts.text,
      duration: Number(opts.duration),
      size: opts.size,
    });
  });

program
  .command('concat')
  .description('Ghép nhiều video')
  .requiredOption('--inputs <paths>', 'Danh sách file, cách nhau bởi dấu phẩy')
  .requiredOption('-o, --output <file>', 'File đầu ra')
  .action(async (opts) => {
    const inputs = opts.inputs.split(',').map((p) => path.resolve(p.trim()));
    await concatVideos({
      inputPaths: inputs,
      outputPath: path.resolve(opts.output),
    });
  });

registerGommoCommands(program);

program.parse();
