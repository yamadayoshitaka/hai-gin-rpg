/**
 * v47 age × build character identity profiles.
 * Age and build are independent of sex, cosmetics, job and hair selection.
 * Valid grid: 8 age bands × 4 builds × 2 sexes = 64 deterministic recipes.
 */
export const AGE_PROFILES=Object.freeze({
 under10:Object.freeze({id:'under10',label:'10歳以下',heightScale:.72,headScale:.84,sag:0,wrinkles:0,
  cheekRound:.42,jawAge:-.34,eyelidScale:1.18,lipFullness:.93,browDensity:.72,beard:0}),
 teens:Object.freeze({id:'teens',label:'10代',heightScale:.90,headScale:.94,sag:0,wrinkles:0,
  cheekRound:.22,jawAge:-.18,eyelidScale:1.09,lipFullness:1,browDensity:.86,beard:.05}),
 twenties:Object.freeze({id:'twenties',label:'20代',heightScale:1,headScale:1,sag:0,wrinkles:0,
  cheekRound:.13,jawAge:0,eyelidScale:1.07,lipFullness:1.07,browDensity:1,beard:.12}),
 thirties:Object.freeze({id:'thirties',label:'30代',heightScale:1.005,headScale:1,sag:.08,wrinkles:.12,
  cheekRound:.03,jawAge:.09,eyelidScale:1,lipFullness:1,browDensity:1,beard:.25}),
 forties:Object.freeze({id:'forties',label:'40代',heightScale:1,headScale:.99,sag:.24,wrinkles:.31,
  cheekRound:-.08,jawAge:.19,eyelidScale:.94,lipFullness:.97,browDensity:1.08,beard:.30}),
 sixties:Object.freeze({id:'sixties',label:'60代',heightScale:.965,headScale:.98,sag:.51,wrinkles:.64,
  cheekRound:-.18,jawAge:.36,eyelidScale:.86,lipFullness:.85,browDensity:1.11,beard:.38}),
 seventies:Object.freeze({id:'seventies',label:'70代',heightScale:.935,headScale:.97,sag:.75,wrinkles:.83,
  cheekRound:-.24,jawAge:.49,eyelidScale:.81,lipFullness:.80,browDensity:1.14,beard:.45}),
 eightyPlus:Object.freeze({id:'eightyPlus',label:'80代以上',heightScale:.88,headScale:.96,sag:1,wrinkles:1,
  cheekRound:-.32,jawAge:.64,eyelidScale:.76,lipFullness:.76,browDensity:1.16,beard:.52})
});
export const AGE_BAND_IDS=Object.freeze(Object.keys(AGE_PROFILES));
export const BODY_PROFILES=Object.freeze({
 ultraThin:Object.freeze({id:'ultraThin',label:'超痩せ型',width:.90,depth:.90,faceFullness:-.75,neckWidth:.93,abdomen:-.075,legRadius:.89,armRadius:.92}),
 thin:Object.freeze({id:'thin',label:'痩せ型',width:.95,depth:.95,faceFullness:-.285,neckWidth:.965,abdomen:-.034,legRadius:.91,armRadius:.96}),
 normal:Object.freeze({id:'normal',label:'普通',width:1.0,depth:1.0,faceFullness:.18,neckWidth:1.0,abdomen:.007,legRadius:.93,armRadius:1}),
 fat:Object.freeze({id:'fat',label:'太め',width:1.37,depth:1.34,faceFullness:1.07,neckWidth:1.19,abdomen:.49,legRadius:1.08,armRadius:1.1})
});
export const BODY_TYPE_IDS=Object.freeze(Object.keys(BODY_PROFILES));
export const LEGACY_BODY_TYPE_MAP=Object.freeze({
 ultraThin:'ultraThin',thin:'thin',normal:'normal',fat:'fat',
 // v46 'slim' and 'child' used v59 thin proportions: preserve those identities.
 slim:'ultraThin',average:'normal',sturdy:'normal',full:'fat',heavy:'fat',child:'ultraThin'
});
export function resolveAgeBand(id='twenties'){
 return AGE_PROFILES[id]||AGE_PROFILES.twenties;
}
export function resolveBodyType(id='normal'){
 return BODY_PROFILES[LEGACY_BODY_TYPE_MAP[id]||'normal'];
}
export function resolveDemographicProfile(ageBand='twenties',bodyType='normal'){
 const age=resolveAgeBand(ageBand),body=resolveBodyType(bodyType);
 return Object.freeze({ageBand:age.id,bodyType:body.id,age,body,
  heightScale:age.heightScale,headScale:age.headScale,
  faceFullness:body.faceFullness,abdomen:body.abdomen});
}
/** No random genders, no missing decades, no dependency on UI DOM. */
export function enumerateDemographics(){
 return Object.freeze(['female','male'].flatMap(gender=>
  AGE_BAND_IDS.flatMap(ageBand=>BODY_TYPE_IDS.map(bodyType=>
   Object.freeze({id:gender+'-'+ageBand+'-'+bodyType,gender,ageBand,bodyType})))));
}
/** Give every selected decade a coherent face, without making youthful faces old. */
export function applyDemographicFaceControls(controls={},ageBand='twenties',bodyType='normal',gender='female'){
 const {age,body}=resolveDemographicProfile(ageBand,bodyType);
 const base={...controls,ageBand:age.id,bodyType:body.id};
 // Constrain rather than overwrite artist-selected eyes. Age affects real
 // aperture, sockets and lid geometry via the original face control pipeline.
 const eyeHeight=Math.max(.65,Math.min(1.45,(Number(base.eyeHeight)||1)*age.eyelidScale));
 return {
  ...base,eyeHeight,
  eyeWidth:Math.max(.70,Math.min(1.45,(Number(base.eyeWidth)||1)*(age.id==='under10'?1.04:1))),
  faceMorph:Math.max(-.6,Math.min(.6,(Number(base.faceMorph)||0)+
   age.cheekRound*.27+body.faceFullness*.12)),
  browThickness:Math.max(.45,Math.min(1.85,(Number(base.browThickness)||1)*age.browDensity)),
  jawSharpness:Math.max(1,Math.min(10,(Number(base.jawSharpness)||4.5)+age.jawAge)),
  ...(gender==='male'?{
   beardDensity:age.id==='under10'?0:Math.max(0,Math.min(1,Number(base.beardDensity??age.beard)))}
   :{lashLength:age.id==='under10'?1.10:
     Math.max(.5,Math.min(2.1,Number(base.lashLength)||1.4))}),
  // No five-o'clock shadow on an unedited young hero; manually selected
  // dense beards and older NPC beard profiles stay available.
  ...(gender==='male'?{
   beardDensity:age.id==='under10'||age.id==='teens'?0:
    age.id==='twenties'&&Number(base.beardDensity??age.beard)<=.35?0:
    Math.max(0,Math.min(1,Number(base.beardDensity??age.beard)))}
   :{}),
  // Geometry is not deepened when user chooses older or more weight.
  eyeDepth:Math.max(.02,Number(base.eyeDepth)||0)
 };
}
