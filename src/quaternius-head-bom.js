/** Quaternius anatomical head extraction from CC0 full-body humanoid.
 * Keep skinning and shared skeleton; source model provides facial UV, eyes and brows.
 * Head selection is derived from skin weights, not an arbitrary polygon/height cutoff.
 */
export function retainSkinnedHead(scene){
 let headTriangles=0;
 const kept=[];
 scene.traverse(node=>{
  if(!node.isMesh)return;
  if(node.name==='Eyes'||node.name==='Eyebrows'){kept.push(node);return;}
  if(!node.isSkinnedMesh){node.visible=false;return;}
  const skeleton=node.skeleton,boneIndex=skeleton.bones.findIndex(b=>b.name==='Head');
  if(boneIndex<0){node.visible=false;return;}
  const geo=node.geometry,si=geo.getAttribute('skinIndex'),sw=geo.getAttribute('skinWeight');
  if(!si||!sw){node.visible=false;return;}
  const index=geo.getIndex(),cnt=index?index.count:geo.getAttribute('position').count;
  const indices=[];
  const score=v=>{let weight=0;for(let k=0;k<4;k++)if(si.getComponent(v,k)===boneIndex)weight+=sw.getComponent(v,k);return weight;};
  for(let t=0;t+2<cnt;t+=3){
   const a=index?index.getX(t):t,b=index?index.getX(t+1):t+1,c=index?index.getX(t+2):t+2;
   if([a,b,c].filter(i=>score(i)>.45).length>=2)indices.push(a,b,c);
  }
  if(!indices.length){node.visible=false;return;}
  const filtered=geo.clone();filtered.setIndex(indices);filtered.clearGroups();
  node.geometry=filtered;headTriangles+=indices.length/3;kept.push(node);
 });
 if(headTriangles<20)throw Error('No skinned facial polygons in humanoid source');
 return {headTriangles,visibleMeshes:kept.length};
}

/** Reusable hairline module. No spherical cap or helmet-shaped overlay. */
export function attachFittedHeadHair(THREE,headBone,{seed=0,palette=[],style=null}={}){
 if(!headBone||style==='bald'||(style===null&&seed%9===0))return null;
 const colors=palette.length?palette:[0x30211b,0x7c4427,0x4e3b32];
 const finish=new THREE.MeshStandardMaterial({color:colors[seed%colors.length],roughness:.88,side:THREE.DoubleSide});
 const group=new THREE.Group();group.name='bom-head-hairline';headBone.add(group);
 // Continuous fitted hair shell: a single tapered surface, not overlapping
 // spheres. Front edge stays high for the face; rear and sides cover the scalp.
 const segments=32,rings=9,vertices=[],indices=[];
 for(let j=0;j<=rings;j++){
  const t=j/rings;
  const theta=t*Math.PI*.82;
  for(let i=0;i<=segments;i++){
   const phi=i/segments*Math.PI*2;
   const x=Math.sin(theta)*Math.cos(phi)*.112;
   const z=Math.sin(theta)*Math.sin(phi)*.108-.008;
   const back=Math.max(0,-Math.sin(phi));
   const side=Math.abs(Math.cos(phi));
   const drop=(style==='long'?.075:style==='layered'?.048:style==='bob'?.042:.018)*(back*.9+side*.35)*Math.pow(t,3);
   const y=.065+Math.cos(theta)*.113-drop;
   vertices.push(x,y,z);
   if(i<segments&&j<rings){
    const n=j*(segments+1)+i;
    indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const shell=new THREE.Mesh(geometry,finish);
 shell.name='hair-continuous-shell';
 shell.castShadow=true;
 group.add(shell);
 // Thin forehead locks follow the facial profile instead of placing a second head on top.
 const styles={short:7,layered:12,long:15,bob:13,swept:10};
 const locks=Math.min(6,styles[style]??6);
 for(let i=0;i<locks;i++){
  const x=(i/(locks-1)*2-1)*.075;
  const z=.095-Math.abs(x)*.10;
  const length=(style==='long'?.030:style==='bob'?.028:style==='layered'?.024:style==='swept'?.022:.018)+(i%3)*.003;
  const width=.013+(i%2)*.005;
  // Four-point curved ribbon follows the rounded forehead, avoiding a flat hovering triangle.
  const tipX=x+(style==='swept'?.038:(i%2?-.008:.008));
  const vertices=new Float32Array([
   x-width,.09,z-.020, x+width,.09,z-.020, x-width*.66,.072,z-.002,
   x+width,.09,z-.020, x+width*.66,.072,z-.002, x-width*.66,.072,z-.002,
   x-width*.66,.072,z-.002, x+width*.66,.072,z-.002, tipX,.09-length,z+.002
  ]);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));geo.computeVertexNormals();
  const fringe=new THREE.Mesh(geo,finish);fringe.name='bom-hairline-lock';fringe.castShadow=true;group.add(fringe);
 }
 // Sideburn spheres were visually detached from the face in front view.
 // The continuous shell is the sole scalp silhouette.
 // Wig BOM: individually hinged tapered locks with deterministic wind response.
 // The rigid scalp remains attached to the head bone; only the free tips sway.
 const strands=[];
 const strandCount=style==='long'?18:style==='bob'?14:style==='layered'?12:8;
 const length=style==='long'?.17:style==='bob'?.105:style==='layered'?.085:.045;
 for(let i=0;i<strandCount;i++){
  const phi=i/strandCount*Math.PI*2;
  const x=Math.cos(phi)*.099,z=Math.sin(phi)*.093-.008;
  const hinge=new THREE.Group();
  hinge.position.set(x,.042,z);
  hinge.rotation.y=-phi;
  group.add(hinge);
  const taper=new THREE.BufferGeometry();
  const w=.018+(i%3)*.003;
  taper.setAttribute('position',new THREE.Float32BufferAttribute([
   -w,0,0, w,0,0, -w*.65,-length*.55,.008,
   w,0,0, w*.65,-length*.55,.008, -w*.65,-length*.55,.008,
   -w*.65,-length*.55,.008,w*.65,-length*.55,.008,0,-length,.014
  ],3));
  taper.computeVertexNormals();
  const lock=new THREE.Mesh(taper,finish);
  lock.name='wig-strand-'+i;
  lock.castShadow=true;
  hinge.add(lock);
  strands.push({hinge,phase:i*2.39996,flex:.6+(i%5)*.12});
 }
 group.userData.wigParts={scalp:1,strands:strandCount,faceParts:['eyes','eyebrows','nose','mouth','ears']};
 group.userData.updateWind=(time=0,wind={x:0,z:0,strength:0})=>{
  const force=Math.max(0,Math.min(1,Number(wind.strength)||0));
  for(const part of strands){
   const wave=Math.sin(time*2.3+part.phase)*(.018+force*.065)*part.flex;
   part.hinge.rotation.z=wave+(Number(wind.x)||0)*force*.13;
   part.hinge.rotation.x=Math.cos(time*1.7+part.phase)*force*.07+(Number(wind.z)||0)*force*.1;
  }
 };
 group.userData.componentType='head-hairline';
 group.userData.selectedStyle=style;group.userData.style=style??seed%3;
 return group;
}
