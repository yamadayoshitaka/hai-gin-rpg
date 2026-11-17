/**
 * Monster/creature mesh adoption contract.
 * Preserve canonical procedural models and humanoid cosplay rigs.
 * Selections are explicitly opt-in, same-origin local and rollbackable.
 */
import {MONSTER_CATALOG,MONSTER_BY_ID} from './monster-catalog.js';
import {HUMAN_MONSTER_IDS} from './monster-character-cosplay-manifest.js';
import {WEB_CREATURE_MESH_SOURCES} from './creature-web-mesh-catalog.js';
import {REAL_BODY_CANDIDATES,REAL_BODY_SUGGESTIONS} from './creature-real-body-candidates.js';

export const MESH_ADOPTION_STORAGE_KEY='hai-gin.creature-mesh-adoption.v1';
// The user-approved m001 wolf-king is the locally generated procedural 3D
// model. Do not silently replace it with an unverified remote r-wolf GLB on
// enemy spawn or summon. Dedicated ordinary 'wolf' keeps its previous
// shipped look; local deliberate selections still override any default.
export const DEFAULT_CREATURE_MESHES=Object.freeze({
 wolf:'r-wolf'
});
export const NONHUMAN_MONSTER_IDS=Object.freeze(
 MONSTER_CATALOG.filter(m=>!HUMAN_MONSTER_IDS.includes(m.id)).map(m=>m.id));
export const NONHUMAN_EXTRA_SUMMON_IDS=Object.freeze([
 'wolf','wyvern','dragon','elder_dragon','dragon_lord','horse'
]);
const allowed=new Set([
 ...NONHUMAN_MONSTER_IDS,
 ...NONHUMAN_MONSTER_IDS.map(id=>'summon_'+id),
 ...NONHUMAN_EXTRA_SUMMON_IDS
]);
const protectedIds=new Set(['m005','m006','summon_m005','summon_m006']);
export const protectedCreature=id=>protectedIds.has(String(id));
const sourceId=/^(?:q(?:00[1-9]|0[1-4][0-9]|050)|r-(?:wolf|tiger|jaguar|eagle|crocodile))$/;
const knownSource=source=>sourceId.test(source)||
 Object.hasOwn(WEB_CREATURE_MESH_SOURCES,source)||
 Object.hasOwn(REAL_BODY_CANDIDATES,source);
// Only previously established 3D sources can be adopted. Newly researched
// low-poly or static bodies are for comparison only until fully validated.
export const referenceOnlySource=source=>
 Object.hasOwn(WEB_CREATURE_MESH_SOURCES,source)||
 Object.hasOwn(REAL_BODY_CANDIDATES,source);
// Species-linked realism choices only: never show a fish, gobkit
// low-poly, or wrong-anatomy animal as an apparent improvement.
const realisticRecommendations=Object.freeze({
 m001:['r-wolf'],m002:['r-wolf'],m003:['r-wolf'],m004:['r-wolf'],
 m007:['r-tiger',...(REAL_BODY_SUGGESTIONS.m007||[])],
 m008:[...(REAL_BODY_SUGGESTIONS.m008||[])],
 m009:['r-jaguar',...(REAL_BODY_SUGGESTIONS.m009||[])],
 m010:['r-tiger',...(REAL_BODY_SUGGESTIONS.m010||[])],
 m011:['r-eagle']
});
export function eligibleCreature(id){
 return allowed.has(id)&&!protectedCreature(id);
}
export function baseMonsterId(id){
 const raw=String(id).startsWith('summon_')?String(id).slice(7):String(id);
 return MONSTER_BY_ID[raw]?raw:null;
}
export function recommendedMeshSources(id){
 if(protectedCreature(id))return [];
 const m=MONSTER_BY_ID[baseMonsterId(id)];
 if(!m)return id==='wolf'?['r-wolf']:[];
 return [...(realisticRecommendations[m.id]||[])];
}
function stored(storage){
 try{
  const raw=JSON.parse(storage?.getItem(MESH_ADOPTION_STORAGE_KEY)||'{}');
  return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 }catch{return {};}
}
export function creatureMeshAdoptions(storage=globalThis.localStorage){
 return stored(storage);
}
export function adoptedCreatureMesh(id,storage=globalThis.localStorage){
 if(!eligibleCreature(id))return 'legacy';
 const map=stored(storage);
 // A saved "legacy" is an intentional rollback; never silently
 // reapply the shipped r-wolf default after the user chooses the old mesh.
 const own=Object.hasOwn(map,id)?map[id]:undefined;
 const parent=String(id).startsWith('summon_')?id.slice(7):null;
 const inherited=parent&&Object.hasOwn(map,parent)?map[parent]:undefined;
 const choice=own??inherited??DEFAULT_CREATURE_MESHES[id]??'legacy';
 return typeof choice==='string'&&knownSource(choice)&&!referenceOnlySource(choice)?choice:'legacy';
}
export function setAdoptedCreatureMesh(id,source,storage=globalThis.localStorage){
 if(!eligibleCreature(id))throw Error('人間タイプ・保護対象・未知の種族は切り替えできません: '+id);
 if(source!=='legacy'&&!knownSource(source))throw Error('未登録の外部モデル: '+source);
 if(referenceOnlySource(source))throw Error('この素材は比較用であり、現行モデルより高品質・ゲーム動作を確認するまで採用できません: '+source);
 if(!storage?.setItem)throw Error('端末ストレージへ保存できません');
 const map=stored(storage);
 // Explicit rollback persists even when a future build ships r-wolf
 // as its default. Ordinary non-default species keep the compact storage.
 if(source==='legacy'){
  if(Object.hasOwn(DEFAULT_CREATURE_MESHES,id)||String(id).startsWith('summon_'))
   map[id]='legacy';
  else delete map[id];
 }else map[id]=source;
 storage.setItem(MESH_ADOPTION_STORAGE_KEY,JSON.stringify(map));
 try{globalThis.dispatchEvent?.(new CustomEvent('hai-gin-creature-mesh-adopted',{detail:{id,source}}));}catch{}
 return source;
}
export function compatibleSourceWarning(id,source){
 if(protectedCreature(id))return 'PR #345/#346の保護対象です。モデルの変更と再検証を行いません。';
 if(source==='legacy')return '';
 if(!knownSource(source))return '未登録のGLB';
 if(referenceOnlySource(source))return '比較専用の未検証素材です。現行より高品質と確認できるまで採用不可。ローポリと未リグのGLBは母体として正式採用しません。';
 if(source.startsWith('r-'))return 'CC BY 4.0の外部リアル候補。著作者表示必須。アニメーション・既存パーツの移植は未完了のため動作を確認してください。';
 if(recommendedMeshSources(id).includes(source))return '系統から選んだ暫定候補です。外観と骨格の適合を必ず確認してください。';
 return '注意：系統外のメッシュです。角・羽・脚などの接続やシルエットが崩れる可能性があります。';
}
