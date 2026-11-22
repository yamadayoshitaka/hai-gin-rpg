/**
 * Real 3D face expressions for the standalone face and full-body studios.
 * No generated image/texture and no global source-GLB edits.
 * Blinking moves the EXISTING anatomical eyelid vertices and a surface-
 * matching closure curtain. Talking moves the EXISTING two vermilion lips.
 * Demo talking is SILENT, syllable-paced motion; not phoneme/audio sync.
 */
import * as THREE from 'three';
import {smoothStudioFaceNormals} from './studio-face-quality-v56.js?v=76-expression-smooth';
import {resolveAgeBand} from './character-demographics-v47.js?v=80';
import {createFaceOralAnatomy} from './face-oral-anatomy-v80.js?v=89-enamel-quality';
import {poseIntegratedMouth} from './face-integrated-mouth-v82.js?v=82';
import {captureNativeOralSkinPose,updateNativeOralPose,getNativeOralRigReport} from './face-native-oral-rig-v88.js?v=89-natural-jaw';
import {FACS_CHANNELS_V80,deriveFacialActionUnits,v80FaceMuscleDelta}
 from './face-anatomy-rig-v80.js?v=89-live-nasolabial';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const smooth=t=>{const x=clamp(t);return x*x*(3-2*x);};
/** Signed intensities are blended with ongoing blink and speech.
 * Every expression preset changes actual 3D skin and part geometry, not labels. */
