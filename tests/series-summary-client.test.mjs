import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeriesSummaryClient } from '../src/series-summary-client.mjs';
import { renderSeriesSummary } from '../src/series-summary.mjs';
import { SERIES_SUMMARY_FIXTURE as fixture } from '../src/series-summary-fixtures.mjs';

const url = 'https://shootershub.net/api/entities/series/fixture-series/summary';
const scope = { seriesId: 'fixture-series', seriesSlug: 'fixture-series' };
const unavailable = { schemaVersion: 1, type: fixture.type, status: 'unavailable', series: null };
const withheld = { ...unavailable, status: 'withheld' };
function reply(dto = fixture, { status = 200, headers = {}, finalUrl = url, redirected = false, raw } = {}) {
  const response = new Response(raw ?? JSON.stringify(dto), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
  Object.defineProperty(response, 'url', { value: finalUrl });
  Object.defineProperty(response, 'redirected', { value: redirected });
  return response;
}
const client = fetchImpl => createSeriesSummaryClient({ ...scope, fetchImpl });

test('fixed parent/canonical route and actual validator/renderer; credential-free fetch policy', async () => {
  const calls = [];
  const config = { ...scope, fetchImpl: async (...args) => { calls.push(args); return reply(); } };
  const api = createSeriesSummaryClient(config);
  config.seriesSlug = 'mutated';
  const dto = await api.read();
  assert.deepEqual(dto, fixture);
  assert.notStrictEqual(dto, fixture);
  assert.match(renderSeriesSummary(dto), /Fixture rimfire series/);
  assert.equal(calls.length, 1);
  const [actualUrl, options] = calls[0];
  assert.equal(actualUrl, url);
  assert.deepEqual(Object.keys(options).sort(), ['cache', 'credentials', 'headers', 'method', 'mode', 'redirect', 'referrerPolicy', 'signal']);
  assert.deepEqual({ ...options, signal: undefined }, {
    method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    mode: 'cors', headers: { Accept: 'application/json' }, signal: undefined,
  });
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(Object.keys(api).join(','), 'read');
});

test('caller URL/query/headers/credentials cannot widen configuration or reads', async () => {
  for (const extra of [{ origin: 'https://evil.invalid' }, { url: 'https://evil.invalid' }, { headers: { Authorization: 'private' } }, { credentials: 'include' }, { query: 'page=2' }]) {
    assert.throws(() => createSeriesSummaryClient({ ...scope, fetchImpl: async () => reply(), ...extra }), /Unsupported/);
    await assert.rejects(client(async () => reply()).read(extra), /Unsupported/);
  }
  for (const malformed of [{ ...scope, seriesId: '../private' }, { ...scope, seriesSlug: '//evil.invalid' }, { ...scope, seriesId: 1 }, { ...scope, seriesSlug: '' }]) {
    assert.throws(() => createSeriesSummaryClient({ ...malformed, fetchImpl: async () => reply() }), /Canonical/);
  }
});

for (const status of ['published-empty', 'partial']) test(`${status} is valid, distinct from unavailable and uses existing presentation`, async () => {
  const dto = structuredClone(fixture); dto.status = status;
  if (status === 'published-empty') Object.assign(dto.series, { title: '', shortDescription: '', plainTextDescription: '' });
  const actual = await client(async () => reply(dto)).read();
  assert.deepEqual(actual, dto);
  assert.match(renderSeriesSummary(actual), status === 'published-empty' ? /No series description/ : /Some series information/);
});

for (const status of [400, 404]) test(`${status} withheld clears published content without stale fallback`, async () => {
  let result = reply(); let count = 0;
  const api = client(async () => { count++; return result; });
  assert.deepEqual(await api.read(), fixture);
  result = reply(withheld, { status });
  const next = await api.read();
  assert.deepEqual(next, withheld);
  assert.equal(renderSeriesSummary(next), '');
  assert.equal(count, 2);
});

test('503 unavailable and network failure do not retain content or private errors', async () => {
  let phase = 0;
  const api = client(async () => {
    if (phase++ === 0) return reply();
    if (phase === 2) return reply(unavailable, { status: 503 });
    throw Error('Bearer synthetic-secret at https://private.invalid');
  });
  assert.deepEqual(await api.read(), fixture);
  assert.deepEqual(await api.read(), unavailable);
  assert.deepEqual(await api.read(), unavailable);
});

for (const [name, response] of [
  ['redirected', () => reply(fixture, { redirected: true })],
  ['foreign final origin', () => reply(fixture, { finalUrl: 'https://evil.invalid/summary' })],
  ['wrong final path', () => reply(fixture, { finalUrl: url + '?foreign=1' })],
  ['missing response identity', () => reply(fixture, { finalUrl: '' })],
  ['cacheable proxy response', () => reply(fixture, { headers: { 'Cache-Control': 'public, max-age=60' } })],
  ['unsupported content type', () => reply(fixture, { headers: { 'Content-Type': 'text/html' } })],
  ['invalid JSON', () => reply(fixture, { raw: '{bad' })],
  ['private HTTP failure', () => reply({ secret: 'private' }, { status: 401 })],
  ['published under 404', () => reply(fixture, { status: 404 })],
  ['published under 503', () => reply(fixture, { status: 503 })],
  ['withheld under 200', () => reply(withheld)],
  ['unknown schema', () => reply({ ...fixture, schemaVersion: 2 })],
  ['extra public field', () => reply({ ...fixture, cursor: 'private' })],
  ['foreign series', () => reply({ ...fixture, series: { ...fixture.series, id: 'foreign' } })],
  ['untrusted canonical href', () => reply({ ...fixture, series: { ...fixture.series, canonicalHref: 'https://evil.invalid' } })],
  ['oversized content length', () => reply(fixture, { headers: { 'Content-Length': '16385' } })],
  ['malformed content length', () => reply(fixture, { headers: { 'Content-Length': '-1' } })],
]) test(`fail closed: ${name}`, async () => {
  const dto = await client(async () => response()).read();
  assert.deepEqual(dto, unavailable);
  assert.equal(renderSeriesSummary(dto), '');
});

test('streaming byte bound cancels oversized body without parsing or rendering it', async () => {
  let cancelled = 0;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(16_385)); },
    cancel() { cancelled++; },
  });
  const response = reply();
  Object.defineProperty(response, 'body', { value: body });
  assert.deepEqual(await client(async () => response).read(), unavailable);
  assert.equal(cancelled, 1);
});

