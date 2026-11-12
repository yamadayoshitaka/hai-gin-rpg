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
 },
  'princess-long':{
   id:'princess-long',label:'姫レイヤー・ロング',part:'center',
   whorl:{x:0,y:.965,z:-.08},
   partWidth:0.006,fringeSweep:0.012,
   gravityMps2:9.81,gravityScale:1,scalpClearance:.002,
   faceClearance:.007,faceAvoidanceX:.025,backSweep:.035,
   restFallExponent:1.12,cut:'soft-u-layered',longLayers:true,
   styleLength:1.02,templeVolume:0.02,strandWave:0.045,
   wigType:'independent-3d-asset',collisions:['scalp','face','neck','shoulder','chest']
  },
  'curtain-bangs-long':{
   id:'curtain-bangs-long',label:'カーテンバング・ロング',part:'center',
   whorl:{x:0,y:.965,z:-.08},
   partWidth:0.005,fringeSweep:0.046,
   gravityMps2:9.81,gravityScale:1,scalpClearance:.002,
   faceClearance:.007,faceAvoidanceX:.025,backSweep:.035,
   restFallExponent:1.12,cut:'soft-u-layered',longLayers:true,
   styleLength:1,templeVolume:0.015,strandWave:0.036,
   wigType:'independent-3d-asset',collisions:['scalp','face','neck','shoulder','chest']
  },
  'knight-long':{
   id:'knight-long',label:'騎士の流線ロング',part:'side',
   whorl:{x:-0.075,y:.965,z:-.08},
   partWidth:0.011,fringeSweep:0.025,
   gravityMps2:9.81,gravityScale:1,scalpClearance:.002,
   faceClearance:.007,faceAvoidanceX:.025,backSweep:.035,
   restFallExponent:1.12,cut:'soft-u-layered',longLayers:true,
   styleLength:1.12,templeVolume:0.026,strandWave:0.052,
   wigType:'independent-3d-asset',collisions:['scalp','face','neck','shoulder','chest']
  },
  'soft-medium':{
   id:'soft-medium',label:'柔らかなミディアム',part:'side',
   whorl:{x:-0.075,y:.965,z:-.08},
   partWidth:0.01,fringeSweep:0.05,
   gravityMps2:9.81,gravityScale:1,scalpClearance:.002,
   faceClearance:.007,faceAvoidanceX:.025,backSweep:.035,
   restFallExponent:1.12,cut:'soft-u-layered',longLayers:true,
   styleLength:0.83,templeVolume:0.023,strandWave:0.048,
   wigType:'independent-3d-asset',collisions:['scalp','face','neck','shoulder','chest']
  },
  'mature-layer-long':{
   id:'mature-layer-long',label:'大人のレイヤーロング',part:'side',
   whorl:{x:-0.075,y:.965,z:-.08},
   partWidth:0.009,fringeSweep:0.026,
   gravityMps2:9.81,gravityScale:1,scalpClearance:.002,
   faceClearance:.007,faceAvoidanceX:.025,backSweep:.035,
   restFallExponent:1.12,cut:'soft-u-layered',longLayers:true,
   styleLength:1.16,templeVolume:0.024,strandWave:0.028,
   wigType:'independent-3d-asset',collisions:['scalp','face','neck','shoulder','chest']
  },
  'fringe-long':{
   id:'fringe-long',label:'透け前髪ロング',part:'center',
   whorl:{x:0,y:.965,z:-.08},
   partWidth:0.004,fringeSweep:0.042,
   gravityMps2:9.81,gravityScale:1,scalpClearance:.002,
   faceClearance:.007,faceAvoidanceX:.025,backSweep:.035,
   restFallExponent:1.12,cut:'soft-u-layered',longLayers:true,
   styleLength:1.04,templeVolume:0.013,strandWave:0.048,
   wigType:'independent-3d-asset',collisions:['scalp','face','neck','shoulder','chest']
  },
  'shag-long':{
   id:'shag-long',label:'シャギー・ロング',part:'side',
   whorl:{x:-0.075,y:.965,z:-.08},
   partWidth:0.014,fringeSweep:0.074,
   gravityMps2:9.81,gravityScale:1,scalpClearance:.002,
   faceClearance:.007,faceAvoidanceX:.025,backSweep:.035,
   restFallExponent:1.12,cut:'soft-u-layered',longLayers:true,
   styleLength:1.16,templeVolume:0.029,strandWave:0.07,
   wigType:'independent-3d-asset',collisions:['scalp','face','neck','shoulder','chest']
  },
  'rounded-bob':{
   id:'rounded-bob',label:'丸みのあるボブ',part:'center',
   whorl:{x:0,y:.965,z:-.08},
   partWidth:0.008,fringeSweep:0.061,
   gravityMps2:9.81,gravityScale:1,scalpClearance:.002,
   faceClearance:.007,faceAvoidanceX:.025,backSweep:.035,
   restFallExponent:1.12,cut:'soft-u-layered',longLayers:true,
   styleLength:0.65,templeVolume:0.03,strandWave:0.082,
   wigType:'independent-3d-asset',collisions:['scalp','face','neck','shoulder','chest']
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
