/**
 * Monster/creature mesh adoption contract.
 * Preserve canonical procedural models and humanoid cosplay rigs.
 * Selections are explicitly opt-in, same-origin local and rollbackable.
 */
import {MONSTER_CATALOG,MONSTER_BY_ID} from './monster-catalog.js';
import {HUMAN_MONSTER_IDS} from './monster-character-cosplay-manifest.js';
import {NONHUMAN_REBUILD_IDS,defaultCreatureSource}
 from './creature-species-blueprints.js';

export const MESH_ADOPTION_STORAGE_KEY='hai-gin.creature-mesh-adoption.v1';
// Shipped visual baseline. These three distinct actors share the same source
// mesh, but keep separate reversible local overrides.
export const DEFAULT_CREATURE_MESHES=Object.freeze(Object.fromEntries([
 // Per-species source selection: never force a wolf skeleton on a bird,
 // insect, spider or fish. No default switch for protected m005/m006.
 ...NONHUMAN_REBUILD_IDS.flatMap(id=>{
  const source=defaultCreatureSource(id);
  return source?[[id,source],['summon_'+id,source]]:[];
 }),
 ['wolf','r-wolf']
]));
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
const sourceId=/^(?:q(?:00[1-9]|0[1-4][0-9]|050)|r-(?:wolf|tiger|jaguar|eagle|crocodile))$/;
const recommend=Object.freeze({
 beast:['q022'], feline:['q020'], avian:['q048','q030','q002'],
 reptile:['q007','q040','q039'], insect:['q037','q036'],
 arachnid:[],aquatic:['q049','q008','q023','q024']
});
const realRecommendations=Object.freeze({
 beast:['r-wolf'],feline:['r-tiger','r-jaguar'],
 avian:[],reptile:[],insect:[],arachnid:[],aquatic:[]
});
const exceptions=Object.freeze({
 m012:['q040','q048'],m013:['q048','q040'],m018:['q039'],
 m020:['q039'],m023:['q036'],m024:['q037'],
 m026:[],m027:[],m028:[],m029:[],m030:[],
 m046:['q024','q031'],m047:['q049'],m048:[],m049:['q049'],m050:['q008']
});
export function eligibleCreature(id){
 return allowed.has(id);
}
export function baseMonsterId(id){
 const raw=String(id).startsWith('summon_')?String(id).slice(7):String(id);
 return MONSTER_BY_ID[raw]?raw:null;
}
export function recommendedMeshSources(id){
 const m=MONSTER_BY_ID[baseMonsterId(id)];
 if(!m)return id==='wolf'?['r-wolf','q022']:
   ['wyvern','dragon','elder_dragon','dragon_lord'].includes(id)?['q040','q039']:[];
 const base=exceptions[m.id]??recommend[m.family]??[];
 const real=m.id==='m011'?['r-eagle']:
   m.id==='m016'?['r-crocodile']:
   (realRecommendations[m.family]??[]);
 return [...real,...base];
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
 return typeof choice==='string'&&sourceId.test(choice)?choice:'legacy';
}
export function setAdoptedCreatureMesh(id,source,storage=globalThis.localStorage){
 if(!eligibleCreature(id))throw Error('人間タイプ・未知の種族は切り替えできません: '+id);
 if(source!=='legacy'&&!sourceId.test(source))throw Error('未登録の外部モデル: '+source);
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
 if(source==='legacy')return '';
 if(!sourceId.test(source))return '未登録のGLB';
 if(source.startsWith('r-'))return 'CC BY 4.0の外部リアル候補。著作者表示必須。アニメーション・既存パーツの移植は未完了のため動作を確認してください。';
 if(recommendedMeshSources(id).includes(source))return '系統から選んだ暫定候補です。外観と骨格の適合を必ず確認してください。';
 return '注意：系統外のメッシュです。角・羽・脚などの接続やシルエットが崩れる可能性があります。';
}
