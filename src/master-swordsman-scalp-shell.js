import * as THREE from 'three';

const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};

/**
 * Cover the scalp by offsetting the REAL Blender head triangles, not by
 * placing a sphere ("helmet hair") on top of the model. Source is untouched.
 *
 * Coverage intentionally includes the entire back of the head down to the
 * nape, but only the top front hairline. Front face, eyes and nose are left
 * unpainted. The licensed 3D hair cards remain a separate outer layer.
 */
export function buildHeadConformingScalp(actorHead){
 if(!actorHead)throw Error('Head GLB required for fitted scalp');
 actorHead.updateWorldMatrix(true,true);
 let faceMesh=null,largest=0;
 actorHead.traverse(o=>{
  if(!o.isMesh||/iris|sclera|eyelid|pupil/i.test(o.name))return;
  const n=o.geometry?.getAttribute('position')?.count||0;
  if(n>largest){largest=n;faceMesh=o;}
 });
 if(!faceMesh||largest<1100)
  throw Error('An actual high-detail Blender face mesh is required for scalp fitting');
 faceMesh.updateWorldMatrix(true,false);
 const bounds=new THREE.Box3().setFromObject(faceMesh);
 const d=bounds.getSize(new THREE.Vector3());
 if(d.y<.1||d.z<.09)throw Error('Source face bounds are not anatomically valid');
 const geo=faceMesh.geometry.clone();
 const positions=geo.getAttribute('position');
 if(!geo.getAttribute('normal'))geo.computeVertexNormals();
 const normals=geo.getAttribute('normal');
 const colors=[],pt=new THREE.Vector3();
 let rearCount=0,topCount=0,faceExcluded=0;
 for(let i=0;i<positions.count;i++){
  pt.fromBufferAttribute(positions,i).applyMatrix4(faceMesh.matrixWorld);
  const y=clamp((pt.y-bounds.min.y)/d.y);
  // The face is towards +Z in this *particular* Blender Studio source GLB.
  const front=clamp((pt.z-(bounds.min.z+d.z*.28))/(d.z*.60));
  const side=Math.abs((pt.x-(bounds.max.x+bounds.min.x)*.5)/Math.max(.001,d.x*.5));
  // Back: cover up to the nape. Front: stop above the brow. On the
  // sides taper naturally into the temple without a blunt horizontal line.
  const hairline=.22+.52*front+.042*Math.sin(pt.x*37+pt.z*19)+.018*side;
  const alpha=smooth(hairline-.025,hairline+.060,y);
  const tint=.91+.06*Math.sin(pt.x*91+pt.z*54)*Math.cos(pt.y*59);
  colors.push(tint,tint*.98,tint*.95,alpha);
  if(front<.2&&y>.35&&y<.75&&alpha>.85)rearCount++;
  if(y>.89&&alpha>.9)topCount++;
  if(front>.8&&y<.54&&alpha<.01)faceExcluded++;
  // Offset in SOURCE mesh local normal direction to eliminate scalp z-fight.
  positions.setXYZ(i,
   positions.getX(i)+normals.getX(i)*.0026,
   positions.getY(i)+normals.getY(i)*.0026,
   positions.getZ(i)+normals.getZ(i)*.0026);
 }
 if(rearCount<35||topCount<40||faceExcluded<30)
  throw Error('Scalp coverage insufficient '+JSON.stringify({rearCount,topCount,faceExcluded}));
 positions.needsUpdate=true;
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
 geo.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color:0x382922,metalness:0,roughness:.86,side:THREE.FrontSide,
  vertexColors:true,transparent:true,alphaTest:.08,depthWrite:true
 });
 const scalp=new THREE.Mesh(geo,material);
 scalp.name='HEAD_CONFORMING_SOURCE_TOPOLOGY_SCALP';
 // Preserve original nested head-mesh coordinates relative to actor root.
 const parentWorld=actorHead.parent?.matrixWorld||new THREE.Matrix4();
 scalp.matrix.copy(parentWorld.clone().invert().multiply(faceMesh.matrixWorld));
 scalp.matrixAutoUpdate=false;
 scalp.renderOrder=1;
 scalp.castShadow=true;scalp.receiveShadow=true;
 const report=Object.freeze({
  sourceFaceVertices:largest,scalpVertices:positions.count,
  highTopCoverageSamples:topCount,highRearCoverageSamples:rearCount,
  faceUncoveredSamples:faceExcluded,
  originalHeadGeometryUntouched:true,sourceAnatomyAligned:true,
  photoHairVerified:false,helmetFitApproved:false
 });
 return {scalp,report};
}


