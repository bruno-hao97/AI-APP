# Demo Video — Tạo video bằng Node.js + Gommo AI

Dự án mẫu dùng **Node.js**, **FFmpeg** và **Gommo Jobs gateway** (`https://v2.api.gommo.net`):

**FFmpeg (local):**
- Slideshow từ ảnh (+ nhạc nền)
- Video nền + chữ, overlay chữ, ghép clip

**Gommo API:**
- Load models → tạo job AI (video/image/…) → poll trạng thái
- Playground web (Settings + token `localStorage` cho demo nội bộ)
- CLI `gommo` cho server/script

## Yêu cầu

- Node.js 18+
- Windows / macOS / Linux

## Cài đặt Node.js + dependencies

Terminal chưa có `node`/`npm`? Chạy **một lần** (tải Node portable ~33MB vào `.tools/node`):

```powershell
cd "D:\79AI\projects\demo video"
.\scripts\setup-node.ps1
```

Hoặc cài [Node.js LTS](https://nodejs.org/) rồi:

```bash
npm install
```

Sao chép `.env.example` → `.env` và điền `GOMMO_ACCESS_TOKEN` nếu dùng API.

**Dùng npm khi PATH chưa có Node:**

```powershell
.\scripts\npm.ps1 run dev
```

## Playground — Vite (khuyến nghị)

```powershell
.\scripts\npm.ps1 run dev
```

Mở http://localhost:5173 → **Settings** → token → tải models → tạo job.

Build production: `npm run build` → thư mục `dist/`.

## Playground — server tĩnh (cũ)

```bash
npm run playground
```

http://localhost:3456

`domain` luôn **`79ai.net`** (whitelist), không dùng hostname gateway.

## Gommo — CLI

```bash
# POST /ai/models — data[] như API Gommo (ratios/modes/resolutions dùng field `type`)
node src/index.js gommo models -t image
node src/index.js gommo schema -t image -m imagegen_2_0

# Tạo job — payload build tự động từ schema model
node src/index.js gommo create -t image -m imagegen_2_0 --prompt "portrait" --fields "{\"mode\":\"low\",\"resolution\":\"2k\",\"ratio\":\"16:9\"}"

# Tạo + poll (model ví dụ Playground)
set GOMMO_ACCESS_TOKEN=your_token
node src/index.js gommo video -m happy_horse_1 --prompt "a cinematic portrait" -o ./output/ai.mp4

# Tạo job thủ công
node src/index.js gommo create -t video -m happy_horse_1 --prompt "a cinematic portrait"

# Poll
node src/index.js gommo poll -i JOB_ID --media video --wait
```

## Gommo — từ code

```javascript
const gommo = require('./src/gommo');

const models = await gommo.fetchModels({ type: 'video', accessToken: process.env.GOMMO_ACCESS_TOKEN });
const result = await gommo.createVideoJobAndWait({
  modelId: 'happy_horse_1',
  prompt: 'a cinematic portrait',
  domain: '79ai.net',
  projectId: 'default',
  accessToken: process.env.GOMMO_ACCESS_TOKEN,
});
console.log(result.resultUrl);
```

## Chuẩn bị ảnh

Đặt file `.jpg`, `.png`, … vào thư mục `assets/images/`.

## Lệnh CLI

### 1. Slideshow từ ảnh

```bash
node src/index.js from-images -i ./assets/images -o ./output/slideshow.mp4 -d 3
```

Có nhạc nền:

```bash
node src/index.js from-images -i ./assets/images -o ./output/slideshow.mp4 -a ./assets/music.mp3
```

### 2. Video chỉ có chữ

```bash
node src/index.js text-video -t "Video demo Node.js" -o ./output/intro.mp4 -d 5
```

### 3. Thêm chữ lên video

```bash
node src/index.js add-text -i ./output/slideshow.mp4 -o ./output/final.mp4 -t "Xin chào!"
```

### 4. Ghép nhiều video

```bash
node src/index.js concat --inputs ./output/part1.mp4,./output/part2.mp4 -o ./output/merged.mp4
```

## Cấu trúc thư mục

```
demo-video/
├── assets/images/   # ảnh đầu vào
├── output/          # video xuất ra
└── src/
    ├── index.js           # CLI
    ├── createFromImages.js
    ├── createTextVideo.js
    ├── addText.js
    └── concatVideos.js
```

## Gọi từ code

```javascript
const { createFromImages } = require('./src/createFromImages');

await createFromImages({
  inputDir: './assets/images',
  outputPath: './output/my-video.mp4',
  durationPerImage: 4,
  audioPath: './assets/music.mp3',
});
```

## Ghi chú

- FFmpeg được đóng gói qua `@ffmpeg-installer/ffmpeg`, không cần cài FFmpeg thủ công.
- Trên Windows, chữ overlay dùng font mặc định của FFmpeg; để font tùy chỉnh có thể thêm `fontfile` trong `addText.js`.
