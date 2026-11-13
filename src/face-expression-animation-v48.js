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
 const upperLash=parts.getObjectByName(side+'_UPPER_LASH_MESH');
 const lashRestY=upperLash?.position.y??0;
 const cover=makeClosure(upper,lower,side,headSize);
 return {a,b,cover,eye,iris,pupil,decorations,upperLash,lashRestY};
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
export function createFaceExpressionAnimator(model,{autoBlink=true,speaking=false}={}){
 const face=model?.face,parts=model?.parts;
 if(!face?.geometry||!parts?.getObjectByName)throw Error('Real anatomical face model required');
 face.geometry.computeBoundingBox();
 const size=face.geometry.boundingBox.getSize(new THREE.Vector3());
 const sides=['LEFT','RIGHT'].map(side=>buildSide(parts,side,size)).filter(Boolean);
 const mouth=buildMouth(face,parts,size);
 let elapsed=0,blink=0,mouthOpen=0,manualMouth=null,forcedBlink=null,disposed=false;
 const state={autoBlink:!!autoBlink,speaking:!!speaking};
 const setBlink=value=>{
  blink=clamp(value);
  for(const side of sides){
   moveGrid(side.a,side.b.rest,blink,true);
   moveGrid(side.b,side.a.rest,blink,false);
   moveDecorations(side,blink);
   coverEye(side,blink,size);
   // Eyeliner belongs to the eyelid and follows the moved lid,
   // iris and pupil retain their individual natural geometry.
   for(const mesh of [side.a.mesh,side.b.mesh]){
    mesh.geometry.computeBoundingSphere();
   }
  }
 };
 const setMouthOpen=value=>{
  mouthOpen=clamp(value);
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
  // Stable direct preview/QA pose. Passing null restores periodic blinking.
  setBlinkProgress:value=>{
   forcedBlink=value===null?null:clamp(value);
   setBlink(forcedBlink===null?0:forcedBlink);
  },
  setMouthOpen:value=>{manualMouth=value===null?null:clamp(value);setMouthOpen(manualMouth??0);},
  getState:()=>({autoBlink:state.autoBlink,speaking:state.speaking,
   blink:Number(blink.toFixed(3)),mouthOpen:Number(mouthOpen.toFixed(3)),
   blinkEyes:sides.length,mouthIs3D:!!mouth,sourceMeshUnchanged:true,
   elapsed:Number(elapsed.toFixed(3))})
 };
}
