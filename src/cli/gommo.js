const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const gommo = require('../gommo');
const { DEFAULT_DOMAIN, DEFAULT_PROJECT_ID } = require('../gommo/config');

function getToken(opts) {
  return opts.token || process.env.GOMMO_ACCESS_TOKEN;
}

function registerGommoCommands(parent) {
  const gommoCmd = parent
    .command('gommo')
    .description('Gommo Jobs API (gateway v2.api.gommo.net)');

  gommoCmd
    .command('health')
    .description('GET /health')
    .option('--token <token>', 'Access token')
    .action(async (opts) => {
      const r = await gommo.checkHealth({ accessToken: getToken(opts) });
      console.log(JSON.stringify(r.envelope, null, 2));
    });

  gommoCmd
    .command('models')
    .description('Load models trước khi tạo job')
    .requiredOption('-t, --type <type>', 'image|video|tts|music|avatar-lipsync')
    .option('--token <token>', 'Access token')
    .option('--no-cache', 'Bỏ cache')
    .option('--schema', 'In kèm analyzeModel cho từng model')
    .action(async (opts) => {
      const { models, runtime } = await gommo.fetchModels({
        type: opts.type,
        accessToken: getToken(opts),
        useCache: opts.cache,
      });
      if (opts.schema) {
        const out = models.map((m) => ({
          slug: gommo.modelSlug(m),
          status: m.status,
          available: gommo.isModelAvailable(m),
          schema: gommo.analyzeModel(m, opts.type),
        }));
        console.log(JSON.stringify({ runtime, models: out }, null, 2));
      } else {
        console.log(JSON.stringify({ runtime, data: models }, null, 2));
      }
    });

  gommoCmd
    .command('schema')
    .description('Phân tích payload cần thiết cho một model')
    .requiredOption('-t, --type <type>', 'Job type')
    .requiredOption('-m, --model <id>', 'model slug')
    .option('--token <token>', 'Access token')
    .action(async (opts) => {
      const { models } = await gommo.fetchModels({
        type: opts.type,
        accessToken: getToken(opts),
      });
      const model = gommo.findModelBySlug(models, opts.model);
      if (!model) {
        console.error('Model không tìm thấy');
        process.exitCode = 1;
        return;
      }
      const schema = gommo.analyzeModel(model, opts.type);
      const defaults = gommo.defaultSelections(schema);
      console.log(JSON.stringify({ schema, defaultSelections: defaults }, null, 2));
    });

  gommoCmd
    .command('create')
    .description('POST /ai/jobs/{type}/{model_id}')
    .requiredOption('-t, --type <type>', 'Job type')
    .requiredOption('-m, --model <id>', 'model_id slug')
    .option('--token <token>', 'Access token')
    .option('-d, --domain <domain>', 'domain', DEFAULT_DOMAIN)
    .option('-p, --project-id <id>', 'project_id', DEFAULT_PROJECT_ID)
    .option('--prompt <text>', 'prompt')
    .option('--fields <json>', 'JSON selections (ratio, mode, resolution, subjects, …)')
    .option('--from-model', 'Build payload từ /ai/models schema (mặc định)')
    .option('--raw', 'Gửi fields thô, không qua buildJobPayload')
    .action(async (opts) => {
      const selections = opts.fields ? JSON.parse(opts.fields) : {};
      if (opts.prompt) selections.prompt = opts.prompt;

      if (opts.raw) {
        const r = await gommo.createJob({
          type: opts.type,
          modelId: opts.model,
          fields: { ...selections },
          domain: opts.domain,
          projectId: opts.projectId,
          accessToken: getToken(opts),
        });
        console.log(JSON.stringify(r.envelope, null, 2));
        return;
      }

      const { createResult, fields } = await gommo.createJobFromModel({
        type: opts.type,
        modelId: opts.model,
        selections,
        domain: opts.domain,
        projectId: opts.projectId,
        accessToken: getToken(opts),
      });
      console.log(JSON.stringify({ fields, response: createResult.envelope }, null, 2));
    });

  gommoCmd
    .command('poll')
    .description('Poll /ai/jobs/{id}?media=...')
    .requiredOption('-i, --id <jobId>', 'id_base')
    .option('--media <media>', 'image|video|music', 'video')
    .option('--wait', 'Poll đến khi xong')
    .option('--token <token>', 'Access token')
    .option('-d, --domain <domain>', 'domain', DEFAULT_DOMAIN)
    .action(async (opts) => {
      if (opts.wait) {
        const r = await gommo.pollJobUntilDone({
          jobId: opts.id,
          media: opts.media,
          domain: opts.domain,
          accessToken: getToken(opts),
          onProgress: ({ phase, status, resultUrl, attempt }) => {
            console.log(
              `[${attempt}] ${phase} status=${status} url=${resultUrl || '-'}`
            );
          },
        });
        console.log(JSON.stringify(r, null, 2));
        if (!r.success) process.exitCode = 1;
      } else {
        const r = await gommo.pollJobOnce({
          jobId: opts.id,
          media: opts.media,
          domain: opts.domain,
          accessToken: getToken(opts),
        });
        console.log(JSON.stringify(r.envelope, null, 2));
      }
    });

  gommoCmd
    .command('video')
    .description('Tạo video AI + poll (happy path)')
    .requiredOption('-m, --model <id>', 'model_id, vd. happy_horse_1')
    .requiredOption('--prompt <text>', 'Mô tả video')
    .option('--token <token>', 'Access token')
    .option('-d, --domain <domain>', 'domain', DEFAULT_DOMAIN)
    .option('-p, --project-id <id>', 'project_id', DEFAULT_PROJECT_ID)
    .option('-o, --output <file>', 'Tải MP4 về file local')
    .option('--fields <json>', 'Field bổ sung từ /ai/models')
    .option('-t, --type <type>', 'Job type', 'video')
    .action(async (opts) => {
      const selections = opts.fields ? JSON.parse(opts.fields) : { prompt: opts.prompt };
      if (opts.prompt) selections.prompt = opts.prompt;
      const r = await gommo.createJobAndWait({
        type: opts.type,
        modelId: opts.model,
        selections,
        domain: opts.domain,
        projectId: opts.projectId,
        accessToken: getToken(opts),
        onProgress: ({ phase, status, attempt }) => {
          console.log(`[${attempt}] ${phase} — ${status}`);
        },
      });

      console.log('\nKết quả:');
      console.log(JSON.stringify({ jobId: r.jobId, resultUrl: r.resultUrl, success: r.success }, null, 2));

      if (r.resultUrl && opts.output) {
        await downloadFile(r.resultUrl, path.resolve(opts.output));
        console.log('Đã lưu:', opts.output);
      }

      if (!r.success) process.exitCode = 1;
    });

  gommoCmd
    .command('upload-image')
    .description('POST /ai/upload/image')
    .requiredOption('-f, --file <path>', 'File ảnh')
    .option('--token <token>', 'Access token')
    .action(async (opts) => {
      const r = await gommo.uploadImage({
        filePath: path.resolve(opts.file),
        accessToken: getToken(opts),
      });
      console.log(JSON.stringify(r, null, 2));
    });

  gommoCmd
    .command('upload-video')
    .description('POST /ai/upload/video')
    .requiredOption('-f, --file <path>', 'File video')
    .option('--token <token>', 'Access token')
    .action(async (opts) => {
      const r = await gommo.uploadVideo({
        filePath: path.resolve(opts.file),
        accessToken: getToken(opts),
      });
      console.log(JSON.stringify(r, null, 2));
    });
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tải file thất bại: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

module.exports = { registerGommoCommands };
