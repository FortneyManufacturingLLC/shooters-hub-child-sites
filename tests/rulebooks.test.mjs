import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRevision, compareRevisions, citationFor, resolveRules, lockSnapshot, verifySnapshot } from '../src/rulebooks.mjs';
const revision = (revisionId = 'v1', rules = [{id:'safety',text:'Keep muzzle downrange.',topic:'muzzle'}], rulebookId = 'practical') => ({schemaVersion:1,rulebookId,revisionId,label:'Practical rules',source:{sha256:'a'.repeat(64),filename:'rules.pdf'},rules});
const match = {type:'match',id:'m1'}, season = {type:'season',id:'s1'}, series = {type:'series',id:'series1'}, community = {type:'community',id:'c1'}, club = {type:'club',id:'club1'}, venue = {type:'venue',id:'venue1'};
const assignment = (id = 'base', entity = community, extra = {}) => ({id,entity,role:'competition',rulebookId:'practical',revisionId:'v1',...extra});
const edges = [{child:match,parent:season},{child:season,parent:series},{child:series,parent:community},{child:match,parent:club},{child:match,parent:venue}];
const opts = {entity:match,edges};
const lockedAt = '2026-11-05T18:00:00Z';

test('validates source and stable rule identities; preserves importer metadata', () => {
  assert.equal(validateRevision(revision()).valid,true);
  assert.equal(validateRevision({...revision(),rules:[{id:'r',text:'a'},{id:'r',text:'b'}]}).valid,false);
  assert.equal(validateRevision({...revision(),source:{sha256:'bad',filename:'r.pdf'}}).valid,false);
  const input = revision('v1',[{id:'r',text:'Clause',block:{level:2,marker:'a)'},sourceParagraph:3}]);
  assert.equal(resolveRules([assignment()], [input],opts).rules[0].block.level,2);
});

test('revision comparison separates additions, removals, edits and positions with plain text diff', () => {
  const before = revision('v1',[{id:'a',text:'Use <safe> equipment',number:'1'},{id:'b',text:'Old clause'},{id:'c',text:'Unchanged'}]);
  const after = revision('v2',[{id:'c',text:'Unchanged'},{id:'a',text:'Use <new> equipment',number:'2'},{id:'d',text:'Added'}]);
  const result = compareRevisions(before,after);
  assert.deepEqual(result.additions.map(r => r.id),['d']);
  assert.deepEqual(result.removals.map(r => r.id),['b']);
  const diff = result.modifications[0].diff;
  assert.equal(diff.filter(p => p.type !== 'insert').map(p => p.text).join(''),before.rules[0].text);
  assert.equal(diff.filter(p => p.type !== 'delete').map(p => p.text).join(''),after.rules[1].text);
  assert.ok(diff.some(p => p.text === '<new>'));
  assert.equal(result.moves.length,2);
  assert.throws(() => compareRevisions(before,{...after,revisionId:'v1'}),/immutable/);
  assert.throws(() => compareRevisions(before,{...after,rulebookId:'other'}),/same rulebook/);
});

test('diff work is bounded for long clauses while retaining exact text', () => {
  const old = 'old '.repeat(1200), next = 'next '.repeat(1200);
  assert.deepEqual(compareRevisions(revision('v1',[{id:'r',text:old}]),revision('v2',[{id:'r',text:next}])).modifications[0].diff,[{type:'delete',text:old},{type:'insert',text:next}]);
});

