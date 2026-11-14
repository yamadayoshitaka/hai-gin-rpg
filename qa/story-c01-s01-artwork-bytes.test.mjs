import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {comicForStage,comicPageAsset} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
import {chapter1ProvisionalLivePanel} from '../src/story-chapter1-provisional-live.js';
const root=new URL('../',import.meta.url);
const inventory=JSON.parse(readFileSync(new URL('../assets/story/chapters/c01/c01-s01-draft-registry-20261113.json',import.meta.url),'utf8'));
assert.equal(inventory.stageId,'c01-s01');
assert.equal(inventory.status,'AI_DRAFT_UNAPPROVED');
assert.equal(inventory.approved,false);
assert.equal(inventory.noTextInArt,true);
assert.equal(inventory.openingAlreadyRegistered,true);
assert.deepEqual(inventory.editions.map(e=>e.edition+'|'+e.gender),['pre|female','post-town|male','post-town|female']);
const usedPaths=new Set();
const bytesFor=relative=>{
 const file=new URL('../'+relative,import.meta.url);
 assert(existsSync(file),'Missing WebP '+relative);
 const data=readFileSync(file);
 assert.equal(data.toString('ascii',0,4),'RIFF',relative+' RIFF');
 assert.equal(data.toString('ascii',8,12),'WEBP',relative+' WEBP');
 assert(data.length>12000,'Too small to be a meaningful panel: '+relative);
 return data;
};
for(const e of inventory.editions){
 const phase=e.edition==='pre'?'pre':'post',ctx={protagonistGender:e.gender};
 const comic=comicForStage('c01-s01',phase,ctx);
 assert.equal(comic.edition,e.edition);
 assert.equal(comic.panels.length,e.panelCount);
 assert.equal(comic.pages.length,1);
 assert.equal(e.rows,Math.ceil(e.panelCount/2));
 assert.deepEqual(e.sheetDimensions,[1536,432*e.rows]);
 assert.equal('./'+e.sheet,comicPageAsset('c01-s01',phase,ctx,1,e.gender));
 const sheet=bytesFor(e.sheet);
 assert.equal(sheet.length,e.bytes);
 assert.equal(createHash('sha256').update(sheet).digest('hex'),e.sha256);
 for(let i=0;i<e.panelCount;i++){
  const p=e.panels[i],scene=comic.panels[i];
  assert.equal(scene.id,'c01-s01-m'+Number(p.id.match(/-m(\d+)$/)?.[1]),'Wrong canonical scene order '+e.edition);
  const live=registeredStoryPanelAsset(scene);
  const provisional=chapter1ProvisionalLivePanel(scene);
  if(provisional){
   assert.equal(live,provisional.asset,'Provisional game must bind real canonical image');
   assert(provisional.asset.includes(
    [scene.stageId,scene.comicEdition,scene.protagonistGender,scene.id].join('__')),
    'Provisional image key cannot borrow gender, outcome or shot');
   const newImage=bytesFor(provisional.asset.slice(2));
   assert.equal(createHash('sha256').update(newImage).digest('hex'),
    provisional.sha256,'Provisional image bytes differ from SHA-verified art');
   assert.equal(provisional.status,'PROVISIONAL_OWNER_AUTHORIZED_PENDING_P0',
    'Owner-authorized provisional display must not be confused with final P0 approval');
  }else{
   assert.equal('./'+p.path,live,'Legacy gender/outcome binding must remain unchanged');
  }
  assert(!usedPaths.has(p.path),'Same image path assigned to two cuts');
  usedPaths.add(p.path);
  const file=bytesFor(p.path);
  assert.equal(file.length,p.bytes);
  assert.equal(createHash('sha256').update(file).digest('hex'),p.sha256,'Wrong artwork bytes: '+p.path);
 }
}
assert.equal(usedPaths.size,20);
console.log('PASS C01 S01: 20 independently saved panel WebPs, 3 real sheets, canonical scene order, voice-linked gender paths, 0 fake approvals');