export const FACE_EXPRESSIONS=Object.freeze({
 neutral:Object.freeze({label:'通常',brow:0,tilt:0,squint:0,smile:0,open:0,cheek:0}),
 softSmile:Object.freeze({label:'微笑み',brow:.07,tilt:0,squint:.26,smile:.40,open:0,cheek:.33}),
 smile:Object.freeze({label:'笑顔',brow:.09,tilt:0,squint:.44,smile:.83,open:.12,cheek:.70}),
 laugh:Object.freeze({label:'大笑い',brow:.08,tilt:0,squint:.42,smile:.80,open:.70,cheek:.70}),
 angry:Object.freeze({label:'怒り',brow:-.18,tilt:-.27,squint:.28,smile:-.28,open:0,cheek:-.12}),
 shout:Object.freeze({label:'怒鳴る',brow:-.21,tilt:-.33,squint:.23,smile:-.2,open:.96,cheek:-.09}),
 sad:Object.freeze({label:'悲しい',brow:-.06,tilt:.20,squint:.19,smile:-.45,open:.05,cheek:-.13}),
 surprised:Object.freeze({label:'驚き',brow:.36,tilt:.04,squint:-.16,smile:0,open:.70,cheek:0}),
 troubled:Object.freeze({label:'困る',brow:.12,tilt:.23,squint:.11,smile:-.19,open:.04,cheek:0}),
 serious:Object.freeze({label:'真剣',brow:-.12,tilt:-.08,squint:.13,smile:0,open:0,cheek:-.03}),
 determined:Object.freeze({label:'決意',brow:-.19,tilt:-.10,squint:.22,smile:.03,open:0,cheek:.09}),
 embarrassed:Object.freeze({label:'恥ずかしい',brow:.14,tilt:.12,squint:.20,smile:.20,open:.04,cheek:.61}),
 tearful:Object.freeze({label:'涙目',brow:.15,tilt:.29,squint:.18,smile:-.42,open:.09,cheek:-.10}),
 sleepy:Object.freeze({label:'眠い',brow:-.05,tilt:0,squint:.58,smile:-.04,open:0,cheek:-.05}),
 skeptical:Object.freeze({label:'疑い',brow:.17,tilt:-.16,squint:.32,smile:-.12,open:0,cheek:-.08}),
 smug:Object.freeze({label:'不敵な笑み',brow:-.08,tilt:-.12,squint:.26,smile:.47,open:0,cheek:.23}),
 focused:Object.freeze({label:'集中',brow:-.13,tilt:-.06,squint:.26,smile:0,open:0,cheek:0}),
 curious:Object.freeze({label:'好奇心',brow:.18,tilt:.06,squint:-.04,smile:.17,open:.10,cheek:.08}),
 startled:Object.freeze({label:'動揺',brow:.28,tilt:.17,squint:-.08,smile:-.20,open:.33,cheek:-.07}),
 afraid:Object.freeze({label:'恐怖',brow:.31,tilt:.25,squint:-.07,smile:-.41,open:.29,cheek:-.16}),
 relaxed:Object.freeze({label:'安らぎ',brow:.05,tilt:.01,squint:.23,smile:.24,open:0,cheek:.12}),
 pout:Object.freeze({label:'不満',brow:-.10,tilt:.12,squint:.16,smile:-.31,open:0,cheek:-.06})
});
export function blinkEnvelope(seconds=0){
 // Deliberate, fast human-like closing/opening, once every ~4.3 seconds.
 const t=((seconds%4.3)+4.3)%4.3;
 if(t<2.65||t>3.015)return 0;
 if(t<2.755)return smooth((t-2.65)/.105);
 if(t<2.80)return 1;
 return 1-smooth((t-2.80)/.215);
}
export function speechEnvelope(seconds=0){
 // Only a preview: the final Japanese speech system will provide phoneme
 // amplitudes to setMouthOpen(). No fabricated talking audio is played.
 const syllables=Math.abs(Math.sin(seconds*13.8));
 const emphasis=.58+.22*Math.sin(seconds*2.7)+.2*Math.sin(seconds*6.3);
 const spacing=(Math.sin(seconds*3.3)+Math.sin(seconds*5.7))*.5;
 return clamp(syllables*(.52+emphasis*.34)*(spacing>-.65?1:.18));
}
function makeClosure(upper,lower,side,faceSize){
 const rows=2,cols=28;
 const xyz=new Float32Array((cols+1)*rows*3),indices=[];
 for(let i=0;i<cols;i++){
  const k=i;
  indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(xyz,3));
 geometry.setIndex(indices);
 const material=upper.material.clone();
 material.side=THREE.DoubleSide;material.depthWrite=false;
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name=side+'_ANIMATED_BLINK_CLOSURE';
 mesh.renderOrder=10;
 mesh.frustumCulled=false;
 mesh.visible=false;
 mesh.userData.colorRole='eyelid';
 // It is a skin surface attached to the same eye joint, NOT a static mask.
 upper.parent.add(mesh);
 return mesh;
}
function buildSide(parts,side,headSize){
 const upper=parts.getObjectByName(side+'_UPPER_ANATOMICAL_EYELID');
 const lower=parts.getObjectByName(side+'_LOWER_ANATOMICAL_EYELID');
 const eye=parts.getObjectByName(side+'_ORBITAL_EYEBALL');
 const iris=parts.getObjectByName(side+'_CURVED_IRIS');
 const pupil=parts.getObjectByName(side+'_CURVED_PUPIL');
 if(!upper||!lower||!eye||!iris||!pupil)return null;
 const remember=(mesh)=>({
  mesh,attr:mesh.geometry.getAttribute('position'),
  rest:mesh.geometry.getAttribute('position').array.slice()
 });
 const a=remember(upper),b=remember(lower);
 const decorations=[];
 for(const [suffix,isUpper] of [
  ['_UPPER_EYELINER',true],['_LOWER_EYELINER',false],
  ['_UPPER_EYESHADOW',true],['_LOWER_TEAR_MENISCUS',false]
 ]){
  const element=parts.getObjectByName(side+suffix);
  if(element?.geometry?.getAttribute('position'))
   decorations.push({...remember(element),isUpper,
    rows:suffix.endsWith('EYESHADOW')?6:suffix.endsWith('MENISCUS')?2:3});
 }
 const brow=parts.getObjectByName(side+'_BROW_ANGLE_CONTROL');
 const browRest=brow?{y:brow.position.y,z:brow.rotation.z}:null;
 const upperLash=parts.getObjectByName(side+'_UPPER_LASH_MESH');
 const lowerLash=parts.getObjectByName(side+'_LOWER_LASH_MESH');
 const lashRestY=upperLash?.position.y??0;
 const lowerLashRestY=lowerLash?.position.y??0;
 const cover=makeClosure(upper,lower,side,headSize);
 return {a,b,cover,eye,iris,pupil,decorations,upperLash,lashRestY,
  lowerLash,lowerLashRestY,brow,browRest,side};
}
function moveGrid({attr,rest},otherRest,openness,upper){
 const cols=28,rows=4;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const k=(j*(cols+1)+i)*3;
  const delta=(otherRest[i*3+1]-rest[i*3+1]);
  const arch=Math.pow(Math.max(0,Math.sin(Math.PI*i/cols)),.80);
  const envelope=Math.pow(1-j/rows,1.60);
  const amount=(upper?.89:.11)*openness*arch*envelope;
  attr.array[k+1]=rest[k+1]+delta*amount;
 }
 attr.needsUpdate=true;
}
function moveDecorations(side,blink){
 const {a,b}=side;
 const cols=28;
 for(const decoration of side.decorations){
  const {attr,rest,isUpper,rows}=decoration;
  const count=Math.min(attr.count,(rows+1)*(cols+1));
  for(let i=0;i<count;i++){
   const col=i%(cols+1),row=Math.floor(i/(cols+1));
   const start=col*3;
   const gap=b.rest[start+1]-a.rest[start+1];
   const arch=Math.pow(Math.max(0,Math.sin(Math.PI*col/cols)),.8);
   const direction=isUpper?.89:.11;
   const fade=rows===6?Math.max(.16,1-row/rows*.84):1;
   attr.array[i*3+1]=rest[i*3+1]+(isUpper?gap:-gap)*blink*arch*direction*fade;
  }
  attr.needsUpdate=true;
  decoration.mesh.geometry.computeBoundingSphere();
 }
 if(side.upperLash){
  const center=14*3;
  const gap=b.rest[center+1]-a.rest[center+1];
  side.upperLash.position.y=side.lashRestY+gap*.89*blink;
 }
 if(side.lowerLash){
  const center=14*3,gap=a.rest[center+1]-b.rest[center+1];
  side.lowerLash.position.y=side.lowerLashRestY+gap*.11*blink;
 }
}
function coverEye(side,blink,headSize){
 const {a,b,cover}=side;
 const pos=cover.geometry.getAttribute('position');
 const cols=28;
 for(let i=0;i<=cols;i++){
  const k=i*3;
  const upperY=a.rest[k+1],lowerY=b.rest[k+1];
  const arch=Math.pow(Math.max(0,Math.sin(Math.PI*i/cols)),.8);
  const shut=blink*.995*arch;
  // Two rows share the top at the natural upper lash line; the lower
  // row tracks the lid as it closes, suppressing the sunken-iris look.
  const z=Math.max(a.rest[k+2],b.rest[k+2])+headSize.z*.018;
  for(let j=0;j<2;j++){
   const idx=(j*(cols+1)+i)*3;
   pos.array[idx]=a.rest[k];
   pos.array[idx+1]=upperY+(lowerY-upperY)*(j?shut:0);
   pos.array[idx+2]=z;
  }
 }
 pos.needsUpdate=true;
 cover.visible=blink>.012;
}
function buildMouth(face,parts,headSize){
 // V83 public safety mode: a closed original face must never render a
 // fake foreground mouth, protruding teeth or black sphere. The full
 // facial mesh still deforms for smile, jaw, cheeks and brow.
 if(face.userData.v83SafeOriginalMouthTopology&&!face.userData.v88NativeOralRig?.ready)return null;
 const upper=parts.getObjectByName('UPPER_3D_VERMILION_LIP');
 const lower=parts.getObjectByName('LOWER_3D_VERMILION_LIP');
 if(!upper||!lower)return null;
 const geou=upper.geometry,geol=lower.geometry;
 geou.computeBoundingBox();geol.computeBoundingBox();
 const b=geou.boundingBox;
 const mid=new THREE.Vector3().addVectors(b.min,b.max).multiplyScalar(.5);
 const lipPos=geou.getAttribute('position'), n=Math.floor(lipPos.count/2);
 const native=face.userData.v88NativeOralRig?.ready===true;
 const integrated=!!face.userData.v82IntegratedMouth?.integrated||native;
 const frontZ=Math.max(mid.z,lipPos.getZ(n))+headSize.z*.003;
 const material=new THREE.MeshStandardMaterial({
  color:0x43272d,roughness:.94,metalness:0,
  side:THREE.DoubleSide,depthWrite:false,depthTest:false
 });
 const cavity=new THREE.Mesh(new THREE.SphereGeometry(1,48,20),material);
 cavity.name='V48_3D_INNER_MOUTH';
 cavity.position.set(mid.x,face.userData.actualMouthCreaseY??mid.y,frontZ);
 cavity.renderOrder=6;cavity.visible=false;
 // A legacy handle for existing editor probes; the black foreground
 // ball is NEVER drawn when the head owns a genuine oral aperture.
 cavity.material.visible=!integrated;
 cavity.userData.v82DisabledForegroundOralCover=integrated;
 cavity.frustumCulled=false;
 face.add(cavity);
 const oral=createFaceOralAnatomy(face,{
  x:mid.x,y:face.userData.actualMouthCreaseY??mid.y,
  z:integrated?((face.userData.v82IntegratedMouth?.surfaceZ??frontZ)-headSize.z*.055):
   frontZ-headSize.z*.002,
  width:Math.max(.0001,b.max.x-b.min.x),
  height:headSize.y,depth:headSize.z
 });
 if(integrated){
  // Proper depth-buffer occlusion through the real mouth opening.
  // Teeth, tongue and palate can never paint over the cheeks.
  oral.root.traverse(o=>{
   if(!o.isMesh)return;
   o.material.depthTest=true;
   o.material.depthWrite=true;
   o.renderOrder=0;
  });
  upper.visible=false;lower.visible=false;
 }else{
  // Compatibility fallback for exceptionally low-density donor meshes.
  oral.root.traverse(o=>{
   if(!o.isMesh)return;
   o.material.depthWrite=false;o.material.depthTest=false;
   o.renderOrder=/(?:TOOTH|TONGUE)/.test(o.name)?8:7;
  });
  for(const lip of [upper,lower]){
   lip.material.depthTest=false;lip.material.depthWrite=false;
   lip.renderOrder=9;
  }
 }
 return {upper,lower,cavity,oral,integrated,native,
  restU:upper.position.y,restL:lower.position.y,
  height:headSize.y,width:Math.max(.0001,b.max.x-b.min.x)};
}
/** Smooth low-frequency facial muscle fields: real cheek, nasal ala,
 * and glabella motion coupled to existing 22 expressions. No etched lines. */
