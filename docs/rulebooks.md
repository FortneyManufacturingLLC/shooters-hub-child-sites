# Reusable rules core (local pilot)

`src/rulebooks.mjs` is a dependency-free pure module, with matching TypeScript declarations. This is a local contract pilot, not a storage service, PDF extractor, permissions system, production release or live match integration. It does not add a package export or activate a provider.

## Revisions and citations

A revision contains `{schemaVersion:1,rulebookId,revisionId,label,source:{sha256,filename},rules}`. Each rule contains `{id,text,number?,section?,topic?,conflictKey?}` and may carry importer metadata such as `block` and `sourceParagraph`. IDs and explicit conflict keys use ASCII letters, digits, period, underscore or hyphen, begin with a letter/digit and are at most 160 characters. Rules are plain text; HTML renderers must escape all content and diff tokens. Source SHA-256 is provenance supplied by the importer; this module checks its format, not source-file contents.

`validateRevision(value)` returns `{valid,errors}`. Rule IDs must be unique within a revision and stable across revisions. The importer/editor owns stable identity: renumbering a rule must retain its ID. Never assign IDs from array positions. Reusing a revision ID for changed content is invalid; repository/storage callers must enforce immutable revision identity across writes. The resolver also surfaces conflicting definitions of the same revision identity in a supplied library.

`citationFor(revision,ruleId)` returns `{rulebookId,revisionId,ruleId,key}`. Its key is three percent-encoded identity segments separated by `/`; it is not a URL. Registration acknowledgments and MatchOps rulings can save this object to cite the exact clause even after upstream revisions change.

`compareRevisions(before,after)` compares revisions of the same book and returns:

- `additions` and `removals`: arrays of complete rules.
- `modifications`: `{ruleId,before,after,diff}` entries for changed clause text only. `diff` contains plain `{type:'equal'|'insert'|'delete',text}` tokens. Importer metadata changes, including paragraph offsets and list identifiers, do not count as edits.
- `moves`: `{ruleId,from,to}` with zero-based array positions, emitted when retained rules change order relative to one another or their explicit `number`/`section` changes. Insertions/deletions alone do not mark unchanged retained rules as moved. Renumbering without changed text is a move only.

Diffing preserves whitespace and exact text and does not output HTML. It falls back to whole-clause delete/insert when either side exceeds 4,000 tokens or their product exceeds one million, bounding the dynamic-programming matrix.

## Explicit inheritance and conflict handling

`resolveRules(assignments,revisions,{entity,edges})` accepts entities `{type,id}` with types `community`, `series`, `season`, `club`, `venue` and `match`. Each edge `{child,parent}` explicitly grants inheritance; the module does not assume every series belongs to every community or every match belongs to a club. Multiple parents are supported. Only the target and reachable parents contribute assignments; unrelated assignments do not affect a match. Reachable graph cycles are conflicts.

Assignments contain `{id,entity,role,rulebookId,revisionId,mandatory?,replaces?}`. Every pin names an exact revision. Roles are `competition`, `host`, `venue` and `supplement`. Host, venue and supplement rules are additive. More than one distinct competition pin remains a `competition-selection` conflict until the caller supplies an explicit replacement. There is no automatic priority from input order, entity type or distance.

`replaces` lists assignment IDs. A replacement must have the same role, and its scope must be the same entity or a descendant of the replaced scope. Mandatory assignments cannot be replaced; omission of the `mandatory` property means false. Replacement cycles, missing references and cross-role/sibling replacements are conflicts. New revisions must be reviewed and explicitly selected rather than updating a shared “latest” pointer.

The result contains `status`, `conflicts`, selected `assignments`, all reachable `consideredAssignments`, exact pinned `revisions`, and selected `rules`. Resolved rules preserve metadata and include `citation` and contributing `assignmentIds`. The result also embeds `entity` and `edges` to replay the decision. Each returned object is a detached, recursively frozen copy.

`topic` is a human-readable grouping heading and never implies a contradiction. Multiple distinct clauses under “Safety,” within one assignment or across books, are valid. A caller may explicitly annotate a semantic constraint with `conflictKey`; different text sets for that key across distinct selected assignments raise `conflict-key`. Multiple clauses in one assignment do not conflict with one another, and assigning the same content twice does not produce a conflict. Selecting different text for the same rulebook and stable rule ID across assignments raises `rule-revision-conflict`, including across different roles. These mechanical checks do not infer contradictions in unannotated prose; review remains necessary. Conflict rows contain `{code,assignmentIds,detail}`. No conflict silently selects a winner, and conflicted results cannot be locked. Invalid basic input shapes throw; valid-shaped conflicting selections return `status:'conflict'` for a UI to present.

```js
const resolution = resolveRules(assignments, revisions, {
  entity: {type:'match', id:'match-12'},
  edges: [
    {child:{type:'match',id:'match-12'},parent:{type:'season',id:'2026'}},
    {child:{type:'season',id:'2026'},parent:{type:'series',id:'practical'}}
  ]
});
if (resolution.status === 'conflict') showConflicts(resolution.conflicts);
```

## Locked match history

`lockSnapshot(resolution,{matchId,lockedAt,completedAt?,existingSnapshot?})` requires a resolved match with the same identity. Freeze the snapshot when rules lock, normally before the match starts. `completedAt` is optional later evidence and cannot precede `lockedAt`. The snapshot embeds full revisions, assignments, rules, citations and inheritance edges; it never resolves a current upstream pointer. Mutating upstream objects cannot alter it.

On repeat calls, supplying `existingSnapshot` verifies and returns an unchanged detached frozen copy for that match, regardless of a new resolution. A foreign or malformed snapshot is rejected. Durable integration must make snapshot creation create-only, retain the existing snapshot when a match completes, reject upstream overwrite, and restore frozen values after JSON loading. This pure module cannot observe match status or stop another service from replacing a database row.

`verifySnapshot(snapshot)` returns `{valid,errors}` after validating the envelope and replaying resolution against embedded inputs. It detects inconsistent rules, pins, citations and assignments. It is a structural consistency check, not a cryptographic signature or authenticity proof; a coordinated rewrite of all embedded content requires storage authorization/audit controls or a trusted external digest to detect.

```js
const snapshot = lockSnapshot(resolution, {
  matchId:'match-12', lockedAt:'2026-11-05T18:00:00Z'
});
// Save snapshot and exact rule citations in the parent-owned service.
```

Run the focused test with `node --test tests/rulebooks.test.mjs`. Tests cover edits and stable IDs, bounded text diffing, every entity type, additive roles, explicit replacements, mandatory inheritance, ambiguity/cycles/missing pins, stable citations, and detached immutable snapshots.
