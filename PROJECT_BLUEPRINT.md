# AI Studio Project Blueprint

Tai lieu nay la ban huong dan day du de ban co the tao lai toan bo project AI Studio o mot folder/repo moi ma khong can xem lai lich su chat.

## 1) Tong quan nhanh du an hien tai

- Muc tieu: web app SPA (single-page) cho tao noi dung AI gom `video`, `image`, `tts`, `music`, `avatar-lipsync`.
- UI style: dark gradient, feel giong Genful/Gospel.
- Router: hash router (`#/...`) tu xay dung, khong dung framework.
- Runtime frontend: Vite phuc vu folder `public/`.
- Backend API: goi truc tiep `https://v2.api.gommo.net` tu browser thong qua token.
- Luu tru local:
  - token/domain/project_id trong `localStorage`
  - lich su ket qua generation trong `localStorage`

## 2) Cong nghe va script

`package.json` hien tai:
- `vite` de dev/build frontend.
- Co phan code CLI/FFmpeg o `src/` (legacy), nhung web app hien tai tap trung o `public/`.

Scripts quan trong:
- `npm run dev` - chay Vite dev server.
- `npm run build` - build ra `dist`.
- `npm run preview` - preview ban build.

Vite config:
- `root: public`
- `publicDir: false`
- `server.host = true`, `allowedHosts = true` (quan trong khi expose qua Cloudflare tunnel)

## 3) Cau truc thu muc can co (frontend SPA)

```text
public/
  index.html
  settings.html
  css/
    app.css
    pages.css
  js/
    app.js
    router.js
    feature-menu.js
    gommo-client.js
    model-schema.js
    settings-store.js
    history-store.js
    site-content.js
    ui-labels.js
    views/
      dashboard.js
      features.js
      models.js
      docs.js
      support.js
      privacy.js
      settings.js
      history.js
      media-playground.js
      image-playground.js
      studio.js (legacy)
```

Ghi chu:
- `image-playground.js` hien tai la wrapper/entry cho playground tong.
- `studio.js`, `playground.js` co the xem la legacy; neu tao moi co the bo qua neu khong can backward compatibility.

## 4) Kien truc app (flow thuc te)

1. Browser mo `public/index.html`.
2. `index.html` load `/js/app.js`.
3. `app.js`:
   - dang ky route -> view renderer.
   - bind su kien header/nav.
   - init feature menu.
   - refresh trang thai token.
   - start router.
4. `router.js`:
   - parse hash.
   - map route static + dynamic.
   - render vao `#app-main`.
5. View layer (`public/js/views/*.js`) render HTML bang template string + event listener.
6. API layer:
   - `settings-store.js` cap token/domain/project.
   - `gommo-client.js` call Gommo models/jobs/polling.
   - `model-schema.js` map model -> field/options/payload.
7. Sau khi tao noi dung thanh cong -> `history-store.js` luu lich su.

## 5) Route map chi tiet

Static:
- `#/` -> Dashboard
- `#/features` -> Trang tinh nang
- `#/models` -> Danh sach model
- `#/docs` -> Tai lieu
- `#/support` -> Ho tro
- `#/privacy` -> Chinh sach
- `#/create` -> Playground (mac dinh type)
- `#/history` -> Lich su
- `#/settings` -> Cau hinh token

Dynamic:
- `#/create/{type}` voi `type in {video,image,tts,music,avatar-lipsync}`
- `#/history/{type}`
- `#/models/{type}`
- `#/docs/{section}`

## 6) Cac trang va trach nhiem

### Dashboard (`views/dashboard.js`)
- Hero + prompt nhanh.
- Chip goi y prompt.
- CTA den `create/image`, `features`, `settings`.
- Hien thong ke tong lich su.

### Features (`views/features.js`)
- Render theo section/category.
- Moi section co title, desc, theme.
- Item hien theo row ngang + wrap xuong dong.
- CTA cuoi trang den tao noi dung/models.

### Models (`views/models.js`)
- Tab theo type.
- Neu co token: goi API lay model that.
- Neu chua co token: placeholder + button den settings.

### Media Playground (`views/media-playground.js`)
- Core page quan trong nhat.
- 3 cot: config -> preview -> request/response debug.
- Chon model, nhap thong so, submit job, polling ket qua.
- Save history sau khi thanh cong.

### History (`views/history.js`)
- Loc theo type.
- Xem ket qua da tao.
- Xoa item hoac clear theo nhom.

### Settings (`views/settings.js`)
- Form token/domain/project.
- Luu localStorage.
- Ban event `settings:saved`.
- Update status tren header.

### Docs/Support/Privacy
- Noi dung static, route theo section de user de theo doi.

## 7) Data model localStorage

### 7.1 Settings (`settings-store.js`)
Keys:
- `gommo_access_token`
- `gommo_domain` (default `79ai.net`)
- `gommo_project_id` (default `default`)

API:
- `loadSettings()`
- `saveSettings(...)`
- `hasToken()`

### 7.2 History (`history-store.js`)
Key:
- `ai_studio_history` (array)

