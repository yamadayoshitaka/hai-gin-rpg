import * as THREE from 'three';
import {createFaceProfile,updateFaceProfile,facialSpeechEnvelope,mouthSyllableCount} from './facial-feature-profiles.js';

/** All adjustments are on the original skinned donor face; no second face,
 * floating eyebrows, artificial bald scalp or unlicensed external mesh.
 * The cloned geometries are OWNED by one actor and released on dispose.
 */
const findNode=(root,name)=>{let result=null;root.traverse(o=>{
 if(!result&&o.name?.toLowerCase()===name.toLowerCase())result=o;
});return result;};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const shapeFactor=(kind,part)=>{
 if(part==='eyes')return {round:1.12,narrow:.77,hooded:.88,almond:1}[kind]??1;
 if(part==='nose')return {broad:1.14,short:.87,aquiline:1.11,straight:1}[kind]??1;
 return {wide:1.07,thin:.80,bow:.93,neutral:1}[kind]??1;
};
function applyEyes(eyes,profile,original){
 const position=eyes.geometry?.getAttribute('position');
 if(!position)return 0;
 const source=original.getAttribute('position'),length=source.count;
 let center=0,centery=0;
 for(let i=0;i<length;i++){center+=source.getX(i);centery+=source.getY(i)}
 center/=length;centery/=length;
 const shape=shapeFactor(profile.eyesType,'eyes');
 for(let i=0;i<length;i++){
  const x=source.getX(i),y=source.getY(i),z=source.getZ(i);
  const side=x<center?-1:1;
  // No whole-actor scale transform; only sclera and iris vertices change.
  const ownCenter=center+side*.028;
  const nx=center+side*.028*profile.eyeSpacing+(x-ownCenter)*profile.eyeSize;
  const ny=centery+(y-centery)*profile.eyeSize*shape;
  position.setXYZ(i,nx,ny,z);
 }
 position.needsUpdate=true;eyes.geometry.computeBoundingSphere();
 return length;
}
function faceVertexDeform(x,y,z,profile,{eyeY,eyeZ,eyeSpan}){
 // Geometry is in GLTF bind-space metres. Eye Y is measured from the actual
 // donor (not hard-coded world coordinates), and drives lower-face windows.
 const noseY=eyeY-eyeSpan*1.55,mouthY=eyeY-eyeSpan*3.50;
 const width=Math.max(.024,eyeSpan*1.65);
 let nx=x,ny=y,nz=z;
 const depth=clamp((z-eyeZ+.045)/.095,0,1);
 const noseRadius=Math.abs(x)/width,dyN=Math.abs(y-noseY)/(eyeSpan*1.4);
 const noseWeight=depth*Math.max(0,1-noseRadius*noseRadius)*
   Math.max(0,1-dyN*dyN);
 if(noseWeight>0){
  const noseShape=shapeFactor(profile.noseType,'nose');
  nx+=x*(profile.noseWidth*noseShape-1)*noseWeight*.60;
  ny+=(y-noseY)*(profile.noseLength-1)*noseWeight*.45;
  nz+=(profile.noseLength-1)*.016*noseWeight;
 }
 const mouthRadius=Math.abs(x)/(width*1.35),dyM=Math.abs(y-mouthY)/(eyeSpan*.74);
 const mouthWeight=depth*Math.max(0,1-mouthRadius*mouthRadius)*
   Math.max(0,1-dyM*dyM);
 if(mouthWeight>0){
  nx+=x*(profile.mouthWidth*shapeFactor(profile.mouthType,'mouth')-1)*mouthWeight*.65;
  nz+=(profile.mouthFullness-1)*.012*mouthWeight;
 }
 return {x:nx,y:ny,z:nz,mouthWeight,mouthY};
}
/** Original Quaternius faces contain no jaw bone or mouth morph targets.
 * Create ONE localized morph directly on original skinned facial triangles.
 * GPU executes this morph; runtime animation only changes one influence.
 */
