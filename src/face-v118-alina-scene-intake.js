/**
 * Analyze a locally provided Alina Ip GLB. Does NOT fetch, persist, publish
 * or assume possession of the third-party mesh. Hair and garments are excluded
 * where source mesh/material names allow separation.
 */
import * as THREE from 'three';
import {analyzeFaceReference} from './face-v118-alina-reference-transfer.js';
export const ALINA_IP_ATTRIBUTION=Object.freeze({
 title:'Alina Ip, realistic Asian woman (Animated)',
 author:'Jungle Jim',
 url:'https://sketchfab.com/3d-models/alina-ip-realistic-asian-woman-animated-600d4d4aa71c4181b2567a3605ce8c57',
 license:'CC BY 4.0'
});
const excluded=/(hair|wig|fringe|bangs|skirt|cloth|clothing|shirt|dress|pant|boot|shoe|jacket|suit|sock|weapon|eyebrow|eyelash|sclera|iris|pupil|cornea|teeth|tongue|eye[_\s-])/i;
const preferred=/(^|[_\s-])(face|head|skin|body|genesis|cc_base)([_\s-]|$)/i;
function meshTitle(mesh){
 return [mesh.name,...(Array.isArray(mesh.material)?mesh.material:[mesh.material])
  .map(m=>m?.name||'')].join(' ');
}
export function collectAlinaFaceVertices(scene){
 if(!scene?.traverse)throw Error('A decoded GLB scene is required');
 scene.updateMatrixWorld(true);
 const bbox=new THREE.Box3().setFromObject(scene);
 if(bbox.isEmpty())throw Error('GLB contains no scene geometry');
 const allHeight=bbox.max.y-bbox.min.y;
 if(allHeight<.0001)throw Error('Invalid source height');
 const candidates=[];
 scene.traverse(o=>{
  if(!o.isMesh||!o.geometry?.getAttribute('position'))return;
  const title=meshTitle(o),vertices=o.geometry.getAttribute('position').count;
  if(excluded.test(title)||vertices<300)return;
  const bounds=new THREE.Box3().setFromObject(o);
  if(bounds.isEmpty())return;
  candidates.push({mesh:o,vertices,title,bounds,
   priority:preferred.test(title)?(/(face|head)/i.test(title)?3:2):1});
 });
 if(!candidates.length)throw Error('No skin/head mesh was found (hair/clothing excluded)');
 candidates.sort((a,b)=>b.priority-a.priority||b.vertices-a.vertices);
 const top=candidates[0];
 // A named face/head mesh is much safer than guessing from an entire body.
 const isolated=top.priority===3&&
  top.bounds.getSize(new THREE.Vector3()).y<allHeight*.82;
 const selected=isolated?candidates.filter(x=>x.priority===3):[top];
 const referenceCut=isolated?-Infinity:
  bbox.max.y-allHeight*(allHeight>1.20?.265:.50);
 const point=new THREE.Vector3(),positions=[];
 let skipped=0;
 for(const item of selected){
  const mesh=item.mesh,count=item.vertices;
  for(let i=0;i<count;i++){
   mesh.getVertexPosition(i,point);
   point.applyMatrix4(mesh.matrixWorld);
   if(!Number.isFinite(point.x+point.y+point.z)||point.y<referenceCut){
    skipped++;continue;
   }
   positions.push(point.x,point.y,point.z);
  }
 }
 if(positions.length<900)
  throw Error('Source head has fewer than 300 usable surface vertices');
 return {positions:new Float32Array(positions),report:{
  selectedMeshes:selected.map(x=>({name:x.mesh.name||'(unnamed)',
   originalVertices:x.vertices})),
  headOnlyMesh:isolated,headCutY:Number.isFinite(referenceCut)?referenceCut:null,
  sampledVertices:positions.length/3,excludedVertices:skipped,
  importedWithoutModifyingSource:true
 }};
}
export function analyzeAlinaScene(scene){
 const sample=collectAlinaFaceVertices(scene);
 const face=analyzeFaceReference(sample.positions);
 if(face.confidence<.12)throw Error('Source facing direction has low confidence; cannot transfer facial proportions');
 return Object.freeze({ ...face,source:'local-GLB-geometry',
  sceneReport:sample.report,attribution:ALINA_IP_ATTRIBUTION});
}
