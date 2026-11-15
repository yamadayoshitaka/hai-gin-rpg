/**
 * Beastfolk transformation recipes. These are ANIMAL-SOURCE models, not
 * human Superhero GLB characters with ears glued on.
 *
 * Prototype uses the original wolf's head, jaws, muzzle, eyes, facial fur
 * and full tail, on a jointed two-legged body. All figures retain their
 * canonical bestiary ID and the unchanged original quadruped alternative.
 *
 * m005 / m006 are protected workstreams: do not change, generate, or audit.
 */
export const BEASTFOLK_PROTOTYPE_IDS=Object.freeze(['m001','m002','m003']);
export const BEASTFOLK_PROTECTED_IDS=Object.freeze(['m005','m006']);
export const BEASTFOLK_RECIPES=Object.freeze({
 m001:Object.freeze({id:'m001',family:'canine',source:'original-wolf',
  title:'灰牙の狼王・獣人型',headScale:.74,bodyBulk:1,legLength:1,
  coat:0x565f68,ruff:0x9da7af,cloth:0x323f42,
  armor:0x777e83,style:'ranger',tail:true}),
 m002:Object.freeze({id:'m002',family:'canine',source:'original-wolf',
  title:'紅蓮の獄狼・獣人型',headScale:.73,bodyBulk:1.12,legLength:.97,
  coat:0x512b34,ruff:0xa84b36,cloth:0x342d34,
  armor:0x9a4b39,style:'warrior',tail:true}),
 m003:Object.freeze({id:'m003',family:'canine',source:'original-wolf',
  title:'氷霜フェンリル・獣人型',headScale:.81,bodyBulk:1.20,legLength:1.04,
  coat:0xaecedd,ruff:0xe8f8ff,cloth:0x425363,
  armor:0x8eacbf,style:'guardian',tail:true}),
});
export const BEASTFOLK_ROADMAP=Object.freeze([
 Object.freeze({id:'m004',family:'canine',phase:2,base:'元の雷迅の魔狼',state:'not-implemented'}),
 Object.freeze({id:'m007',family:'feline',phase:2,base:'元の白銀の剣歯虎',state:'not-implemented'}),
 Object.freeze({id:'m008',family:'feline',phase:2,base:'元の紅眼の獅子王',state:'not-implemented'}),
 Object.freeze({id:'m009',family:'feline',phase:2,base:'元の砂嵐の豹獣',state:'not-implemented'}),
 Object.freeze({id:'m010',family:'feline',phase:2,base:'元の紫電の雷虎',state:'not-implemented'}),
]);
export const isBeastfolkPrototype=(id)=>Object.hasOwn(BEASTFOLK_RECIPES,id);
export function beastfolkRecipeFor(spec){
 const id=typeof spec==='string'?spec:spec?.id;
 return BEASTFOLK_RECIPES[id]??null;
}
export function validateBeastfolkRecipes(){
 if(BEASTFOLK_PROTOTYPE_IDS.length!==3)throw Error('Beastfolk prototype is three source wolves');
 if(BEASTFOLK_PROTOTYPE_IDS.some(id=>BEASTFOLK_PROTECTED_IDS.includes(id)))
  throw Error('Protected monster was transformed');
 if(Object.keys(BEASTFOLK_RECIPES).length!==3)
  throw Error('Beastfolk recipe count mismatch');
 for(const [id,recipe] of Object.entries(BEASTFOLK_RECIPES)){
  if(recipe.id!==id||recipe.family!=='canine'||recipe.source!=='original-wolf')
   throw Error('Only animal-derived canine prototypes are allowed: '+id);
  if(recipe.headScale<.5||recipe.headScale>1||recipe.bodyBulk<=0||recipe.legLength<=0)
   throw Error('Invalid anatomical proportions: '+id);
 }
 return true;
}
validateBeastfolkRecipes();
