/**
 * Quantified monster/creature reference QA (v1).
 * Evidence must be measured/observed: never equate asset-registration,
 * AI rendering, or a default mesh choice with a passed quality gate.
 */
export const MONSTER_QUALITY_SCHEMA='hai-gin/monster-quality-review/v1';
export const MONSTER_QUALITY_TARGET=90;
export const MONSTER_QUALITY_MIN_RATINGS=Object.freeze({
 design:4,anatomy:4,materials:4,actions:4,parts:4,mobile:3,regression:4,rights:5
});
export const MONSTER_QUALITY_FIELDS=Object.freeze([
 Object.freeze({id:'design',name:'2D基準画との一致',weight:20,
  description:'顔、体格、シルエット、属性、種族固有特徴の一致'}),
 Object.freeze({id:'anatomy',name:'体型・骨格・形状',weight:15,
  description:'脚の数と接地、関節、骨の変形、ボディの厚み'}),
 Object.freeze({id:'materials',name:'テクスチャ・PBR',weight:15,
  description:'毛・鱗・肌・岩・金属の質感、UV、影、自然な色'}),
 Object.freeze({id:'actions',name:'7種類のアクション',weight:20,
  description:'待機・歩行・走行・攻撃・咆哮・被弾・死亡の自然さ'}),
 Object.freeze({id:'parts',name:'装飾・既存パーツ',weight:10,
  description:'角、翼、鎧、尻尾、武器などの追従・貫通防止'}),
 Object.freeze({id:'mobile',name:'Android性能・LOD',weight:10,
  description:'目標機種での実測FPS、メモリ、長時間安定性'}),
 Object.freeze({id:'regression',name:'画面間整合・切戻し',weight:5,
  description:'図鑑・採用・召喚・戦闘の同一モデル、旧モデル復元'}),
 Object.freeze({id:'rights',name:'商用権利・出典',weight:5,
  description:'権利確認、著作者表示、ライセンス対応'})
]);
export const MONSTER_QUALITY_ACTIONS=Object.freeze([
 Object.freeze({id:'idle',label:'待機'}),
 Object.freeze({id:'walk',label:'歩行'}),
 Object.freeze({id:'run',label:'走行'}),
 Object.freeze({id:'attack',label:'攻撃'}),
 Object.freeze({id:'roar',label:'咆哮'}),
 Object.freeze({id:'hit',label:'被弾'}),
 Object.freeze({id:'defeat',label:'死亡'})
]);
export const MONSTER_QUALITY_GATES=Object.freeze([
 Object.freeze({id:'referenceChecked',label:'2D基準画・登場部位を確認'}),
 Object.freeze({id:'noWhiteGeometry',label:'白化・飛び出し・三角形崩れが0件'}),
 Object.freeze({id:'noSkinHoles',label:'頭頂・首・足などの穴が0件'}),
 Object.freeze({id:'noDetachedParts',label:'角・羽・鎧・牙などの浮遊・貫通が0件'}),
 Object.freeze({id:'sameModelInGame',label:'ゲーム・図鑑・召喚表示で同じ採用モデル'}),
 Object.freeze({id:'rollbackTested',label:'現行（旧）モデルへの切戻し成功'}),
 Object.freeze({id:'deviceMeasured',label:'Android実機でFPS・安定性を実測'}),
 Object.freeze({id:'rightsChecked',label:'商用利用・帰属表示を確認'})
]);
export const MONSTER_QUALITY_ANATOMY=Object.freeze({
 beast:Object.freeze(['四肢の接地と膝・足首','首・肩・毛並みと牙','尾の根元と走行時の揺れ']),
 feline:Object.freeze(['前後肢と猫科の背骨','顔・耳・爪と体長','尾・ジャンプ・接地']),
 avian:Object.freeze(['両翼と羽根の重なり','足指と爪','飛行・羽ばたき・着地']),
 reptile:Object.freeze(['鱗・角・背棘・長尾','対象種に適合する脚・首・口','噛みつき・飛行または這行']),
 insect:Object.freeze(['昆虫6脚・節・関節','甲殻・大顎・複眼','羽・角・鎌の適正追従']),
 arachnid:Object.freeze(['蜘蛛8脚・節の接地','腹部・鋏角・毒牙','糸・歩行・旋回の自然さ']),
 undead:Object.freeze(['骨・皮膚・包帯の自然さ','服・鎧・武器の密着','破綻のない人型モーション']),
 golem:Object.freeze(['岩・金属・結晶の質感','装甲接合・隙間が意図どおり','重量感・地面への接地']),
 fiend:Object.freeze(['顔・角・翼・尾の整合','衣装・武器の貫通防止','固有魔法・飛行・攻撃の一致']),
 aquatic:Object.freeze(['種ごとの鰭・触手・胴体','水棲特有の関節・吸盤・甲羅','水中動作・水面・攻撃の一致'])
});
export const WOLF_QUALITY_REFERENCE=Object.freeze({
 m001:Object.freeze({title:'灰牙の狼王（敵モンスター）',
  visual:'筋肉質な灰黒い狼。荒い首毛、太い前肢、大きな牙・鉤爪、暗赤色の魔力傷、鋭い橙赤眼。巨大だが四足の骨格は自然',
  compare:'Wolf animated r-wolf → 敵モンスター用の全身差分',
  role:'enemy'}),
 summon_m001:Object.freeze({title:'召喚狼王',
  visual:'灰銀の長毛、神秘的な青白い眼光と控えめな雷光。獣らしい威圧感を保ちながら敵版と区別',
  compare:'Wolf animated r-wolf → 召喚獣版',role:'summon'}),
 wolf:Object.freeze({title:'専用召喚狼',
  visual:'灰白の毛並み・自然な四肢。軽い青白い召喚紋と控えめな魔力光。狼王ほど巨大にはしない',
  compare:'Wolf animated r-wolf → 通常召喚版',role:'summon'})
});
export const WOLF_SOURCE='r-wolf';
export const MOBILE_TEST_PROTOCOL=Object.freeze({
 profile:'Pixel 8a相当のAndroid実機、ブラウザーとゲームの表示設定・画質を記録',
 baseline:'採用前後を同一シーン・同一カメラ・同一敵人数で10分以上比較',
 scenario:'50対50を主要合否条件、1000対1000はLOD別ストレス検証',
 minFps50:30,
 maxCrashCount:0,
 maxMissingTextureCount:0,
 maxWhiteGeometryCount:0,
 fpsMetric:'10分間の1% low FPS（平均FPSとは分離）',
 performanceNote:'30FPSは検証開始の暫定合格値。実機実測に基づき改定する'
});
const isRating=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=5;
const hasText=v=>typeof v==='string'&&v.trim().length>0;
const asBool=v=>v===true;
/** Returns null unless all fields have a valid 0..5 review rating. */
export function monsterQualityScore(ratings){
 if(!ratings||typeof ratings!=='object')return null;
 if(!MONSTER_QUALITY_FIELDS.every(field=>isRating(ratings[field.id])))return null;
 return Math.round(MONSTER_QUALITY_FIELDS.reduce(
  (total,field)=>total+field.weight*ratings[field.id]/5,0)*10)/10;
}
export function assessMonsterQuality(record){
 const ratings=record?.ratings||{};
 const score=monsterQualityScore(ratings);
 const missingRatings=MONSTER_QUALITY_FIELDS
  .filter(field=>!isRating(ratings[field.id])).map(field=>field.id);
 const gates=record?.gates||{};
 const unverified=MONSTER_QUALITY_GATES.filter(field=>!asBool(gates[field.id]))
  .map(field=>field.id);
 const actions=record?.actions||{};
 const missingActions=MONSTER_QUALITY_ACTIONS.filter(field=>!asBool(actions[field.id]))
  .map(field=>field.id);
 const speciesChecks=Array.isArray(record?.speciesChecks)?record.speciesChecks:[];
 const missingAnatomy=speciesChecks.length===3&&speciesChecks.every(asBool)?[]:
  ['speciesAnatomy'];
 const lowCategories=MONSTER_QUALITY_FIELDS.filter(
  f=>isRating(ratings[f.id])&&ratings[f.id]<MONSTER_QUALITY_MIN_RATINGS[f.id]
 ).map(f=>f.id);
 const metrics=record?.metrics||{};
 const measuredFps=Number(metrics.fps1Low);
 const fpsValid=hasText(String(metrics.fps1Low??''))&&
  Number.isFinite(measuredFps)&&measuredFps>=MOBILE_TEST_PROTOCOL.minFps50;
 const crashes=Number(metrics.crashCount);
 const crashesValid=hasText(String(metrics.crashCount??''))&&crashes===0;
 const performanceVerified=Boolean(fpsValid&&crashesValid);
 const evidence=record?.evidence||{};
 const missingEvidence=[];
 if(!hasText(evidence.reference))missingEvidence.push('reference');
 if(!hasText(evidence.renderBefore))missingEvidence.push('renderBefore');
 if(!hasText(evidence.renderAfter))missingEvidence.push('renderAfter');
 if(!hasText(evidence.motion))missingEvidence.push('motion');
 if(!hasText(evidence.device))missingEvidence.push('device');
 if(!hasText(evidence.license))missingEvidence.push('license');
 if(!performanceVerified)missingEvidence.push('performanceMetric');
 const ready=missingRatings.length===0&&unverified.length===0&&
  missingActions.length===0&&missingAnatomy.length===0&&missingEvidence.length===0;
 const status=!ready?'unverified':
  score>=MONSTER_QUALITY_TARGET&&lowCategories.length===0?'pass':'fail';
 return Object.freeze({score,status,ready,pass:status==='pass',
  missingRatings,unverified,missingActions,missingAnatomy,missingEvidence,
  lowCategories,
  threshold:MONSTER_QUALITY_TARGET});
}
export function monsterQualityProgress(record){
 const value=record||{};
 const ratings=MONSTER_QUALITY_FIELDS.filter(f=>isRating(value.ratings?.[f.id])).length;
 const gates=MONSTER_QUALITY_GATES.filter(f=>asBool(value.gates?.[f.id])).length;
 const actions=MONSTER_QUALITY_ACTIONS.filter(f=>asBool(value.actions?.[f.id])).length;
 return Object.freeze({ratings,gates,actions,
  ratedTotal:MONSTER_QUALITY_FIELDS.length,
  gateTotal:MONSTER_QUALITY_GATES.length,actionTotal:MONSTER_QUALITY_ACTIONS.length});
}
