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
export function attachFittedHeadHair(THREE,headBone,{seed=0,palette=[]}={}){
 if(!headBone||seed%9===0)return null;
 const colors=palette.length?palette:[0x30211b,0x7c4427,0x4e3b32];
 const finish=new THREE.MeshStandardMaterial({color:colors[seed%colors.length],roughness:.96,side:THREE.DoubleSide});
 const group=new THREE.Group();group.name='bom-head-hairline';headBone.add(group);
 // Thin forehead locks follow the facial profile instead of placing a second head on top.
 const locks=seed%3===0?7:seed%3===1?9:6;
 for(let i=0;i<locks;i++){
  const x=(i/(locks-1)*2-1)*.096;
  const z=.095-Math.abs(x)*.22;
  const length=.022+(i%3)*.014;
  const width=.013+(i%2)*.005;
  // Four-point curved ribbon follows the rounded forehead, avoiding a flat hovering triangle.
  const tipX=x+(i%2?-.008:.008);
  const vertices=new Float32Array([
   x-width,.09,z-.020, x+width,.09,z-.020, x-width*.66,.072,z-.002,
   x+width,.09,z-.020, x+width*.66,.072,z-.002, x-width*.66,.072,z-.002,
   x-width*.66,.072,z-.002, x+width*.66,.072,z-.002, tipX,.09-length,z+.002
  ]);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));geo.computeVertexNormals();
  const fringe=new THREE.Mesh(geo,finish);fringe.name='bom-hairline-lock';fringe.castShadow=true;group.add(fringe);
 }
 for(const side of [-1,1]){
  const sideburn=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),finish);
  sideburn.name='bom-sideburn';sideburn.scale.set(.011,.039,.015);
  sideburn.position.set(side*.107,.004,.032);group.add(sideburn);
 }
 group.userData.componentType='head-hairline';group.userData.style=seed%3;
 return group;
}
