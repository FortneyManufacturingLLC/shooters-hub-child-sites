import { validateSeriesSummary } from './series-summary.mjs';

// Source-first CP07b adapter. Not exported, selected or mounted by an existing host yet.
const PARENT = 'https://shootershub.net';
const MAX_BYTES = 16_384;
const TIMEOUT_MS = 8_000;
const identity = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/;
const unavailable = () => ({ schemaVersion: 1, type: 'competition.series-summary', status: 'unavailable', series: null });
function exactOptions(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key))) throw new TypeError('Unsupported public summary options');
}

function discardResponseBody(response) {
  // Rejection can happen before a reader exists, or after fetch resolves late.
  // Cancellation is best-effort and must not extend the caller's deadline.
  try {
    const body = response?.body;
    if (body && !body.locked) Promise.resolve(body.cancel()).catch(() => {});
  } catch { /* No transport cleanup error crosses the public boundary. */ }
}

async function boundedJSON(response, signal) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) throw Error('Invalid summary size');
  if (!response.body || typeof response.body.getReader !== 'function') throw Error('Missing summary body');
  const reader = response.body.getReader();
  const cancel = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, text = '';
  try {
    if (signal.aborted) throw Error('Aborted');
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw Error('Aborted');
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { cancel(); throw Error('Summary too large'); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    // Decoder/read failures can precede EOF; cancel before releasing the lock.
    cancel();
    throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

/** Deployment-owned canonical identity, not URL/query/user headers. No DTO cache. */
export function createSeriesSummaryClient(options) {
  exactOptions(options, ['seriesId', 'seriesSlug', 'fetchImpl']);
  const { seriesId, seriesSlug, fetchImpl = globalThis.fetch } = options;
  if (typeof seriesId !== 'string' || typeof seriesSlug !== 'string' ||
      !identity.test(seriesId) || !identity.test(seriesSlug) || typeof fetchImpl !== 'function') {
    throw new TypeError('Canonical public series identity and fetch are required');
  }
  const scope = Object.freeze({ seriesId, seriesSlug });
  const url = `${PARENT}/api/entities/series/${encodeURIComponent(seriesSlug)}/summary`;
  return Object.freeze({
    async read(readOptions = {}) {
      exactOptions(readOptions, ['signal']);
      const externalSignal = readOptions.signal;
      if (externalSignal !== undefined && !(externalSignal instanceof AbortSignal)) throw new TypeError('Invalid abort signal');
      if (externalSignal?.aborted) return unavailable();
      const controller = new AbortController();
      const abort = () => controller.abort();
      externalSignal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, TIMEOUT_MS);
      let onAbort;
      const aborted = new Promise((_, reject) => {
        onAbort = () => reject(Error('Summary read interrupted'));
        controller.signal.addEventListener('abort', onAbort, { once: true });
      });
      try {
        const operation = (async () => {
          const response = await fetchImpl(url, {
            method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
            referrerPolicy: 'no-referrer', mode: 'cors',
            headers: { Accept: 'application/json' }, signal: controller.signal,
          });
          try {
            if (controller.signal.aborted || response.redirected || response.url !== url ||
                ![200, 400, 404, 503].includes(response.status) ||
                !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control') || '') ||
                !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw Error('Invalid public summary response');
            const dto = validateSeriesSummary(await boundedJSON(response, controller.signal), scope);
            const readable = ['published', 'published-empty', 'partial'].includes(dto.status);
            if (response.status === 200 ? !readable : response.status === 503 ? dto.status !== 'unavailable' : dto.status !== 'withheld') {
              throw Error('Inconsistent public summary status');
            }
            return dto;
          } finally {
            discardResponseBody(response);
          }
        })();
        // Even a non-cooperative injected fetch cannot make the public call wait forever.
        return await Promise.race([operation, aborted]);
      } catch {
        // No raw error/URL/credential propagation and no retained successful DTO fallback.
        controller.abort();
        return unavailable();
      } finally {
        clearTimeout(timer);
        externalSignal?.removeEventListener('abort', abort);
        controller.signal.removeEventListener('abort', onAbort);
      }
    },
  });
}