test('insertion and importer metadata changes do not edit or move retained rules', () => {
  const before = revision('v1',[{id:'a',text:'Same clause',sourceParagraph:1,block:{marker:'1',level:0,listId:'old'}},{id:'b',text:'Second clause',sourceParagraph:2}]);
  const after = revision('v2',[{id:'new',text:'Inserted clause'},{id:'a',text:'Same clause',sourceParagraph:2,block:{marker:'2',level:0,listId:'new'}},{id:'b',text:'Second clause',sourceParagraph:3}]);
  const result = compareRevisions(before,after);
  assert.deepEqual(result.additions.map(rule => rule.id),['new']);
  assert.deepEqual(result.modifications,[]);
  assert.deepEqual(result.moves,[]);
  const removed = compareRevisions(after,revision('v3',before.rules));
  assert.deepEqual(removed.modifications,[]);
  assert.deepEqual(removed.moves,[]);
  const renumbered = compareRevisions(before,revision('v3',[{...before.rules[0],number:'2',section:'Safety'},before.rules[1]]));
  assert.deepEqual(renumbered.modifications,[]);
  assert.deepEqual(renumbered.moves,[{ruleId:'a',from:0,to:0}]);
});

test('shared topic headings do not imply contradictions within or across assignments', () => {
  const book = revision('v1',[{id:'a',text:'Keep muzzle downrange.',topic:'Safety'},{id:'b',text:'Wear eye protection.',topic:'Safety'}]);
  const host = revision('v1',[{id:'c',text:'Use hearing protection.',topic:'Safety'}],'host');
  assert.equal(resolveRules([assignment()],[book],opts).status,'resolved');
  assert.equal(resolveRules([assignment(),assignment('host',club,{role:'host',rulebookId:'host'})],[book,host],opts).status,'resolved');
  const sameScope = revision('v1',book.rules.map(rule => ({...rule,conflictKey:'safety-limit'})));
  assert.equal(resolveRules([assignment()],[sameScope],opts).status,'resolved');
  assert.equal(resolveRules([assignment(),assignment('same-pin',club,{role:'host'})],[sameScope],opts).status,'resolved');
});

test('explicit conflict keys and stable rule identity compare distinct assignments', () => {
  const base = revision('v1',[{id:'safety',text:'Limit 10',conflictKey:'round-limit'}]);
  const host = revision('v1',[{id:'capacity',text:'Limit 5',conflictKey:'round-limit'}],'host');
  const assignments = [assignment(),assignment('host',club,{role:'host',rulebookId:'host'})];
  assert.ok(resolveRules(assignments,[base,host],opts).conflicts.some(c => c.code === 'conflict-key'));
  const identical = revision('v1',[{id:'capacity',text:'Limit 10',conflictKey:'round-limit'}],'host');
  assert.equal(resolveRules(assignments,[base,identical],opts).status,'resolved');
  const differentPin = resolveRules([assignment(),assignment('host',club,{role:'host',revisionId:'v2'})],[base,revision('v2',[{id:'safety',text:'Limit 5'}])],opts);
  assert.ok(differentPin.conflicts.some(c => c.code === 'rule-revision-conflict'));
  assert.equal(validateRevision(revision('v1',[{id:'a',text:'Clause',conflictKey:'not valid'}])).valid,false);
});

test('explicit graph inherits community through series/season and additive club and venue pins', () => {
  const host = revision('h1',[{id:'parking',text:'Park in the north lot.'}],'club-rules');
  const site = revision('r1',[{id:'arrival',text:'Check in at the gate.'}],'range');
  const result = resolveRules([assignment(),assignment('host',club,{role:'host',rulebookId:'club-rules',revisionId:'h1'}),assignment('venue',venue,{role:'venue',rulebookId:'range',revisionId:'r1'}),assignment('unrelated',{type:'match',id:'m2'},{revisionId:'missing'})],[revision(),host,site],opts);
  assert.equal(result.status,'resolved');
  assert.equal(result.rules.length,3);
  assert.deepEqual(result.rules[0].citation,citationFor(revision(),'safety'));
  assert.equal(Object.isFrozen(result.rules[0]),true);
});

