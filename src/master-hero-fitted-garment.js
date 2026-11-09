import * as THREE from 'three';

/**
 * Fitted youth knight clothing - source-body surface reconstruction.
 * Unlike the removed cylinder/cone outfit, the torso, shoulders and upper
 * sleeves are re-projected from actual human anatomy source triangles.
 * No destructively trimmed Viking sleeve is rendered for hero profiles.
 *
 * Static display only. GLB source originals, UVs, bone weights and other
 * existing garment modes remain untouched.
 */
const finite=v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);
const saturate=v=>Math.max(0,Math.min(1,v));
const smooth01=v=>{const t=saturate(v);return t*t*(3-2*t)};
function buildFromTriangles(records,material,name,{alphaAt=null}={}){
 const pos=[],norm=[],uv=[],colors=[],idx=[];
 for(const rec of records){
  const start=pos.length/3;
  for(let j=0;j<3;j++){
   const p=rec.points[j],n=rec.normals[j];
   pos.push(p.x,p.y,p.z);norm.push(n.x,n.y,n.z);
   uv.push(p.x*1.7,p.y*1.7);
   if(alphaAt)colors.push(1,1,1,saturate(alphaAt(p)));
  }
  idx.push(start,start+1,start+2);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geo.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 if(alphaAt)geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
 geo.setIndex(idx);geo.computeBoundingSphere();
 const mesh=new THREE.Mesh(geo,material);
 mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
 return mesh;
}
function bodySkinTriangles(body){
 body.updateWorldMatrix(true,true);
 const result=[];
 let maxCount=0,sourceMeshes=0;
 body.traverse(mesh=>{
  if(!mesh.isMesh||/iris|sclera|eyelid|pupil|eye[LR]/i.test(mesh.name))return;
  const g=mesh.geometry,pos=g?.getAttribute('position');
  if(!pos||pos.count<300)return;
  sourceMeshes++;maxCount=Math.max(maxCount,pos.count);
  const normals=g.getAttribute('normal');
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const idx=g.getIndex(),count=idx?.count||pos.count;
  if(count%3!==0)throw Error('Real anatomical source is not triangles');
  const world=[],worldNormal=[];
  const get=i=>idx?idx.getX(i):i;
  for(let i=0;i<count;i+=3){
   const xyz=[],nrm=[];
   for(let k=0;k<3;k++){
    const index=get(i+k);
    const p=new THREE.Vector3();
    if(mesh.isSkinnedMesh&&typeof mesh.getVertexPosition==='function')
     mesh.getVertexPosition(index,p);
    else p.fromBufferAttribute(pos,index);
    p.applyMatrix4(mesh.matrixWorld);
    if(!finite(p))throw Error('Nonfinite source anatomy');
    const normal=new THREE.Vector3(0,0,1);
    if(normals)normal.fromBufferAttribute(normals,index)
     .applyMatrix3(normalMatrix).normalize();
    xyz.push(p);
    nrm.push(normal);
   }
   result.push({points:xyz,normals:nrm});
  }
 });
 if(maxCount<2000||sourceMeshes<1)throw Error('High resolution real-body anatomical source required');
 return result;
}
function sourceContour(src,bb,{female=false}={}){
 const boundsSize=bb.getSize(new THREE.Vector3()),height=boundsSize.y;
 const center=bb.getCenter(new THREE.Vector3());
 const shoulder=bb.max.y-height*.255;
 const neck=shoulder+height*.092;
 const hem=shoulder-height*.335;
 const sleeveHem=shoulder-height*.18;
 const torsoHalf=height*(female?.127:.140);
 const innerSleeve=height*(female?.10:.115);
 const outerSleeve=height*(female?.295:.302);
 const torso=[],breastplate=[],armSegments={left:0,right:0};
 const validSourceTriangle=t=>{
  const centroid=t.points.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(1/3);
  const x=Math.abs(centroid.x-center.x),y=centroid.y;
  const isNeck=y>shoulder-.005&&
    x<height*.068&&
    Math.abs(centroid.z-center.z)<height*.053;
  const torsoZone=y>=hem&&y<=neck&&x<=torsoHalf;
  const sleeveZone=y>=sleeveHem&&y<=neck&&x>=innerSleeve&&x<outerSleeve;
  const selected=(torsoZone||sleeveZone)&&!isNeck;
  if(selected&&sleeveZone&&x>torsoHalf){
   if(centroid.x<center.x)armSegments.left++;
   else armSegments.right++;
  }
  return {selected,centroid,sleeveZone};
 };
 for(const tri of src){
  const p=validSourceTriangle(tri);
  if(!p.selected)continue;
  const clothPoints=tri.points.map((point,i)=>point.clone().addScaledVector(tri.normals[i],.008));
  const shifted={points:clothPoints,normals:tri.normals};
  torso.push(shifted);
  // A thin armored inset, traced on the real anatomy. This is a chest
  // surface; it does not grow a separate cylindrical barrel around the body.
  const forward=p.centroid.z-center.z;
  if(forward>.035&&p.centroid.y<shoulder+.02&&p.centroid.y>shoulder-height*.18&&
     Math.abs(p.centroid.x-center.x)<height*.104){
   const n=tri.normals.reduce((a,v)=>a.add(v),new THREE.Vector3()).normalize();
   if(n.z>.26){
    breastplate.push({points:tri.points.map((vertex,i)=>
      vertex.clone().addScaledVector(tri.normals[i],.015)),
      normals:tri.normals});
   }
  }
 }
 if(torso.length<180||breastplate.length<25||
    armSegments.left<35||armSegments.right<35)
  throw Error('Source skin contour cannot produce full torso, breastplate and both sleeves '+
    JSON.stringify({torso:torso.length,plate:breastplate.length,arms:armSegments}));
 return {torso,breastplate,armSegments,sourceHeight:height,shoulderY:shoulder,
  necklineY:neck,hemY:hem,armHemY:sleeveHem,center};
}
function makePiping(points,material,name,r=.0035,closed=false){
 const curve=new THREE.CatmullRomCurve3(points,closed,'centripetal');
 const g=new THREE.TubeGeometry(curve,Math.max(32,points.length*4),r,8,closed);
 const m=new THREE.Mesh(g,material);
 m.name=name;m.castShadow=true;return m;
}
function smallNeckGorget(center,neckY,height,material){
 // Close the source skin's visibly jagged neckline with an actual small
 // wrapped collar, not a 60cm cylindrical shirt or a floating scarf.
 const radial=48,rings=6,p=[],uv=[],idx=[];
 for(let j=0;j<=rings;j++){
  const t=j/rings;
  const y=neckY-.030-.029*t;
  const rx=height*(.051+.027*t),rz=height*(.039+.024*t);
  for(let k=0;k<radial;k++){
   const a=k/radial*2*Math.PI;
   p.push(center.x+Math.sin(a)*rx,y,center.z+Math.cos(a)*rz);
   uv.push(k/radial,t);
   if(j<rings){
    const x=j*radial+k,yIndex=j*radial+(k+1)%radial;
    idx.push(x,x+radial,yIndex,yIndex,x+radial,yIndex+radial);
   }
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();
 const mesh=new THREE.Mesh(g,material);
 mesh.name='KNIGHT_FORM_FITTED_HIGH_COLLAR';mesh.castShadow=true;
 return mesh;
}
function sampleFrontSurface(source,x,y){
 let best=null,score=Infinity;
 for(const tri of source)for(let i=0;i<3;i++){
  const v=tri.points[i],n=tri.normals[i];
  if(n.z<.19)continue;
  const dist=(v.x-x)**2*1.35+(v.y-y)**2;
  if(dist<score){score=dist;best={v,n};}
 }
 if(!best||score>.01)throw Error('No real chest surface for trim fitting');
 return best.v.clone().addScaledVector(best.n,.019);
}
/**
 * Single, contiguous front breastplate mapped to REAL front torso vertices.
 * The earlier breastplate was a disjoint collection of triangles selected by
 * their centroids. On the female source it split down the sternum and showed
 * an obvious crack. A shared-index grid covers the sternum without a seam.
 * It has no skinned rig; this is an editable preview mesh.
 */
function continuousAnatomicalChest(source,data,material){
 const h=data.sourceHeight,c=data.center;
 const half=h*.098,top=data.shoulderY-h*.030,bottom=data.shoulderY-h*.177;
 const samples=[];
 for(const triangle of source)for(let i=0;i<3;i++){
  const p=triangle.points[i],n=triangle.normals[i];
  if(n.z<.29||p.z<c.z+.015||Math.abs(p.x-c.x)>half*1.50||
     p.y<bottom-.045||p.y>top+.045)continue;
  samples.push(p);
 }
 if(samples.length<55)
  throw Error('Unable to fit continuous breastplate to real torso: '+samples.length);
 const columns=22,rows=14,points=[],uv=[],colors=[],indices=[],centerIndices=[];
 const nearestZ=(x,y)=>{
  const best=[];
  for(const q of samples){
   const ds=(q.x-x)**2+(q.y-y)**2;
   if(best.length===9&&ds>=best[8].distance)continue;
   let j=best.length;
   while(j>0&&best[j-1].distance>ds)j--;
   best.splice(j,0,{distance:ds,z:q.z});
   if(best.length>9)best.pop();
  }
  let weighted=0,total=0;
  for(const item of best){
   const w=1/(item.distance+.00006)**1.4;
   weighted+=item.z*w;total+=w;
  }
  return weighted/total+.019;
 };
 for(let j=0;j<=rows;j++){
  const t=j/rows,y=top+(bottom-top)*t;
  // Slight taper towards the waist for a smoother, less bulky plate.
  const xRadius=half*(1-.09*t);
  for(let i=0;i<=columns;i++){
   const u=i/columns,x=c.x+(u*2-1)*xRadius;
   const z=nearestZ(x,y);
   points.push(x,y,z);uv.push(u,t);
   // The center of the armour remains solid, and all four boundaries fade
   // into the UNDERLYING cloth; no opaque detached rectangle over the chest.
   const edge=Math.min(u,1-u,t,1-t);
   const opacity=.92*smooth01(edge/.145);
   colors.push(1,1,1,opacity);
   if(i===columns/2)centerIndices.push(j*(columns+1)+i);
   if(i<columns&&j<rows){
    const a=j*(columns+1)+i,b=a+columns+1;
    // +Z facing: shared indexed vertices prevent a central chest crack.
    indices.push(a,b,a+1,a+1,b,b+1);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name='KNIGHT_ANATOMICAL_BREASTPLATE';
 mesh.castShadow=true;mesh.receiveShadow=true;
 const report=Object.freeze({
  singleConnectedBreastplate:true,sourceSurfaceSampled:true,
  chestCenterlineVertexCount:centerIndices.length,sharedIndexTopology:true,
  gridTriangles:indices.length/3,sourceMeshUnmodified:true,
  originalChestSplitPanelsReplaced:true,
  chestFeatheredEdge:true,bodyUnderlyingKept:true,
  centerlineAlpha:.92,boundaryAlpha:0
 });
 return {mesh,report};
}
function armCuff(source,center,hemY,sign,material){
 const samples=[];
 for(const tri of source)for(const v of tri.points){
  if(Math.abs(v.y-hemY)<.019&&sign*(v.x-center.x)>.18&&
    sign*(v.x-center.x)<.48)samples.push(v);
 }
 if(samples.length<12)throw Error('Sleeve hem has no actual source arm ring');
 const xs=samples.map(p=>p.x),zs=samples.map(p=>p.z);
 const midpoint=new THREE.Vector3(
  (Math.min(...xs)+Math.max(...xs))/2,hemY,
  (Math.min(...zs)+Math.max(...zs))/2);
 const rx=(Math.max(...xs)-Math.min(...xs))*.5+.008;
 const rz=(Math.max(...zs)-Math.min(...zs))*.5+.008;
 const points=[];
 for(let k=0;k<40;k++){
  const a=k/40*2*Math.PI;
  points.push(new THREE.Vector3(midpoint.x+Math.cos(a)*rx,
   hemY,midpoint.z+Math.sin(a)*rz));
 }
 return makePiping(points,material,sign<0?'LEFT_SLEEVE_FITTED_CUFF':'RIGHT_SLEEVE_FITTED_CUFF',.0038,true);
}

/**
 * Pants and boots projected on the SAME continuous real body surface.
 * The old preview combined Viking trouser GLB pieces with floating hip
 * tassets and a large circular belt, which made legs appear disconnected.
 * Only these new preview meshes are made; source GLBs remain unmodified.
 */
function createAnatomicalLowerClothes(source,bb,data,{female=false}={}){
 const h=data.sourceHeight,center=data.center;
 const bottom=bb.min.y;
 const waist=bottom+h*.58,bootTop=bottom+h*.275,shoeBottom=bottom+h*.055;
 const trousers=[],boots=[];
 const maxOuter=h*(female?.195:.213);
 for(const tri of source){
  const mid=tri.points.reduce((v,p)=>v.add(p),new THREE.Vector3()).multiplyScalar(1/3);
  const x=Math.abs(mid.x-center.x);
  if(x>maxOuter||mid.y>waist+h*.024||mid.y<shoeBottom-h*.018)continue;
  // Keep real thigh, calf and hip anatomy. Neither hand nor sword may
  // masquerade as a trouser/boot: they are outside the lower-limb envelope.
  const shifted=(offset)=>({points:tri.points.map((p,i)=>
    p.clone().addScaledVector(tri.normals[i],offset)),
   normals:tri.normals});
  if(mid.y>=bootTop-h*.028)trousers.push(shifted(.011));
  if(mid.y<=bootTop+h*.023)boots.push(shifted(.015));
 }
 if(trousers.length<80||boots.length<30)
  throw Error('Anatomical lower leg surface coverage missing: '+JSON.stringify({
   trousers:trousers.length,boots:boots.length
  }));
 const trouserMat=new THREE.MeshStandardMaterial({
  color:female?0x222f40:0x273342,roughness:.90,metalness:0,
  transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexColors:true
 });
 const bootMat=new THREE.MeshStandardMaterial({
  color:0x43362d,roughness:.81,metalness:.04,
  transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexColors:true
 });
 const pantsAlpha=p=>{
  const upper=smooth01((waist+h*.024-p.y)/(h*.055));
  const lower=smooth01((p.y-(bootTop-h*.030))/(h*.06));
  return .99*upper*lower;
 };
 const bootAlpha=p=>{
  const top=smooth01((bootTop+h*.023-p.y)/(h*.062));
  const lower=smooth01((p.y-(shoeBottom-h*.015))/(h*.035));
  return .99*top*lower;
 };
 const pants=buildFromTriangles(trousers,trouserMat,
  'KNIGHT_ANATOMICAL_FITTED_TROUSERS',{alphaAt:pantsAlpha});
 const greaves=buildFromTriangles(boots,bootMat,
  'KNIGHT_ANATOMICAL_FITTED_BOOTS',{alphaAt:bootAlpha});
 pants.renderOrder=2;greaves.renderOrder=2;
 return {pants,boots:greaves,materials:[trouserMat,bootMat],
  report:Object.freeze({
   realLegSurface:true,legsShareSourceBody:true,
   pantsSurfaceTriangles:trousers.length,bootSurfaceTriangles:boots.length,
   overlappingFadedLegSeams:true,floatingTassetsRemoved:true,
   oversizedFloatingBeltRemoved:true,sourceBodyUnchanged:true
  })
 };
}

export function createFittedFantasyHeroGarment(body,{female=false}={}){
 if(!body)throw Error('Actual human body missing');
 const bb=new THREE.Box3().setFromObject(body);
 const height=bb.getSize(new THREE.Vector3()).y;
 if(height<1.2||height>2.2)throw Error('Real source human dimensions invalid');
 const source=bodySkinTriangles(body);
 const data=sourceContour(source,bb,{female});
 const group=new THREE.Group();group.name='ANATOMY_FITTED_FANTASY_KNIGHT_GARMENT';
 // Original skin is left intact beneath BOTH translucent layers. The
 // cliff-like silhouette cutoffs are feathered into their respective parent
 // surfaces, not removed by a destructive triangle mask.
 const fabric=new THREE.MeshStandardMaterial({
  color:female?0x26384b:0x283b4a,metalness:0,roughness:.87,
  side:THREE.DoubleSide,transparent:true,depthWrite:false,vertexColors:true});
 const plating=new THREE.MeshPhysicalMaterial({
  color:female?0x576779:0x5b6876,
  metalness:.24,roughness:.71,clearcoat:.03,
  side:THREE.DoubleSide,transparent:true,depthWrite:false,vertexColors:true});
 const shirtAlpha=p=>{
  const y=p.y,x=Math.abs(p.x-data.center.x);
  const vertical=smooth01((y-data.hemY)/.043)*
   smooth01((data.necklineY+.025-y)/.055);
  // Shoulder and sleeve edges roll off instead of hard-cutting anatomy.
  const radial=smooth01((data.sourceHeight*.30-x)/.045);
  return .985*vertical*radial;
 };
 const shirt=buildFromTriangles(data.torso,fabric,
  'KNIGHT_SOURCE_SURFACE_SHIRT_AND_JOINED_SLEEVES',{alphaAt:shirtAlpha});
 const seamlessChest=continuousAnatomicalChest(source,data,plating);
 const breastplate=seamlessChest.mesh;
 shirt.renderOrder=3;breastplate.renderOrder=4;
 group.add(shirt,breastplate);
 const trim=new THREE.MeshStandardMaterial({
  color:0xb39a73,roughness:.45,metalness:.60,side:THREE.DoubleSide});
 const lower=createAnatomicalLowerClothes(source,bb,data,{female});
 group.add(lower.pants,lower.boots);
 // The collar is a solid, untextured ring; it must not use the translucent
 // shirt material requiring vertex RGBA, otherwise it renders black.
 const collarFabric=new THREE.MeshStandardMaterial({
  color:female?0x26384b:0x283b4a,metalness:0,roughness:.87,
  side:THREE.DoubleSide
 });
 group.add(smallNeckGorget(data.center,data.necklineY,height,collarFabric));
 // A neckline band hides topological cut edges without inflating shoulders.
 const collar=[];
 for(let i=0;i<40;i++){
  const a=i/40*Math.PI*2;
  collar.push(new THREE.Vector3(
   data.center.x+Math.sin(a)*height*.061,
   data.necklineY-.022,
   data.center.z+Math.cos(a)*height*.049));
 }
 group.add(makePiping(collar,trim,'KNIGHT_NECKLINE_FITTED_TRIM',.0045,true));
 for(const sign of [-1,1])group.add(armCuff(source,data.center,data.armHemY,sign,trim));
 // A small centered crest is more restrained than the formerly bent
 // gold tubes drawn through both breasts and across the waist.
 const crestOrigin=sampleFrontSurface(source,data.center.x,
  data.shoulderY-height*.137);
 const crest=new THREE.Mesh(new THREE.OctahedronGeometry(1,0),trim);
 crest.name='KNIGHT_SMALL_BREASTPLATE_CREST';
 crest.scale.set(.025,.038,.005);
 crest.position.copy(crestOrigin).add(new THREE.Vector3(0,0,.006));
 crest.castShadow=true;group.add(crest);
 // No detached circular waist ring: clothing continues over actual hips.
 // The source body is a connected human surface, so these sleeves do not
 // require any separate cylinder overlays or disconnected shoulder caps.
 const report=Object.freeze({
  bodyFitted:true,anatomicalSourceSurface:true,
  sourceTrianglesOnly:true,originalCC0ClothUntouched:true,
  staticOnly:true,noVikingTposeSleeves:true,
  anatomicallyConnectedUpperSleeves:true,
  torsoTriangles:data.torso.length,
  breastplateTriangles:data.breastplate.length,
  continuousChest:seamlessChest.report,
  originalBodyUnderClothing:true,featheredBodyToCloth:true,
  layeredClothMaterials:true,skinNotCutForHeroes:true,
  upperArmTriangles:{...data.armSegments},
  sourceBodyTriangles:source.length,
  realSourceBodyHeightMeters:Number(data.sourceHeight.toFixed(4)),
  hemHeight:Number(data.hemY.toFixed(4)),
  neckHeight:Number(data.necklineY.toFixed(4)),
  upperArmHemHeight:Number(data.armHemY.toFixed(4)),
  newClothingShading:female?'fantasy-female': 'fantasy-male',
  hipTassetPanels:0,shortTabardPanels:0,sleeveCuffCount:2,
  anatomyFittedLowerClothes:lower.report,
  fittedHighCollar:true,fittedNecklineTrim:true,centerCrestFitted:true,
  slimLeatherBelt:false,
  noProceduralCylinderSleeves:true,combatRigCertified:false,artGradeCertified:false
 });
 return {object:group,report,
  setLowerVisible(part,visible){
   if(part==='pants')lower.pants.visible=Boolean(visible);
   if(part==='boots')lower.boots.visible=Boolean(visible);
  },
  changeAppearance(profile){
   fabric.color.set(profile.gender==='female'?0x26384b:0x283b4a);
   plating.color.set(profile.gender==='female'?0x576779:0x5b6876);
  },
  dispose(){
   group.traverse(o=>{if(o.isMesh)o.geometry.dispose()});
   fabric.dispose();plating.dispose();trim.dispose();collarFabric.dispose();
   for(const m of lower.materials)m.dispose();
  }
 };
}