HistoryEntry:
- `id`, `type`, `resultUrl`, `prompt`, `modelName`, `modelSlug`, `createdAt`, `meta`

Rule:
- toi da 80 entry/type.
- khong cho trung `resultUrl + type`.

## 8) Gommo API integration

File: `public/js/gommo-client.js`

Co cac method chinh:
- `fetchModels(type)` -> lay model list.
- `createJob(type, modelId, fields)` -> tao job.
- `pollUntilDone(jobId, media, options)` -> polling den khi xong/fail/timeout.
- `extract(envelope)` + `classify(status, resultUrl)` -> chuan hoa ket qua.

Luu y:
- Request mac dinh auth qua Bearer token.
- Du lieu submit dung `application/x-www-form-urlencoded`.
- `domain` + `project_id` duoc inject tu settings.

## 9) UI/Style strategy

File css:
- `public/css/app.css`: shell, global component, playground component.
- `public/css/pages.css`: landing + marketing pages + features page sections.

Design token:
- Mau dark gradient + purple/indigo accent.
- Font:
  - display: Plus Jakarta Sans
  - body: Inter

Responsive:
- Header: desktop co nav day du, mobile dung dropdown menu.
- Features cards: flex wrap (4/3/2/1 cot theo breakpoint).
- Playground: layout 3 cot roi co collapse theo man hinh nho.

## 10) Checklists de clone project o folder moi

## 10.1 Khoi tao nhanh

1. Tao repo moi.
2. Copy folder `public/`, `vite.config.js`, `package.json`.
3. `npm install`
4. `npm run dev`
5. Mo `http://localhost:5173`

## 10.2 Toi uu de chay tunnel/domain ngoai

Dam bao `vite.config.js` co:
- `host: true`
- `allowedHosts: true`

Neu thieu, UI co the load nhung call script/css bi chan khi mo qua URL public.

## 10.3 Verify route

Test lan luot:
- `#/`
- `#/features`
- `#/models`
- `#/create/image`
- `#/create/video`
- `#/history`
- `#/settings`
- `#/docs`

## 10.4 Verify API

1. Vao Settings, paste token.
2. Mo Models -> phai thay list model.
3. Mo Create/Image -> generate mot ket qua.
4. Mo History -> thay entry moi.

## 11) Blueprint ky thuat neu ban muon viet lai tu dau

Neu ban muon build lai sach se 100%, di theo thu tu nay:

1. Tao `router.js` (hash parser + route map + dispatch).
2. Tao `app.js` (register route + boot app).
3. Tao `index.html` shell + `#app-main`.
4. Tao `settings-store.js` + `gommo-client.js`.
5. Tao `model-schema.js` + `ui-labels.js`.
6. Tao `media-playground.js` (core generation).
7. Tao `history-store.js` + `history.js`.
8. Tao marketing pages (`dashboard/features/models/docs/support/privacy`).
9. Hoan thien css split `app.css`/`pages.css`.
10. Cuoi cung toi uu UX (loading state, error state, dropdown, copy request payload...).

## 12) Cac quy uoc code nen giu nguyen

- Moi view export duy nhat function `renderX({ main, params, query, segments })`.
- Khong giong framework: phai tu clear/re-render HTML trong `main.innerHTML`.
- Event listener can bind sau khi render.
- Tat ca dieu huong thong qua `navigate('/path')`.
- Tieu de/noi dung route luon la source of truth, khong hardcode duplicate qua nhieu noi.
- Du lieu localStorage can co default fallback de tranh crash.

## 13) Known risks va huong nang cap

Rui ro hien tai:
- Token luu localStorage -> de bi lo neu co XSS.
- Khong co auth backend.
- Polling client-side neu tab dong thi khong theo doi tiep.

Nang cap de production:
- Dua API call qua backend proxy.
- Dung encrypted session/HttpOnly cookie.
- Them user auth + server history.
- Theo doi job bang websocket/push.
- Tach code thanh module/component ro hon (hoac migrate React/Vue).

## 14) Mau commit strategy cho lan tao moi

- `feat(shell): setup app shell and hash router`
- `feat(settings): add token/domain/project storage`
- `feat(api): integrate gommo models and jobs`
- `feat(playground): add unified media playground`
- `feat(history): persist generated outputs`
- `feat(marketing): add dashboard/features/docs pages`
- `style(theme): apply dark gradient visual system`

## 15) Definition of Done (DoD)

Project xem nhu hoan chinh khi:
- Chay local duoc bang `npm run dev`.
- Tat ca route chinh render dung.
- Co the save token va goi API thanh cong.
- Generate duoc it nhat 1 image + 1 video (hoac 1 media bat ky).
- Lich su luu duoc va xem lai duoc.
- Build pass: `npm run build`.

---

Neu ban muon, buoc tiep theo minh co the tao them:
- `PROJECT_SETUP_CHECKLIST.md` (dang checklist 1 trang, rat ngan gon).
- `ARCHITECTURE_DIAGRAM.md` (mermaid flow de onboarding team nhanh).
