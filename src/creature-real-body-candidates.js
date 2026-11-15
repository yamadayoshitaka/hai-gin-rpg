/**
 * Realistic-looking static animal body references. Exact CC0 CDN URLs and
 * triangle counts sourced from the official public pack manifest:
 * https://3dassets.dev/api/v1/packs/exotic-wildlife-hd
 *
 * These are AI-generated *static* GLBs. They must be visually reviewed,
 * rigged, animated and regression-tested before any adoption in combat.
 * They are NOT measured to outperform the current Hai-gin models.
 */
const license='https://creativecommons.org/publicdomain/zero/1.0/';
function candidate(id,name,assetId,page,triangles,species){
 return Object.freeze({id,name,downloadUrl:'https://cdn.3dassets.dev/assets/'+assetId+'/v1/model.glb',
  sourceUrl:'https://3dassets.dev/assets/'+page,
  license:'CC0-1.0',licenseUrl:license,author:'3D Assets',
  style:'realistic',category:species,triangles,rigged:false,
  animationNote:'静止GLB。リギングとアニメーション移植が必要',
  integration:'reference-only',aiGenerated:true,
  qualityCaution:'写実方向の造形候補。現行モデルより高品質とは未確認。AI生成の静的メッシュで、骨格/モーションは未実装。'});
}
export const REAL_BODY_CANDIDATES=Object.freeze({
 'w-lion':candidate('w-lion','写実寄り 雄ライオン（静止）','30195','exotic-wildlife-hd-african-lion-male-4417c586',23368,'feline'),
 'w-lioness':candidate('w-lioness','写実寄り 雌ライオン（静止）','30194','exotic-wildlife-hd-african-lioness-6090dd62',20488,'feline'),
 'w-tiger':candidate('w-tiger','写実寄り ベンガルトラ（静止）','30200','exotic-wildlife-hd-bengal-tiger-cbb738df',20068,'feline'),
 'w-snowleopard':candidate('w-snowleopard','写実寄り ユキヒョウ（静止）','30196','exotic-wildlife-hd-snow-leopard-76abf232',23284,'feline'),
 'w-cheetah':candidate('w-cheetah','写実寄り チーター（静止）','30201','exotic-wildlife-hd-cheetah-c33fc992',null,'feline')
});
export const REAL_BODY_SUGGESTIONS=Object.freeze({
 m008:['w-lion','w-lioness'],
 m010:['w-tiger'],
 m009:['w-snowleopard','w-cheetah'],
 m007:['w-tiger']
});
export const bodySourcesFor=speciesId=>REAL_BODY_SUGGESTIONS[String(speciesId).replace(/^summon_/,'')]||[];
