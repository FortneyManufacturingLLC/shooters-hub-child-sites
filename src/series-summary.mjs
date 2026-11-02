/** Portable public projection only. Parent services enforce publication authority. */
export const SERIES_SUMMARY_TYPE = 'competition.series-summary';
export const SERIES_SUMMARY_RENDERER_VERSION = '1.0.0';
const identity = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/;
const readable = new Set(['published', 'published-empty', 'partial']);
const statuses = new Set([...readable, 'withheld', 'unavailable']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function exact(value, keys) {
  if (!object(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) throw Error('Invalid series summary shape');
}
const envelopeKeys = ['schemaVersion', 'type', 'status', 'series'];
const seriesKeys = ['id', 'slug', 'title', 'shortDescription', 'plainTextDescription', 'canonicalHref'];
const plain = (value, limit) => typeof value === 'string' && value.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
export function validateSeriesSummary(input, scope = {}) {
  exact(input, envelopeKeys);
  if (input.schemaVersion !== 1 || input.type !== SERIES_SUMMARY_TYPE || !statuses.has(input.status)) throw Error('Unsupported series summary');
  if (!readable.has(input.status)) {
    if (input.series !== null) throw Error('Withheld summaries must contain no content');
    return {schemaVersion:1, type:SERIES_SUMMARY_TYPE, status:input.status, series:null};
  }
  exact(input.series, seriesKeys);
  const s = input.series;
  if (typeof s.id !== 'string' || typeof s.slug !== 'string' || !identity.test(s.id) || !identity.test(s.slug) ||
      !plain(s.title,160) || !plain(s.shortDescription,320) || !plain(s.plainTextDescription,2000) ||
      s.canonicalHref !== `https://shootershub.net/en-us/series/${encodeURIComponent(s.slug)}` ||
      scope.seriesId !== undefined && s.id !== scope.seriesId || scope.seriesSlug !== undefined && s.slug !== scope.seriesSlug) throw Error('Invalid or foreign series summary');
  const hasContent = Boolean(s.title || s.shortDescription || s.plainTextDescription);
  if (input.status === 'published-empty' && hasContent || input.status === 'published' && !hasContent) throw Error('Inconsistent summary status');
  return {schemaVersion:1, type:SERIES_SUMMARY_TYPE, status:input.status, series:{...s}};
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
/** Deterministic HTML for both hosts; all DTO text is escaped, never interpreted. */
export function renderSeriesSummary(input, {headingLevel = 2, instanceId = 'series-summary'} = {}) {
  const value = validateSeriesSummary(input);
  if (!Number.isInteger(headingLevel) || headingLevel < 1 || headingLevel > 6 || !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(instanceId)) throw Error('Invalid summary presentation');
  if (!readable.has(value.status)) return '';
  const s = value.series, title = s.title || 'Series information';
  return `<section class="competition-series-summary" data-block-type="${SERIES_SUMMARY_TYPE}" data-summary-status="${value.status}" aria-labelledby="${instanceId}-title"><h${headingLevel} id="${instanceId}-title">${escape(title)}</h${headingLevel}>${s.shortDescription ? `<p>${escape(s.shortDescription)}</p>` : ''}${s.plainTextDescription ? `<p class="competition-series-summary__description">${escape(s.plainTextDescription).replace(/\r?\n/g,'<br>')}</p>` : ''}${value.status === 'published-empty' ? '<p>No series description has been published yet.</p>' : ''}${value.status === 'partial' ? '<p role="status">Some series information is unavailable.</p>' : ''}<a href="${escape(s.canonicalHref)}">Series information on Shooters Hub</a></section>`;
}

/** Local contract fixture only; this does not choose or activate a live release. */
export function validateSeriesSummaryRelease(input, {servedReleaseId, rollback = false} = {}) {
  exact(input, ['schemaVersion','type','releaseId','channel','public','artifact','hosts','previouslyJointlyCompatible']);
  if (input.schemaVersion !== 1 || input.type !== SERIES_SUMMARY_TYPE + '.release' || typeof input.releaseId !== 'string' || !identity.test(input.releaseId) || input.channel !== 'production' || input.public !== true) throw Error('Not a public production summary release');
  exact(input.artifact, ['sha256','export','schemaVersion','rendererVersion']);
  const a = input.artifact;
  if (!/^[a-f0-9]{64}$/.test(a.sha256) || a.export !== './series-summary' || a.schemaVersion !== 1 || a.rendererVersion !== SERIES_SUMMARY_RENDERER_VERSION) throw Error('Incompatible summary artifact');
  exact(input.hosts,['parent','child']);
  for (const host of ['parent','child']) {
    const ack = input.hosts[host];
    exact(ack,['releaseId','artifactSha256','schemaVersion','rendererVersion']);
    if (ack.releaseId !== input.releaseId || ack.artifactSha256 !== a.sha256 || ack.schemaVersion !== a.schemaVersion || ack.rendererVersion !== a.rendererVersion) throw Error('Both hosts must acknowledge the same release');
  }
  if (typeof input.previouslyJointlyCompatible !== 'boolean' || rollback && !input.previouslyJointlyCompatible || servedReleaseId !== undefined && servedReleaseId !== input.releaseId) throw Error('Summary release drift or unsafe rollback');
  return structuredClone(input);
}
