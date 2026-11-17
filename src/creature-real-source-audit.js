/**
 * Real-source acceptance contract for every monster/summon master.
 *
 * Geometry counts are diagnostic ONLY. Repeated procedural subdivision,
 * a tinted donor, 2D reference imagery, and exported runtime GLB cannot be
 * misreported as a licensed/approved photoreal 3D master.
 */
import {CREATURE_MASTER_ENTRIES} from './creature-master-library.js';
import {CREATURE_RECONSTRUCTION_BY_ID} from './creature-reconstruction-plan.js';

export const REAL_BASE_CRITERIA=Object.freeze({
 beast:Object.freeze({anatomy:'犬科の肩甲骨・肘・飛節・趾・歩容・毛流れ',surface:'部位別毛皮・鼻鏡・爪・皮膚PBR',motion:'四肢対角歩行・伸縮疾走'}),
 feline:Object.freeze({anatomy:'猫科固有の頭骨・脊柱・肩・爪・尾',surface:'短毛/鬣/皮膚/角膜の独立材質',motion:'柔軟な背骨と跳躍・着地'}),
 avian:Object.freeze({anatomy:'翼の肩肘手首・風切羽/覆い羽・胸骨',surface:'羽軸/羽枝・嘴・爪・羽毛PBR',motion:'翼展開・飛翔・着地'}),
 reptile:Object.freeze({anatomy:'頭骨・顎・連続頸椎・体節・尾椎・鰭/翼の個体差',surface:'鱗サイズ分布・濡れ・粗さ・腹部皮膚',motion:'蛇行/四肢歩行・遊泳・噛みつき'}),
 insect:Object.freeze({anatomy:'頭胸腹・六脚の節・外骨格・翅のヒンジ',surface:'甲殻の凹凸・節膜・色素分布',motion:'六脚の交互三脚歩行・翅の展開'}),
 arachnid:Object.freeze({anatomy:'頭胸部・腹部・八脚の節・鋏角',surface:'剛毛・甲殻・眼の微細質感',motion:'八脚支持歩行・糸/毒の攻撃'}),
 undead:Object.freeze({anatomy:'骨/筋/顔/包帯/鎧の人体構造',surface:'骨・腐蝕肌・布・金属の独立PBR',motion:'人型リグ・衣服貫通なし'}),
 golem:Object.freeze({anatomy:'荷重を支える石塊・内骨格・可動関節',surface:'石/金属/結晶/溶岩のPBR',motion:'関節接地・荷重移動'}),
 fiend:Object.freeze({anatomy:'人物頭骨・眼窩・翼/角/尾の接合',surface:'肌・眼・角・革/金属PBR',motion:'共通人体リグと種族固有アクション'}),
 aquatic:Object.freeze({anatomy:'頭足/粘液/海蛇/珊瑚種別に独立した身体',surface:'湿潤皮膚・吸盤・鱗・粘液・透過',motion:'遊泳・触腕の連続変形'})
});
export const REAL_SOURCE_ACCEPTANCE=Object.freeze([
 '前後左右の同一個体2D基準画と一致',
 '種族固有の形状・関節を持つ実原型GLB/Blendを保存',
 '原型の出所・作者・商用利用許諾を確認',
 'BaseColor/Normal/Roughness/AO等の部位別PBRを検査',
 '静止・移動・攻撃・被弾・死亡の実リグ動作を検査',
 '正面・横・背面・斜めのレンダリングを基準画と比較',
 'source→near/mid/farのリトポロジー・ベイクと実機検証'
]);
const sectionalFamilies=new Set(['beast','feline','avian','insect','arachnid','reptile']);
// m005/m006 are now reconstructable m001 source morphs, not frozen legacy bases.
const protectedIds=new Set();
export const REAL_SOURCE_AUDIT=Object.freeze(CREATURE_MASTER_ENTRIES.map(entry=>{
 const plan=CREATURE_RECONSTRUCTION_BY_ID[entry.id];
 if(!plan||!REAL_BASE_CRITERIA[entry.family])
   throw Error('Real-source coverage missing: '+entry.id);
 const protectedSource=protectedIds.has(entry.id)||entry.protected===true;
 const proceduralSections=!protectedSource&&
   (sectionalFamilies.has(entry.family)||entry.baseId==='m048');
 // This is geometry progress, NOT approval of a real 3D master.
 const form=entry.engine.includes('human')||entry.engine==='canonical-female-rig'
   ?'shared-humanoid-base':proceduralSections?'sectional-procedural-source':
     'legacy-procedural-source';
 return Object.freeze({
  id:entry.id,baseId:entry.baseId,kind:entry.kind,name:entry.name,
  family:entry.family,archetype:plan.archetype,
  protected:protectedSource,modifiable:!protectedSource,
  currentSource:form,
  candidateSources:Object.freeze([...(plan.candidateSources||[])]),
  anatomyReferences:Object.freeze([...(plan.anatomyReferences||[])]),
  criteria:REAL_BASE_CRITERIA[entry.family],
  requiredChecks:REAL_SOURCE_ACCEPTANCE,
  realSourceApproved:false,
  rigVerified:false,
  referenceApproved:false,
  gameLodBaked:false,
  photoQualityCertified:false,
  status:protectedSource?'既存モデル保護／変更対象外':
   '原型を写実ベースで再制作・検証する必要あり'
 });
}));
export const REAL_SOURCE_BY_ID=Object.freeze(Object.fromEntries(
 REAL_SOURCE_AUDIT.map(entry=>[entry.id,entry])
));
export const REAL_SOURCE_SUMMARY=Object.freeze({
 total:REAL_SOURCE_AUDIT.length,
 protected:REAL_SOURCE_AUDIT.filter(x=>x.protected).length,
 pending:REAL_SOURCE_AUDIT.filter(x=>x.modifiable&&!x.realSourceApproved).length,
 realSourceApproved:REAL_SOURCE_AUDIT.filter(x=>x.realSourceApproved).length
});
export function realSourceAuditFor(id){
 return REAL_SOURCE_BY_ID[id]||null;
}
if(REAL_SOURCE_SUMMARY.total!==108||REAL_SOURCE_SUMMARY.protected!==0||
   REAL_SOURCE_SUMMARY.realSourceApproved!==0||
   Object.keys(REAL_SOURCE_BY_ID).length!==108)
 throw Error('Real-source verification counts are inconsistent');
