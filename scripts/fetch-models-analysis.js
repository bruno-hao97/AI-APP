#!/usr/bin/env node
/**
 * Gọi POST https://api.gommo.net/ai/models và in phân tích model.
 * Cần: GOMMO_ACCESS_TOKEN trong .env hoặc biến môi trường
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.GOMMO_API_BASE || 'https://api.gommo.net';
const DOMAIN = process.env.GOMMO_DOMAIN || '79ai.net';
const TYPES = ['image', 'video', 'tts', 'music', 'avatar-lipsync'];

function loadToken() {
  const envPath = path.join(__dirname, '..', '.env');
  if (process.env.GOMMO_ACCESS_TOKEN) return process.env.GOMMO_ACCESS_TOKEN.trim();
  if (fs.existsSync(envPath)) {
    const m = fs.readFileSync(envPath, 'utf8').match(/GOMMO_ACCESS_TOKEN=(.+)/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return '';
}

async function fetchModels(type, token) {
  const url = `${BASE}/ai/models?type=${encodeURIComponent(type)}&domain=${encodeURIComponent(DOMAIN)}`;
  const body = new URLSearchParams({ type, domain: DOMAIN }).toString();
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { method: 'POST', headers, body });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status} — not JSON: ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json.message || text.slice(0, 200)}`);
  return json;
}

function getModes(model) {
  const raw = model.modes?.length ? model.modes : model.mode;
  return Array.isArray(raw) ? raw : [];
}

function analyzeOne(model, type) {
  const modes = getModes(model);
  const ratios = model.ratios || [];
  const resolutions = model.resolutions || [];
  const refLimit =
    model.configs?.reference?.limits?.image ??
    model.configs?.templates?.override?.reference?.limits?.image ??
    0;

  const capabilities = [];
  if (model.withSubject && model.maxSubject) capabilities.push(`subject≤${model.maxSubject}`);
  if (model.withReference || refLimit) capabilities.push(`reference≤${refLimit || '?'}`);
  if (model.startImage) capabilities.push('startFrame');
  if (model.startImageAndEnd) capabilities.push('start+endFrame');
  if (model.withFace) capabilities.push('face');
  if (model.withSence) capabilities.push('scene');
  if (model.withStyle) capabilities.push('style');
  if (model.withMotion) capabilities.push('motion');
  if (model.withMultiShots) capabilities.push('multiShots');
  if (model.withEdit) capabilities.push('edit');
  if (model.extendVideo) capabilities.push('extend');
  if (model.configs?.templates?.enabled) capabilities.push('templates');

  return {
    slug: model.model,
    name: model.name,
    status: model.status || '—',
    server: model.server,
    priceFrom: model.price,
    description: (model.description || '').slice(0, 120),
    ratios: ratios.map((r) => r.type),
    modes: modes.map((m) => m.type),
    resolutions: resolutions.map((r) => r.type),
    priceRows: (model.prices || []).length,
    capabilities: capabilities.length ? capabilities : ['text-prompt only'],
    grids: model.grids,
    jobType: type,
  };
}

async function main() {
  const token = loadToken();
  if (!token) {
    console.error('Thiếu GOMMO_ACCESS_TOKEN. Tạo file .env từ .env.example');
    process.exit(1);
  }

  const all = {};
  for (const type of TYPES) {
    try {
      const json = await fetchModels(type, token);
      const list = Array.isArray(json.data) ? json.data : [];
      all[type] = { runtime: json.runtime, count: list.length, models: list.map((m) => analyzeOne(m, type)) };
      console.error(`OK ${type}: ${list.length} models`);
    } catch (e) {
      all[type] = { error: e.message, models: [] };
      console.error(`FAIL ${type}: ${e.message}`);
    }
  }

  const outPath = path.join(__dirname, '..', 'output', 'models-analysis.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2));

  // In báo cáo markdown-friendly ra stdout
  console.log('\n# Phân tích models — api.gommo.net/ai/models\n');
  for (const type of TYPES) {
    const block = all[type];
    console.log(`\n## type=${type} (${block.count ?? 0} model)\n`);
    if (block.error) {
      console.log(`Lỗi: ${block.error}\n`);
      continue;
    }
    for (const m of block.models || []) {
      console.log(`### ${m.name} (\`${m.slug}\`)`);
      console.log(`- **status:** ${m.status} | **server:** ${m.server} | **giá từ:** ${m.priceFrom}`);
      console.log(`- **ratio:** ${m.ratios.join(', ') || '—'}`);
      console.log(`- **mode:** ${m.modes.join(', ') || '—'}`);
      console.log(`- **resolution:** ${m.resolutions.join(', ') || '—'}`);
      console.log(`- **khả năng:** ${m.capabilities.join(', ')}`);
      if (m.grids) console.log(`- **grids:** ${m.grids} ảnh/lượt`);
      if (m.description) console.log(`- ${m.description}…`);
      console.log('');
    }
  }
  console.log(`\n(JSON đầy đủ: ${outPath})\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
