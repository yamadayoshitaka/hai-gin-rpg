/**
 * Source-grounded 108-actor reconstruction work queue.
 * Defines candidates, not fabricated converted GLBs or approved 2D art.
 *
 * Canonical 50 monster actors + 50 summon mirrors + 8 dedicated summons.
 * Existing model source and user's explicit Adopt selection are preserved.
 * A "reference-only" donor MUST NOT be used as a mesh without rig validation.
 */
import {MONSTER_CATALOG,MONSTER_BY_ID} from './monster-catalog.js';
import {HUMAN_MONSTER_IDS} from './monster-character-cosplay-manifest.js';
import {MONSTER_SUMMON_ENTRIES} from './monster-summon-registry.js';
import {WEB_CREATURE_MESH_SOURCES} from './creature-web-mesh-catalog.js';
import {WEB_CREATURE_ANATOMY_REFERENCES} from './creature-research-reference-catalog.js';
import {REAL_BODY_CANDIDATES} from './creature-real-body-candidates.js';
// Keep the manifest pure-data: loading a planning table must not fetch a
// Three.js renderer or third-party 3D assets.
const VERIFIED_CATALOG_KEYS=new Set([
 'r-wolf','r-tiger','r-jaguar','r-eagle','r-crocodile',
 ...Object.keys(WEB_CREATURE_MESH_SOURCES),
 ...Object.keys(WEB_CREATURE_ANATOMY_REFERENCES),
 ...Object.keys(REAL_BODY_CANDIDATES)
]);

