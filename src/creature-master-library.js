/**
 * 108 on-demand original high-detail creature masters.
 * Definitions are source code, not false claims of a photogrammetry-grade GLB.
 * The source sculpt and its 3 render tiers remain separate from production
 * optimization. The source is created on demand, never 108 at game startup.
 */
import {MONSTER_CATALOG,MONSTER_BY_ID} from './monster-catalog.js';
import {MONSTER_SUMMON_ENTRIES} from './monster-summon-registry.js';
import {HUMAN_MONSTER_IDS} from './monster-character-cosplay-manifest.js';

export const MASTER_LIBRARY_SCHEMA='hai-gin/creature-master-library/v1';
export const MASTER_RENDER_TIERS=Object.freeze({
 master:Object.freeze({label:'原型マスター',geometry:'source',purpose:'造形・高精細確認・GLB書き出し'}),
 near:Object.freeze({label:'近距離',geometry:'high',purpose:'接近時の実ゲーム表示'}),
 mid:Object.freeze({label:'中距離',geometry:'medium',purpose:'ゲーム用の中程度の形状。後で最適化'}),
 far:Object.freeze({label:'遠距離',geometry:'low',purpose:'遠方のゲーム用軽量造形'})
});
export const MASTER_LOD_DISTANCES=Object.freeze({near:16,mid:52});
export function chooseCreatureLod(distance,{near=16,mid=52}={}){
 if(!Number.isFinite(distance)||distance<0) return 'far';
 return distance<near?'near':distance<mid?'mid':'far';
}
// m005/m006 now share the accepted m001 physical mother; master/source LOD is available.
const protectedIds=new Set();
const humanIds=new Set(HUMAN_MONSTER_IDS);
const monsters=MONSTER_CATALOG.map(m=>Object.freeze({
 id:m.id,baseId:m.id,name:m.name,kind:'monster',family:m.family,element:m.element,
 stage:'master-generator',protected:protectedIds.has(m.id),
 engine:humanIds.has(m.id)?'canonical-human-rig':'source-anatomical-sculpt',
 template:m.id,referenceRequired:true,
 sourceGlbReady:false,photorealCertified:false,exportStatus:'runtime-generated'
}));
const summons=MONSTER_SUMMON_ENTRIES.map(s=>{
 const base=MONSTER_BY_ID[s.monsterId];
 return Object.freeze({
 id:s.id,baseId:base.id,name:s.name,kind:'summon',family:base.family,
 element:base.element,stage:'master-generator',protected:protectedIds.has(s.id),
 engine:humanIds.has(base.id)?'canonical-human-rig':'source-anatomical-sculpt',
 template:base.id,referenceRequired:true,sourceGlbReady:false,
 photorealCertified:false,exportStatus:'runtime-generated'
 });
});
const extras=Object.freeze([
 ['wolf','灰狼','beast','physical','dedicated-procedural'],
 ['wyvern','飛竜','reptile','wind','dedicated-procedural'],
 ['dragon','古竜','reptile','fire','dedicated-procedural'],
 ['elder_dragon','天竜','reptile','light','dedicated-procedural'],
 ['dragon_lord','竜王（竜本体）','reptile','dark','dedicated-procedural'],
 ['forest_archer','森の精霊弓士','fiend','nature','canonical-female-rig'],
 ['seraph_guardian','光翼の守護天使','fiend','light','canonical-female-rig'],
 ['horse','軍馬','beast','physical','dedicated-procedural']
].map(([id,name,family,element,engine])=>Object.freeze({
 id,baseId:id,name,kind:'dedicated',family,element,
 stage:'master-generator',protected:false,engine,template:id,
 referenceRequired:true,sourceGlbReady:false,photorealCertified:false,
 exportStatus:'runtime-generated'
})));
export const CREATURE_MASTER_ENTRIES=Object.freeze([...monsters,...summons,...extras]);
export const CREATURE_MASTER_BY_ID=Object.freeze(
 Object.fromEntries(CREATURE_MASTER_ENTRIES.map(v=>[v.id,v]))
);
export const CREATURE_MASTER_COUNTS=Object.freeze({
 total:CREATURE_MASTER_ENTRIES.length,monsters:monsters.length,
 summons:summons.length,dedicated:extras.length,
 humanoid:CREATURE_MASTER_ENTRIES.filter(x=>x.engine!=='source-anatomical-sculpt'&&x.engine!=='dedicated-procedural').length,
 protected:CREATURE_MASTER_ENTRIES.filter(x=>x.protected).length,
 exportedFiles:0,photorealCertified:0
});
export function validateCreatureMasterLibrary(){
 if(CREATURE_MASTER_COUNTS.total!==108||
   CREATURE_MASTER_COUNTS.monsters!==50||
   CREATURE_MASTER_COUNTS.summons!==50||
   CREATURE_MASTER_COUNTS.dedicated!==8)throw Error('108 model ID contract broken');
 if(Object.keys(CREATURE_MASTER_BY_ID).length!==108)throw Error('Duplicate master IDs');
 for(const entry of CREATURE_MASTER_ENTRIES){
  if(!entry.id||!entry.template||entry.sourceGlbReady||entry.photorealCertified)
   throw Error('Unverified high-detail model marked complete: '+entry.id);
  if(entry.kind!=='dedicated'&&!MONSTER_BY_ID[entry.baseId])
   throw Error('Missing source bestiary anatomy: '+entry.id);
  if(entry.kind==='summon'&&!CREATURE_MASTER_BY_ID[entry.baseId])
   throw Error('Summon without source: '+entry.id);
 }
 return true;
}
validateCreatureMasterLibrary();
