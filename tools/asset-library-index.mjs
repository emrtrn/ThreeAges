#!/usr/bin/env node
// Generic CC0 asset-library indexer.
//
// Walks an external asset library (organised as <root>/<category>/<pack>/...)
// and emits three dev-only artifacts:
//
//   tools/<lib>/<lib>-index.json   structured (packs + every asset) for tooling
//                                  — stays in THIS repo (Forge dev tool, used
//                                    while pulling assets into any game fork).
//   tools/<lib>/<lib>-assets.tsv   flat, one asset per line, grep-friendly
//                                  — stays in THIS repo, same reason.
//   docs/<lib>/<LIB>_CATALOG.md     human pack catalog + game-theme -> packs map
//                                  — written to the GameDesign studio repo
//                                    (sibling dir), NOT this repo. Forge does
//                                    platform work only; game-design/ideation
//                                    docs live in GameDesign (2026-07-04 policy).
//                                    Override with ASSET_LIBRARY_DOCS_ROOT.
//
// First/only consumer today is the Kenney library, but nothing here is
// Kenney-specific: point ASSET_LIBRARY_ROOT (or argv[2]) at any CC0 library
// laid out the same way. Keep this generic - it lives in the template.
//
// Usage:
//   node tools/asset-library-index.mjs [libraryRoot]
//   ASSET_LIBRARY_ROOT=D:/path node tools/asset-library-index.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const LIBRARY_NAME = process.env.ASSET_LIBRARY_NAME || 'kenney';
const LIBRARY_ROOT =
  process.argv[2] ||
  process.env.ASSET_LIBRARY_ROOT ||
  'C:/Users/emret/Documents/Kenney';
const DOCS_ROOT =
  process.env.ASSET_LIBRARY_DOCS_ROOT || 'C:/Users/emret/Desktop/GameDesign/docs';

const OUT_JSON = path.join(repoRoot, 'tools', LIBRARY_NAME, `${LIBRARY_NAME}-index.json`);
const OUT_TSV = path.join(repoRoot, 'tools', LIBRARY_NAME, `${LIBRARY_NAME}-assets.tsv`);
const OUT_MD = path.join(DOCS_ROOT, LIBRARY_NAME, `${LIBRARY_NAME.toUpperCase()}_CATALOG.md`);

const MODEL_EXT = new Set(['.glb', '.gltf', '.obj', '.fbx']);
const AUDIO_EXT = new Set(['.ogg', '.wav', '.mp3']);
const IMAGE_EXT = new Set(['.png', '.svg', '.jpg', '.jpeg']);
const FONT_EXT = new Set(['.ttf', '.otf']);

// Pack-level meta files we never index as assets.
const META_FILE = /^(license|readme|sample|preview|overview|index)/i;

function kindOf(ext) {
  if (MODEL_EXT.has(ext)) return 'model';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (ext === '.svg') return 'vector';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (FONT_EXT.has(ext)) return 'font';
  return 'other';
}

// Split file/folder names into lowercase search tokens (handles camelCase,
// separators, and trailing variant/version digits).
function tokenize(name) {
  const base = name.replace(/\.[^.]+$/, '');
  return [
    ...new Set(
      base
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[\s_\-.()[\]]+/)
        .map((s) => s.toLowerCase())
        .filter((s) => s.length > 1 && !/^\d+$/.test(s)),
    ),
  ];
}