export function v65ExpressionMuscleDelta({ax,ny,front,expression={}}={}){
 const fall=(x,c,w)=>Math.exp(-.5*Math.pow((x-c)/w,2));
 const smile=Math.max(0,Number(expression.smile)||0);
 const anger=Math.max(0,-(Number(expression.brow)||0));
 const opening=Math.max(0,Number(expression.open)||0);
 const squint=Math.max(0,Number(expression.squint)||0);
 const cheek=fall(ax,.32,.12)*fall(ny,.57,.075)*front;
 const nasalWing=fall(ax,.077,.039)*fall(ny,.557,.038)*front;
 const glabella=fall(ax,.085,.066)*fall(ny,.740,.047)*front;
 const corner=fall(ax,.23,.075)*fall(ny,.502,.047)*front;
 return {dy:.0034*smile*cheek+.0015*squint*cheek+
   .0020*anger*nasalWing-.0012*opening*corner,
  dz:.0033*smile*cheek+.0018*opening*nasalWing+
   .0011*anger*glabella};
}

/** v76 small anatomically localized skin-muscle response. Eyebrow raise,
 * nasal ala, glabella, cheek and nasolabial compression share the existing
 * owned head vertices. Never add fake wrinkle cards or replace the donor. */
export function v76ExpressionMuscleDelta({ax,ny,front,expression={}}={}){
 const bell=(x,c,w)=>Math.exp(-.5*Math.pow((x-c)/w,2));
 const smile=Math.max(0,Number(expression.smile)||0);
 const frown=Math.max(0,-(Number(expression.brow)||0));
 const raised=Math.max(0,Number(expression.brow)||0);
 const squint=Math.max(0,Number(expression.squint)||0);
 const open=Math.max(0,Number(expression.open)||0);
 const nasalAla=bell(ax,.105,.035)*bell(ny,.552,.037)*front;
 // Align dynamic folds with the skin pigment and age geometry.
  const foldX=.09+.045*clamp((ny-.509)/.16);
  const nasolabial=bell(ax,foldX,.028)*bell(ny,.579,.077)*front;
 const forehead=bell(ax,.21,.23)*bell(ny,.802,.049)*front;
 const glabella=bell(ax,.07,.045)*bell(ny,.739,.035)*front;
 const cheekLift=bell(ax,.34,.077)*bell(ny,.606,.047)*front;
 const canthus=bell(ax,.42,.073)*bell(ny,.675,.042)*front;
 return {
  dy:.0020*smile*cheekLift+.0011*raised*forehead-
   .0012*frown*glabella-.0012*open*nasalAla,
  dz:.0021*smile*cheekLift-.0016*(smile+squint)*nasolabial+
   .0010*(smile+squint)*canthus+.0012*frown*glabella+
   .0007*open*nasalAla
 };
}
export function createFaceExpressionAnimator(model,{autoBlink=true,speaking=false,expressionIntensity=1}={}){
 const face=model?.face,parts=model?.parts;
 if(!face?.geometry||!parts?.getObjectByName)throw Error('Real anatomical face model required');
 face.geometry.computeBoundingBox();
 const size=face.geometry.boundingBox.getSize(new THREE.Vector3());
 const sides=['LEFT','RIGHT'].map(side=>buildSide(parts,side,size)).filter(Boolean);
 const mouth=buildMouth(face,parts,size);
 let elapsed=0,blink=0,mouthOpen=0,manualMouth=null,forcedBlink=null,disposed=false;
 const strength=clamp(Number(expressionIntensity)||1,.6,1.35);
 // On sparse donor polygons large cheek displacement creates visible triangular
 // folds. Retain part-rig motion while damping whole-skin deformation only.
 const skinDeformationGain=.61;
 const state={autoBlink:!!autoBlink,speaking:!!speaking,expression:'neutral'};
 // Muscle channels can blend emotions, dialogue and presets without
 // adding floating expression meshes or permanently changing the donor.
 const channels=['brow','tilt','squint','smile','open','cheek',...FACS_CHANNELS_V80];
 let manualActionUnits=null,transition=null;
 const expressionFrame=()=>({
  ...FACE_EXPRESSIONS[state.expression],...(manualActionUnits||{})
 });
 // Keep smooth skin normals across blendshape expressions, including
 // split geometry vertices around UV seams (raw recompute causes facets).
 const initialNormalReport=smoothStudioFaceNormals(face.geometry,{
  weldTolerance:.00007
 });
 const facialAttr=face.geometry.getAttribute('position');
 const facialRest=facialAttr.array.slice();
 const sculptNormalRest=face.geometry.getAttribute('normal')?.array.slice()||null;
 const faceBox=face.geometry.boundingBox.clone();
 const faceSize=faceBox.getSize(new THREE.Vector3());
 const centerX=(faceBox.min.x+faceBox.max.x)/2;
 const mouthY=clamp(((face.userData.actualMouthCreaseY??(
  faceBox.min.y+faceSize.y*.509))-faceBox.min.y)/Math.max(1e-8,faceSize.y),.32,.62);
 const ageStrength=resolveAgeBand(
  face.userData.facePigmentControls?.ageBand||'twenties').wrinkles;
 const mouthRest=mouth?{
  upper:mouth.upper.geometry.getAttribute('position').array.slice(),
  lower:mouth.lower.geometry.getAttribute('position').array.slice()
 }:null;
 const poseLips=(frame,delta)=>{
  if(!mouth||!mouthRest)return;
  const smile=clamp(Number(frame.smile)||Number(frame.au12)||0);
  const cheek=clamp(Number(frame.cheek)||Number(frame.au06)||0);
  const halfWidth=mouth.width*.5;
  for(const [lip,original,isUpper] of [
   [mouth.upper,mouthRest.upper,true],
   [mouth.lower,mouthRest.lower,false]
  ]){
   const attr=lip.geometry.getAttribute('position');
   for(let i=0;i<attr.count;i++){
    const k=i*3,t=THREE.MathUtils.clamp(
     (original[k]-centerX)/Math.max(1e-8,halfWidth),-1,1);
    const corner=Math.pow(Math.abs(t),1.85);
    const center=Math.pow(Math.max(0,1-t*t),.63);
    attr.array[k]=centerX+(original[k]-centerX)*(1+.145*smile+.02*cheek);
    const lift=faceSize.y*(.034*smile+.006*cheek)*corner;
    const edgeCorrection=isUpper?-delta*.14*corner:delta*.69*corner;
    attr.array[k+1]=original[k+1]+lift+edgeCorrection;
    attr.array[k+2]=original[k+2]-faceSize.z*.006*smile*center;
   }
   attr.needsUpdate=true;
   lip.geometry.computeVertexNormals();lip.geometry.computeBoundingSphere();
  }
 };

 function applyExpression(){
  const preset=expressionFrame();
  const e=Object.fromEntries(Object.entries(preset).map(([k,v])=>[
   k,typeof v==='number'?v*strength:v
  ]));
  const neutralPose=channels.every(k=>Math.abs(Number(e[k])||0)<1e-8);
  // v84 public safety: the original CC0 head lacks a valid movable
  // oral aperture. v83 hid fake teeth but DID NOT stop e.open from
  // dragging existing facial triangles into an inverted black fan.
  // Jaw opening awaits genuine manifold topology and visual review.
  const safeOriginalMouth=face.userData.v83SafeOriginalMouthTopology===true;
  const nativeOral=face.userData.v88NativeOralRig?.ready===true;
  // Native geometry supports full muscle smile; safety clamp applies to unverified mouths only.
  const skinPose=nativeOral?{...e,open:0,au26:0}:
   safeOriginalMouth?{...e,open:0,au26:0,
    smile:THREE.MathUtils.clamp(Number(e.smile)||0,-.30,.35)}:e;
  const actionUnits=deriveFacialActionUnits(skinPose);
  // Face sculpt uses its ORIGINAL sampled head vertices as the baseline.
  // No expression accumulates when selections are toggled 100+ times.
  const xd=Math.max(.000001,faceSize.x),yd=Math.max(.000001,faceSize.y);
  const depth=Math.max(.000001,faceSize.z);
  for(let i=0;i<facialAttr.count;i++){
   const k=i*3,x=facialRest[k],y=facialRest[k+1],z=facialRest[k+2];
   const ax=Math.abs((x-centerX)/xd),ny=(y-faceBox.min.y)/yd;
   const front=clamp(((z-faceBox.min.z)/depth-.50)/.18);
   const fall=(a,c,w)=>Math.exp(-.5*((a-c)/w)**2);
   const lipCorner=fall(ax,.065,.048)*fall(ny,mouthY,.050)*front;
   const cheek=fall(ax,.20,.11)*fall(ny,.565,.085)*front;
   const brow=fall(ax,.135,.090)*fall(ny,.745,.057)*front;
   const jaw=fall(ax,.10,.17)*fall(ny,mouthY-.099,.105)*front;
   const lowerLip=fall(ax,.055,.068)*fall(ny,mouthY-.025,.039)*front;
   const mouthInterior=fall(ax,.050,.070)*fall(ny,mouthY,.020)*front;
   const inner=fall(ax,.16,.10)*fall(ny,.745,.05)*front;
   const muscle=v65ExpressionMuscleDelta({ax,ny,front,expression:skinPose});
   const micro=v76ExpressionMuscleDelta({ax,ny,front,expression:skinPose});
   const anatomical=v80FaceMuscleDelta({ax,ny,front,mouthY,
    ageStrength,actionUnits});
   // Do not tear or invert the lip/philtrum/chin triangles of an intact
   // face. Retain cheek and eyelid expressions outside the guard.
   const oralGuard=safeOriginalMouth?
    1-(1-THREE.MathUtils.smoothstep(ax,.18,.44))*
      (1-THREE.MathUtils.smoothstep(Math.abs(ny-mouthY),.018,.105))*
      THREE.MathUtils.smoothstep(front,.55,.99):1;
   const skinGain=skinDeformationGain*oralGuard;
   facialAttr.array[k]=x+xd*skinGain*
    Math.sign(x-centerX)*anatomical.dxOut;
   facialAttr.array[k+1]=y+yd*skinGain*(.033*skinPose.smile*lipCorner+
    .012*skinPose.cheek*cheek+.008*skinPose.brow*brow+
    .013*skinPose.tilt*inner-.050*Math.max(0,skinPose.open)*jaw-
    .024*Math.max(0,skinPose.open)*lowerLip+
    muscle.dy+micro.dy+anatomical.dy);
   facialAttr.array[k+2]=z+depth*skinGain*(.009*skinPose.cheek*cheek+
    .008*Math.max(0,skinPose.smile)*lipCorner-
    .014*Math.max(0,skinPose.open)*mouthInterior+
    muscle.dz+micro.dz+anatomical.dz);
  }
  // Exact neutral restoration also preserves signed zeros / donor float32
  // geometry, eliminating cumulative drift after repeated face changes.
  if(neutralPose)facialAttr.array.set(facialRest);
  facialAttr.needsUpdate=true;
  if(face.userData.v82IntegratedMouth?.integrated)face.userData.v82IntegratedMouth.lastPoseKey=null;
  const normals=face.geometry.getAttribute('normal');
  if(neutralPose&&normals&&sculptNormalRest&&
     normals.array.length===sculptNormalRest.length){
   normals.array.set(sculptNormalRest);
   normals.needsUpdate=true;
  }else{
   // Never shade deformed skin using neutral-pose normals. Recalculate
   // only at pose changes, welding UV-split coincident vertices so
   // cheeks and nasolabial regions do not show polygon boundaries.
   face.geometry.computeVertexNormals();
   smoothStudioFaceNormals(face.geometry,{weldTolerance:.00007});
  }
  face.geometry.computeBoundingSphere();
  captureNativeOralSkinPose(face);
  for(const side of sides)if(side.brow&&side.browRest){
   side.brow.position.y=side.browRest.y+faceSize.y*e.brow*.012;
   side.brow.rotation.z=side.browRest.z+(side.side==='LEFT'?-1:1)*e.tilt*.21;
  }
  // Lip poses are solved with the jaw opening in setMouthOpen.
 }
 const setBlink=value=>{
  blink=clamp(value);
  const frame=expressionFrame();
  const squint=Math.max(Number(frame.squint)||0,Number(frame.au07)||0)*strength;
  const expressiveSquint=state.expression==='sleepy'?squint:
   Math.max(0,squint)*(state.expression==='laugh'?.78:.59);
  const closure=clamp(blink+(1-blink)*expressiveSquint,0,1);
  // Shock/laughter visibly open the actual eyelid edges instead of only
  // tinting the eye. Preserve full automatic blinks at their peak.
  const widen=['surprised','startled','afraid'].includes(state.expression)?.24:
   state.expression==='laugh'?0:0;
  const eyelidTravel=closure-(1-closure)*widen;
  for(const side of sides){
   moveGrid(side.a,side.b.rest,eyelidTravel,true);
   moveGrid(side.b,side.a.rest,eyelidTravel,false);
   moveDecorations(side,eyelidTravel);
   coverEye(side,closure,size);
   // Eyeliner belongs to the eyelid and follows the moved lid,
   // iris and pupil retain their individual natural geometry.
   for(const mesh of [side.a.mesh,side.b.mesh]){
    mesh.geometry.computeBoundingSphere();
   }
  }
 };
 const setMouthOpen=value=>{
  const frame=expressionFrame();
  // Never show a fictitious 96% opening while the real donor face has
  // a safely closed topology. Lip deformation is intentionally limited.
  if(face.userData.v83SafeOriginalMouthTopology&&
     !face.userData.v88NativeOralRig?.ready){
   mouthOpen=0;
   return;
  }
  mouthOpen=clamp(Math.max(value,Math.max(Number(frame.open)||0,
   Number(frame.au26)||0)*strength));
  if(!mouth)return;
  const delta=mouth.height*.053*mouthOpen;
  mouth.upper.position.y=mouth.restU+delta*.14;
  mouth.lower.position.y=mouth.restL-delta*.69;
  if(mouth.native){
   updateNativeOralPose(face,{open:mouthOpen,
    smile:Number(frame.smile)||0,cheek:Number(frame.cheek)||0});
   smoothStudioFaceNormals(face.geometry,{weldTolerance:.00007});
  }else if(mouth.integrated){
   // These vertices are owned by the HEAD geometry; no mouth silhouette
   // is drawn above the face and the same vertices carry lipstick.
   const updated=poseIntegratedMouth(face,{
    open:mouthOpen,smile:Number(frame.smile)||Number(frame.au12)||0,
    cheek:Number(frame.cheek)||Number(frame.au06)||0
   });
   if(updated)smoothStudioFaceNormals(face.geometry,{weldTolerance:.00007});
  }else poseLips(frame,delta);
  mouth.cavity.visible=mouthOpen>.025;
  const grin=clamp(Number(frame.smile)||Number(frame.au12)||0);
  mouth.cavity.position.y=(face.userData.actualMouthCreaseY??mouth.cavity.position.y)-
   delta*.19+mouth.height*.009*grin;
  mouth.cavity.scale.set(mouth.width*(.45+.16*grin),
   Math.max(.000001,delta*(.68-.045*grin)),mouth.height*.0045);
  mouth.oral.update({openness:mouthOpen,jawDrop:mouthOpen,
   smile:Number(frame.smile)||Number(frame.au12)||0});
 };
 const update=dt=>{
  if(disposed)return;
  const step=Math.max(0,Math.min(.10,Number(dt)||0));
  elapsed+=step;
  if(transition){
   transition.elapsed+=step;
   const t=smooth(transition.elapsed/transition.duration);
   if(t>=1||t-transition.lastApplied>=.13){
    transition.lastApplied=t;
    manualActionUnits=t>=1?null:Object.fromEntries(
     channels.slice(0,6).map(k=>[k,(transition.from[k]||0)*(1-t)+
      (transition.to[k]||0)*t]));
    if(t>=1)transition=null;
    applyExpression();
   }
  }
  setBlink(forcedBlink===null?(state.autoBlink?blinkEnvelope(elapsed):0):forcedBlink);
  setMouthOpen(manualMouth!==null?manualMouth:
   state.speaking?speechEnvelope(elapsed):0);
 };
 const dispose=()=>{
  if(disposed)return;
  state.expression='neutral';
  manualActionUnits=null;transition=null;
  applyExpression();
  setBlink(0);setMouthOpen(0);
  for(const side of sides){
   side.cover.removeFromParent();side.cover.geometry.dispose();side.cover.material.dispose();
  }
  if(mouth){
   mouth.cavity.removeFromParent();
   mouth.cavity.geometry.dispose();mouth.cavity.material.dispose();
   mouth.oral.dispose();
  }
  disposed=true;
 };
 return {
  update,dispose,setAutoBlink:on=>{state.autoBlink=!!on;if(!on)setBlink(0);},
  setSpeaking:on=>{state.speaking=!!on;if(!on&&manualMouth===null)setMouthOpen(0);},
  setExpression:id=>{
   if(!FACE_EXPRESSIONS[id])throw Error('Unknown 3D face expression: '+id);
   state.expression=id;
   manualActionUnits=null;transition=null;
   applyExpression();
   setBlink(blink);
   setMouthOpen(manualMouth??(state.speaking?speechEnvelope(elapsed):0));
  },
  // Natural expression switching: six to eight shape updates over
  // 0.28 s, not 60 heavy full-face normal recomputations per second.
  transitionToExpression:(id,duration=.28)=>{
   if(!FACE_EXPRESSIONS[id])throw Error('Unknown 3D face expression: '+id);
   const from=expressionFrame(),to=FACE_EXPRESSIONS[id];
   state.expression=id;
   const seconds=THREE.MathUtils.clamp(Number(duration)||.28,.08,1);
   transition={from,to,duration:seconds,elapsed:0,lastApplied:0};
   manualActionUnits=Object.fromEntries(channels.slice(0,6).map(k=>[k,Number(from[k])||0]));
   applyExpression();setBlink(blink);
   setMouthOpen(manualMouth??(state.speaking?speechEnvelope(elapsed):0));
  },
  setActionUnits:values=>{
   transition=null;
   manualActionUnits=values==null?null:Object.fromEntries(
    channels.filter(k=>Number.isFinite(Number(values[k]))).map(k=>[
     k,THREE.MathUtils.clamp(Number(values[k]),-1,1)
    ]));
   applyExpression();setBlink(blink);
   setMouthOpen(manualMouth??(state.speaking?speechEnvelope(elapsed):0));
  },
  // Stable direct preview/QA pose. Passing null restores periodic blinking.
  setBlinkProgress:value=>{
   forcedBlink=value===null?null:clamp(value);
   setBlink(forcedBlink===null?0:forcedBlink);
  },
  setMouthOpen:value=>{manualMouth=value===null?null:clamp(value);setMouthOpen(manualMouth??0);},
  getState:()=>({autoBlink:state.autoBlink,speaking:state.speaking,
   expression:state.expression,
   blink:Number(blink.toFixed(3)),mouthOpen:Number(mouthOpen.toFixed(3)),
   blinkEyes:sides.length,mouthIs3D:!!mouth,sourceMeshUnchanged:true,
   v65NasalCheekMuscleCoupling:true,
   v76FineForeheadNasalNasolabialAndCanthusMuscles:true,
   v76BothLashesTrackBlinkClosure:true,
   v76FacialSculptNormalsPreserved:!!sculptNormalRest,
   v76InitialSeamNormalSmoothing:initialNormalReport.applied,
   v76ExpressionKeepsSmoothShading:true,
   v79DynamicSeamWeldedNormals:true,
   v79ActionUnitChannels:channels.length,
   v79ManualActionUnits:manualActionUnits?{...manualActionUnits}:null,
   v80FACSChannels:FACS_CHANNELS_V80.length,
   v80MouthAnatomy:mouth?.oral.report||null,
   v80OralLandmarkFollowsAge:true,
   v80SmoothMuscleTransitions:true,
   v81AnatomicalSmileEyeCoupling:true,
   v81LipstickFollowsVermilion:true,
   v81MouthCornersLiftAndSpread:true,
   v82SingleHeadMouthTopology:!!face.userData.v82IntegratedMouth?.integrated,
   v82NoForegroundMouthCover:!!mouth?.integrated,
   v82LipPigmentDeformsWithFace:!!mouth?.integrated,
   v83ProductionSafetyMode:!!face.userData.v83SafeOriginalMouthTopology,
   v83ForegroundOverlaysDisabled:!!face.userData.v83SafeOriginalMouthTopology,
   v83OralCavityDeferredUntilTopologyValidated:
    !!face.userData.v83SafeOriginalMouthTopology,
   v84JawOpeningQuarantined:!!face.userData.v83SafeOriginalMouthTopology,
   v84OralSkinInversionGuard:!!face.userData.v83SafeOriginalMouthTopology,
   v85BuildSignature:'face-v85-source-mouth-restored-closed-20261122',
   v85SourceOralGeometryProtected:!!face.userData.v85SourceOralGeometryProtected,
   v85RestoredOralVertices:face.userData.v85RestoredOralVertices||0,
   v86BuildSignature:'face-v86-native-front-lip-loop-seal-20261122',
   v87BuildSignature:'face-v87-anatomical-mouth-corners-20261122',
   v87MouthWidth:face.userData.v87AnatomicalMouthWidth||1,
   v87OriginalSkinMouthWidth:!!face.userData.v87MouthWidthOnOriginalSkin,
   v88BuildSignature:'face-v88-native-oral-structural-facs-20261122',
   v89BuildSignature:'face-v89-natural-laugh-cosmetics-nasolabial-20261122',
   v90BuildSignature:'face-v90-native-skin-lip-reference-quality-20261122',
   v91BuildSignature:'face-v91-responsive-natural-laugh-visual-sculpt-20261122',
   v88OralAnatomy:getNativeOralRigReport(face),
   v88NativeLipVolume:!!face.userData.v88V80InspiredLipVolume,
   v86OralSealed:face.userData.v86OralSealSummary?.sealed===true,
   v86OralSealTriangles:face.userData.v86OralSealSummary?.addedTriangles||0,
   v86OralSealFailure:face.userData.v86OralSealSummary?.reason||null,
   v80TransitionProgress:transition?Number(smooth(
    transition.elapsed/transition.duration).toFixed(3)):null,
   expressionIntensity:strength,
   elapsed:Number(elapsed.toFixed(3))})
 };
}
