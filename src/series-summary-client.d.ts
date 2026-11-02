import type { SeriesSummary } from '@competition-hub/child-sites/series-summary';

/** Trusted deployment identity only. The parent origin/route cannot be overridden. */
export interface SeriesSummaryClientOptions {
  seriesId: string;
  seriesSlug: string;
  fetchImpl?: typeof globalThis.fetch;
}
export interface SeriesSummaryReadOptions { signal?: AbortSignal; }
export interface SeriesSummaryClient {
  /** Fresh public read; abort/timeout/invalid transport returns contentless unavailable. */
  read(options?: SeriesSummaryReadOptions): Promise<SeriesSummary>;
}
/** Source-first Shooters adapter; package availability does not activate any host. */
export declare function createSeriesSummaryClient(options: SeriesSummaryClientOptions): Readonly<SeriesSummaryClient>;
