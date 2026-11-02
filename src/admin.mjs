import {validateSite} from './contracts.mjs';
import {resolveThemes} from './themes.mjs';

export const ADMIN_DRAFT_FIELDS = Object.freeze(['title', 'timeZone', 'brand', 'themeTokens', 'homePage', 'themeLayout', 'themeId']);
const immutable = new Set(['siteId', 'communityId', 'seriesId', 'canonicalOrigin', 'entityBaseOrigin']);
const sensitiveKey = /^(?:api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret|secret|password|credentials?|authorization|auth|cookie|session)$/i;

function record(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw Error(`${field} must be a JSON object`);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor)) {
      throw Error(`${field} must contain only JSON properties`);
    }
  }
  return value;
}

/** Validate a local presentation draft. This function grants no server permissions. */
export function validateAdminDraft(base, patch) {
  const site = validateSite(base);
  record(patch, 'Draft');
  for (const key of Object.keys(patch)) {
    if (immutable.has(key)) throw Error(`${key} is fixed by the site deployment and cannot be edited`);
    if (!ADMIN_DRAFT_FIELDS.includes(key)) throw Error(`Unknown draft field: ${key}; credentials and policies are not editable`);
  }
  const candidate = {...site};
  if (Object.hasOwn(patch, 'title')) {
    if (typeof patch.title !== 'string' || !patch.title.trim()) throw Error('title must be a non-empty string');
    candidate.title = patch.title;
  }
  if (Object.hasOwn(patch, 'timeZone')) {
    if (typeof patch.timeZone !== 'string' || !patch.timeZone.trim()) throw Error('timeZone must be a valid IANA time zone');
    try { new Intl.DateTimeFormat('en-US', {timeZone: patch.timeZone}); }
    catch { throw Error('timeZone must be a valid IANA time zone'); }
    candidate.timeZone = patch.timeZone;
  }
  if (Object.hasOwn(patch, 'brand')) {
    record(patch.brand, 'brand');
    for (const [key, value] of Object.entries(patch.brand)) {
      if (!['logoPath', 'heroPath'].includes(key)) throw Error(`Unknown brand field: ${key}`);
      if (typeof value !== 'string' || !/^\/assets\/[a-zA-Z0-9_./-]+$/.test(value) || value.includes('..')) {
        throw Error(`brand.${key} must be a local /assets/ path without traversal`);
      }
    }
    candidate.brand = {...patch.brand};
  }
  if (Object.hasOwn(patch, 'themeTokens')) {
    record(patch.themeTokens, 'themeTokens');
    for (const [key, value] of Object.entries(patch.themeTokens)) {
      if (sensitiveKey.test(key)) throw Error(`themeTokens.${key} is a credential field, not a presentation token`);
      try { resolveThemes([], {[key]: value}); }
      catch { throw Error(`themeTokens.${key} must be a safe CSS token value`); }
    }
    candidate.themeTokens = {...patch.themeTokens};
  }
  for (const key of ['homePage','themeLayout','themeId']) if(Object.hasOwn(patch,key)) candidate[key]=patch[key];
  const validated = validateSite(candidate);
  return {...validated, brand: {...validated.brand}, themeTokens: {...validated.themeTokens}};
}
