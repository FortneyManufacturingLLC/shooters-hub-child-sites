# Public share and export core

`@competition-hub/child-sites/share` supplies pure browser/Node helpers for the
Hub public share dialog. It has no DOM, React, recipient suggestions, messaging,
authentication, persistence, or network requests. A host supplies its dialog and
only the records in the current filtered scope (maximum 1,000).

## API

- `normaliseShareItem(input, {origin})`, also `shareItemFromEntity`: a frozen
  public snapshot with id, kind, eyebrow, title, href, metadata, and optional
  summary/image. Relative child paths require an HTTP(S) origin. Revision query
  parameters and rule fragments remain intact. Invalid URLs throw `TypeError`.
  User info, control/whitespace/backslash URLs, protocol-relative URLs, and
  executable schemes are rejected. Titles are limited to 200 characters,
  summaries to 2,000, URLs to 4,096, and metadata to eight 160-character values.
  The caller must escape these plain strings when inserting HTML.
- `resultCsv(results)`: seven Hub columns: Type, Title, Date, Location, Status,
  Distance, URL. Relative links remain relative. CSV quotes escape separators,
  quotes and line breaks; formula prefixes receive a leading apostrophe. Non-object
  values are excluded and no records are fetched or discovered implicitly.
- `resultCalendar(results, {origin, timeZone, now})`: RFC 5545 text or `null` if
  the scope has no eligible matches. `now` accepts a Date or an ISO timestamp
  with Z/explicit offset and defaults to the current time. Inject it for
  reproducible exports. UTC DTSTAMP, escaped property values, CRLF endings and
  UTF-8-safe 75-octet folding are included. Pass `origin` for absolute event URLs.
  `timeZone` is optional descriptive metadata, never an inference about a naive
  timestamp. Invalid event dates/bounds are omitted; oversized scopes throw.
- `googleCalendarHref(result, {origin})`: a Google Calendar template URL or
  `null` for an ineligible match or a timed match without an explicit end.

Results follow the Hub SearchViewResult subset: id, kind, title, summary,
destination.webHref, dateIso, startIso, timeZone, locationLabel, statusLabel and
distanceLabel. Child adapters may supply href, timeTbd, endIso and endDateIso.
`dateIso` is a real YYYY-MM-DD date. If startIso is absent or timeTbd is true,
the event is all-day and needs dateIso. The end is the next calendar date unless
an exclusive endDateIso is supplied. Dated events remain all-day when only the
time is TBD; undated/TBD-date events are excluded. Timed starts/ends require an
explicit Z/offset and are converted to UTC. Missing timed ends remain missing;
the core never invents a three-hour duration or converts local midnight to UTC.
Calendar exports are snapshots, not subscription feeds.

## DOM adapter

The companion `@competition-hub/child-sites/share-dialog` export supplies
`createShareDialog({document, window})`, returning `{open, close, destroy, element}`.
Load `@competition-hub/child-sites/share-dialog.css` once in the host. Open it
with `{item, title?, description?, extraActions?}`; each extra action supplies
label, optional description/icon/successMessage, and a trusted
`onAction({item, close})` callback. The host
owns which calendar/export actions are appropriate for the current scope. The
adapter has no default recipients or private commands. It consumes this core
instead of maintaining a separate child-site sharing implementation.

## Derivation and exact source custody

Source repository: https://github.com/FortneyManufacturingLLC/shooters-hub

Pinned source commit: `59d3d3657cfad093c9af5777d8d60d79a651be31`.
The sources were read without modifying that repository. SHA-256 values below
identify Git blob bytes, without checkout newline conversion:

| Source | SHA-256 |
| --- | --- |
| web-app/src/decade/components/share/SiteShare.tsx | 072cc6c7dc65e10085ab8d4fd63996cb633073e79c560cbde241881dc8120f0b |
| web-app/src/decade/screens/search/SearchResultActions.tsx | 26a6b7098c68a3b4749d012fdb62679edf87e39dc16af025506a0dcf6cce26d9 |
| packages/sh-ui-contracts/src/communication/contracts.ts | 2e45459af54980bf300876ded9ea39da7f3073073a7ebb744ed143a9cc410d6f |

The snapshot contract/normalizer derive from SharedItemSnapshot and
shareItemFromEntity. CSV, calendar escaping, stable UID hashing, all-day
exclusive ends, and Google template parameters derive from SearchResultActions.
The source dialog extends these public actions through an extraActions slot.

Deliberate portable changes: remove React/Next/UI and communication dependencies;
parameterize child-site origin; retain safe child paths instead of hardcoding Hub
route roots or discarding opaque identities; validate dates/offsets; omit the
source's invented three-hour timed duration; neutralize spreadsheet formulas;
bound scope/content; preserve URI punctuation in URL properties; add DTSTAMP, Unicode-aware folding and deterministic time
injection. No prototype people or private commands are included. This is an
extraction/adaptation, not a byte-identical copy of the React component.

The child-sites repository retains its MIT license. No separate top-level Hub
license was found in the inspected source checkout; source reuse here follows
the owner's explicit cross-repository extraction instruction. This provenance
records that instruction and source custody, not a newly verified upstream
public licensing grant. Do not publish this artifact to npm as part of this task.

The share-only archive includes package metadata, src/share.mjs, src/share.d.ts,
src/share-dialog.mjs, src/share-dialog.css, this document, LICENSE, and share-provenance.json with exact source commit and
per-file hashes. Its filename is content-addressed; archive bytes and source
commit must be verified together before vendoring.
