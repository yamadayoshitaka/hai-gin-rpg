/**
 * v67 hair catalog: two VERIFIED anatomical donors only.
 * Short styles re-use the approved buzz scalp/cap/fibres; all longer cuts
 * re-use the approved Sadako donor crown, temple seam and garment collision.
 * Retired styles remain importable for saved data but are no longer listed.
 *
 * tuple: id, label, base, length, face, curl, part, temple length ratio
 * base: buzz | sadako
 * face: center (forehead open) | bangs (straight brow-above fringe) | tucked
 *       (one-length hair held behind the ear, no face curtain)
 * curl: straight | inward | outward | sauvage (invisible salon rods)
 */
const F=[
 ['rb-f-pixie','ピクシーショート','buzz',.125,'center','straight','side',1],
 ['rb-f-natural-short','ナチュラルショート','buzz',.175,'center','straight','side',1],
 ['rb-f-ear-short','耳出しショート','buzz',.195,'center','straight','side',.65],
 ['rb-f-bangs-short','眉丈前髪ショート','buzz',.22,'bangs','straight','center',.82],
 ['rb-f-center-short','センター分けショート','buzz',.23,'center','straight','center',.90],
 ['rb-f-wolf-short','ショートウルフ','buzz',.255,'center','outward','side',.72],
 ['rb-f-softperm-short','ショートパーマ','buzz',.245,'center','sauvage','side',.92],
 ['rb-f-bob-straight','ストレートボブ','sadako',.35,'tucked','straight','center',1],
 ['rb-f-bob-bangs','前髪ありボブ','sadako',.38,'bangs','straight','center',1],
 ['rb-f-bob-in','内巻きボブ','sadako',.39,'tucked','inward','center',1],
 ['rb-f-bob-out','外ハネボブ','sadako',.40,'tucked','outward','center',1],
 ['rb-f-bob-wave','ウェーブボブ','sadako',.42,'bangs','sauvage','center',1],
 ['rb-f-medium','ミディアムストレート','sadako',.56,'tucked','straight','center',1],
 ['rb-f-shoulder','眉丈前髪・肩丈','sadako',.61,'bangs','straight','center',1],
 ['rb-f-medium-out','外ハネミディアム','sadako',.63,'center','outward','side',1],
 ['rb-f-medium-wave','ウェーブミディアム','sadako',.64,'center','sauvage','center',1],
 ['rb-f-wolf-medium','ミディアムウルフ','sadako',.68,'center','outward','side',.72],
 ['rb-f-semilong','セミロング','sadako',.84,'tucked','straight','center',1],
 ['rb-f-layered','レイヤーロング','sadako',1.02,'center','inward','side',.86],
 ['rb-f-long','重力ストレートロング','sadako',1.24,'tucked','straight','center',1],
 ['rb-f-long-bangs','眉丈前髪・ロング','sadako',1.23,'bangs','straight','center',1],
 ['rb-f-long-in','内巻きロング','sadako',1.22,'tucked','inward','center',1],
 ['rb-f-long-out','外巻きロング','sadako',1.22,'tucked','outward','center',1],
 ['rb-f-long-wave','ソバージュロング','sadako',1.23,'center','sauvage','center',1],
 ['rb-f-hime','姫カット風・眉丈前髪','sadako',1.18,'bangs','straight','center',.55]
];
const M=[
 ['rb-m-crew','クルーカット','buzz',.11,'center','straight','center',1],
 ['rb-m-natural-short','ナチュラルショート','buzz',.185,'center','straight','side',1],
 ['rb-m-textured','束感ショート','buzz',.23,'center','outward','side',1],
 ['rb-m-mash','ナチュラルマッシュ','buzz',.26,'bangs','inward','center',1],
 ['rb-m-two-block','ツーブロック','buzz',.26,'center','straight','side',.48],
 ['rb-m-undercut','刈り上げショート','buzz',.235,'center','straight','side',.38],
 ['rb-m-seven-three','七三分けショート','buzz',.235,'center','straight','side',.85],
 ['rb-m-slickback','オールバック','buzz',.26,'center','straight','back',.65],
 ['rb-m-short-wolf','ショートウルフ','buzz',.275,'center','outward','side',.70],
 ['rb-m-short-perm','ソフトパーマショート','buzz',.25,'center','sauvage','center',1],
 ['rb-m-center-medium','センター分けミディアム','sadako',.46,'center','straight','center',1],
 ['rb-m-bangs-medium','眉丈前髪ミディアム','sadako',.51,'bangs','straight','center',1],
 ['rb-m-comma','コンマヘア風','sadako',.51,'center','inward','side',1],
 ['rb-m-wolf-medium','ミディアムウルフ','sadako',.59,'center','outward','side',.74],
 ['rb-m-medium-perm','ニュアンスパーマ','sadako',.58,'center','sauvage','center',1],
 ['rb-m-side-medium','サイドパートミディアム','sadako',.54,'center','straight','side',1],
 ['rb-m-shoulder','肩丈ストレート','sadako',.77,'center','straight','center',1],
 ['rb-m-long','重力ストレートロング','sadako',1.06,'center','straight','center',1],
 ['rb-m-long-wave','ウェーブロング','sadako',1.04,'center','sauvage','center',1]
];
const entry=(gender,t)=>Object.freeze({
 id:t[0],label:t[1],gender,base:t[2],length:t[3],
 front:t[4],curl:t[5],part:t[6],templeRatio:t[7]
});
export const REBUILT_HAIR_BLUEPRINTS=Object.freeze(
 Object.fromEntries([
  ...F.map(t=>entry('female',t)),...M.map(t=>entry('male',t))
 ].map(v=>[v.id,v])));
export const REBUILT_HAIR_CATALOG=Object.freeze({
 female:Object.freeze(F.map(t=>REBUILT_HAIR_BLUEPRINTS[t[0]])),
 male:Object.freeze(M.map(t=>REBUILT_HAIR_BLUEPRINTS[t[0]]))
});
const oldApproved=[
 ['buzz-cut','バズカット'],
 ['sadako-straight-long','貞子・重力ストレート'],
 ['sadako-inward-long','貞子・内巻き'],
 ['sadako-outward-long','貞子・外巻き'],
 ['sadako-sauvage-long','貞子・ソバージュ'],
 ['sadako-center-part-long','貞子・センター分け'],
 ['sadako-bangs-long','貞子・眉丈前髪']
];
export const REBUILT_HAIR_PARTS=Object.freeze({
 female:Object.freeze([
  ...[...REBUILT_HAIR_CATALOG.female].sort((a,b)=>(a.id==='rb-f-long'?-1:b.id==='rb-f-long'?1:0)).map((v,i)=>Object.freeze({
   id:'female-hair-rebuilt-'+String(i+1).padStart(2,'0'),
   label:v.label,values:Object.freeze({styleId:v.id})})),
  ...oldApproved.map(([id,label],i)=>Object.freeze({
   id:'female-hair-donor-'+String(i+1).padStart(2,'0'),
   label,values:Object.freeze({styleId:id})}))
 ]),
 male:Object.freeze([
  ...[...REBUILT_HAIR_CATALOG.male].sort((a,b)=>(a.id==='rb-m-natural-short'?-1:b.id==='rb-m-natural-short'?1:0)).map((v,i)=>Object.freeze({
   id:'male-hair-rebuilt-'+String(i+1).padStart(2,'0'),
   label:v.label,values:Object.freeze({styleId:v.id})})),
  Object.freeze({id:'male-hair-donor-buzz',label:'バズカット',
   values:Object.freeze({styleId:'buzz-cut'})})
 ])
});
