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
 // A continuous fitted cap covers crown, temples and back of the head.
 // Avoid the old radial spheres, which looked like fingers and left bald gaps.
 const longHair=style==='long'||style==='layered'||style==='bob';
 const cap=new THREE.Mesh(
  new THREE.SphereGeometry(1,32,20,0,Math.PI*2,0,Math.PI*(longHair?.65:.59)),
  finish
 );
 cap.name='hair-fitted-cap';
 cap.scale.set(.113,.104,.108);
 cap.position.set(0,.068,-.009);
 cap.castShadow=true;
 group.add(cap);
 // Side and rear hair continue below the crown while leaving the face open.
 for(const side of [-1,1]){
  const temple=new THREE.Mesh(new THREE.SphereGeometry(1,12,12),finish);
  temple.name='hair-temple';
  temple.scale.set(.018,longHair?.057:.038,.043);
  temple.position.set(side*.091,longHair?-.009:.012,-.030);
  temple.castShadow=true;
  group.add(temple);
 }
 if(longHair){
  const back=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),finish);
  back.name='hair-back';
  back.scale.set(.085,style==='long'?.075:.058,.030);
  back.position.set(0,style==='long'?-.038:-.014,-.100);
  back.castShadow=true;
  group.add(back);
 }
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
 for(const side of [-1,1]){
  const sideburn=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),finish);
  sideburn.name='bom-sideburn';sideburn.scale.set(.011,.039,.015);
  sideburn.position.set(side*.107,.004,.032);group.add(sideburn);
 }
 group.userData.componentType='head-hairline';
 group.userData.selectedStyle=style;group.userData.style=style??seed%3;
 return group;
}
