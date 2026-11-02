import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSeriesSummary,renderSeriesSummary,validateSeriesSummaryRelease} from '../src/series-summary.mjs';
import {SERIES_SUMMARY_FIXTURE as fixture,SERIES_SUMMARY_RELEASE_FIXTURE as release} from '../src/series-summary-fixtures.mjs';
const copy = value => structuredClone(value);
test('exact public DTO scope, bounded plain fields and canonical links',()=>{
  assert.deepEqual(validateSeriesSummary(fixture,{seriesId:'fixture-series',seriesSlug:'fixture-series'}),fixture);
  for(const mutate of [v=>v.raw={},v=>v.series.id=123,v=>v.series.slug=123,v=>v.series.ownerId='private',v=>v.series.title='x'.repeat(161),v=>v.series.shortDescription='x'.repeat(321),v=>v.series.plainTextDescription='x'.repeat(2001),v=>v.series.canonicalHref='https://evil.example/',v=>v.series.title='\u0000',v=>v.schemaVersion=2]){const v=copy(fixture);mutate(v);assert.throws(()=>validateSeriesSummary(v));}
  assert.throws(()=>validateSeriesSummary(fixture,{seriesId:'other'}));
  assert.throws(()=>validateSeriesSummary(fixture,{seriesSlug:'other'}));
});
test('withheld/unavailable cannot retain content; empty and partial do not fabricate facts',()=>{
  for(const status of ['withheld','unavailable']){assert.equal(renderSeriesSummary({schemaVersion:1,type:fixture.type,status,series:null}),'');assert.throws(()=>validateSeriesSummary({...fixture,status}));}
  const empty={...copy(fixture),status:'published-empty'};Object.assign(empty.series,{title:'',shortDescription:'',plainTextDescription:''});assert.match(renderSeriesSummary(empty),/No series description/);assert.throws(()=>validateSeriesSummary({...empty,status:'published'}));
  assert.match(renderSeriesSummary({...fixture,status:'partial'}),/role="status"/);
});
test('same deterministic semantic renderer escapes hostile text and restricts presentation',()=>{
  const v=copy(fixture);v.series.title='<img src=x onerror=alert(1)>';v.series.plainTextDescription='A & B\n<script>bad</script>';
  const html=renderSeriesSummary(v,{instanceId:'fixture-header',headingLevel:2});assert.equal(html,renderSeriesSummary(v,{instanceId:'fixture-header',headingLevel:2}));
  assert.match(html,/aria-labelledby="fixture-header-title"/);assert.match(html,/<h2 id="fixture-header-title">/);assert.match(html,/&lt;img/);assert.match(html,/A &amp; B<br>&lt;script&gt;/);assert.doesNotMatch(html,/<img|<script|onclick=/);
  assert.throws(()=>renderSeriesSummary(v,{instanceId:'bad" id'}));assert.throws(()=>renderSeriesSummary(v,{headingLevel:7}));
});
test('local release contract rejects draft/Val, incompatible hosts, drift and unsafe rollback',()=>{
  assert.deepEqual(validateSeriesSummaryRelease(release,{servedReleaseId:release.releaseId,rollback:true}),release);
  for(const mutate of [v=>v.channel='val',v=>v.channel='draft',v=>v.public=false,v=>v.hosts.parent.releaseId='other',v=>v.hosts.child.artifactSha256='2'.repeat(64),v=>v.artifact.rendererVersion='2.0.0',v=>v.artifact.export='./arbitrary']){const v=copy(release);mutate(v);assert.throws(()=>validateSeriesSummaryRelease(v));}
  assert.throws(()=>validateSeriesSummaryRelease(release,{servedReleaseId:'other'}));
  assert.throws(()=>validateSeriesSummaryRelease({...release,previouslyJointlyCompatible:false},{rollback:true}));
});
