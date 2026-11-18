/** Quality lanes are goals, not claims that an image was translated to game mesh. */
export const CHARACTER_QUALITY_SIX_LANES = Object.freeze({
  "faceHair": {
    "title": "顔・髪｜造形・動作・写実品質",
    "gamePipeline": [
      "src/character-face-catalog-v64.js",
      "src/face-expression-animation-v48.js",
      "src/independent-face-masters.js",
      "src/face-feature-meshes.js",
      "src/face-scalp-wig.js",
      "src/face-wig-styles.js",
      "src/hero-hair-controls-v43.js",
      "face-mesh-studio.html",
      "face-body-studio.html",
      "male-body-studio.html",
      "src/character-system/hair-attachment-runtime.js",
      "src/character-system/battle-visual-pipeline.js",
      "tactics-wireframe.html"
    ],
    "hairStylePartition": "既存男女髪型IDを安定ソートして6群へ均等割当。全髪型を対象、重複なく毎時一巡。",
    "lanes": [
      {
        "id": "eyes",
        "title": "目・眉・まつ毛",
        "criteria": [
          "黒目と眼瞼の正しい前後関係",
          "虹彩・瞳孔の立体感と潤い",
          "まつ毛・アイラインの自然な生え際",
          "瞬きでの貫通・浮遊・消失なし"
        ]
      },
      {
        "id": "nose",
        "title": "鼻・輪郭・肌",
        "criteria": [
          "鼻梁/鼻尖/小鼻/鼻孔の独立した立体造形",
          "正面・側面・斜めの顔幅整合",
          "鼻と頬・額の陰影が破綻しない",
          "肌PBRと年齢差が顔/首で連続"
        ]
      },
      {
        "id": "mouth",
        "title": "口・唇・歯・顎",
        "criteria": [
          "上唇/下唇/口角のボリューム連続",
          "口腔と歯列は開口時のみ自然に見える",
          "顎・頬の追従変形",
          "発話中も唇と顔の隙間なし"
        ]
      },
      {
        "id": "expression",
        "title": "表情・視線・アクション",
        "criteria": [
          "喜怒哀楽と戦闘表情を筋肉ベースで変形",
          "瞬きと口パクの合成で破綻なし",
          "頭・眼球・表情の同期",
          "男女・各年代・各顔型に適用"
        ]
      },
      {
        "id": "hair_shape",
        "title": "髪型6群・頭皮・根元",
        "criteria": [
          "男女全髪型を6群に均等仕分け",
          "頭頂・生え際・前/横/後髪のボリューム自然",
          "地肌の誤露出・後頭UV継ぎ目なし",
          "眉・目・肩・鎧との交差なし"
        ]
      },
      {
        "id": "hair_motion",
        "title": "髪の揺れ・LOD・再描画",
        "criteria": [
          "走行・跳躍・騎乗・戦闘時の接続安定",
          "近中遠LODでハゲ・スパイク・髪型変化なし",
          "カメラ接近後に時間経過で修復する現象なし",
          "Pixel/AndroidのFPSと品質を両立"
        ]
      }
    ]
  },
  "outfit": {
    "title": "衣装｜造形・材質・着用動作",
    "gamePipeline": [
      "outfit-maintenance.html",
      "src/outfit-maintenance-model.js",
      "src/character-system/rigged-outfit-runtime.js",
      "src/character-system/outfit-surface-policy.js",
      "src/character-system/garment-coverage-runtime.js",
      "src/character-system/battle-visual-pipeline.js",
      "tactics-wireframe.html"
    ],
    "lanes": [
      {
        "id": "silhouette",
        "title": "衣装の骨格・シルエット",
        "criteria": [
          "職業別に実用的な裁断/構造",
          "男女・体型と衣装輪郭のフィット",
          "見本同等のレイヤー構造",
          "背面を板状にしない"
        ]
      },
      {
        "id": "materials",
        "title": "布・皮革・金属・PBR",
        "criteria": [
          "素材ごとのroughness/normal/色を適正化",
          "皮革と金属の反射・摩耗・縫い目",
          "顔・手の肌マテリアルを衣装で上書きしない",
          "露出部のみ肌を描画"
        ]
      },
      {
        "id": "seams",
        "title": "縫合・装飾・密着",
        "criteria": [
          "肩/腕/腰/膝の隙間・貫通なし",
          "浮遊バックル・胸飾り・背面板なし",
          "鎧と靴の境界で肌が破れない",
          "金具・ベルト・布の荷重と支点が自然"
        ]
      },
      {
        "id": "accessories",
        "title": "小物・留め具・職業差分",
        "criteria": [
          "帽子/フード/盾/剣帯の取付位置",
          "ポーチ/マント/刺繍/留め具の造形精度",
          "装飾が背面や素肌へ誤投影しない",
          "レアリティ差分をソース正本に保持"
        ]
      },
      {
        "id": "motion",
        "title": "リグ・関節・戦闘アクション",
        "criteria": [
          "骨追従とクロス差分が一致",
          "腕振り/しゃがみ/騎乗/ジャンプで破綻なし",
          "馬・召喚獣への人体貫通なし",
          "装備品が頭部・背中に誤配置されない"
        ]
      },
      {
        "id": "lod_release",
        "title": "近中遠LOD・本編適用ゲート",
        "criteria": [
          "実アセットと本編の読込経路一致",
          "中距離で素肌・髪・衣装が抜けない",
          "1000対1000に向けてFPS差分を実測",
          "QA合格後のみGitHub main→Pages公開"
        ]
      }
    ]
  }
});
export const CHARACTER_HAIR_PARTITION_COUNT = 6;
/** Deterministically distribute every existing hairstyle ID exactly once. */
export function partitionHairStyles(styleRows, partitions=CHARACTER_HAIR_PARTITION_COUNT){
 if(!Number.isInteger(partitions)||partitions<1)throw Error('Invalid hair partition count');
 const rows=[...styleRows].sort((a,b)=>String(a.gender+':'+a.id).localeCompare(String(b.gender+':'+b.id),'en'));
 const unique=new Set(rows.map(row=>row.gender+':'+row.id));
 if(unique.size!==rows.length)throw Error('Duplicate canonical hair identity');
 const buckets=Array.from({length:partitions},(_,index)=>({id:'hair-'+(index+1),items:[]}));
 rows.forEach((row,index)=>buckets[index%partitions].items.push({id:row.id,gender:row.gender,label:row.label}));
 return buckets;
}
