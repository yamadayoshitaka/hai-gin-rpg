#!/usr/bin/env node
/** Real Three.js generator probes, NOT image-similarity/Android-FPS scores.
 * Each candidate uses a fresh Node process after swapping only the tune profile.
 */
import * as THREE from 'three';
import {EVOLUTION_PROFILE,validateEvolutionProfile}
 from '../src/character-system/quality-evolution-profile.js';
import {makeIndependentFaceMaster} from '../src/independent-face-masters.js';
import {v71EyeDepthFromEyeliner} from '../src/face-feature-meshes.js';
import {createScalpAnchoredWig} from '../src/face-scalp-wig.js';
import {createDetailedOutfit,JOBS} from '../src/outfit-maintenance-model.js';
import {performance} from 'node:perf_hooks';

validateEvolutionProfile();
const domain=process.argv[2]||'face';
if(!['face','hair','outfit'].includes(domain))throw Error('Unknown evolution group');
const result={
 schemaVersion:1,domain,source:'actual in-repo Three.js geometry constructors',
 profile:EVOLUTION_PROFILE[domain],visualApproval:false,androidFpsMeasured:false,
 proxyScore:null,metrics:null,hardGate:false
};
const head=()=>{
 const geometry=new THREE.SphereGeometry(.19,64,48);
 const source=new THREE.Group();
 const skin=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xbbbbbb}));
 skin.name='GEO-real-source-head';
 source.add(skin);
 const eye=new THREE.Mesh(new THREE.SphereGeometry(.018,18,12));
 eye.name='GEO_sclera_l';source.add(eye);
 return source;
};
function costumeRig(){
 const body=new THREE.Group();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(.38,1.48,.29),
  new THREE.MeshStandardMaterial());
 mesh.position.y=.81;mesh.name='anatomical-mannequin-body';
 body.add(mesh);
 const joints={
  pelvis:[0,.78,0],spine_03:[0,1.20,0],
  neck_01:[0,1.54,0],head:[0,1.73,0],
  clavicle_l:[-.15,1.39,0],clavicle_r:[.15,1.39,0],
  foot_l:[-.09,.07,0],foot_r:[.09,.07,0]
 };
 for(const [name,coords] of Object.entries(joints)){
  const bone=new THREE.Bone();bone.name=name;bone.position.set(...coords);
  body.add(bone);
 }
 body.updateMatrixWorld(true);return body;
}
try{
 if(domain==='face'){
  const face=makeIndependentFaceMaster(head(),'female');
  const report=face.report;
  const scan=[
   {upperZ:.088,lowerZ:.082,corneaZ:.063,eyeRadius:.042},
   {upperZ:.11,lowerZ:.105,corneaZ:.07,eyeRadius:.054},
   {upperZ:.07,lowerZ:.066,corneaZ:.043,eyeRadius:.034}
  ].map(v=>v71EyeDepthFromEyeliner({...v,eyeDepth:0}));
  const depths=scan.map(x=>-x.signedDepthRatio);
  const avg=depths.reduce((a,b)=>a+b,0)/depths.length;
  const residual=Math.max(...scan.map(x=>Math.abs(x.residualRatio)));
  const target=.025;
  const compliant=depths.every(x=>x>=.015&&x<=.044)&&residual<=1e-7;
  const anatomical=report.detailedParts?.eyeMeshCount===2&&
   report.detailedParts?.eyelidMeshCount===4&&
   report.sourceGeometryIndependent===true;
  result.metrics={eyeInsetRatio:avg,maxFitResidual:residual,
   eyeMeshCount:report.detailedParts.eyeMeshCount,
   lidMeshCount:report.detailedParts.eyelidMeshCount,
   sourceVertices:report.sourceVertices,faceTriangles:report.triangles,
   objective:'slightly behind measured eyeliner; objective is a PROXY, not artistic judgment',
   targetInsetRatio:target};
  result.hardGate=compliant&&anatomical;
  result.proxyScore=Math.max(0,100-Math.abs(avg-target)*1000);
 }else if(domain==='hair'){
  const face=makeIndependentFaceMaster(head(),'female');
  const t0=performance.now();
  const wig=createScalpAnchoredWig(face.face,{
   count:196,lengthScale:1,normalLayeredSingleMesh:true,gender:'female',
   visualFiberMultiplier:1,fineFringeMultiplier:1
  });
  const duration=performance.now()-t0;
  const r=wig.getReport(),z=r.rootDistribution;
  const fringe=(z.fringeLeft||0)+(z.fringeRight||0);
  const crown=(z.crown||0);
  let triangles=0,invalid=0;
  wig.root.traverse(n=>{
   if(!n.isMesh)return;
   const g=n.geometry,p=g?.getAttribute?.('position');
   if(!p||p.count===0){invalid++;return}
   triangles+=g.index?.count?g.index.count/3:p.count/3;
   for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/100))){
    if(![p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite)){invalid++;break}
   }
  });
  result.metrics={fringeRoots:fringe,crownRoots:crown,rootCount:r.rootCount,
   fringeRootFraction:fringe/Math.max(1,r.rootCount),meshTriangles:Math.round(triangles),
   invalidMeshes:invalid,headScalpAnchored:wig.root.userData.hairOnRealHead===true,
   generatorMs:Math.round(duration*100)/100,
   objective:'real female head root coverage against geometry cost, not beauty or Android FPS'};
  result.hardGate=invalid===0&&fringe>0&&crown>0&&
   Number.isFinite(triangles)&&triangles>0&&r.rootCount>=196;
  // A monotonic surrogate cannot certify realistic hairstyles; the
  // deployment gate additionally requires real browser FPS and art review.
  result.proxyScore=Math.round(result.metrics.fringeRootFraction*10000)/100;
  wig.dispose();
 }else{
  const body=costumeRig();
  const texture=new THREE.Texture(),textures={
   linen:texture,leather:texture,steel:texture,
   'gold-brocade':texture,'linen-fine':texture
  };
  const all=[];
  for(const [job] of JOBS){
   const mesh=createDetailedOutfit(job,'female',body,textures,
    {quality:'battle',rarity:'N',isProtagonist:false});
   const mats=mesh.userData?.materials||[];
   all.push({job,triangles:mesh.userData?.triangles||0,
    materialCount:mats.length,
    bumpScales:mats.map(m=>m.bumpScale).filter(Number.isFinite)});
   mesh.traverse(o=>{if(o.isMesh){o.geometry?.dispose?.()}});
  }
  const triangles=all.reduce((sum,r)=>sum+r.triangles,0);
  const bump=all.flatMap(r=>r.bumpScales);
  const valid=all.length===17&&all.every(r=>r.triangles>0&&r.materialCount>0)&&
   bump.length>0&&bump.every(x=>x>=0&&x<=.006);
  result.metrics={jobCount:all.length,triangles,materials:all.reduce((s,r)=>s+r.materialCount,0),
   averageBumpScale:bump.reduce((a,b)=>a+b,0)/Math.max(1,bump.length),
   invalidBumps:bump.filter(x=>!Number.isFinite(x)||x<0||x>.006).length,
   objective:'17 real outfit factory variants and valid PBR mapping; no numeric aesthetic target'};
  result.hardGate=valid;
  // Without an approved photometric reference any bump change is
  // stylistic and MUST remain preview-only.
  result.proxyScore=null;
 }
}catch(error){result.hardGate=false;result.error=String(error.stack||error).slice(0,1100)}
console.log('EVOLUTION_PROBE '+JSON.stringify(result));
if(!result.hardGate)process.exitCode=1;
