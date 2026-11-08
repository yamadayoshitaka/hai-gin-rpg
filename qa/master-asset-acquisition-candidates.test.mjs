import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MASTER_ASSET_ACQUISITION_CANDIDATES,masterAssetCandidateStats}
  from '../src/master-asset-acquisition-candidates.js';

test('source discovery is not a claim of downloaded or FF13-ready assets',()=>{
 const stats=masterAssetCandidateStats();
 assert.equal(stats.identified,21);
 assert.equal(stats.installed,0);
 assert.equal(stats.verifiedArtQuality,0);
 assert.equal(stats.realTimeGameImports,0);
});
test('only free official licensed source locations are shortlisted',()=>{
 const ids=new Set();
 for(const entry of MASTER_ASSET_ACQUISITION_CANDIDATES){
  assert.ok(!ids.has(entry.id),entry.id+' duplicate');ids.add(entry.id);
  assert.ok(entry.license.toLowerCase().includes('cc0'),entry.id+' is not CC0 core source');
  assert.ok([1,2].includes(entry.priority),entry.id+' unknown priority');
  assert.equal(entry.state,'identified-not-downloaded');
  assert.equal(entry.automaticInstall,false);
  const url=new URL(entry.officialUrl);
  assert.equal(url.protocol,'https:');
  assert.ok(
   url.hostname==='www.blender.org'||
   url.hostname.endsWith('makehumancommunity.org')||
   url.hostname==='polyhaven.com',
   entry.id+' unknown official source '+url.hostname
  );
  if(entry.directZip){
    const direct=new URL(entry.directZip);
    assert.equal(direct.hostname,'download.blender.org');
    assert.ok(direct.pathname.endsWith('.zip'));
  }
 }
});
test('source discovery spans geometry, face, appearance, equipment and summons',()=>{
 const categories=new Set(MASTER_ASSET_ACQUISITION_CANDIDATES.map(x=>x.category));
 for(const category of ['topology','face','skin','hair','animation','outfit','creature','texture'])
  assert.ok(categories.has(category),'missing required master source '+category);
 const source=MASTER_ASSET_ACQUISITION_CANDIDATES.find(x=>x.id==='human-topology');
 assert.ok(source.directZip?.includes('v1.4.1.zip'));
 assert.equal(source.license,'CC0-1.0');
 const makehuman=MASTER_ASSET_ACQUISITION_CANDIDATES.find(x=>x.id==='human-variation');
 assert.match(makehuman.license,/GPL addon/,'must distinguish code license from CC0 assets');
});
test('master model manager exposes an expandable researched source catalog, not install buttons',()=>{
 const html=readFileSync(new URL('../master-model-manager.html',import.meta.url),'utf8');
 assert.ok(html.includes('MASTER_ASSET_ACQUISITION_CANDIDATES'));
 assert.ok(html.includes('id="sourceCandidates"'));
 assert.ok(html.includes('sourcePriority'));
 assert.ok(html.includes('sourceCategory'));
 assert.ok(html.includes('未ダウンロード'));
 assert.ok(html.includes('公式配布元を開く'));
 assert.ok(!html.includes('automaticInstall=true'));
});
