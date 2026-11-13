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
// Static scalp foundation volume. This is geometry, not a shader or physics.
export const WIG_BASE_VOLUME_PROFILES=deepFreeze({
 natural:{label:'トップ最小（頭皮に沿う）',crown:.0,side:.0},
 soft:{label:'やや少なめ（自然な丸み）',crown:.016,side:.008},
 airy:{label:'標準（ふんわりした根元）',crown:.034,side:.019},
 lifted:{label:'多め（トップにボリューム）',crown:.069,side:.013},
 full:{label:'最大（全体に厚み）',crown:.086,side:.048}
});
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
  'natural-short':{
   id:'natural-short',label:'ナチュラルショート',part:'side',
   whorl:{x:-.03,y:.965,z:-.08},partWidth:.003,fringeSweep:.014,
   gravityMps2:9.81,gravityScale:1,scalpClearance:.002,
   faceClearance:.007,faceAvoidanceX:.025,backSweep:.010,
   restFallExponent:1.05,cut:'textured-short',longLayers:false,
   styleLength:.26,templeVolume:.009,strandWave:.018,
   shortCutKind:'short',wigType:'independent-3d-asset',
   collisions:['scalp','face','neck','shoulder','chest']
  },
  'very-short':{
   id:'very-short',label:'ベリーショート',part:'side',
   whorl:{x:-.03,y:.965,z:-.08},partWidth:.002,fringeSweep:.008,
   gravityMps2:9.81,gravityScale:1,scalpClearance:.002,
   faceClearance:.007,faceAvoidanceX:.018,backSweep:.005,
   restFallExponent:1.05,cut:'very-short-cropped',longLayers:false,
   styleLength:.12,templeVolume:.003,strandWave:.009,
   shortCutKind:'very-short',wigType:'independent-3d-asset',
   collisions:['scalp','face','neck','shoulder','chest']
  },
  'buzz-cut':{
   id:'buzz-cut',label:'バズカット（頭皮に沿う極短毛）',part:'center',
   whorl:{x:0,y:.965,z:-.08},partWidth:.0,fringeSweep:.0,
   gravityMps2:9.81,gravityScale:1,scalpClearance:.001,
   faceClearance:.003,faceAvoidanceX:.010,backSweep:0,
   restFallExponent:1,cut:'buzz-scalp-close',longLayers:false,
   styleLength:.025,templeVolume:0,strandWave:.004,
   shortCutKind:'buzz',wigType:'independent-3d-asset',
   collisions:['scalp','face','neck']
  },
  'soft-wave-long':{
   id:'soft-wave-long',label:'ゆるウェーブ・ロング',part:'side',
   whorl:{x:-.052,y:.965,z:-.08},partWidth:.008,fringeSweep:.045,
   gravityMps2:9.81,gravityScale:.90,scalpClearance:.003,
   faceClearance:.008,faceAvoidanceX:.035,backSweep:.045,
   restFallExponent:1.14,cut:'soft-u-layered',longLayers:true,
   styleLength:1.08,templeVolume:.037,strandWave:.24,
   wigType:'independent-3d-asset',collisions:['scalp','face','neck','shoulder','chest']
  },
  'full-fringe-straight':{
   id:'full-fringe-straight',label:'厚め前髪・艶ストレート',part:'center',
   whorl:{x:0,y:.965,z:-.08},partWidth:.003,fringeSweep:.014,
   gravityMps2:9.81,gravityScale:1.04,scalpClearance:.002,
   faceClearance:.007,faceAvoidanceX:.026,backSweep:.02,
   restFallExponent:1.08,cut:'soft-u-layered',longLayers:true,
   styleLength:1.08,templeVolume:.018,strandWave:.012,
   wigType:'independent-3d-asset',collisions:['scalp','face','neck','shoulder','chest']
  },
  'airy-shoulder-layers':{
   id:'airy-shoulder-layers',label:'肩丈エアリーレイヤー',part:'side',
   whorl:{x:-.06,y:.965,z:-.08},partWidth:.008,fringeSweep:.046,
   gravityMps2:9.81,gravityScale:.97,scalpClearance:.003,
   faceClearance:.008,faceAvoidanceX:.032,backSweep:.034,
   restFallExponent:1.13,cut:'soft-u-layered',longLayers:true,
   styleLength:.71,templeVolume:.031,strandWave:.12,
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

// Haircut-specific 3D contours in source-head units; not texture/label changes.
// Fringe drops can reach the brow and upper eyelid; rear width and cut line
// establish distinct back silhouettes without inflating the crown.
export const WIG_SILHOUETTE_PROFILES=deepFreeze({
 'center-part-gravity-long':{fringeDrop:.052,rearWidth:.58,rearCutShift:-.018,sideFlare:.006,rearDepth:.016},
 'salon-layered-long':{fringeDrop:.073,rearWidth:.68,rearCutShift:.025,sideFlare:.013,rearDepth:.034},
 'princess-long':{fringeDrop:.086,rearWidth:.56,rearCutShift:-.030,sideFlare:.006,rearDepth:.014},
 'curtain-bangs-long':{fringeDrop:.058,rearWidth:.76,rearCutShift:.010,sideFlare:.016,rearDepth:.025},
 'knight-long':{fringeDrop:.050,rearWidth:.65,rearCutShift:-.040,sideFlare:.009,rearDepth:.060},
 'soft-medium':{fringeDrop:.078,rearWidth:.76,rearCutShift:.145,sideFlare:.020,rearDepth:.020},
 'mature-layer-long':{fringeDrop:.039,rearWidth:.59,rearCutShift:-.025,sideFlare:.007,rearDepth:.043},
 'fringe-long':{fringeDrop:.105,rearWidth:.66,rearCutShift:-.025,sideFlare:.010,rearDepth:.027},
 'shag-long':{fringeDrop:.091,rearWidth:.86,rearCutShift:.045,sideFlare:.027,rearDepth:.050},
 'rounded-bob':{fringeDrop:.090,rearWidth:.90,rearCutShift:.260,sideFlare:.025,rearDepth:.010},
 'natural-short':{fringeDrop:.038,rearWidth:.84,rearCutShift:.320,sideFlare:.004,rearDepth:0},
 'very-short':{fringeDrop:.016,rearWidth:.95,rearCutShift:.340,sideFlare:0,rearDepth:0},
 'buzz-cut':{fringeDrop:0,rearWidth:1,rearCutShift:.380,sideFlare:0,rearDepth:0},
 'soft-wave-long':{fringeDrop:.073,rearWidth:.94,rearCutShift:-.025,sideFlare:.029,rearDepth:.070},
 'full-fringe-straight':{fringeDrop:.110,rearWidth:.61,rearCutShift:-.030,sideFlare:.007,rearDepth:.022},
 'airy-shoulder-layers':{fringeDrop:.082,rearWidth:.79,rearCutShift:.180,sideFlare:.025,rearDepth:.035}
});
export function listWigStyles(){
 return Object.values(WIG_STYLES).map(({id,label,part,cut})=>({id,label,part,cut}));
}
export function getWigStyle(id=DEFAULT_WIG_STYLE_ID){
 const style=WIG_STYLES[id];
 if(!style)throw Error('Unknown registered independent wig style: '+id);
 return style;
}
