/**
 * 2D reference prompts grounded in the actual 50-species bestiary catalog.
 * These prompts are drafting instructions, not generated or approved images.
 * Distinguish monsters from summons; never present prompt outputs as GLBs.
 */
import {MONSTER_CATALOG,MONSTER_BY_ID,MONSTER_FAMILIES,MONSTER_ELEMENTS} from './monster-catalog.js';
import {HUMAN_MONSTER_IDS} from './monster-character-cosplay-manifest.js';
import {WOLF_QUALITY_REFERENCE} from './monster-quality-kpi.js';
const BODY=Object.freeze({
 beast:'写実的な四足の狼・獣の解剖学、筋肉と肩甲骨、厚い毛、牙と鉤爪',
 feline:'実在猫科の骨格と走行筋、柔軟な背骨、明瞭な耳・鼻・鉤爪・長尾',
 avian:'自然な鳥類骨格と左右対称の翼、層状の風切羽、爪と尾羽',
 reptile:'爬虫類または竜の骨格、鱗のレイヤー、明確な四肢、関節と尻尾',
 insect:'6本脚と外骨格の節、複眼、大顎、種に沿う羽・角・鎌',
 arachnid:'8本の脚と各関節、腹部、毒牙、細かな毛と口器',
 undead:'人体構造に合う骨・筋肉・包帯・鎧、怪物的な顔と破損した衣装',
 golem:'石塊・青銅・晶石の可動接合、重厚な腕脚、素材の摩耗と割れ',
 fiend:'人型または魔族の解剖学を保ち、角・翼・尾と衣装の位置整合',
 aquatic:'種に一致した触手・鰭・吸盤・水棲の体表・骨格と水の表現'
});
const FEATURES=Object.freeze({
 m001:'大型の灰黒い魔狼、厚い首毛、太い前脚、裂傷から赤い魔力が漏れる、赤橙の目と強い牙',
 m002:'燃える胸毛、燻った黒赤の毛並みと口元の火炎',
 m003:'氷の結晶が付いた灰白毛、青い眼光、凍結する吐息',
 m004:'銀紫の毛に沿って走る稲妻、青紫の眼光',
 m005:'苔色の古狼、自然の霊力を宿す老いた毛並み',
 m006:'黒豹の密度の高い艶消し黒毛、影の鉤爪',
 m007:'銀白のサーベルタイガー、巨大な上顎の犬歯',
 m008:'厚い鬣の獅子王、紅蓮の眼と堂々たる体格',
 m011:'精緻な風切羽を備えた巨大な荒野の鷲',
 m012:'鷲頭と獅子の胴体が解剖学的につながるグリフォン',
 m013:'炎を纏う層状の羽を持つ不死鳥、自然な鳥類の翼',
 m018:'多頭の毒竜。各首と胴体の接続が破綻しない',
 m020:'海洋巨竜。長い胴体と水棲の鰭、鱗の細部',
 m021:'角と分節の明確な甲虫、昆虫6脚',
 m023:'鎌状の前脚を持つ大型のカマキリ、6脚',
 m026:'四面基準画準拠。8本の関節脚、暗褐色の重なり甲殻、巨大な腹部、8眼、根元を埋めた湾曲毒牙',
 m027:'装甲型の大型紫毒蜘蛛。8本の節脚、腹部の紫の毒脈、重なり甲殻、突起と曲線毒牙',
 m028:'氷色の重装蜘蛛。8本の節脚、白霧の甲殻、氷晶化した腹部脈、8眼と曲線毒牙',
 m029:'熔岩色の装甲蜘蛛。8本の節脚、赤熱した腹部亀裂、鋭い関節棘と湾曲毒牙',
 m030:'紫黒の女王蜘蛛。四面基準画の巨大な甲殻腹部、マゼンタの亀裂発光、8眼、8本の装甲節脚、毒牙と棘を再現',
 m036:'大岩を重ねた巨大ゴーレム、脆い接合を避けた可動の関節',
 m041:'小さなインプ、翼・角・尾が体の骨格と連動',
 m046:'青と水色の透明ゲルの外殻、広がる裾、内包した発光渦核、浮遊泡、内部結晶、曲がるゲル角を四面基準画に準拠',
 m047:'四面基準画準拠。紫紺の膨らんだ外套膜と装甲棘、黄眼、青緑の発光模様、太い8本の3関節触腕、各触腕の凹凸吸盤',
 m048:'細長い水棲蛇竜、鱗と鰭の連続性',
 m049:'四面基準画準拠。大型の紫黒クラーケン、巨大な後方外套膜、黄金の捕食眼、青緑発光線、8本の長く太い触腕と凹んだ吸盤'
});
const avoid='文字・ロゴ・番号・コマ割り・UI・透かしは一切入れない。脚の本数を間違えない。人体を動物へ流用しない。不要な白いポリゴン・浮く装飾・貫通・T字姿勢は禁止。';
export function monsterDesignPrompt(id,{summoned=false}={}){
 const baseId=String(id||'').replace(/^summon_/,'');
 const m=MONSTER_BY_ID[baseId];
 if(!m)throw Error('不明なモンスターID: '+id);
 const human=HUMAN_MONSTER_IDS.includes(m.id);
 const wolf=WOLF_QUALITY_REFERENCE[id]?.visual||WOLF_QUALITY_REFERENCE[m.id]?.visual;
 const detail=wolf||FEATURES[m.id]||'実在生物または魔獣として整合する種族固有の造形';
 const body=BODY[m.family]||m.anatomy;
 const summon=summoned||String(id).startsWith('summon_');
 return [
  '『灰銀のレゾナンス』公式候補の2Dキャラクター基準画を1枚制作。',
  '対象：'+m.id+' '+m.name+'。分類：'+MONSTER_FAMILIES[m.family]+'、属性：'+MONSTER_ELEMENTS[m.element]+'、レアリティ：'+m.rarity+'。',
  '外観：'+detail+'。身体構造：'+body+'。',
  '配色：基調'+m.colors.base+'、補助'+m.colors.highlight+'、差し色'+m.colors.accent+'。',
  '能力の表現：'+m.skill+'。既存ゲームモデルにある角・羽・鎧・武器・尾などの固有パーツを自然な部位に残す。',
  summon?'召喚獣版：種族の外見を維持し、眼や属性の魔法発光を調整。敵と区別できる神秘性。':
   '敵モンスター版：攻撃的な顔つきと威圧感。召喚獣版より野性的で凶暴な演出。',
  human?'人型キャラクター：人体骨格と衣装・顔モデルを使用し、獣の身体メッシュを移植しない。':
   '非人型：生物解剖学と可動関節を優先。適合する四肢・翼・触手の数を厳守。',
  '完成目標：リアルなハイエンド3Dゲーム用の写実的2Dコンセプト。前方斜めからの全身、頭部・手足が画面内に収まる。',
  avoid
 ].join('\n');
}
export const MONSTER_REFERENCE_COVERAGE=Object.freeze(MONSTER_CATALOG.map(m=>
 Object.freeze({id:m.id,name:m.name,family:m.family,hasAuthoredSpecificFeature:!!FEATURES[m.id]})
));
