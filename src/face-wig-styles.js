/**
 * Independently registered hairstyles / detachable wigs.
 * Data belongs to the wig, NEVER to the face master or its saved sliders.
 * Each style can be exported as an independent GLB via face-mesh-studio.
 */
const deepFreeze=value=>{
 if(value&&typeof value==='object'){
  for(const child of Object.values(value))deepFreeze(child);
  Object.freeze(value);
 }
 return value;
};
export const DEFAULT_WIG_STYLE_ID='center-part-gravity-long';
export const WIG_STYLES=deepFreeze({
 'center-part-gravity-long':{
  id:'center-part-gravity-long',
  label:'つむじ・センター分け（重力ロング）',
  part:'center',
  whorl:{x:0,y:.965,z:-.08},
  partWidth:.012,
  fringeSweep:.025,
  gravityMps2:9.81,
  gravityScale:1,
  scalpClearance:.002,
  faceClearance:.007,
  faceAvoidanceX:.025,
  backSweep:.035,
  restFallExponent:1.12,
  cut:'soft-u-layered',
  longLayers:true,
  wigType:'independent-3d-asset',
  collisions:['scalp','face','neck','shoulder','chest']
 },
 'salon-layered-long':{
  id:'salon-layered-long',
  label:'サロンレイヤー・ロング',
  part:'side',
  whorl:{x:-.09,y:.965,z:-.08},
  partWidth:.009,
  fringeSweep:.045,
  gravityMps2:9.81,
  gravityScale:.95,
  scalpClearance:.003,
  faceClearance:.007,
  faceAvoidanceX:.034,
  backSweep:.040,
  restFallExponent:1.08,
  cut:'soft-u-layered',
  longLayers:true,
  wigType:'independent-3d-asset',
  collisions:['scalp','face','neck','shoulder','chest']
 }
});
export function listWigStyles(){
 return Object.values(WIG_STYLES).map(({id,label,part,cut})=>({id,label,part,cut}));
}
export function getWigStyle(id=DEFAULT_WIG_STYLE_ID){
 const style=WIG_STYLES[id];
 if(!style)throw Error('Unknown registered independent wig style: '+id);
 return style;
}