test('valid split UTF8 stream is decoded once; malformed UTF8 is rejected', async () => {
  const dto = structuredClone(fixture); dto.series.title = 'Rimfire é';
  const bytes = new TextEncoder().encode(JSON.stringify(dto));
  const body = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } });
  const response = reply(); Object.defineProperty(response, 'body', { value: body });
  assert.deepEqual(await client(async () => response).read(), dto);
  const invalid = reply();
  Object.defineProperty(invalid, 'body', { value: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([0xff])); controller.close(); } }) });
  assert.deepEqual(await client(async () => invalid).read(), unavailable);
});

test('pre-abort makes no request; in-flight abort does not await non-cooperative fetch or reveal stale content', async () => {
  let calls = 0, resolveLate;
  const api = client(async () => {
    calls++;
    if (calls === 1) return reply();
    return new Promise(resolve => { resolveLate = resolve; });
  });
  assert.deepEqual(await api.read(), fixture);
  const before = new AbortController(); before.abort();
  assert.deepEqual(await api.read({ signal: before.signal }), unavailable);
  assert.equal(calls, 1);
  const current = new AbortController();
  const pending = api.read({ signal: current.signal });
  current.abort();
  assert.deepEqual(await pending, unavailable);
  resolveLate(reply());
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(api.read({ signal: {} }), /Invalid abort signal/);
});

test('malformed UTF8 cancels an otherwise open body instead of leaving a reader behind', async () => {
  let cancelled = 0;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([0xff])); },
    cancel() { cancelled++; },
  });
  const response = reply(); Object.defineProperty(response, 'body', { value: body });
  assert.deepEqual(await client(async () => response).read(), unavailable);
  assert.equal(cancelled, 1);
});

test('finite eight-second deadline works even if injected fetch ignores its signal', async t => {
  // Real adapter timeout branch; only clock progression is controlled, no network or server.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const pending = client(() => new Promise(() => {})).read();
    t.mock.timers.tick(8_000);
    assert.deepEqual(await pending, unavailable);
  } finally { t.mock.timers.reset(); }
});

test('aborting body read cancels its stream and returns no partial DTO', async () => {
  let cancelled = 0, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const body = new ReadableStream({ pull() { entered(); }, cancel() { cancelled++; } });
  const response = reply(); Object.defineProperty(response, 'body', { value: body });
  const aborter = new AbortController();
  const pending = client(async () => response).read({ signal: aborter.signal });
  await ready;
  // Let the actual adapter install the body cancellation listener before abort.
  await new Promise(resolve => setImmediate(resolve));
  aborter.abort();
  assert.deepEqual(await pending, unavailable);
  assert.equal(cancelled, 1);
});

for (const [name, options] of [
  ['invalid headers', { headers: { 'Cache-Control': 'public, max-age=60' } }],
  ['invalid media', { headers: { 'Content-Type': 'text/html' } }],
  ['declared oversize', { headers: { 'Content-Length': '16385' } }],
]) test(`rejected ${name} cancels non-cooperative returned body before acquiring reader`, async () => {
  let cancelled = 0;
  const body = new ReadableStream({ cancel() { cancelled++; } });
  const response = reply(fixture, options); Object.defineProperty(response, 'body', { value: body });
  assert.deepEqual(await client(async () => response).read(), unavailable);
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
});

test('response arriving after deadline has its non-cooperative body cancelled without exposing content', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolveLate, cancelled = 0;
  const body = new ReadableStream({ cancel() { cancelled++; } });
  const response = reply(); Object.defineProperty(response, 'body', { value: body });
  try {
    const pending = client(() => new Promise(resolve => { resolveLate = resolve; })).read();
    t.mock.timers.tick(8_000);
    assert.deepEqual(await pending, unavailable);
    resolveLate(response);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(cancelled, 1);
    assert.equal(body.locked, false);
  } finally { t.mock.timers.reset(); }
});

test('response arriving after external abort also cancels its non-cooperative open body', async () => {
  let resolveLate, cancelled = 0;
  const body = new ReadableStream({ cancel() { cancelled++; } });
  const response = reply(); Object.defineProperty(response, 'body', { value: body });
  const aborter = new AbortController();
  const pending = client(() => new Promise(resolve => { resolveLate = resolve; })).read({ signal: aborter.signal });
  aborter.abort();
  assert.deepEqual(await pending, unavailable);
  resolveLate(response);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
});

for (const mode of ['pending', 'reject']) test(`response cancellation ${mode} cannot delay or escape the public read`, async () => {
  let cancelled = 0;
  const body = new ReadableStream({ cancel() {
    cancelled++;
    return mode === 'pending' ? new Promise(() => {}) : Promise.reject(Error('synthetic-private-cleanup-error'));
  } });
  const response = reply(fixture, { status: 401 }); Object.defineProperty(response, 'body', { value: body });
  const result = await Promise.race([
    client(async () => response).read(),
    new Promise(resolve => setImmediate(() => resolve('unbounded-cleanup-wait'))),
  ]);
  assert.deepEqual(result, unavailable);
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
});
