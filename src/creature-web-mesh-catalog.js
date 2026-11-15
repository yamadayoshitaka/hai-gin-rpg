/**
 * Publicly downloadable creature GLBs newly located through source research.
 * Never reinterpret a low-poly fallback as a photoreal finished model.
 * All URLs occur verbatim in the publishers' public asset manifests.
 * No hosted files are mirrored to this repository by this source table.
 *
 * Gobkit: https://gobkit.com/api/free  (CC0 1.0)
 * Bake3D: https://bake3d.ai/free-3d-models (CC BY 4.0)
 */
export const WEB_CREATURE_MESH_SCHEMA='hai-gin/web-creature-mesh/v1';
const CC0='https://creativecommons.org/publicdomain/zero/1.0/';
const CCBY='https://creativecommons.org/licenses/by/4.0/';
const GOBKIT='https://gobkit.com/freebies';
const BAKED='https://bake3d.ai/free-3d-models';
const donor=(id,name,url,group,kind='low-poly')=>Object.freeze({
 id,name,downloadUrl:url,sourceUrl:GOBKIT,license:'CC0-1.0',
 licenseUrl:CC0,author:'Gobkit',sourceManifest:'https://gobkit.com/api/free',
 style:kind,hasPublicGLB:true,rigged:true,
 animationNote:'各GLBの実クリップ名で再生。アイドル・移動・攻撃・被弾・死亡の収録内容は個体別に確認',
 integration:'preview-only',
 qualityCaution:'アニメ付き商用無料GLB。低ポリ表現であり、実写品質の最終モデルとして合格扱いしない',
 category:group
});
export const WEB_CREATURE_MESH_SOURCES=Object.freeze({
 'g-lion':donor('g-lion','Lion / 獅子',GOBKIT+'/animal006/Lion.glb','feline'),
 'g-tiger':donor('g-tiger','Tiger / 虎',GOBKIT+'/animal008/Tiger.glb','feline'),
 'g-owl':donor('g-owl','Red horned owl / 梟',GOBKIT+'/animal012/Redhornedowl.glb','avian'),
 'g-seagull':donor('g-seagull','Seagull / 海鳥',GOBKIT+'/animal007/Seagull.glb','avian'),
 'g-fox':donor('g-fox','Fox / 狐',GOBKIT+'/animal006/Fox.glb','beast'),
 'g-horse':donor('g-horse','Palomino Horse / 軍馬',GOBKIT+'/animal012/PalominoHorse.glb','beast'),
 'g-ptero':donor('g-ptero','Pterodactylus / 翼竜',GOBKIT+'/dino/Pterodactylus.glb','reptile'),
 'g-plesio':donor('g-plesio','Plesiosaurus / 首長竜',GOBKIT+'/dino/Plesiosaurus.glb','aquatic'),
 'g-trex':donor('g-trex','Tyrannosaurus / 肉食恐竜',GOBKIT+'/dino/Trex.glb','reptile'),
 'g-anky':donor('g-anky','Ankylosaurus / 鎧竜',GOBKIT+'/dino/Ankylosaurus.glb','reptile'),
 'g-triceratops':donor('g-triceratops','Triceratops / 三角竜',GOBKIT+'/dino/Triceratops.glb','reptile'),
 'g-hercules':donor('g-hercules','Hercules Beetle / ヘラクレス',GOBKIT+'/insect001/HerculesBeetle.glb','insect'),
 'g-atlas':donor('g-atlas','Atlas Beetle / アトラス',GOBKIT+'/insect002/AtlasBeetle.glb','insect'),
 'g-mantis':donor('g-mantis','Orchid Mantis / ハナカマキリ',GOBKIT+'/insect001/OrchidMantis.glb','insect'),
 'g-scarab':donor('g-scarab','Sacred Scarab / スカラベ',GOBKIT+'/insect002/SacredScarab.glb','insect'),
 'g-goldstag':donor('g-goldstag','Golden Stag Beetle / 黄金クワガタ',GOBKIT+'/insect002/GoldenStagBeetle.glb','insect'),
 'g-dungbeetle':donor('g-dungbeetle','Dung Beetle / 糞虫',GOBKIT+'/insect001/DungBeetle.glb','insect'),
 'g-rainbowscarab':donor('g-rainbowscarab','Rainbow Scarab / 虹色スカラベ',GOBKIT+'/insect002/RainbowScarab.glb','insect'),
 'g-scorpion':donor('g-scorpion','Scorpion / サソリ',GOBKIT+'/animal007/Scorpion.glb','arachnid'),
 'g-anglerfish':donor('g-anglerfish','Anglerfish / 深海魚',GOBKIT+'/animal/Anglerfish.glb','aquatic'),
 'g-shark':donor('g-shark','Shark / 鮫',GOBKIT+'/animal/Shark.glb','aquatic'),
 'g-sturgeon':donor('g-sturgeon','Sturgeon / チョウザメ',GOBKIT+'/animal011/Sturgeon.glb','aquatic'),
 'g-parrotfish':donor('g-parrotfish','Parrotfish / ブダイ',GOBKIT+'/animal008/Parrotfish.glb','aquatic'),
 'g-jellyfish':donor('g-jellyfish','Jellyfish / 海月',GOBKIT+'/animal/Jellyfish.glb','aquatic'),
 'b-trex':Object.freeze({
  id:'b-trex',name:'Bake3D T. rex（高精細リグ・写実参考）',
  downloadUrl:'https://bake3d.ai/samples/free/bake3d-trex-animated.glb',
  sourceUrl:BAKED,license:'CC BY 4.0',licenseUrl:CCBY,author:'Bake3D',
  sourceManifest:BAKED,style:'realistic',hasPublicGLB:true,rigged:true,
  animationNote:'36ボーン・4クリップ（歩行・待機・視線・イントロ）、約15万三角形',
  integration:'preview-only',category:'reptile',
  qualityCaution:'写実的だが翼や多頭構造のないT-rex。11.8 MB・15万三角形でAndroid大軍戦は最適化必須'
 }),
 'b-fox':Object.freeze({
  id:'b-fox',name:'Bake3D Fox（高精細四足リグ）',
  downloadUrl:'https://bake3d.ai/samples/free/bake3d-fox-animated.glb',
  sourceUrl:BAKED,license:'CC BY 4.0',licenseUrl:CCBY,author:'Bake3D',
  sourceManifest:BAKED,style:'realistic',hasPublicGLB:true,rigged:true,
  animationNote:'29ボーン・歩行・尾振り・視線、約6万三角形',
  integration:'preview-only',category:'beast',
  qualityCaution:'狼への直採用不可（キツネ体型）。3 MB・6万三角形、リグと四足モーションの参考'
 })
});
export const WEB_CREATURE_SOURCE_COUNT=Object.keys(WEB_CREATURE_MESH_SOURCES).length;
export function validateWebCreatureMeshSources(){
 const ids=Object.keys(WEB_CREATURE_MESH_SOURCES);
 if(ids.length!==26||new Set(ids).size!==ids.length)throw Error('Expected exactly 26 web GLB sources');
 for(const [id,m] of Object.entries(WEB_CREATURE_MESH_SOURCES)){
  if(id!==m.id||!/^https:\/\/[^\s]+\.glb$/.test(m.downloadUrl)||
    !/^https:\/\/[^\s]+/.test(m.sourceUrl)||!['CC0-1.0','CC BY 4.0'].includes(m.license)||
    !m.author||!m.sourceManifest||m.integration!=='preview-only'||!m.hasPublicGLB)
   throw Error('Unverified web GLB manifest entry '+id);
 }
 return true;
}
validateWebCreatureMeshSources();