export const RECONSTRUCTION_PLAN_SCHEMA='hai-gin/creature-reconstruction-plan/v1';
export const MESH_STAGE=Object.freeze({
 default:'既定モデル実装済・品質未合格',
 candidate:'実物GLB候補あり・適合未検証',
 anatomy:'解剖学参考のみ・専用メッシュ必要',
 missing:'基準に合うメッシュ未選定',
 human:'人型共通素体あり・個別品質改善待ち',
 protected:'保護対象・既存モデル変更禁止',
 'm001-derived':'m001物理メッシュ複製・種族別変形・検証中'
});
export const RECONSTRUCTION_ACTIONS=Object.freeze([
 'idle','walk','run','attack','roar','hit','defeat'
]);
export const FAMILY_REUSE_PARTS=Object.freeze({
 beast:['毛束','耳','牙','爪','尻尾','属性紋様'],
 feline:['耳','ヒゲ','牙','爪','尾','毛色'],
 avian:['風切羽','翼','尾羽','嘴','爪','属性羽'],
 reptile:['角','鱗','背棘','鰭','爪','長尾'],
 insect:['角','複眼','大顎','甲殻','翅','節'],
 arachnid:['8脚','腹部','鋏角','毒牙','糸','甲殻'],
 undead:['顔','骨','衣装','鎧','装備','魔法'],
 golem:['石片','装甲','胸核','関節','武器','発光'],
 fiend:['顔','角','翼','尾','衣装','武器'],
 aquatic:['鰭','触手','吸盤','甲羅','水紋','発光']
});
export const FAMILY_MESH_STRATEGY=Object.freeze({
 beast:'犬科の写実四足素体を共有し、種族別の首毛・牙・属性を別アセット化',
 feline:'猫科の種別により虎・豹・獅子を分割。違う猫科を無理に同一シルエットにしない',
 avian:'鳥は種類別の翼骨格。グリフォン・不死鳥・梟へ鷲の完成メッシュを直貼りしない',
 reptile:'蜥蜴・ワイバーン・ヒュドラ・海竜の骨格を分離。頭数・脚数・翼有無を検査',
 insect:'昆虫6脚・複眼・節の整合を先に完成、種別の角・翅・鎌を接続',
 arachnid:'蜘蛛8脚と腹部・鋏角を必須とし、女王も蜘蛛の脚数を維持',
 undead:'人間モデル共通素体を使い、骨・包帯・顔・衣装・魔法を個体差分化',
 golem:'人間型の関節構造を活かした石・青銅・結晶・溶岩の部品化',
 fiend:'共通人型の顔・身体と魔族の翼・角・尾・衣装を分離管理',
 aquatic:'蛸・クラーケン・蛇竜・スライム・海神獣を別素体で制作'
});
const candidates=Object.freeze({
 m001:['r-wolf'], m002:['r-wolf'],m003:['r-wolf'],m004:['r-wolf'],
 m007:['r-tiger'],m009:['r-jaguar'],m010:['r-tiger'],
 m011:['r-eagle']
});
const anatomicalReferences=Object.freeze({
 m007:['w-tiger'],m008:['w-lion','w-lioness'],
 m009:['w-snowleopard','w-cheetah'],m010:['w-tiger'],
 m012:['r-eagle','w-lion'],m013:['r-eagle'],
 
 m016:['s-lizard','s-gecko'],
 m017:['s-lizard'],
 m018:['s-dragon-rig'],
 m019:['s-salamander'],m020:['s-snake'],
 m021:['s-beetle-male'],m022:['s-beetle-male'],
 m023:['s-beetle-flight'],m024:['s-beetle-male'],
 m025:['s-beetle-flight'],
 m026:['s-spider','s-spider-rig'],
 m027:['s-spider','s-spider-rig'],
 m028:['s-spider','s-spider-rig'],
 m029:['s-spider','s-spider-rig'],
 m030:['s-spider','s-spider-rig'],
 m046:['s-slime-cc0'],
 m047:['s-octopus','s-octopus-ccby'],
 m048:['s-snake'],
 m049:['s-octopus'],
 m050:[]
});
const shapes=Object.freeze({
 m001:'large-wolf',m002:'large-wolf',m003:'large-wolf',m004:'large-wolf',m005:'forest-wolf',
 m006:'panther',m007:'sabretooth-tiger',m008:'lion',m009:'leopard',m010:'tiger',
 m011:'eagle',m012:'griffin',m013:'phoenix',m014:'owl',m015:'tengu-humanoid',
 m016:'giant-lizard',m017:'basilisk',m018:'multiheaded-hydra',m019:'salamander',m020:'leviathan',
 m021:'beetle',m022:'rhinoceros-beetle',m023:'mantis',m024:'scarab',m025:'divine-beetle',
 m026:'cave-spider',m027:'tarantula',m028:'frost-spider',m029:'fire-spider',m030:'spider-queen',
 m046:'slime',m047:'octopus',m048:'sea-serpent',m049:'kraken',m050:'coral-sea-beast'
});
const notes=Object.freeze({
 m001:'現在のr-wolfと追加シェーダを基礎とし、白化0/四肢/攻撃の実機確認が先',
 m002:'r-wolfの体型を維持。炎毛・炎牙の表現は新たな未リグ板ポリで代替しない',
 m003:'r-wolfに氷毛・凍結エフェクト。物理の毛束と氷パーツの貫通を検査',
 m004:'r-wolfの紫電表現はテクスチャと発光から。走行アニメを検査',
 m005:'m001狼王の頭骨・胴体・脚関節・毛並みを母体とする古狼。緑の毛と尾・属性効果を追加',
 m006:'m001狼王の実断面メッシュを猫型に縮約した黒豹。上寄りの小さな逆三角鼻とヒゲ',
 m007:'虎骨格への剣歯を装着、牙が顎と干渉しないこと',
 m008:'獅子専用のたてがみ・頭骨が未確定。虎は構造参考のみ',
 m011:'鷲GLBは外観参考、飛行リグと羽ばたき未完成',
 m012:'鷲の翼と獅子の体を無理に接合せず、専用グリフォン骨格が必要',
 m013:'炎の鳥は翼骨格と発光が必要。鷲は参考のみ',
 m014:'梟の目・首回転・翼骨格を専用化',
 m016:'巨大蜥蜴をワニ素体に直置きしない。関節と長尾の比較のみ',
 m018:'ヒュドラは首の本数分の頭部骨と連動アニメが必要',
 m020:'リヴァイアサンは海竜素体が必要',
 m023:'前脚が鎌、かつ六脚であること',
 m026:'脚は必ず8本',
 m030:'人型顔の追加だけでは女王蜘蛛と見なさない。8脚を維持',
 m046:'透明感と内部構造を持つ専用スライムシェーダ・素体が必要',
 m047:'8本腕のタコ骨格と吸盤のアニメが必要',
 m048:'蛇状の海竜の鰭・長胴を固有化',
 m049:'巨大クラーケンの腕・吸盤の位置と水面を検証'
});
// Owner-protected models: never modify or QA m005/m006 or their summon mirrors.
const protectedIds=new Set(['m005','m006']);
const humanoids=new Set(HUMAN_MONSTER_IDS);
const shared=monster=>{
 const humanoid=humanoids.has(monster.id);
 const protectedModel=protectedIds.has(monster.id);
 const candidatesFor= protectedModel?[]:(candidates[monster.id]||[]);
 const referencesFor= protectedModel?[]:(anatomicalReferences[monster.id]||[]);
 return {
  family:monster.family,
  archetype:humanoid?'humanoid-'+monster.family:(shapes[monster.id]||monster.family),
  baseMesh:humanoid?'current-human-rig':
    ['m005','m006'].includes(monster.id)?'procedural:m001':
    monster.id==='m001'?'r-wolf':'legacy',
  candidateSources:candidatesFor,
  anatomyReferences:referencesFor,
  stage:protectedModel?'protected':humanoid?'human':
    ['m005','m006'].includes(monster.id)?'m001-derived':
    monster.id==='m001'?'default':candidatesFor.length?'candidate':
    referencesFor.length?'anatomy':'missing',
  canModify:!protectedModel,
  reusedParts:FAMILY_REUSE_PARTS[monster.family],
  strategy:FAMILY_MESH_STRATEGY[monster.family],
  instructions:notes[monster.id]||'現在の形状・関節・装飾を維持し、基準画とのシルエット照合と七動作検査を実施',
  modelSelectable:!humanoid&&!protectedModel&&
    !['m005','m006'].includes(monster.id),
  baselineRequired:true,
  originalPreserved:true,
  sourceRigValidated:false,
  rebuiltGLBComplete:false,
  kpiPass:false
 };
};
const monsterWork=MONSTER_CATALOG.map(m=>{
 const common=shared(m);
 return Object.freeze({
  ...common,id:m.id,monsterId:m.id,name:m.name,kind:'monster',
  priority:common.stage==='default'?1:common.stage==='candidate'?2:
   common.stage==='human'?4:common.stage==='protected'?9:3,
  referencePromptId:m.id,variant:'enemy',
  appearance:'敵版は野性味・攻撃性・種族ごとの傷や魔力を強調'
 });
});
const byMonster=Object.fromEntries(monsterWork.map(x=>[x.id,x]));
const summoned=MONSTER_SUMMON_ENTRIES.map(s=>{
 const parent=byMonster[s.monsterId];
 return Object.freeze({
  ...parent,id:s.id,name:s.name,kind:'summon',priority:parent.priority+1,
  referencePromptId:s.id,variant:'summon',
  baseMesh:parent.id==='m001'?'r-wolf':parent.baseMesh,
  appearance:'敵版の素体・骨格から派生。色、眼、魔法発光、召喚演出を変え、敵版とは別の品質判定',
  instructions:parent.instructions+'／召喚版は親モデルの完成とLOD検査の後に派生'
 });
});
const dedicatedDefs=[
 ['wolf','専用召喚狼','beast','large-wolf','r-wolf',['r-wolf'],[],1,false],
 ['wyvern','飛竜','reptile','wyvern','legacy',[],['s-dragon-low'],3,false],
 ['dragon','古竜','reptile','ancient-dragon','legacy',[],['s-dragon-rig'],3,false],
 ['elder_dragon','天竜','reptile','celestial-dragon','legacy',[],['s-dragon-rig','s-dragon-low'],3,false],
 ['dragon_lord','竜王・ドラゴン形態','reptile','dragon-lord','legacy',[],['s-dragon-rig'],3,false],
 ['forest_archer','森の精霊弓士','fiend','humanoid-archer','current-human-rig',[],[],4,true],
 ['seraph_guardian','光翼の守護天使','fiend','humanoid-angel','current-human-rig',[],[],4,true],
 ['horse','軍馬','beast','horse','legacy',[],[],3,false]
];
const dedicated=dedicatedDefs.map(([id,name,family,archetype,baseMesh,source,reference,priority,humanoid])=>
 Object.freeze({
  id,name,kind:'dedicated-summon',monsterId:null,family,archetype,
  baseMesh,candidateSources:source,anatomyReferences:reference,priority,
  stage:id==='wolf'?'default':humanoid?'human':
   source.length?'candidate':reference.length?'anatomy':'missing',
  canModify:true,modelSelectable:!humanoid,
  reusedParts:FAMILY_REUSE_PARTS[family],
  strategy:FAMILY_MESH_STRATEGY[family],
  referencePromptId:id,variant:'summon',
  instructions:id==='horse'?'実馬の骨格を使い、鞍と騎手の同期を保持':
   id==='dragon_lord'?'竜王の人型形態を変更せず、竜本体だけを別形状で再構成':
   id==='seraph_guardian'?'髭なし白肌の天使。旧高品質の翼を保持し、浮遊飛行と衣装を確認':
   id==='wolf'?'r-wolfを基礎とした召喚専用カラー。敵狼王とは別に7動作を評価':
   '種別固有の骨格を保持し、7動作と装備・翼・飛行を確認',
  appearance:'召喚獣専用の属性発光と自然な骨格・動作',
  baselineRequired:true,originalPreserved:true,sourceRigValidated:false,
  rebuiltGLBComplete:false,kpiPass:false
 }));
