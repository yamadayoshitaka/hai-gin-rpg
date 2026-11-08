import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MASTER_ASSET_ACQUISITION_CANDIDATES,masterAssetCandidateStats}
  from '../src/master-asset-acquisition-candidates.js';

test('source discovery is not a claim of downloaded or FF13-ready assets',()=>{
 const stats=masterAssetCandidateStats();
 assert.equal(stats.identified,23);
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
   ['www.blender.org','polyhaven.com','github.com'].includes(url.hostname),
   entry.id+' unsupported or insecure source '+url.hostname
  );
  assert.ok(!entry.officialUrl.includes('makehumancommunity.org'),
   entry.id+' legacy MakeHuman host must not be linked');
  assert.ok(['official-https','verified-https-project-alternative'].includes(entry.secureLinkKind),
   entry.id+' source security type missing');
  if(entry.secureLinkKind==='verified-https-project-alternative'){
   assert.equal(entry.originalPackUrlRemoved,true);
   assert.equal(entry.sourceAvailability,'specific-original-pack-not-verified');
   assert.ok(entry.accessNote?.includes('別')||entry.accessNote?.includes('ありません')||
    entry.accessNote?.includes('未確認')||entry.accessNote?.includes('直接ダウンロードではありません'),
    entry.id+' must distinguish a code repository from its asset pack');
  }
  if(entry.directZip){
    const direct=new URL(entry.directZip);
    assert.ok(['download.blender.org','github.com'].includes(direct.hostname));
    assert.ok(direct.pathname.endsWith('.zip'));
    if(direct.hostname==='github.com')
     assert.ok(direct.pathname.startsWith('/Makehuman-2/MH2_Asset_Repository_CCO/releases/download/CC0/'),
      'Only GitHub release assets of CC0 repository are allowed');
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

test('two GitHub release archives have exact known asset names and trustworthy HTTPS previews',()=>{
 const release=MASTER_ASSET_ACQUISITION_CANDIDATES.filter(x=>x.sourceAvailability==='release-asset-verified');
 assert.equal(release.length,2);
 assert.ok(release.some(x=>x.directZip.endsWith('/mh_system_CC0.zip')));
 assert.ok(release.some(x=>x.directZip.endsWith('/RP_Viking_set_CC0.zip')));
 for(const row of release){
  assert.equal(new URL(row.officialUrl).hostname,'github.com');
  assert.ok(row.previewUrl.startsWith('https://raw.githubusercontent.com/Makehuman-2/MH2_Asset_Repository_CCO/main/resource/'));
 }
});
test('no deprecated MakeHuman HTTPS or unencrypted external links remain in source catalog',()=>{
 const catalog=readFileSync(new URL('../src/master-asset-acquisition-candidates.js',import.meta.url),'utf8');
 assert.ok(!/https?:\\/\\/(?:www|download|static)\\.makehumancommunity\\.org/i.test(catalog));
 assert.ok(!/http:\\/\\//i.test(catalog),'No plaintext HTTP URLs should appear');
 const manager=readFileSync(new URL('../master-model-manager.html',import.meta.url),'utf8');
 assert.ok(manager.includes('安全なGitHub参考元を開く'));
 assert.ok(manager.includes('HTTPS公式ZIPを取得'));
 assert.ok(manager.includes('代替参照'));
});
