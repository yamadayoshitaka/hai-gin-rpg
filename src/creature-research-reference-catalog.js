/**
 * High-fidelity source models located for anatomical reference / retopology.
 * These are NOT direct GLB sources unless an explicit lawful public GLB URL
 * is known. Model owners may require logged-in download or Blender access.
 * Do not register these as already imported or completed game-ready rigs.
 */
export const WEB_CREATURE_ANATOMY_REFERENCES=Object.freeze({
 's-spider':Object.freeze({
  id:'s-spider',name:'Golden Spider / コガネグモ 3Dスキャン',
  sourceUrl:'https://sketchfab.com/3d-models/cc0-golden-spider-argiope-amoena-d2668ce3243941399688d329069b3bf3',
  author:'ffish.asia / floraZia.com',license:'CC0-1.0',triangles:178600,
  form:'eight-leg-spider',rigVerified:false,downloadMethod:'Sketchfab原作品から取得',
  caution:'高密度3Dスキャン。足は8本。Android用にリトポと骨設定が必要'
 }),
 's-spider-rig':Object.freeze({
  id:'s-spider-rig',name:'Spider (Rigged, Animated & Fur)',
  sourceUrl:'https://www.blendkit.com/asset-gallery-detail/72f27245-d3fc-447b-b556-76b762a7e858/',
  author:'Nik Kottmann',license:'CC0-1.0',triangles:1744,
  form:'eight-leg-spider',rigVerified:false,
  downloadMethod:'Blendkit/Blender経由で取得。GLBへの変換が必要',
  caution:'872ポリ・16.7MiB、毛髪粒子と歩行リグ。Blenderで毛とアニメの実物確認が必要'
 }),
 's-beetle-male':Object.freeze({
  id:'s-beetle-male',name:'Japanese Rhinoceros Beetle / 雄カブトムシ実物スキャン',
  sourceUrl:'https://sketchfab.com/3d-models/cc0-japanese-rhinoceros-beetle-f9c297562ec84418a7d4833944e88ffc',
  author:'ffish.asia / floraZia.com',license:'CC0-1.0',triangles:330900,
  form:'six-leg-beetle',rigVerified:false,
  downloadMethod:'Sketchfab原作品から取得',
  caution:'高密度スキャン。6脚・角・甲殻の精細な参考。Android直採用不可'
 }),
 's-beetle-flight':Object.freeze({
  id:'s-beetle-flight',name:'Japanese Rhinoceros Beetle / 飛翔形態',
  sourceUrl:'https://sketchfab.com/3d-models/cc0-japanese-rhinoceros-beetle-834fc0fa26124c91b84b007eeae0bb70',
  author:'ffish.asia / floraZia.com',license:'CC0-1.0',triangles:388500,
  form:'six-leg-beetle-flying',rigVerified:false,
  downloadMethod:'Sketchfab原作品から取得',
  caution:'羽開き参考。高密度スキャン。開閉リグの採用可否を別途確認'
 }),
 's-octopus':Object.freeze({
  id:'s-octopus',name:'Webfoot Octopus / イイダコ3Dスキャン',
  sourceUrl:'https://sketchfab.com/3d-models/cc0-webfoot-octopus-octopus-ocellatus-04e13f6fc8304c34b7928a7c7879a39a',
  author:'ffish.asia / floraZia.com',license:'CC0-1.0',triangles:751800,
  form:'eight-arm-octopus',rigVerified:false,
  downloadMethod:'Sketchfab原作品から取得',
  caution:'8腕・吸盤の参考。約75万三角形。大軍戦用の低LOD／骨格を新規制作'
 }),
 's-octopus-ccby':Object.freeze({
  id:'s-octopus-ccby',name:'Realistic Octopus / 精密タコモデル',
  sourceUrl:'https://sketchfab.com/3d-models/octopus-with-textured-reddish-brown-skin-a6e8afbc35604438bbd4fba04e866025',
  author:'Pigcraft',license:'CC BY 4.0',triangles:null,
  form:'eight-arm-octopus',rigVerified:false,
  downloadMethod:'Sketchfab原作品から取得・著作者表示必須',
  caution:'写実的な肌・吸盤の参考。骨・GLB形式・三角形数の実物確認が必要'
 }),
 's-snake':Object.freeze({
  id:'s-snake',name:'Tiger Keelback / ヤマカガシ3Dスキャン',
  sourceUrl:'https://sketchfab.com/3d-models/cc0-tiger-keelback-snake-r-tigrinus-1796715199f94c20b15a79111b3a1d44',
  author:'ffish.asia / floraZia.com',license:'CC0-1.0',triangles:240900,
  form:'serpent',rigVerified:false,
  downloadMethod:'Sketchfab原作品から取得',
  caution:'鱗と長胴の参考。海竜の鰭・ブレス・水中移動は別途追加'
 }),
 's-dragon-rig':Object.freeze({
  id:'s-dragon-rig',name:'Dragon Rigged / 無料ドラゴン',
  sourceUrl:'https://sketchfab.com/3d-models/dragon-rigged-eb958a6e66f542cbb1cbabc4d36f34d9',
  author:'Empire',license:'CC BY 4.0',triangles:null,
  form:'dragon',rigVerified:false,
  downloadMethod:'Sketchfab原作品から取得・著作者表示必須',
  caution:'作者説明ではリグ・改変可能。実際のアニメ・GLB配布・翼と骨格を確認'
 }),
 's-dragon-low':Object.freeze({
  id:'s-dragon-low',name:'Low Poly Dragon (Rigged)',
  sourceUrl:'https://sketchfab.com/3d-models/low-poly-dragon-rigged-c23530e89e8e4f21b0682860c9b2235b',
  author:'Yanez Designs',license:'CC BY 4.0',triangles:null,
  form:'dragon',rigVerified:false,
  downloadMethod:'Sketchfab原作品から取得・著作者表示必須',
  caution:'作者説明ではidle、fly、biteあり。実写基準には未到達、低LOD用の候補'
 })
});
export function validateAnatomySources(){
 for(const [id,x] of Object.entries(WEB_CREATURE_ANATOMY_REFERENCES)){
  if(id!==x.id||!x.sourceUrl.startsWith('https://')||
    !['CC0-1.0','CC BY 4.0'].includes(x.license)||!x.author||
    !x.downloadMethod||!x.caution||x.rigVerified!==false)
   throw Error('Incomplete anatomical reference: '+id);
 }
 return true;
}
validateAnatomySources();
