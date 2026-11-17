/** 50 enemy + 50 mirror summons + eight dedicated summons.
 * Family lanes traverse source IDs; no "completed" based on a manifest alone.
 */
export const CREATURE_SIX_FAMILY_LANES = Object.freeze([
  {
    "id": "canid_feline",
    "name": "犬科・猫科",
    "families": [
      "beast",
      "feline"
    ],
    "criteria": [
      "実在動物に基づく頭骨・吻/鼻・歯・顎・目",
      "四肢と背骨が接続し走行/ジャンプで裂けない",
      "毛根・毛流れ・耳・尻尾を自然なメッシュとPBRで再構成",
      "m005/m006はm001の物理メッシュをコピーして種別変形する。猫の鼻は小さく上寄りの逆三角形",
      "近中遠で体型/毛が崩れずAndroid FPSを守る"
    ]
  },
  {
    "id": "birds",
    "name": "鳥・飛行系",
    "families": [
      "avian"
    ],
    "criteria": [
      "鳥種別の翼骨・羽根・嘴・足指・尾羽の形態",
      "鴉天狗人型は鳥モデルへ無理に変形しない",
      "羽ばたき・滑空・旋回・飛行着地時の接合保護",
      "羽根厚み/半透明回避/金属反射でPBR品質維持",
      "遠距離LODでも羽の輪郭を維持"
    ]
  },
  {
    "id": "reptile_aquatic",
    "name": "竜・爬虫類・水棲",
    "families": [
      "reptile",
      "aquatic"
    ],
    "criteria": [
      "爬虫/蛇/多頭竜/水棲ごとの別骨格",
      "鱗・鼻孔・牙・舌・胸郭のリアルな連続",
      "翼・鰭・触手・尾の根元とアクションを破綻させない",
      "水面/水中の演出と本体FXを分離",
      "m020/m048のUVと動的境界QAを優先"
    ]
  },
  {
    "id": "insects_arachnids",
    "name": "昆虫・蜘蛛",
    "families": [
      "insect",
      "arachnid"
    ],
    "criteria": [
      "昆虫6脚と蜘蛛8脚を厳密区別",
      "外骨格の節と関節・触角・甲殻の連続",
      "飛行/歩行/糸/攻撃時に腹部と脚が分断しない",
      "複眼・鋏角・節足表面のPBR",
      "遠景で脚本数・種別特徴を保持"
    ]
  },
  {
    "id": "undead_fiend",
    "name": "不死・魔族・人型",
    "families": [
      "undead",
      "fiend"
    ],
    "criteria": [
      "人型16種は共通人物母体の顔髪を使う",
      "頭頂露出・眉・目・顔・衣装・背面板を修復",
      "翼・角・武器・布・装飾は接合元の骨へ追従",
      "魔法/飛行/噛みつきアクションを区別",
      "男女召喚士/天使/竜王の専用属性を守る"
    ]
  },
  {
    "id": "constructs",
    "name": "岩・金属・結晶・ゴーレム",
    "families": [
      "golem"
    ],
    "criteria": [
      "石材の継ぎ目/鎧パーツ/胸部コアに構造上の理由を持たせる",
      "金属・岩石・水晶・熔岩のPBRを区別",
      "重みのある歩行・攻撃と接地を表現",
      "パーツの浮遊が演出以外で発生しない",
      "LOD・影・バッチングを実機FPSで評価"
    ]
  }
]);
export function familyLaneFor(family){
 const matches=CREATURE_SIX_FAMILY_LANES.filter(x=>x.families.includes(family));
 if(matches.length!==1)throw Error('Noncanonical creature family: '+family);
 return matches[0];
}
export function taxonomyBatch(work,group,slot){
 if(!Number.isInteger(slot)||slot<0||slot>=CREATURE_SIX_FAMILY_LANES.length)throw Error('Invalid six-lane slot');
 if(!['creatureMonster','creatureSummon'].includes(group))throw Error('Invalid creature batch');
 const lane=CREATURE_SIX_FAMILY_LANES[slot],kinds=group==='creatureMonster'?['monster']:['summon','dedicated-summon'];
 return {lane,items:work.filter(x=>kinds.includes(x.kind)&&lane.families.includes(x.family))};
}