export const CREATURE_RECONSTRUCTION_WORK=Object.freeze([
 ...monsterWork,...summoned,...dedicated
]);
export const CREATURE_RECONSTRUCTION_BY_ID=Object.freeze(
 Object.fromEntries(CREATURE_RECONSTRUCTION_WORK.map(item=>[item.id,item]))
);
export const CREATURE_RECONSTRUCTION_SUMMARY=Object.freeze({
 total:CREATURE_RECONSTRUCTION_WORK.length,
 monster:monsterWork.length,summon:summoned.length,dedicated:dedicated.length,
 humanMonster:monsterWork.filter(x=>x.stage==='human').length,
 protectedMonster:monsterWork.filter(x=>x.stage==='protected').length,
 adoptedDefaults:CREATURE_RECONSTRUCTION_WORK.filter(x=>x.stage==='default').length,
 completed:CREATURE_RECONSTRUCTION_WORK.filter(x=>x.rebuiltGLBComplete).length,
 qualityPassed:CREATURE_RECONSTRUCTION_WORK.filter(x=>x.kpiPass).length
});
export function validateReconstructionPlan(){
 const s=CREATURE_RECONSTRUCTION_SUMMARY;
 if(s.total!==108||s.monster!==50||s.summon!==50||s.dedicated!==8||
  s.humanMonster!==16||s.protectedMonster!==2)
  throw Error('Unexpected reconstruction scope/count');
 const ids=new Set(CREATURE_RECONSTRUCTION_WORK.map(x=>x.id));
 if(ids.size!==108)throw Error('Duplicated reconstruction ids');
 for(const x of CREATURE_RECONSTRUCTION_WORK){
  if(!x.originalPreserved||x.kpiPass||x.rebuiltGLBComplete)
   throw Error('Unverified reconstruction declared complete: '+x.id);
  for(const donor of [...x.candidateSources,...x.anatomyReferences])
   if(!VERIFIED_CATALOG_KEYS.has(donor))throw Error('Unknown 3D donor: '+donor);
  for(const donor of x.candidateSources)
   if(Object.hasOwn(WEB_CREATURE_ANATOMY_REFERENCES,donor)||
      Object.hasOwn(REAL_BODY_CANDIDATES,donor)||
      Object.hasOwn(WEB_CREATURE_MESH_SOURCES,donor))
    throw Error('Reference or low-poly model promoted as real base: '+x.id+'/'+donor);
  if(x.stage==='protected'&&x.canModify)throw Error('Protected source modified');
  if(x.kind==='summon'&&!byMonster[x.monsterId])
   throw Error('Summon lacking canonical parent');
 }
 return true;
}
validateReconstructionPlan();