/**
 * One coherent geometric micro-strand layer sampled from the fitted actual
 * head surface. Only important characters use this fallback when their
 * archived low-poly source hairstyle contains large disjoint patches.
 *
 * Not "photo hair" or physically simulated strands: 3D ribbons in ONE mesh,
 * with the underlying CC0 surface and morphable facial body preserved.
 */
export function buildFittedShortHairStrands(scalp,{style=1}={}){
 const surface=scalp?.geometry;
 if(!surface?.getAttribute('position')||!surface.getAttribute('color'))
  throw Error('A source-head scalp surface is required');
 const pos=surface.getAttribute('position'),nrm=surface.getAttribute('normal');
 const mask=surface.getAttribute('color');
 const pts=[],colors=[],indices=[];
 const baseDir=new THREE.Vector3(
  Math.sin(style*.7)*.33,
  -.72-(style%3)*.045,
  -.49
 ).normalize();
 const start=new THREE.Vector3(),normal=new THREE.Vector3();
 const tangent=new THREE.Vector3(),binormal=new THREE.Vector3();
 let ribbons=0;
 for(let i=0;i<pos.count;i++){
  const alpha=mask.getW(i);
  if(alpha<.84||((i+style*7)%2)!==0)continue;
  start.fromBufferAttribute(pos,i);
  normal.fromBufferAttribute(nrm,i).normalize();
  tangent.copy(baseDir).add(new THREE.Vector3(
   Math.sin(i*9.7+style)*.13,-.07,Math.cos(i*3.1)*.10));
  tangent.addScaledVector(normal,-tangent.dot(normal)).normalize();
  if(tangent.lengthSq()<.25)continue;
  binormal.crossVectors(tangent,normal).normalize();
  // Keep clumps short, broad and swept along the scalp; the previous
  // 6-7 cm outward strips read as black spikes in actual 3D screenshots.
  const len=.014+((i*13+style*29)%7)*.00235;
  const width=.0020+((i*7+style)%5)*.00027;
  const seed=pts.length/3;
  for(let q=0;q<=3;q++){
   const t=q/3;
   const point=start.clone().addScaledVector(tangent,len*t)
     .addScaledVector(normal,.0025+.0022*Math.sin(Math.PI*t)-.0006*t);
   const taper=(1-t)*width+.00008;
   for(const side of [-1,1]){
    const edge=point.clone().addScaledVector(binormal,side*taper);
    pts.push(edge.x,edge.y,edge.z);
    const sheen=.83+.10*Math.sin(i*17.2+t*5.1);
    colors.push(sheen,sheen*.93,sheen*.89);
   }
   if(q<3){
    const b=seed+q*2;
    indices.push(b,b+1,b+2,b+1,b+3,b+2);
   }
  }
  ribbons++;
 }
 if(ribbons<90)throw Error('Not enough fitted hair geometry to replace patchy wig: '+ribbons);
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 const hair=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
  color:0x40332b,metalness:0,roughness:.89,
  vertexColors:true,side:THREE.DoubleSide
 }));
 hair.name='SOURCE_HEAD_SURFACE_MICRO_STRANDS';
 hair.matrixAutoUpdate=false;
 hair.matrix.copy(scalp.matrix);
 hair.castShadow=true;
 return {hair,report:Object.freeze({
  ribbons,triangles:indices.length/3,sourceSurfaceAligned:true,
  archivedLicensedHairStillAvailable:true,sourceHairSimulation:false
 })};
}
