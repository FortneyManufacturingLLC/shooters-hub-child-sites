import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditorService} from '../src/editor-service.mjs';

const site = {siteId: 'site', communityId: 'shooters-hub', seriesId: 'series', title: 'Site',
  canonicalOrigin: 'https://example.com', entityBaseOrigin: 'https://shootershub.net', themeId: 'classic'};
const authorization = 'Bearer private-bearer-token';
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
// Test-only serialized transactional adapter. Production supplies durable storage.
function fixture(overrides = {}) {
  let record = null, calls = [], actorId = 'editor-a', granted = true, queue = Promise.resolve();
  const store = {
    async read(id) { assert.equal(id, site.siteId); return structuredClone(record); },
    transact(id, callback) {
      assert.equal(id, site.siteId);
      const operation = queue.then(() => {
        const next = callback(freeze(structuredClone(record)));
        record = structuredClone(next.record);
        return structuredClone(next.result);
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
  const deps = {site, store, themeIds: ['classic', 'core'],
    authenticate: async token => { calls.push(['authenticate', token]); return {id: actorId, token}; },
    authorize: async (actor, action, scope) => { calls.push(['authorize', actor, action, scope.siteId]); return granted; }, ...overrides};
  return {service: createEditorService(deps), deps, calls, record: () => record,
    actor: id => { actorId = id; }, grant: value => { granted = value; }};
}
const body = (revision = 0, id = 'request_0001', config = {title: 'Draft'}, action = 'draft') =>
  ({config, expectedRevision: revision, requestId: id, action});
const save = (f, request = body()) => f.service.save({authorization, body: request});

test('no permissive dependencies; missing and rejected authentication never read or write storage', async () => {
  assert.throws(() => createEditorService({site}), /requires/);
  const f = fixture();
  for (const auth of [undefined, '', 'Basic abc', 'Bearer a b', 'Bearer\nsecret']) {
    assert.equal((await f.service.read({authorization: auth})).status, 401);
    assert.equal((await f.service.save({authorization: auth, body: body()})).status, 401);
  }
  assert.equal(f.calls.length, 0);
  assert.equal(f.record(), null);
  const invalid = fixture({authenticate: async () => { throw Error('private-bearer-token'); }});
  assert.deepEqual(await invalid.service.read({authorization}), {status: 401, data: {error: 'Authentication required'}});
});

test('authorization checked for each action and again for successful request retries', async () => {
  const f = fixture();
  assert.equal((await save(f)).status, 200);
  f.grant(false);
  assert.equal((await save(f)).status, 403);
  assert.equal((await f.service.read({authorization})).status, 403);
  assert.equal((await save(f, body(1, 'request_0002', {}, 'publish'))).status, 403);
  assert.equal(f.record().revision, 1);
  assert.deepEqual(f.calls.filter(call => call[0] === 'authorize').map(call => call[2]), ['draft', 'draft', 'read', 'publish']);
  assert.deepEqual(f.calls[1][1], {id: 'editor-a'});
});

test('draft and publish have separate state with one revision and optimistic conflicts', async () => {
  const f = fixture();
  const initial = await f.service.read({authorization});
  assert.equal(initial.data.revision, 0);
  const first = await save(f);
  assert.equal(first.data.draft.title, 'Draft');
  assert.equal(first.data.published.title, 'Site');
  assert.equal((await save(f, body(0, 'request_stale'))).status, 409);
  const published = await save(f, body(1, 'request_publish', {themeId: 'core'}, 'publish'));
  assert.equal(published.data.revision, 2);
  assert.equal(published.data.published.title, 'Draft');
  assert.equal(published.data.published.themeId, 'core');
  await save(f, body(2, 'request_0003', {title: 'Later draft'}));
  const read = await f.service.read({authorization});
  assert.equal(read.data.published.title, 'Draft');
  assert.equal(read.data.draft.title, 'Later draft');
  assert.equal(read.data.revision, 3);
  assert.equal(read.data.lastAudit.actorId, 'editor-a');
  assert.equal(read.data.lastAudit.action, 'draft');
  assert.ok(!Number.isNaN(Date.parse(read.data.lastAudit.at)));
});

test('idempotency binds actor and exact canonical request and returns original receipt', async () => {
  const f = fixture();
  const first = await save(f);
  await save(f, body(1, 'request_0002', {title: 'Next'}));
  assert.deepEqual(await save(f), first);
  assert.equal(f.record().revision, 2);
  assert.equal((await save(f, body(0, 'request_0001', {title: 'Changed'}))).status, 409);
  assert.equal((await save(f, body(0, 'request_0001', {title: 'Draft'}, 'publish'))).status, 409);
  f.actor('editor-b');
  assert.equal((await save(f)).status, 409);
  assert.equal(f.record().revision, 2);
});

test('atomic adapter serializes racing writers and returned configurations cannot mutate state', async () => {
  const f = fixture();
  const results = await Promise.all([save(f), save(f, body(0, 'request_racing'))]);
  assert.deepEqual(results.map(result => result.status), [200, 409]);
  results[0].data.draft.title = 'Mutated response';
  assert.equal((await f.service.read({authorization})).data.draft.title, 'Draft');
  assert.equal(site.title, 'Site');
});

test('scope, credentials, uninstalled themes and malformed commands fail without writes', async () => {
  const f = fixture();
  for (const config of [{seriesId: 'foreign'}, {siteId: 'site'}, {authorization},
    {themeTokens: {password: 'secret'}}, {themeId: 'uninstalled'}, {themeTokens: {accent: 'red;display:none'}}, null]) {
    assert.equal((await save(f, body(0, 'request_invalid', config))).status, 400);
  }
  for (const changes of [{requestId: '../outside'}, {expectedRevision: -1}, {expectedRevision: 0.5},
    {expectedRevision: Number.MAX_SAFE_INTEGER + 1}, {action: 'delete'}, {extra: true}]) {
    assert.equal((await save(f, {...body(), ...changes})).status, 400);
  }
  assert.equal(f.record(), null);
});

test('tokens and authentication details never enter records or errors; storage failures are generic', async () => {
  const f = fixture();
  await save(f);
  assert.doesNotMatch(JSON.stringify(f.record()), /private-bearer-token|authorization/);
  const unavailable = fixture({store: {read: async () => { throw Error('credentials private-bearer-token'); },
    transact: async () => { throw Error('credentials private-bearer-token'); }}});
  for (const response of [await unavailable.service.read({authorization}), await save(unavailable)]) {
    assert.deepEqual(response, {status: 503, data: {error: 'Editor unavailable'}});
  }
});

test('receipt history is bounded and canonical object key order permits a retry', async () => {
  const f = fixture();
  const request = body(0, 'request_order', {title: 'Ordered', themeLayout: {navigation: 'rail', density: 'compact'}});
  const first = await save(f, request);
  assert.deepEqual(await save(f, {...request, config: {themeLayout: {density: 'compact', navigation: 'rail'}, title: 'Ordered'}}), first);
  for (let index = 1; index < 70; index++) assert.equal((await save(f, body(index, `request_${index.toString().padStart(4, '0')}`))).status, 200);
  assert.equal(f.record().receipts.length, 64);
  assert.equal(f.record().revision, 70);
});

test('public published reads expose only deployment defaults or published configuration', async () => {
  const f = fixture();
  const initial = await f.service.readPublished();
  assert.equal(initial.status, 200);
  assert.equal(initial.data.config.title, 'Site');
  assert.equal(initial.data.revision, 0);
  assert.deepEqual(f.calls, []);
  await save(f, body(0, 'request_draft', {title: 'Private draft'}));
  const unpublished = await f.service.readPublished();
  assert.equal(unpublished.data.config.title, 'Site');
  assert.equal(unpublished.data.revision, 1);
  assert.deepEqual(Object.keys(unpublished.data).sort(), ['config', 'revision']);
  assert.doesNotMatch(JSON.stringify(unpublished), /Private draft|editor-a|request_draft|lastAudit|receipts/);
  await save(f, body(1, 'request_publish', {title: 'Public title'}, 'publish'));
  const published = await f.service.readPublished();
  assert.equal(published.data.config.title, 'Public title');
  published.data.config.title = 'Mutation';
  assert.equal((await f.service.readPublished()).data.config.title, 'Public title');
});

test('public published reads reject corrupted stored configuration without exposing it', async () => {
  const original = fixture();
  await save(original);
  for (const alter of [record => { record.published.seriesId = 'foreign'; },
    record => { record.published.themeId = 'uninstalled'; },
    record => { record.published.apiKey = 'private-secret'; },
    record => { record.revision = -1; }]) {
    const record = structuredClone(original.record());
    alter(record);
    const f = fixture({store: {read: async () => record, transact: async () => { throw Error('unused'); }}});
    assert.deepEqual(await f.service.readPublished(), {status: 503, data: {error: 'Editor unavailable'}});
    assert.deepEqual(f.calls, []);
  }
});