test('multiple competition choices conflict independently of input order', () => {
  const assignments = [assignment(),assignment('local',match,{revisionId:'v2'})], revisions = [revision(),revision('v2')];
  for (const list of [assignments,[...assignments].reverse()]) assert.ok(resolveRules(list,revisions,opts).conflicts.some(c => c.code === 'competition-selection'));
  const result = resolveRules([assignments[0],{...assignments[1],replaces:['base']}],revisions,opts);
  assert.equal(result.status,'resolved');
  assert.deepEqual(result.assignments.map(a => a.id),['local']);
  assert.equal(result.consideredAssignments.length,2);
  assert.equal(verifySnapshot(lockSnapshot(result,{matchId:match.id,lockedAt})).valid,true);
  const chained = resolveRules([assignment(),assignment('middle',season,{revisionId:'v2',replaces:['base']}),assignment('local',match,{revisionId:'v3',replaces:['middle']})],[revision(),revision('v2'),revision('v3')],opts);
  assert.equal(chained.status,'resolved');
  assert.equal(verifySnapshot(lockSnapshot(chained,{matchId:match.id,lockedAt})).valid,true);
});

test('mandatory assignments, cross-role replacements and sibling replacements cannot be dropped', () => {
  const mandatory = resolveRules([assignment('base',community,{mandatory:true}),assignment('local',match,{revisionId:'v2',replaces:['base']})],[revision(),revision('v2')],opts);
  assert.ok(mandatory.conflicts.some(c => c.code === 'mandatory-replacement'));
  const role = resolveRules([assignment(),assignment('local',match,{role:'host',replaces:['base']})],[revision()],opts);
  assert.ok(role.conflicts.some(c => c.code === 'invalid-replacement'));
  const sibling = resolveRules([assignment('base',club),assignment('local',venue,{replaces:['base']})],[revision()],opts);
  assert.ok(sibling.conflicts.some(c => c.code === 'invalid-replacement-scope'));
});

test('missing pins, revision collisions and cycles remain explicit', () => {
  const codes = result => result.conflicts.map(c => c.code);
  assert.ok(codes(resolveRules([assignment()],[],opts)).includes('missing-revision'));
  assert.ok(codes(resolveRules([assignment()],[revision(),revision('v1',[{id:'safety',text:'Changed'}])],opts)).includes('revision-identity-collision'));
  assert.ok(codes(resolveRules([assignment()],[revision()],{entity:match,edges:[...edges,{child:community,parent:match}]})).includes('inheritance-cycle'));
  assert.ok(codes(resolveRules([assignment('a',match,{replaces:['b']}),assignment('b',match,{replaces:['a']})],[revision()],opts)).includes('replacement-cycle'));
});

test('completed snapshots embed exact immutable content and repeat locks preserve history', () => {
  const upstream = revision(), result = resolveRules([assignment()],[upstream],opts);
  const snapshot = lockSnapshot(result,{matchId:match.id,lockedAt,completedAt:'2026-11-05T20:00:00Z'});
  assert.equal(verifySnapshot(JSON.parse(JSON.stringify(snapshot))).valid,true);
  upstream.rules[0].text = 'Upstream changed';
  assert.equal(snapshot.resolution.rules[0].text,'Keep muzzle downrange.');
  assert.throws(() => { snapshot.resolution.revisions[0].rules[0].text = 'Mutated'; },TypeError);
  const changed = resolveRules([assignment('local',match,{revisionId:'v2'})],[revision('v2',[{id:'safety',text:'New policy'}])],opts);
  assert.deepEqual(lockSnapshot(changed,{matchId:match.id,existingSnapshot:snapshot}),snapshot);
  const tampered = structuredClone(snapshot); tampered.resolution.rules[0].text = 'Tampered';
  assert.equal(verifySnapshot(tampered).valid,false);
  assert.throws(() => lockSnapshot(changed,{matchId:'foreign',existingSnapshot:snapshot}),/foreign/);
  assert.throws(() => lockSnapshot(result,{matchId:match.id,lockedAt,completedAt:'2020-01-01T00:00:00Z'}),/time/);
  const unresolved = resolveRules([assignment()],[],opts);
  assert.throws(() => lockSnapshot(unresolved,{matchId:match.id,lockedAt}),/unresolved/);
});
