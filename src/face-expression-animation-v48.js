/**
 * Real 3D face expressions for the standalone face and full-body studios.
 * No generated image/texture and no global source-GLB edits.
 * Blinking moves the EXISTING anatomical eyelid vertices and a surface-
 * matching closure curtain. Talking moves the EXISTING two vermilion lips.
 * Demo talking is SILENT, syllable-paced motion; not phoneme/audio sync.
 */
import * as THREE from 'three';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const smooth=t=>{const x=clamp(t);return x*x*(3-2*x);};
/** Signed intensities are blended with ongoing blink and speech.
 * Every expression preset changes actual 3D skin and part geometry, not labels. */
export const FACE_EXPRESSIONS=Object.freeze({
 neutral:Object.freeze({label:'通常',brow:0,tilt:0,squint:0,smile:0,open:0,cheek:0}),
 softSmile:Object.freeze({label:'微笑み',brow:.07,tilt:0,squint:.10,smile:.35,open:0,cheek:.24}),
 smile:Object.freeze({label:'笑顔',brow:.09,tilt:0,squint:.18,smile:.75,open:.10,cheek:.50}),
 laugh:Object.freeze({label:'大笑い',brow:.11,tilt:0,squint:.22,smile:1,open:.67,cheek:.66}),
 angry:Object.freeze({label:'怒り',brow:-.18,tilt:-.27,squint:.28,smile:-.28,open:0,cheek:-.12}),
 shout:Object.freeze({label:'怒鳴る',brow:-.21,tilt:-.33,squint:.23,smile:-.2,open:.96,cheek:-.09}),
 sad:Object.freeze({label:'悲しい',brow:-.06,tilt:.20,squint:.19,smile:-.45,open:.05,cheek:-.13}),
 surprised:Object.freeze({label:'驚き',brow:.36,tilt:.04,squint:-.16,smile:0,open:.38,cheek:0}),
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
  ['_UPPER_EYESHADOW',true]
 ]){
  const element=parts.getObjectByName(side+suffix);
  if(element?.geometry?.getAttribute('position'))
   decorations.push({...remember(element),isUpper,
    rows:suffix.endsWith('EYESHADOW')?6:3});
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
 const upper=parts.getObjectByName('UPPER_3D_VERMILION_LIP');
 const lower=parts.getObjectByName('LOWER_3D_VERMILION_LIP');
 if(!upper||!lower)return null;
 const geou=upper.geometry,geol=lower.geometry;
 geou.computeBoundingBox();geol.computeBoundingBox();
 const b=geou.boundingBox;
 const mid=new THREE.Vector3().addVectors(b.min,b.max).multiplyScalar(.5);
 const lipPos=geou.getAttribute('position'), n=Math.floor(lipPos.count/2);
 const frontZ=Math.max(mid.z,lipPos.getZ(n))+headSize.z*.0038;
 const material=new THREE.MeshStandardMaterial({
  color:0x301b25,roughness:.98,metalness:0,
  side:THREE.DoubleSide,depthWrite:false
 });
 const cavity=new THREE.Mesh(new THREE.CircleGeometry(1,32),material);
 cavity.name='V48_3D_INNER_MOUTH';
 cavity.position.set(mid.x,face.userData.actualMouthCreaseY??mid.y,frontZ);
 cavity.renderOrder=3;cavity.visible=false;
 cavity.frustumCulled=false;
 face.add(cavity);
 return {upper,lower,cavity,restU:upper.position.y,restL:lower.position.y,
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
 const nasolabial=bell(ax,.20,.048)*bell(ny,.526,.047)*front;
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
 const state={autoBlink:!!autoBlink,speaking:!!speaking,expression:'neutral'};
 const facialAttr=face.geometry.getAttribute('position');
 const facialRest=facialAttr.array.slice();
 const faceBox=face.geometry.boundingBox.clone();
 const faceSize=faceBox.getSize(new THREE.Vector3());
 const centerX=(faceBox.min.x+faceBox.max.x)/2;
 const mouthRest=mouth?{
  upper:mouth.upper.geometry.getAttribute('position').array.slice(),
  lower:mouth.lower.geometry.getAttribute('position').array.slice()
 }:null;
 function applyExpression(){
  const preset=FACE_EXPRESSIONS[state.expression];
  const e=Object.fromEntries(Object.entries(preset).map(([k,v])=>[
   k,typeof v==='number'?v*strength:v
  ]));
  // Face sculpt uses its ORIGINAL sampled head vertices as the baseline.
  // No expression accumulates when selections are toggled 100+ times.
  const xd=Math.max(.000001,faceSize.x),yd=Math.max(.000001,faceSize.y);
  const depth=Math.max(.000001,faceSize.z);
  for(let i=0;i<facialAttr.count;i++){
   const k=i*3,x=facialRest[k],y=facialRest[k+1],z=facialRest[k+2];
   const ax=Math.abs((x-centerX)/xd),ny=(y-faceBox.min.y)/yd;
   const front=clamp(((z-faceBox.min.z)/depth-.50)/.18);
   const fall=(a,c,w)=>Math.exp(-.5*((a-c)/w)**2);
   const lipCorner=fall(ax,.245,.09)*fall(ny,.493,.075)*front;
   const cheek=fall(ax,.31,.13)*fall(ny,.545,.10)*front;
   const brow=fall(ax,.31,.14)*fall(ny,.745,.057)*front;
   const jaw=fall(ax,.12,.23)*fall(ny,.28,.095)*front;
   const inner=fall(ax,.16,.10)*fall(ny,.745,.05)*front;
   const muscle=v65ExpressionMuscleDelta({ax,ny,front,expression:e});
   const micro=v76ExpressionMuscleDelta({ax,ny,front,expression:e});
   facialAttr.array[k]=x;
   facialAttr.array[k+1]=y+yd*(.018*e.smile*lipCorner+
    .012*e.cheek*cheek+.008*e.brow*brow+
    .013*e.tilt*inner-.020*e.open*jaw+muscle.dy+micro.dy);
   facialAttr.array[k+2]=z+depth*(.009*e.cheek*cheek+
    .008*Math.max(0,e.smile)*lipCorner+muscle.dz+micro.dz);
  }
  facialAttr.needsUpdate=true;
  face.geometry.computeVertexNormals();face.geometry.computeBoundingSphere();
  for(const side of sides)if(side.brow&&side.browRest){
   side.brow.position.y=side.browRest.y+faceSize.y*e.brow*.012;
   side.brow.rotation.z=side.browRest.z+(side.side==='LEFT'?-1:1)*e.tilt*.21;
  }
  if(mouth&&mouthRest){
   for(const [mesh,original] of [[mouth.upper,mouthRest.upper],
    [mouth.lower,mouthRest.lower]]){
    const attr=mesh.geometry.getAttribute('position');
    for(let i=0;i<attr.count;i++){
     const k=i*3;
     const t=(original[k]-centerX)/Math.max(.0001,faceSize.x*.05);
     const corner=Math.min(1,t*t);
     attr.array[k]=centerX+(original[k]-centerX)*
      (1+.09*Math.max(0,e.smile));
     attr.array[k+1]=original[k+1]+
      faceSize.y*(.008*e.smile*corner+.0015*e.cheek);
     attr.array[k+2]=original[k+2];
    }
    attr.needsUpdate=true;mesh.geometry.computeVertexNormals();
   }
  }
 }
 const setBlink=value=>{
  blink=clamp(value);
  const squint=FACE_EXPRESSIONS[state.expression].squint*strength;
  const closure=clamp(blink+(1-blink)*squint,0,1);
  for(const side of sides){
   moveGrid(side.a,side.b.rest,closure,true);
   moveGrid(side.b,side.a.rest,closure,false);
   moveDecorations(side,closure);
   coverEye(side,closure,size);
   // Eyeliner belongs to the eyelid and follows the moved lid,
   // iris and pupil retain their individual natural geometry.
   for(const mesh of [side.a.mesh,side.b.mesh]){
    mesh.geometry.computeBoundingSphere();
   }
  }
 };
 const setMouthOpen=value=>{
  mouthOpen=clamp(Math.max(value,FACE_EXPRESSIONS[state.expression].open*strength));
  if(!mouth)return;
  const delta=mouth.height*.027*mouthOpen;
  mouth.upper.position.y=mouth.restU+delta*.22;
  mouth.lower.position.y=mouth.restL-delta*.75;
  mouth.cavity.visible=mouthOpen>.025;
  mouth.cavity.scale.set(mouth.width*.37,Math.max(.000001,delta*.62),1);
 };
 const update=dt=>{
  if(disposed)return;
  elapsed+=Math.max(0,Math.min(.10,Number(dt)||0));
  setBlink(forcedBlink===null?(state.autoBlink?blinkEnvelope(elapsed):0):forcedBlink);
  setMouthOpen(manualMouth!==null?manualMouth:
   state.speaking?speechEnvelope(elapsed):0);
 };
 const dispose=()=>{
  if(disposed)return;
  state.expression='neutral';
  applyExpression();
  setBlink(0);setMouthOpen(0);
  for(const side of sides){
   side.cover.removeFromParent();side.cover.geometry.dispose();side.cover.material.dispose();
  }
  if(mouth){
   mouth.cavity.removeFromParent();
   mouth.cavity.geometry.dispose();mouth.cavity.material.dispose();
  }
  disposed=true;
 };
 return {
  update,dispose,setAutoBlink:on=>{state.autoBlink=!!on;if(!on)setBlink(0);},
  setSpeaking:on=>{state.speaking=!!on;if(!on&&manualMouth===null)setMouthOpen(0);},
  setExpression:id=>{
   if(!FACE_EXPRESSIONS[id])throw Error('Unknown 3D face expression: '+id);
   state.expression=id;
   applyExpression();
   setBlink(blink);
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
   expressionIntensity:strength,
   elapsed:Number(elapsed.toFixed(3))})
 };
}
