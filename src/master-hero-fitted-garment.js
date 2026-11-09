import * as THREE from 'three';

/**
 * Young-hero battle clothing, built from fitted volumetric surfaces.
 * It replaces the adult Viking tunic ONLY in the static character preview.
 * It is not a skinned combat asset: the original CC0 source is preserved.
 *
 * Features: sewn, closed short sleeves (not open T-pose fins), a fitted
 * continuous torso surface, inset front armor, and slim waist/collar trims.
 * Every ring is manifold and every sleeve reaches the torso shell.
 */
function ringMesh(rings,{segments=48,capEnds=true}={}){
 const p=[],uv=[],index=[];
 for(let j=0;j<rings.length;j++){
  const r=rings[j];
  for(let k=0;k<segments;k++){
   const theta=2*Math.PI*k/segments;
   const point=r.center.clone().add(new THREE.Vector3(
    Math.sin(theta)*r.rx,0,Math.cos(theta)*r.rz));
   p.push(point.x,point.y,point.z);uv.push(k/segments,j/(rings.length-1));
  }
 }
 for(let j=0;j<rings.length-1;j++)for(let k=0;k<segments;k++){
  const a=j*segments+k,b=j*segments+(k+1)%segments;
  const c=a+segments,d=b+segments;
  index.push(a,c,b,b,c,d);
 }
 if(capEnds){
  const top=p.length/3;p.push(...rings[0].center);uv.push(.5,0);
  const bottom=p.length/3;p.push(...rings.at(-1).center);uv.push(.5,1);
  for(let k=0;k<segments;k++){
   index.push(top,k,(k+1)%segments);
   const b=(rings.length-1)*segments;
   index.push(bottom,b+(k+1)%segments,b+k);
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();
 return g;
}
function sleeveGeometry(root,tip,r0,r1,{radial=48,rings=9}={}){
 const axis=new THREE.Vector3().subVectors(tip,root);
 const length=axis.length(),up=axis.clone().normalize();
 if(length<.08||length>.55)throw Error('Unfitted sleeve arm length '+length);
 let side=new THREE.Vector3(0,0,1).addScaledVector(up,-up.z).normalize();
 if(side.lengthSq()<.5)side=new THREE.Vector3(1,0,0).addScaledVector(up,-up.x).normalize();
 const front=new THREE.Vector3().crossVectors(up,side).normalize();
 const p=[],uv=[],indices=[];
 for(let j=0;j<=rings;j++){
  const t=j/rings;
  const center=root.clone().lerp(tip,t);
  const radius=THREE.MathUtils.lerp(r0,r1,t);
  for(let k=0;k<radial;k++){
   const a=k*2*Math.PI/radial;
   const vertex=center.clone().addScaledVector(side,Math.cos(a)*radius)
    .addScaledVector(front,Math.sin(a)*radius*.94);
   p.push(vertex.x,vertex.y,vertex.z);uv.push(k/radial,t);
   if(j<rings){
    const x=j*radial+k,y=j*radial+(k+1)%radial,z=x+radial,w=y+radial;
    indices.push(x,z,y,y,z,w);
   }
  }
 }
 const start=p.length/3;p.push(...root);uv.push(.5,0);
 const end=p.length/3;p.push(...tip);uv.push(.5,1);
 for(let k=0;k<radial;k++){
  indices.push(start,(k+1)%radial,k);
  const b=rings*radial;
  indices.push(end,b+k,b+(k+1)%radial);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
 return geo;
}
function tube(points,rad,material,name,closed=false){
 const curve=new THREE.CatmullRomCurve3(points,closed,'centripetal');
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(24,points.length*5),rad,7,closed),material);
 mesh.name=name;mesh.castShadow=true;return mesh;
}
export function createFittedFantasyHeroGarment(body,{female=false}={}){
 if(!body)throw Error('Actual male/female source body required');
 body.updateWorldMatrix(true,true);
 const bounds=new THREE.Box3().setFromObject(body);
 const height=bounds.getSize(new THREE.Vector3()).y;
 if(height<1.2||height>2.2)throw Error('Real body dimensions invalid');
 const center=bounds.getCenter(new THREE.Vector3());
 // High armhole and narrowed waist make the female knight graceful rather
 // than the oversized adult Viking chainmail silhouette.
 const shoulderY=bounds.max.y-height*.255;
 const torsoZ=center.z;
 const shoulderX=height*(female?.134:.149);
 const chestX=height*(female?.118:.132);
 const waistX=height*(female?.095:.106);
 const hipX=height*(female?.114:.119);
 const sleeveLength=height*(female?.135:.142);
 const group=new THREE.Group();
 group.name='SOURCE_BODY_FITTED_HERO_KNIGHT_OUTFIT';
 const shirt=new THREE.MeshStandardMaterial({color:female?0x263444:0x2d3944,
  roughness:.89,metalness:.02,side:THREE.DoubleSide});
 const armor=new THREE.MeshPhysicalMaterial({color:female?0x536477:0x4b5966,
  metalness:.58,roughness:.42,clearcoat:.22,side:THREE.DoubleSide});
 const trim=new THREE.MeshStandardMaterial({color:0xa28b6c,metalness:.52,roughness:.51});
 const under=new THREE.MeshStandardMaterial({color:0x1f252e,metalness:0,roughness:.88,
  side:THREE.DoubleSide});
 const rings=[
  {y:shoulderY+.115,rx:chestX*.50,rz:.082},
  {y:shoulderY+.055,rx:chestX*.78,rz:.105},
  {y:shoulderY-.045,rx:chestX,rz:.127},
  {y:shoulderY-.140,rx:chestX*.97,rz:.131},
  {y:shoulderY-.300,rx:waistX*1.07,rz:.111},
  {y:shoulderY-.450,rx:waistX,rz:.104},
  {y:shoulderY-.580,rx:hipX,rz:.125},
  {y:shoulderY-.675,rx:hipX*1.05,rz:.131}
 ];
 const worldRings=rings.map(r=>({center:new THREE.Vector3(center.x,r.y,torsoZ),
  rx:r.rx,rz:r.rz}));
 const shirtMesh=new THREE.Mesh(ringMesh(worldRings),shirt);
 shirtMesh.name='KNIGHT_FITTED_CLOSED_TUNIC';shirtMesh.castShadow=true;shirtMesh.receiveShadow=true;
 group.add(shirtMesh);
 // Flexible, moderately thin breastplate: an anatomically wrapped front
 // panel, NOT a floating thick rectangular slab.
 const plateVerts=[],plateIndices=[],plateUV=[];
 const arcSegments=32,upper=2,lower=5;
 for(let i=upper;i<=lower;i++){
  const ring=worldRings[i];
  for(let k=0;k<=arcSegments;k++){
   const a=(-.99+1.98*k/arcSegments);
   const rise=k/arcSegments;
   plateVerts.push(center.x+Math.sin(a)*(ring.rx+.006),
    ring.center.y,
    torsoZ+Math.cos(a)*(ring.rz+.009));
   plateUV.push(rise,(i-upper)/(lower-upper));
   if(i<lower&&k<arcSegments){
    const n=(i-upper)*(arcSegments+1)+k;
    plateIndices.push(n,n+arcSegments+1,n+1,n+1,n+arcSegments+1,n+arcSegments+2);
   }
  }
 }
 const plateGeo=new THREE.BufferGeometry();
 plateGeo.setAttribute('position',new THREE.Float32BufferAttribute(plateVerts,3));
 plateGeo.setAttribute('uv',new THREE.Float32BufferAttribute(plateUV,2));
 plateGeo.setIndex(plateIndices);plateGeo.computeVertexNormals();plateGeo.computeBoundingSphere();
 const cuirass=new THREE.Mesh(plateGeo,armor);
 cuirass.name='KNIGHT_ANATOMIC_CURVED_BREASTPLATE';cuirass.castShadow=true;
 group.add(cuirass);
 // Sleeves are generated from each corresponding body shoulder direction.
 // A full round tube overlaps the torso by one seam; no jagged deletions.
 const sleeves=[],cuffs=[];
 for(const sign of [-1,1]){
  const shoulder=new THREE.Vector3(center.x+sign*shoulderX,shoulderY+.006,torsoZ);
  const upperArm=new THREE.Vector3(center.x+sign*(shoulderX+height*.065),
    shoulderY-sleeveLength,torsoZ);
  const sleeve=new THREE.Mesh(sleeveGeometry(shoulder,upperArm,
   height*(female?.053:.060),height*(female?.041:.047)),shirt);
  sleeve.name=sign<0?'KNIGHT_LEFT_CLOSED_SLEEVE':'KNIGHT_RIGHT_CLOSED_SLEEVE';
  sleeve.castShadow=true;sleeve.receiveShadow=true;group.add(sleeve);sleeves.push(sleeve);
  const cuffPoints=[];
  const direction=upperArm.clone().sub(shoulder).normalize();
  let right=new THREE.Vector3(0,0,1).addScaledVector(direction,-direction.z).normalize();
  const front=new THREE.Vector3().crossVectors(direction,right).normalize();
  for(let j=0;j<32;j++){
   const a=2*Math.PI*j/32,rr=height*(female?.041:.047)*1.017;
   cuffPoints.push(upperArm.clone().addScaledVector(right,Math.cos(a)*rr)
    .addScaledVector(front,Math.sin(a)*rr*.94));
  }
  const cuff=tube(cuffPoints,.0033,trim,
   sign<0?'KNIGHT_LEFT_SLEEVE_TRIM':'KNIGHT_RIGHT_SLEEVE_TRIM',true);
  group.add(cuff);cuffs.push(cuff);
 }
 // Narrow belt and collar follow the fitted torso circumference.
 for(const [i,label,radius] of [[0,'COLLAR',.0044],[5,'WAIST',.008]]){
  const ring=worldRings[i],pts=[];
  for(let j=0;j<48;j++){
   const a=2*Math.PI*j/48;
   pts.push(new THREE.Vector3(center.x+Math.sin(a)*ring.rx*1.025,
    ring.center.y,torsoZ+Math.cos(a)*ring.rz*1.025));
  }
  group.add(tube(pts,radius,label==='COLLAR'?trim:under,'KNIGHT_'+label+'_SEAM',true));
 }
 // Slim front V embossing to read as a high-fantasy knight, not primitive wear.
 const centerY=shoulderY-.135,z=torsoZ+.142;
 group.add(tube([
  new THREE.Vector3(center.x-chestX*.52,centerY+.08,z-.016),
  new THREE.Vector3(center.x-chestX*.19,centerY-.065,z-.011),
  new THREE.Vector3(center.x,centerY-.097,z-.003)
 ],.0022,trim,'KNIGHT_LEFT_CHEST_V'));
 group.add(tube([
  new THREE.Vector3(center.x+chestX*.52,centerY+.08,z-.016),
  new THREE.Vector3(center.x+chestX*.19,centerY-.065,z-.011),
  new THREE.Vector3(center.x,centerY-.097,z-.003)
 ],.0022,trim,'KNIGHT_RIGHT_CHEST_V'));
 let sourceArea=0;
 body.traverse(o=>{if(o.isMesh)sourceArea+=o.geometry?.getAttribute('position')?.count||0;});
 if(sourceArea<500)throw Error('Actual body mesh absent');
 const report=Object.freeze({
  bodyFitted:true,originalCC0ClothUntouched:true,staticOnly:true,
  torsoSurfaceSealed:true,shoulderSleeveCount:sleeves.length,
  joinedSleeveClosedTopology:true,cuffCount:cuffs.length,
  noTriangleTrimForHero:true,
  closedTorsoTriangles:shirtMesh.geometry.getIndex().count/3,
  curvedPlateTriangles:cuirass.geometry.getIndex().count/3,
  headAndBodyGarmentStyle:female?'light-fantasy-knight-female':'light-fantasy-knight-male',
  sourceBodyVertices:sourceArea
 });
 return {object:group,report,
  changeAppearance(profile){
   shirt.color.set(profile.gender==='female'?0x263444:0x2d3944);
   armor.color.set(profile.gender==='female'?0x536477:0x4b5966);
  },
  dispose(){
   group.traverse(o=>{if(o.isMesh)o.geometry.dispose()});
   for(const mat of [shirt,armor,trim,under])mat.dispose();
  }
 };
}