// kenney_city-kit-suburban_20 -> "City Kit Suburban"
function prettyPack(folder) {
  return folder
    .replace(/^kenney[_-]/i, '')
    .replace(/[_-]\d+(\.\d+)?$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Curated game-theme -> candidate pack folders. Only packs that actually exist
// in the library are rendered, so a missing pack just shows fewer options.
const THEME_MAP = {
  'Racing / Driving': [
    'kenney_car-kit', 'kenney_racing-kit', 'kenney_toy-car-kit',
    'kenney_city-kit-roads', 'kenney_3d-road-tiles', 'kenney_coaster-kit',
  ],
  'Platformer': ['kenney_platformer-kit', 'kenney_prototype-kit'],
  'Dungeon Crawler / RPG': [
    'kenney_mini-dungeon', 'kenney_modular-dungeon-kit_1.0', 'kenney_mini-characters',
    'kenney_retro-fantasy-kit', 'kenney_fantasy-town-kit_2.0',
  ],
  'Tower Defense': ['kenney_tower-defense-kit', 'kenney_hexagon-kit', 'kenney_nature-kit'],
  'City Builder / Sim': [
    'kenney_city-kit-commercial_2.1', 'kenney_city-kit-industrial_1.0',
    'kenney_city-kit-suburban_20', 'kenney_city-kit-roads', 'kenney_modular-buildings',
    'kenney_building-kit', 'kenney_brick-kit', 'kenney_factory-kit_3.0',
  ],
  'Space / Sci-Fi Shooter': [
    'kenney_space-kit', 'kenney_space-station-kit', 'kenney_modular-space-kit_1.0',
    'kenney_blaster-kit_2.1',
  ],
  'Survival / Crafting': ['kenney_survival-kit', 'kenney_nature-kit', 'kenney_food-kit'],
  'Pirate / Naval': ['kenney_pirate-kit', 'kenney_watercraft-pack'],
  'Spooky / Horror': ['kenney_graveyard-kit_5.0', 'kenney_holiday-kit'],
  'Sports / Mini-Games': [
    'kenney_minigolf-kit', 'kenney_mini-skate', 'kenney_mini-arena', 'kenney_mini-arcade',
  ],
  'Arena Shooter / Brawler': [
    'kenney_blaster-kit_2.1', 'kenney_mini-arena', 'kenney_blocky-characters_20',
  ],
  'Castle / Medieval': ['kenney_castle-kit', 'kenney_fantasy-town-kit_2.0', 'kenney_brick-kit'],
  'Trains / Transport': ['kenney_train-kit', 'kenney_toy-car-kit', 'kenney_3d-road-tiles'],
  'Cozy / Casual': [
    'kenney_furniture-kit', 'kenney_food-kit', 'kenney_mini-market',
    'kenney_cube-pets_1.0', 'kenney_holiday-kit',
  ],
  'Toy / Physics': ['kenney_marble-kit', 'kenney_toy-car-kit', 'kenney_coaster-kit'],
};

const toPosix = (p) => p.split(path.sep).join('/');

async function buildPack(category, packDir, packFolder) {
  const files = await walk(packDir);
  const previewsDir = path.join(packDir, 'Previews');
  const hasPreviewsDir = await exists(previewsDir);

  // Map basename -> per-asset preview (e.g. Previews/barrel.png).
  const previewByBase = new Map();
  if (hasPreviewsDir) {
    for (const f of files) {
      if (path.dirname(f) !== previewsDir) continue;
      if (path.extname(f).toLowerCase() !== '.png') continue;
      previewByBase.set(path.basename(f, path.extname(f)).toLowerCase(), f);
    }
  }

  const packPreview =
    (await exists(path.join(packDir, 'Preview.png')))
      ? path.join(packDir, 'Preview.png')
      : (await exists(path.join(packDir, 'Sample.png')))
      ? path.join(packDir, 'Sample.png')
      : null;
  const licenseFile = (await exists(path.join(packDir, 'License.txt')))
    ? path.join(packDir, 'License.txt')
    : null;

  const assets = [];
  const kindCounts = {};
  for (const f of files) {
    const dir = path.dirname(f);
    if (dir === previewsDir) continue; // preview thumbnails are not assets
    const ext = path.extname(f).toLowerCase();
    const base = path.basename(f);
    if (META_FILE.test(base)) continue;
    const kind = kindOf(ext);
    if (kind === 'other') continue;
    kindCounts[kind] = (kindCounts[kind] || 0) + 1;
    const stem = path.basename(f, path.extname(f)).toLowerCase();
    const preview = previewByBase.get(stem) || packPreview;
    assets.push({
      id: `${packFolder}/${path.basename(f)}`,
      name: path.basename(f),
      kind,
      ext,
      category,
      pack: packFolder,
      path: toPosix(path.relative(LIBRARY_ROOT, f)),
      preview: preview ? toPosix(path.relative(LIBRARY_ROOT, preview)) : null,
      tags: tokenize(path.basename(f)),
    });
  }

  return {
    folder: packFolder,
    name: prettyPack(packFolder),
    category,
    assetCount: assets.length,
    kindCounts,
    hasPerAssetPreviews: hasPreviewsDir,
    preview: packPreview ? toPosix(path.relative(LIBRARY_ROOT, packPreview)) : null,
    license: licenseFile ? toPosix(path.relative(LIBRARY_ROOT, licenseFile)) : null,
    assets,
  };
}

function kindBreakdown(kindCounts) {
  return Object.entries(kindCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${k}`)
    .join(', ');
}

function renderMarkdown(catalog) {
  const { libraryName, libraryRoot, generatedAt, categories, totals } = catalog;
  const lines = [];
  lines.push(`# ${libraryName.toUpperCase()} Asset Catalog`);
  lines.push('');
  lines.push('> Auto-generated — do **not** edit by hand.');
  lines.push(`> Regenerate with \`node tools/asset-library-index.mjs\` after adding/updating packs.`);
  lines.push('');
  lines.push(`- **Library root:** \`${libraryRoot}\``);
  lines.push(`- **Generated:** ${generatedAt}`);
  lines.push(
    `- **Totals:** ${totals.packs} packs, ${totals.assets} assets ` +
      `(${kindBreakdown(totals.kindCounts)})`,
  );
  lines.push('- **Search per-asset:** grep `tools/' + libraryName + '/' + libraryName + '-assets.tsv` (e.g. `barrel`, `footstep`, `button`).');
  lines.push('');

  // Theme map (ideation aid) — only existing packs.
  const byFolder = new Map();
  for (const cat of categories) for (const p of cat.packs) byFolder.set(p.folder, p);
  lines.push('## Game Theme → Packs');
  lines.push('');
  lines.push('Quick ideation map. Every game also uses UI + Audio packs (see below).');
  lines.push('');
  for (const [theme, folders] of Object.entries(THEME_MAP)) {
    const present = folders.filter((f) => byFolder.has(f)).map((f) => byFolder.get(f).name);
    if (present.length) lines.push(`- **${theme}:** ${present.join(', ')}`);
  }
  lines.push('');

  for (const cat of categories) {
    lines.push(`## ${cat.category}`);
    lines.push('');
    lines.push('| Pack | Folder | Assets | Breakdown | Preview |');
    lines.push('| --- | --- | --: | --- | --- |');
    for (const p of cat.packs) {
      const prev = p.preview ? `[img](file:///${libraryRoot}/${p.preview})` : '—';
      lines.push(
        `| ${p.name} | \`${p.folder}\` | ${p.assetCount} | ${kindBreakdown(p.kindCounts) || '—'} | ${prev} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  if (!(await exists(LIBRARY_ROOT))) {
    console.error(`Asset library not found: ${LIBRARY_ROOT}`);
    process.exit(1);
  }

  const categoryDirs = (await fs.readdir(LIBRARY_ROOT, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const categories = [];
  const totals = { packs: 0, assets: 0, kindCounts: {} };

  for (const category of categoryDirs) {
    const catDir = path.join(LIBRARY_ROOT, category);
    const packFolders = (await fs.readdir(catDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    const packs = [];
    for (const packFolder of packFolders) {
      const pack = await buildPack(category, path.join(catDir, packFolder), packFolder);
      packs.push(pack);
      totals.packs += 1;
      totals.assets += pack.assetCount;
      for (const [k, n] of Object.entries(pack.kindCounts)) {
        totals.kindCounts[k] = (totals.kindCounts[k] || 0) + n;
      }
    }
    categories.push({ category, packCount: packs.length, packs });
  }

  const generatedAt = new Date().toISOString();
  const catalog = {
    libraryName: LIBRARY_NAME,
    libraryRoot: toPosix(LIBRARY_ROOT),
    generatedAt,
    totals,
    categories,
  };

  // --- write JSON (full structured index) ---
  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify(catalog, null, 2), 'utf8');

  // --- write grep-friendly TSV (one asset per line) ---
  const tsvLines = ['path\tpack\tcategory\tkind\ttags'];
  for (const cat of categories) {
    for (const p of cat.packs) {
      for (const a of p.assets) {
        tsvLines.push(`${a.path}\t${a.pack}\t${a.category}\t${a.kind}\t${a.tags.join(' ')}`);
      }
    }
  }
  await fs.writeFile(OUT_TSV, tsvLines.join('\n') + '\n', 'utf8');

  // --- write human catalog ---
  await fs.mkdir(path.dirname(OUT_MD), { recursive: true });
  await fs.writeFile(OUT_MD, renderMarkdown(catalog) + '\n', 'utf8');

  console.log(`Indexed ${totals.packs} packs / ${totals.assets} assets from ${LIBRARY_ROOT}`);
  console.log(`  kinds: ${kindBreakdown(totals.kindCounts)}`);
  console.log(`  -> ${path.relative(repoRoot, OUT_JSON)}`);
  console.log(`  -> ${path.relative(repoRoot, OUT_TSV)}`);
  console.log(`  -> ${OUT_MD}`); // outside repoRoot (GameDesign) — log the absolute path
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
