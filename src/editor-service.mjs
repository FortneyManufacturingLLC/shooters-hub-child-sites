import {createHash} from 'node:crypto';
import {validateAdminDraft} from './admin.mjs';

const RECEIPT_LIMIT = 64;
const reply = (status, error) => ({status, data: {error}});
const clone = value => structuredClone(value);
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  return Reflect.ownKeys(value).every(key => typeof key === 'string' &&
    Object.getOwnPropertyDescriptor(value, key).enumerable &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

/**
 * Server-side editor authority. authenticate(token) verifies a bearer and returns
 * {id}; authorize({id}, action, site) must return true to grant access.
 * store.read(siteId) returns a record or null. store.transact(siteId, callback)
 * MUST atomically run/retry callback(current) and commit its returned record,
 * returning its result. The callback treats current as immutable. Store adapters
 * provide durability and cross-process atomicity; this module supplies neither.
 */
export function createEditorService({site, authenticate, authorize, store, themeIds} = {}) {
  // A broken deployment fails at construction, never falls back to open access.
  if (typeof authenticate !== 'function' || typeof authorize !== 'function' ||
      typeof store?.read !== 'function' || typeof store?.transact !== 'function' ||
      !Array.isArray(themeIds) || themeIds.some(id => typeof id !== 'string')) {
    throw new TypeError('Editor requires authentication, authorization, atomic storage and installed themes');
  }
  const deployed = freeze(clone(validateAdminDraft(site, {})));
  const installed = new Set(themeIds);
  if (deployed.themeId && !installed.has(deployed.themeId)) throw new TypeError('Deployment theme is not installed');
  const scope = ['siteId', 'communityId', 'seriesId', 'canonicalOrigin', 'entityBaseOrigin'];
  function configuration(value) {
    if (!plain(value) || scope.some(key => value[key] !== deployed[key])) throw Error('Invalid stored scope');
    const validated = validateAdminDraft(value, {});
    if (validated.themeId && !installed.has(validated.themeId)) throw Error('Uninstalled theme');
    return clone(validated);
  }
  function state(value) {
    if (value == null) return {draft: clone(deployed), published: clone(deployed), revision: 0, receipts: [], lastAudit: null};
    if (!Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.receipts)) throw Error('Invalid stored record');
    return {...clone(value), draft: configuration(value.draft), published: configuration(value.published)};
  }
  const view = record => ({draft: clone(record.draft), published: clone(record.published), revision: record.revision,
    lastAudit: record.lastAudit ? {actorId: record.lastAudit.actorId, action: record.lastAudit.action, at: record.lastAudit.at} : null});
  async function permission(authorization, action) {
    if (typeof authorization !== 'string' || !/^Bearer [^\s]+$/i.test(authorization)) return {failure: reply(401, 'Authentication required')};
    let actor;
    try { actor = await authenticate(authorization.slice(7)); }
    catch { return {failure: reply(401, 'Authentication required')}; }
    if (!actor || typeof actor.id !== 'string' || !actor.id.trim() || actor.id.length > 256) return {failure: reply(401, 'Authentication required')};
    actor = freeze({id: actor.id});
    try {
      if (await authorize(actor, action, deployed) !== true) return {failure: reply(403, 'Access denied')};
    } catch { return {failure: reply(503, 'Editor unavailable')}; }
    return {actor};
  }
  return Object.freeze({
    async readPublished() {
      try {
        const record = state(await store.read(deployed.siteId));
        return {status: 200, data: {config: clone(record.published), revision: record.revision}};
      } catch { return reply(503, 'Editor unavailable'); }
    },
    async read({authorization} = {}) {
      const access = await permission(authorization, 'read');
      if (access.failure) return access.failure;
      try { return {status: 200, data: view(state(await store.read(deployed.siteId)))}; }
      catch { return reply(503, 'Editor unavailable'); }
    },
    async save({authorization, body} = {}) {
      const action = plain(body) && ['draft', 'publish'].includes(body.action) ? body.action : 'draft';
      const access = await permission(authorization, action);
      if (access.failure) return access.failure;
      let request;
      try {
        if (!plain(body) || Object.keys(body).some(key => !['config', 'expectedRevision', 'requestId', 'action'].includes(key)) ||
            !['draft', 'publish'].includes(body.action) || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 ||
            typeof body.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(body.requestId)) throw Error('Invalid request');
        // Validate against deployment before entering the storage transaction.
        const validated = validateAdminDraft(deployed, body.config);
        if (validated.themeId && !installed.has(validated.themeId)) throw Error('Uninstalled theme');
        request = {action: body.action, expectedRevision: body.expectedRevision, requestId: body.requestId, config: clone(body.config)};
      } catch { return reply(400, 'Invalid editor request'); }
      const fingerprint = createHash('sha256').update(canonical(request)).digest('hex');
      const at = new Date().toISOString();
      try {
        return await store.transact(deployed.siteId, current => {
          const record = state(current);
          const existing = record.receipts.find(receipt => receipt.requestId === request.requestId);
          if (existing) {
            const result = existing.actorId === access.actor.id && existing.fingerprint === fingerprint
              ? clone(existing.result) : reply(409, 'Request ID already used');
            return {record: current, result};
          }
          if (record.revision !== request.expectedRevision) return {record: current, result: reply(409, 'Revision conflict')};
          if (record.revision === Number.MAX_SAFE_INTEGER) throw Error('Revision exhausted');
          const candidate = validateAdminDraft(record.draft, request.config);
          if (candidate.themeId && !installed.has(candidate.themeId)) throw Error('Uninstalled theme');
          record.draft = clone(candidate);
          if (request.action === 'publish') record.published = clone(candidate);
          record.revision++;
          record.lastAudit = {actorId: access.actor.id, action: request.action, at};
          const result = {status: 200, data: view(record)};
          // Receipts contain no authorization headers or bearer tokens. Retain a
          // bounded retry window; expired IDs still face revision concurrency.
          record.receipts = [...record.receipts.slice(-(RECEIPT_LIMIT - 1)),
            {requestId: request.requestId, actorId: access.actor.id, fingerprint, result: clone(result)}];
          return {record, result};
        });
      } catch { return reply(503, 'Editor unavailable'); }
    },
  });
}
