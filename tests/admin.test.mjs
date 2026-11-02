import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAdminDraft, ADMIN_DRAFT_FIELDS} from '../src/admin.mjs';
import {validateSite} from '../src/contracts.mjs';

const base = {
  siteId: 'my-series-site', communityId: 'shooters-hub', seriesId: 'AbC123_X',
  title: 'My Series', canonicalOrigin: 'https://example.com',
  entityBaseOrigin: 'https://shootershub.net', timeZone: 'America/Chicago',
  brand: {logoPath: '/assets/logo.svg'}, themeTokens: {accent: '#ed6a00'},
};

test('draft exports a complete validated site and cannot mutate the input configuration', () => {
  const before = structuredClone(base);
  const patch = {title: 'Summer Series', timeZone: 'America/New_York', brand: {heroPath: '/assets/hero.webp'}, themeTokens: {accent: '#aabbcc'}};
  const draft = validateAdminDraft(base, patch);
  assert.deepEqual(validateSite(draft), draft);
  for (const key of ['siteId', 'communityId', 'seriesId', 'canonicalOrigin', 'entityBaseOrigin']) assert.equal(draft[key], base[key]);
  assert.equal(draft.title, patch.title);
  assert.equal(draft.timeZone, patch.timeZone);
  assert.deepEqual(draft.brand, patch.brand);
  assert.deepEqual(draft.themeTokens, patch.themeTokens);
  draft.brand.heroPath = '/assets/changed.webp';
  draft.themeTokens.accent = '#ffffff';
  assert.deepEqual(base, before);
  assert.equal(patch.brand.heroPath, '/assets/hero.webp');
  assert.equal(patch.themeTokens.accent, '#aabbcc');
  const empty = validateAdminDraft(base, {});
  empty.brand.logoPath = '/assets/other.svg';
  assert.deepEqual(base, before);
});

test('all scope identifiers and origins are immutable, even for same-value patches', () => {
  for (const key of ['siteId', 'communityId', 'seriesId', 'canonicalOrigin', 'entityBaseOrigin']) {
    for (const value of [base[key], 'foreign']) assert.throws(() => validateAdminDraft(base, {[key]: value}), /fixed by the site deployment/);
  }
});

test('drafts reject unknown fields, permission claims, credentials and malformed objects', () => {
  assert.deepEqual(ADMIN_DRAFT_FIELDS, ['title', 'timeZone', 'brand', 'themeTokens']);
  for (const field of ['apiKey', 'password', 'admin', 'roles', 'permissions', 'provider', '__proto__']) {
    assert.throws(() => validateAdminDraft(base, JSON.parse(`{"${field}":"secret"}`)), /Unknown draft field/);
  }
  for (const value of [null, [], 'draft', 5]) assert.throws(() => validateAdminDraft(base, value), /JSON object/);
  for (const field of ['brand', 'themeTokens']) {
    for (const value of [null, [], 'draft', 5]) assert.throws(() => validateAdminDraft(base, {[field]: value}), /JSON object/);
  }
  assert.throws(() => validateAdminDraft(base, {brand: {apiKey: 'secret'}}), /Unknown brand field/);
  for (const key of ['password', 'api-key', 'access-token', 'client-secret', 'authorization']) {
    assert.throws(() => validateAdminDraft(base, {themeTokens: {[key]: 'red'}}), /credential field/);
  }
  let accessed = false;
  const patch = Object.defineProperty({}, 'title', {enumerable: true, get() { accessed = true; return 'Injected'; }});
  assert.throws(() => validateAdminDraft(base, patch), /JSON properties/);
  assert.equal(accessed, false);
});

test('CSS token injection, invalid dates and unsafe asset references fail with field context', () => {
  for (const value of ['red; color:blue', 'url(https://evil.invalid)', '</style>', 'expression(alert(1))', '@import evil', null]) {
    assert.throws(() => validateAdminDraft(base, {themeTokens: {accent: value}}), /themeTokens.accent/);
  }
  for (const value of ['not-a-zone', '', null, 5]) assert.throws(() => validateAdminDraft(base, {timeZone: value}), /timeZone/);
  for (const value of ['', '  ', null, 5]) assert.throws(() => validateAdminDraft(base, {title: value}), /title/);
  for (const value of ['/assets/../secret', '/assets/%2e%2e/secret', 'https://evil.invalid/a.png', '//evil.invalid/a.png', '/assets/a.svg?secret=1', '/assets/a\\b.svg']) {
    assert.throws(() => validateAdminDraft(base, {brand: {logoPath: value}}), /brand.logoPath/);
  }
});

test('invalid deployment configuration is rejected before producing an export', () => {
  assert.throws(() => validateAdminDraft({...base, apiKey: 'secret'}, {}), /Unknown site configuration field/);
  assert.throws(() => validateAdminDraft({...base, canonicalOrigin: 'https://user:pass@example.com'}, {}), /credential-free/);
});
