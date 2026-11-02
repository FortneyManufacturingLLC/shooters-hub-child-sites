import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const packer = path.join(root, 'scripts/pack-series-summary.mjs');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const legacyHash = '051e743c3b21cb05728434493daedf5fd070ee24c125289cd724fe99b985199f';
const oldNames = ['package/package.json', 'package/src/series-summary.mjs', 'package/src/series-summary-fixtures.mjs',
  'package/src/series-summary.d.ts', 'package/src/series-summary-fixtures.d.ts', 'package/LICENSE', 'package/series-summary-provenance.json'];
const clientNames = [...oldNames, 'package/src/series-summary-client.mjs', 'package/src/series-summary-client.d.ts'];
function pack(output, client = false, extra = []) {
  const result = spawnSync(process.execPath, [packer, output, ...(client ? ['--client'] : []), ...extra], {
    cwd: root, encoding: 'utf8', maxBuffer: 256_000,
    env: { ...process.env, CP01_SOURCE_BASE: '13a1079b728f862bda8980abb85e74f008c5b4ab', CP07B_SOURCE_BASE: '886dc63d7ccefddece57edceb2460322e0610aa5' },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
function entries(archive, allowed) {
  const tar = gunzipSync(archive), files = new Map();
  assert.ok(tar.length < 1_000_000);
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const text = (start, end) => header.subarray(start, end).toString('utf8').replace(/\0.*$/s, '').trim();
    const name = text(0, 100), size = parseInt(text(124, 136), 8);
    assert.ok(allowed.includes(name), `Unexpected entry ${name}`);
    assert.ok(!files.has(name) && !name.includes('..') && !name.includes('\\'));
    assert.equal(header[156], 48, 'Only regular files, never symlinks or directories');
    assert.ok(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= tar.length);
    const checksum = parseInt(text(148, 156), 8);
    assert.equal(header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0), checksum);
    files.set(name, tar.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  assert.deepEqual([...files.keys()].sort(), [...allowed].sort());
  return files;
}

test('typed subpath uses package self-reference; source version and old entrypoints stay unchanged (not semantic tsc)', async () => {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '0.1.0');
  assert.deepEqual(pkg.exports['./series-summary/client'], { types: './src/series-summary-client.d.ts', import: './src/series-summary-client.mjs' });
  assert.deepEqual(pkg.exports['./series-summary'], { types: './src/series-summary.d.ts', import: './src/series-summary.mjs' });
  const declarations = await readFile(path.join(root, 'src/series-summary-client.d.ts'), 'utf8');
  assert.match(declarations, /import type \{ SeriesSummary \} from '@competition-hub\/child-sites\/series-summary'/);
  assert.doesNotMatch(declarations, /from ['"][^'"]+\.mjs['"]/);
  assert.match(declarations, /Promise<SeriesSummary>/);
});

test('old default archive is exact051e; explicit client mode is deterministic, isolated and preserves it', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'cp07b-package-'));
  try {
    const legacy = pack(temporary);
    const legacyBytes = await readFile(legacy.archivePath);
    assert.equal(legacyBytes[9], 10, 'Frozen gzip OS metadata must be independent of the build host');
    assert.equal(digest(legacyBytes), legacyHash);
    const old = entries(legacyBytes, oldNames);
    const first = pack(temporary, true), second = pack(temporary, true);
    assert.equal(first.sha256, second.sha256);
    assert.notEqual(first.archivePath, legacy.archivePath);
    assert.match(path.basename(first.archivePath), /^competition-hub-child-sites-series-summary-client-[a-f0-9]{20}\.tgz$/);
    const archive = await readFile(first.archivePath);
    assert.equal(digest(archive), first.sha256);
    assert.equal(digest(await readFile(legacy.archivePath)), legacyHash);
    const files = entries(archive, clientNames);
    const pkg = JSON.parse(files.get('package/package.json'));
    assert.equal(pkg.version, '0.1.0-cp07b.0');
    assert.deepEqual(Object.keys(pkg.exports).sort(), ['./series-summary', './series-summary/client', './series-summary/fixtures']);
    for (const key of ['scripts', 'dependencies', 'devDependencies']) assert.equal(pkg[key], undefined);
    for (const name of oldNames.filter(name => !name.endsWith('package.json') && !name.endsWith('provenance.json'))) {
      assert.deepEqual(files.get(name), old.get(name), `Existing bytes changed: ${name}`);
    }
    assert.equal(digest(files.get('package/src/series-summary.mjs')), '917624be08fcf2a061b40be98643845a78a879ced34c0be2bfb1abb0bed9f6f6');
    assert.equal(digest(files.get('package/src/series-summary-fixtures.d.ts')), '1c7a903be3b7ad01c632622fed0693843bafe282d8b9d6fe9c2339d71b894d96');
    const provenance = JSON.parse(files.get('package/series-summary-provenance.json'));
    assert.equal(provenance.sourceBase, '886dc63d7ccefddece57edceb2460322e0610aa5');
    assert.equal(provenance.sourceState, 'local-uncommitted-cp07b-client');
    for (const [name, sha] of Object.entries(provenance.files)) assert.equal(digest(files.get(name)), sha);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('isolated extracted archive bare imports actual client/fixtures/renderer, with injected offline fetch only', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'cp07b-import-'));
  try {
    const packed = pack(path.join(temporary, 'artifacts'), true);
    const files = entries(await readFile(packed.archivePath), clientNames);
    const packageRoot = path.join(temporary, 'node_modules/@competition-hub/child-sites');
    for (const [name, bytes] of files) {
      const target = path.join(packageRoot, name.slice('package/'.length));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: 'wx' });
    }
    const script = `
      import assert from 'node:assert/strict';
      import {createSeriesSummaryClient} from '@competition-hub/child-sites/series-summary/client';
      import {renderSeriesSummary} from '@competition-hub/child-sites/series-summary';
      import {SERIES_SUMMARY_FIXTURE as fixture} from '@competition-hub/child-sites/series-summary/fixtures';
      globalThis.fetch=()=>{throw Error('Live network forbidden');};
      let calls=0;
      const client=createSeriesSummaryClient({seriesId:fixture.series.id,seriesSlug:fixture.series.slug,fetchImpl:async(url,options)=>{
        assert.equal(url,'https://shootershub.net/api/entities/series/fixture-series/summary');
        assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
        const body=calls++===0?fixture:{schemaVersion:1,type:fixture.type,status:'withheld',series:null};
        const response=new Response(JSON.stringify(body),{status:calls===1?200:404,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
        Object.defineProperty(response,'url',{value:url});return response;
      }});
      assert.deepEqual(await client.read(),fixture);
      assert.match(renderSeriesSummary(fixture),/Fixture rimfire series/);
      const withdrawn=await client.read();assert.equal(withdrawn.series,null);assert.equal(renderSeriesSummary(withdrawn),'');
      assert.equal(calls,2);console.log('isolated-bare-import-and-withdrawal-pass');
    `;
    const actual = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: temporary, encoding: 'utf8', maxBuffer: 64_000,
    });
    assert.equal(actual.status, 0, actual.stderr);
    assert.match(actual.stdout, /isolated-bare-import-and-withdrawal-pass/);
    // No TypeScript executable is invoked: self-reference shape is not semantic proof.
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('unsupported pack mode fails before creating an artifact', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'cp07b-pack-mode-'));
  try {
    const actual = spawnSync(process.execPath, [packer, path.join(temporary, 'unused'), '--unknown'], { encoding: 'utf8', maxBuffer: 16_000 });
    assert.notEqual(actual.status, 0);
    assert.match(actual.stderr, /Only optional --client mode/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
