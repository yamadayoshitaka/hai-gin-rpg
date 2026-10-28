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

/** Reusable head-and-hair BOM module. Hair lives in the same skeletal space as the facial mesh. */
export function attachFittedHeadHair(THREE,headBone,{seed=0,palette=[]}={}){
 if(!headBone||seed%9===0)return null;
 const colors=palette.length?palette:[0x30211b,0x7c4427,0x4e3b32];
 const finish=new THREE.MeshStandardMaterial({color:colors[seed%colors.length],roughness:.94});
 const group=new THREE.Group();group.name='bom-head-hair';headBone.add(group);
 // Hair follows the head bone directly: no host-space positioning or scale compensation.
 const scalp=new THREE.Mesh(new THREE.SphereGeometry(1,24,16,0,Math.PI*2,0,Math.PI*.55),finish);
 scalp.name='bom-scalp';scalp.scale.set(.124,.122,.123);scalp.position.set(0,.06,-.004);scalp.castShadow=true;group.add(scalp);
 for(const side of [-1,1]){
  const temple=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),finish);
  temple.name='bom-temple';temple.position.set(side*.105,.012,.005);temple.scale.set(.018,.058,.045);temple.castShadow=true;group.add(temple);
 }
 group.userData.componentType='head-hair';group.userData.style=seed%3;
 return group;
}
