/** Portable rules primitives. Persistence, authorization and PDF extraction belong to callers. */
const roles = new Set(['competition', 'host', 'venue', 'supplement']);
const entityTypes = new Set(['community', 'series', 'season', 'club', 'venue', 'match']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(value);
const plain = value => typeof value === 'string' && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const entityKey = entity => JSON.stringify([entity.type, entity.id]);
const revisionKey = revision => JSON.stringify([revision.rulebookId, revision.revisionId]);
const validEntity = value => object(value) && entityTypes.has(value.type) && id(value.id);
const clone = value => structuredClone(value);
const canonical = value => JSON.stringify(value, function(key, item) { return object(item) ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item; });
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
export function validateRevision(input) {
  const errors = [];
  if (!object(input)) return { valid:false, errors:['Revision must be an object'] };
  if (input.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  for (const key of ['rulebookId', 'revisionId']) if (!id(input[key])) errors.push(`Invalid ${key}`);
  if (!plain(input.label) || !input.label.trim() || input.label.length > 300) errors.push('Invalid label');
  if (!object(input.source) || !/^[a-f0-9]{64}$/.test(input.source.sha256) || !plain(input.source.filename) || !input.source.filename.trim()) errors.push('Invalid source provenance');
  if (!Array.isArray(input.rules) || input.rules.length > 10000) errors.push('rules must be an array of at most 10000 rules');
  else {
    const seen = new Set();
    input.rules.forEach((rule, index) => {
      if (!object(rule) || !id(rule.id) || seen.has(rule.id) || !plain(rule.text) || !rule.text.trim() || rule.text.length > 100000) errors.push(`Invalid or duplicate rule at ${index}`);
      if (object(rule)) {
        seen.add(rule.id);
        for (const key of ['number', 'section', 'topic']) if (rule[key] !== undefined && (!plain(rule[key]) || !rule[key].trim() || rule[key].length > 500)) errors.push(`Invalid ${key} at ${index}`);
        if (rule.conflictKey !== undefined && !id(rule.conflictKey)) errors.push(`Invalid conflictKey at ${index}`);
      }
    });
  }
  return { valid:errors.length === 0, errors };
}
function requireRevision(revision) {
  const check = validateRevision(revision);
  if (!check.valid) throw new Error(check.errors.join('; '));
}
/** Plain text tokens only: consumers must escape them when rendering HTML. */
function wordDiff(before, after) {
  const a = before.match(/\s+|[^\s]+/gu) || [], b = after.match(/\s+|[^\s]+/gu) || [];
  const parts = [];
  const add = (type, text) => {
    if (!text) return;
    if (parts.at(-1)?.type === type) parts.at(-1).text += text;
    else parts.push({ type, text });
  };
  // Bound memory for unusually large imported clauses.
  if (Math.max(a.length, b.length) > 4000 || a.length * b.length > 1000000) {
    add('delete', before); add('insert', after); return parts;
  }
  const rows = Array.from({length:a.length + 1}, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) rows[i][j] = a[i] === b[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { add('equal', a[i++]); j++; }
    else if (i < a.length && (j === b.length || rows[i + 1][j] >= rows[i][j + 1])) add('delete', a[i++]);
    else add('insert', b[j++]);
  }
  return parts;
}
export function compareRevisions(before, after) {
  requireRevision(before); requireRevision(after);
  if (before.rulebookId !== after.rulebookId) throw new Error('Compare revisions of the same rulebook');
  if (before.revisionId === after.revisionId && canonical(before) !== canonical(after)) throw new Error('An immutable revision ID cannot change');
  const old = new Map(before.rules.map((rule, index) => [rule.id, {rule, index}]));
  const next = new Map(after.rules.map((rule, index) => [rule.id, {rule, index}]));
  // Compare only surviving identities: inserted/removed paragraphs shift source
  // indices without moving the retained clauses relative to one another.
  const oldOrder = new Map(before.rules.filter(rule => next.has(rule.id)).map((rule, rank) => [rule.id, rank]));
  const nextOrder = new Map(after.rules.filter(rule => old.has(rule.id)).map((rule, rank) => [rule.id, rank]));
  const result = { additions:[], removals:[], modifications:[], moves:[] };
  for (const [ruleId, item] of next) {
    const previous = old.get(ruleId);
    if (!previous) { result.additions.push(clone(item.rule)); continue; }
    if (previous.rule.text !== item.rule.text) result.modifications.push({ruleId, before:clone(previous.rule), after:clone(item.rule), diff:wordDiff(previous.rule.text, item.rule.text)});
    if (oldOrder.get(ruleId) !== nextOrder.get(ruleId) || previous.rule.section !== item.rule.section || previous.rule.number !== item.rule.number) result.moves.push({ruleId, from:previous.index, to:item.index});
  }
  for (const [ruleId, item] of old) if (!next.has(ruleId)) result.removals.push(clone(item.rule));
  return result;
}
export function citationFor(revision, ruleId) {
  requireRevision(revision);
  if (!revision.rules.some(rule => rule.id === ruleId)) throw new Error('Unknown rule ID');
  return makeCitation(revision, ruleId);
}
function makeCitation(revision, ruleId) {
  return freeze({rulebookId:revision.rulebookId, revisionId:revision.revisionId, ruleId, key:[revision.rulebookId, revision.revisionId, ruleId].map(encodeURIComponent).join('/')});
}
/** Edges explicitly express child -> parent inheritance; array order has no precedence. */
export function resolveRules(assignments, revisions, {entity, edges = []} = {}) {
  if (!validEntity(entity) || !Array.isArray(edges) || !Array.isArray(assignments) || !Array.isArray(revisions)) throw new Error('Invalid resolution input');
  const conflicts = [], parents = new Map(), visiting = new Set(), reachable = new Set();
  const conflict = (code, assignmentIds = [], detail = '') => conflicts.push({code, assignmentIds:[...assignmentIds].sort(), detail});
  for (const edge of edges) {
    if (!object(edge) || !validEntity(edge.child) || !validEntity(edge.parent)) throw new Error('Invalid inheritance edge');
    const key = entityKey(edge.child);
    if (!parents.has(key)) parents.set(key, new Set());
    parents.get(key).add(entityKey(edge.parent));
  }
  function visit(key) {
    if (visiting.has(key)) { conflict('inheritance-cycle', [], key); return; }
    if (reachable.has(key)) return;
    reachable.add(key); visiting.add(key);
    for (const parent of parents.get(key) || []) visit(parent);
    visiting.delete(key);
  }
  visit(entityKey(entity));
  const library = new Map();
  for (const revision of revisions) {
    requireRevision(revision);
    const key = revisionKey(revision);
    if (library.has(key) && canonical(library.get(key)) !== canonical(revision)) conflict('revision-identity-collision', [], key);
    else library.set(key, revision);
  }
  const applicable = new Map();
  for (const assignment of assignments) {
    if (!object(assignment) || !id(assignment.id) || !validEntity(assignment.entity) || !roles.has(assignment.role) || !id(assignment.rulebookId) || !id(assignment.revisionId) || assignment.mandatory !== undefined && typeof assignment.mandatory !== 'boolean' || assignment.replaces !== undefined && (!Array.isArray(assignment.replaces) || !assignment.replaces.every(id))) throw new Error('Invalid rule assignment');
    if (!reachable.has(entityKey(assignment.entity))) continue;
    if (applicable.has(assignment.id)) conflict('duplicate-assignment-id', [assignment.id]);
    else applicable.set(assignment.id, assignment);
  }
  const replaced = new Set(), replacementEdges = new Map();
  for (const assignment of applicable.values()) {
    if (!library.has(revisionKey(assignment))) conflict('missing-revision', [assignment.id]);
    for (const replacedId of assignment.replaces || []) {
      const prior = applicable.get(replacedId);
      if (!prior || prior.id === assignment.id || prior.role !== assignment.role) { conflict('invalid-replacement', [assignment.id, replacedId]); continue; }
      if (prior.mandatory) { conflict('mandatory-replacement', [assignment.id, replacedId]); continue; }
      // Only the same scope or an explicit descendant can replace inherited rules.
      const ancestors = new Set();
      const collect = key => { if (ancestors.has(key)) return; ancestors.add(key); for (const p of parents.get(key) || []) collect(p); };
      collect(entityKey(assignment.entity));
      if (!ancestors.has(entityKey(prior.entity))) { conflict('invalid-replacement-scope', [assignment.id, replacedId]); continue; }
      replaced.add(replacedId);
      if (!replacementEdges.has(assignment.id)) replacementEdges.set(assignment.id, []);
      replacementEdges.get(assignment.id).push(replacedId);
    }
  }
  const done = new Set(), active = new Set();
  function replacementVisit(key) {
    if (active.has(key)) { conflict('replacement-cycle', [key]); return; }
    if (done.has(key)) return;
    active.add(key);
    for (const next of replacementEdges.get(key) || []) replacementVisit(next);
    active.delete(key); done.add(key);
  }
  for (const key of replacementEdges.keys()) replacementVisit(key);
  const selected = [...applicable.values()].filter(assignment => !replaced.has(assignment.id)).sort((a,b) => a.id.localeCompare(b.id));
  const competition = selected.filter(assignment => assignment.role === 'competition');
  if (new Set(competition.map(revisionKey)).size > 1) conflict('competition-selection', competition.map(a => a.id));
  const rules = new Map(), conflictKeys = new Map(), ruleIdentities = new Map();
  const collectConflict = (groups, key, rule, assignment) => {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({text:rule.text, assignmentId:assignment.id});
  };
  for (const assignment of selected) {
    const revision = library.get(revisionKey(assignment));
    if (!revision) continue;
    for (const rule of revision.rules) {
      const citation = makeCitation(revision, rule.id);
      if (!rules.has(citation.key)) rules.set(citation.key, {...clone(rule), citation, assignmentIds:[]});
      rules.get(citation.key).assignmentIds.push(assignment.id);
      if (rule.conflictKey) collectConflict(conflictKeys, rule.conflictKey, rule, assignment);
      collectConflict(ruleIdentities, JSON.stringify([revision.rulebookId, rule.id]), rule, assignment);
    }
  }
  const surfaceConflicts = (groups, code) => {
    for (const [key, entries] of groups) {
      const assignmentTexts = new Map();
      for (const entry of entries) {
        if (!assignmentTexts.has(entry.assignmentId)) assignmentTexts.set(entry.assignmentId, new Set());
        assignmentTexts.get(entry.assignmentId).add(entry.text);
      }
      const signatures = new Set([...assignmentTexts.values()].map(texts => JSON.stringify([...texts].sort())));
      if (signatures.size > 1) conflict(code, [...assignmentTexts.keys()], key);
    }
  };
  // Human-readable headings group clauses; they do not express contradictions.
  surfaceConflicts(conflictKeys, 'conflict-key');
  surfaceConflicts(ruleIdentities, 'rule-revision-conflict');
  const consideredAssignments = [...applicable.values()].sort((a,b) => a.id.localeCompare(b.id));
  const pinned = new Map(consideredAssignments.map(a => [revisionKey(a), library.get(revisionKey(a))]).filter(([, revision]) => revision));
  return freeze(clone({schemaVersion:1, entity, edges, status:conflicts.length ? 'conflict' : 'resolved', assignments:selected, consideredAssignments, revisions:[...pinned.values()], rules:[...rules.values()], conflicts}));
}
const validTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
function verifyResolution(resolution, matchId) {
  if (!object(resolution) || resolution.status !== 'resolved' || !Array.isArray(resolution.conflicts) || resolution.conflicts.length) throw new Error('Cannot lock unresolved rules');
  if (resolution.entity?.type !== 'match' || resolution.entity.id !== matchId) throw new Error('Snapshot must resolve the completed match');
  const verified = resolveRules(resolution.consideredAssignments, resolution.revisions, {entity:resolution.entity, edges:resolution.edges});
  if (verified.status !== 'resolved' || canonical(verified) !== canonical(resolution)) throw new Error('Resolution content failed verification');
}
/** Structural integrity check, not an authenticity/signature or external digest check. */
export function verifySnapshot(snapshot) {
  try {
    if (!object(snapshot) || snapshot.schemaVersion !== 1 || snapshot.type !== 'competition.rules-snapshot' || snapshot.locked !== true || !id(snapshot.matchId) || !validTime(snapshot.lockedAt) || snapshot.completedAt !== undefined && (!validTime(snapshot.completedAt) || Date.parse(snapshot.completedAt) < Date.parse(snapshot.lockedAt))) throw new Error('Invalid snapshot envelope');
    verifyResolution(snapshot.resolution, snapshot.matchId);
    return {valid:true, errors:[]};
  } catch (error) { return {valid:false, errors:[error.message]}; }
}
/** Freeze at match start; completedAt is optional evidence. Callers persist create-only. */
export function lockSnapshot(resolution, {matchId, lockedAt, completedAt, existingSnapshot} = {}) {
  if (existingSnapshot !== undefined) {
    const check = verifySnapshot(existingSnapshot);
    if (!check.valid || existingSnapshot.matchId !== matchId) throw new Error('Invalid or foreign existing snapshot');
    return freeze(clone(existingSnapshot));
  }
  if (!id(matchId) || !validTime(lockedAt) || completedAt !== undefined && (!validTime(completedAt) || Date.parse(completedAt) < Date.parse(lockedAt))) throw new Error('Invalid match identity or time');
  verifyResolution(resolution, matchId);
  return freeze(clone({schemaVersion:1, type:'competition.rules-snapshot', locked:true, matchId, lockedAt, ...(completedAt === undefined ? {} : {completedAt}), resolution}));
}