export function attachHumanFaceControls(model,{
 id='human',job='civilian',sex='male',quality='battle',overrides={}
}={}){
 let profile=createFaceProfile({id:job+':'+id,kind:'human',sex,overrides});
 const eyes=findNode(model,'Eyes'),body=findNode(model,sex==='female'?'SuperHero_Female':'SuperHero_Male')||
  findNode(model,'SuperHero_Male')||findNode(model,'SuperHero_Female');
 const owned=[];
 const oldEyes=eyes?.geometry,oldBody=body?.geometry;
 let affectedEyes=0,affectedFace=0,mouthMorphIndex=-1;
 let eyeY=0,eyeZ=0,eyeSpan=.03;
 if(eyes?.isSkinnedMesh&&oldEyes?.getAttribute('position')){
  const src=oldEyes.getAttribute('position');let minY=Infinity,maxY=-Infinity;
  for(let i=0;i<src.count;i++){
   eyeY+=src.getY(i);eyeZ+=src.getZ(i);
   minY=Math.min(minY,src.getY(i));maxY=Math.max(maxY,src.getY(i));
  }
  eyeY/=src.count;eyeZ/=src.count;eyeSpan=clamp(maxY-minY,.015,.05);
  eyes.geometry=oldEyes.clone();owned.push(eyes.geometry);
 }
 if(body?.isSkinnedMesh&&oldBody?.getAttribute('position')&&eyeY){
  body.geometry=oldBody.clone();owned.push(body.geometry);
 }
 const faceRest=body?.geometry&&oldBody?oldBody.getAttribute('position'):null;
 function writeProfile(){
  if(eyes?.geometry!==oldEyes)affectedEyes=applyEyes(eyes,profile,oldEyes);
  if(!faceRest||!body?.geometry)return;
  const pos=body.geometry.getAttribute('position');
  const mouth=new Float32Array(pos.count*3);
  let effectCount=0;
  for(let i=0;i<pos.count;i++){
   const x=faceRest.getX(i),y=faceRest.getY(i),z=faceRest.getZ(i);
   const d=faceVertexDeform(x,y,z,profile,{eyeY,eyeZ,eyeSpan});
   pos.setXYZ(i,d.x,d.y,d.z);
   mouth[i*3]=d.x;
   mouth[i*3+1]=d.y+d.mouthWeight*(y<d.mouthY?-.014:.004);
   mouth[i*3+2]=d.z+d.mouthWeight*.003;
   if(d.mouthWeight>.04)effectCount++;
  }
  pos.needsUpdate=true;
  if(effectCount>=5){
   const geom=body.geometry;
   const previous=geom.morphAttributes.position||[];
   if(mouthMorphIndex<0){
    mouthMorphIndex=previous.length;
    geom.morphAttributes.position=[...previous,new THREE.Float32BufferAttribute(mouth,3)];
    geom.morphTargetsRelative=false;body.updateMorphTargets?.();
   }else{
    geom.morphAttributes.position[mouthMorphIndex].array.set(mouth);
    geom.morphAttributes.position[mouthMorphIndex].needsUpdate=true;
   }
   const existing=body.morphTargetInfluences;
   if(existing&&existing[mouthMorphIndex]==null)existing[mouthMorphIndex]=0;
  }
  affectedFace=effectCount;
  geomBounds(body.geometry);
 }
 function geomBounds(geom){geom.computeBoundingBox();geom.computeBoundingSphere();}
 writeProfile();
 let speechAge=Infinity,syllables=0,active=true;
 const diagnostics=()=>({
  supported:!!affectedEyes,profile,eyeVertices:affectedEyes,
  mouthVertices:affectedFace,mouthMorphIndex,
  animatedMouth:mouthMorphIndex>=0,
  noseMesh:!!faceRest,sharedSkinProtected:true,quality
 });
 const controller={
  get profile(){return profile;},
  get supported(){return affectedEyes>0;},
  setProfile(changes){profile=updateFaceProfile(profile,changes);writeProfile();return diagnostics();},
  speak(text){speechAge=0;syllables=mouthSyllableCount(text);return mouthMorphIndex>=0;},
  update(dt){
   if(!active||mouthMorphIndex<0)return;
   if(Number.isFinite(speechAge))speechAge+=Math.max(0,Math.min(.15,Number(dt)||0));
   if(body.morphTargetInfluences)
    body.morphTargetInfluences[mouthMorphIndex]=Number.isFinite(speechAge)?
     facialSpeechEnvelope(speechAge,syllables):0;
  },
  diagnostics,
  dispose(){
   if(!active)return;active=false;
   if(eyes&&oldEyes)eyes.geometry=oldEyes;
   if(body&&oldBody)body.geometry=oldBody;
   for(const geom of owned)geom.dispose();
  }
 };
 model.userData.facialControls=controller;
 return controller;
}
/** Model-specific procedural controls for 50 species without extra meshes. */
export function attachMonsterFaceControls(model,{id,overrides={}}={}){
 let profile=createFaceProfile({id:id??model.userData.speciesId??model.name,kind:'monster',overrides});
 const head=model.userData.pivots?.head||findNode(model,'head');
 const jaw=model.userData.pivots?.jaw||findNode(model,'jaw');
 const eyeMeshes=[];
 head?.traverse(o=>{if(o.isMesh&&(/^(eye|eyes)$/i.test(o.name)||/eye/i.test(o.name)&&!o.name.includes('lid')))eyeMeshes.push(o)});
 const noseMeshes=[];
 head?.traverse(o=>{if(o.isMesh&&/^(nose|muzzle)$/i.test(o.name))noseMeshes.push(o)});
 const rest=new Map([...eyeMeshes,...noseMeshes].map(o=>[o,{position:o.position.clone(),scale:o.scale.clone()}]));
 let age=Infinity,count=0;
 function apply(){
  for(const eye of eyeMeshes){
   const r=rest.get(eye);
   const factor=shapeFactor(profile.eyesType,'eyes');
   eye.scale.copy(r.scale).multiply(new THREE.Vector3(profile.eyeSize,profile.eyeSize*factor,1));
   eye.position.copy(r.position);
   eye.position.x*=profile.eyeSpacing;
  }
  for(const nose of noseMeshes){
   const r=rest.get(nose);
   nose.scale.copy(r.scale).multiply(new THREE.Vector3(profile.noseWidth,profile.noseLength,1));
  }
  if(jaw)jaw.userData.facialMouthProfile=profile;
 }
 apply();
 const controller={
  get profile(){return profile;},
  setProfile(changes){profile=updateFaceProfile(profile,changes);apply();return this.diagnostics();},
  speak(text){age=0;count=mouthSyllableCount(text);return !!jaw;},
  update(dt){
   if(Number.isFinite(age))age+=Math.max(0,Math.min(.2,Number(dt)||0));
   if(jaw&&Number.isFinite(age))jaw.rotation.x+=facialSpeechEnvelope(age,count)*.34;
  },
  diagnostics:()=>({profile,eyeMeshes:eyeMeshes.length,noseMeshes:noseMeshes.length,
   jawAnimated:!!jaw}),
  dispose(){for(const [o,r] of rest){o.position.copy(r.position);o.scale.copy(r.scale)}}
 };
 model.userData.facialControls=controller;
 return controller;
}
