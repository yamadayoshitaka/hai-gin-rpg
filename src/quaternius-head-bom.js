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
  const skeleton=node.skeleton,boneIndex=skeleton.bones.findIndex(b=>/^(Head|head)$/i.test(b.name));
  const neckIndices=skeleton.bones.map((b,i)=>/neck/i.test(b.name)?i:-1).filter(i=>i>=0);
  if(boneIndex<0){node.visible=false;return;}
  const geo=node.geometry,si=geo.getAttribute('skinIndex'),sw=geo.getAttribute('skinWeight');
  if(!si||!sw){node.visible=false;return;}
  const index=geo.getIndex(),cnt=index?index.count:geo.getAttribute('position').count;
  const indices=[];
  const score=v=>{let weight=0;for(let k=0;k<4;k++)if(si.getComponent(v,k)===boneIndex||neckIndices.includes(si.getComponent(v,k)))weight+=sw.getComponent(v,k);return weight;};
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
export function attachFittedHeadHair(THREE,headBone,{seed=0,palette=[],style=null}={}) {
 if(!headBone||style==='bald')return null;
 const colors=palette.length?palette:[0x30211b,0x7c4427,0x4e3b32];
 const material=new THREE.MeshStandardMaterial({color:colors[seed%colors.length],roughness:.76,metalness:0,side:THREE.FrontSide});
 const root=new THREE.Group();root.name='bom-3d-strand-wig';headBone.add(root);
 const styles={short:{length:.028,layers:2},layered:{length:.075,layers:3},bob:{length:.105,layers:3},long:{length:.19,layers:4},swept:{length:.065,layers:3}};
 const cfg=styles[style]||styles.layered;
 // Individual tapered solid 3D locks, not a spherical shell or flat hair cards.
 const strands=[];
 const count=36;
 for(let layer=0;layer<cfg.layers;layer++){
  const n=count+layer*8;
  for(let i=0;i<n;i++){
   const phi=(i+(layer%2)*.5)/n*Math.PI*2;
   const back=Math.sin(phi)<0;
   const side=Math.abs(Math.cos(phi));
   // Head-local coordinates: positive Z is the face; keep front locks above the eyes.
   const x=Math.cos(phi)*(.085+layer*.004);
   const z=Math.sin(phi)*(.081+layer*.003)-.009;
   const crownY=.126-layer*.024;
   const front=Math.max(0,Math.sin(phi));
   const length=cfg.length*(.55+.45*(i%5)/4)*(back?1:front?.28:.78);
   const endY=crownY-length;
   const width=.010+(layer===0?.003:0);
   const points=[
    new THREE.Vector3(x*.30,.164,z*.25),
    new THREE.Vector3(x*.70,.157-layer*.006,z*.66),
    new THREE.Vector3(x,crownY,z),
    new THREE.Vector3(x*1.07,endY+.012,z*1.06),
    new THREE.Vector3(x*1.02,endY,z*1.09)
   ];
   if(style==='swept'&&front){points[3].x+=.018;points[4].x+=.028;}
   const curve=new THREE.CatmullRomCurve3(points);
   const tube=new THREE.TubeGeometry(curve,12,width,5,false);
   // Taper the lower third of the strand to a fine tip.
   const pos=tube.attributes.position;
   const ringSize=6;
   for(let j=0;j<=12;j++){
    const t=j/12;
    const factor=t<.65?1:Math.max(.06,1-(t-.65)/.35);
    const center=curve.getPointAt(t);
    for(let k=0;k<ringSize;k++){
     const idx=j*ringSize+k;
     const v=new THREE.Vector3().fromBufferAttribute(pos,idx).sub(center).multiplyScalar(factor).add(center);
     pos.setXYZ(idx,v.x,v.y,v.z);
    }
   }
   tube.computeVertexNormals();
   const mesh=new THREE.Mesh(tube,material);mesh.name='wig-solid-lock-'+layer+'-'+i;
   mesh.castShadow=true;root.add(mesh);
   strands.push(mesh);
  }
 }
 root.userData.componentType='head-hairline';
 root.userData.selectedStyle=style;
 root.userData.wigParts={scalp:0,strands:strands.length,geometry:'solid-tapered-tube'};
 root.userData.updateWind=()=>{};
 return root;
}

/** Independent facial components on a head-bone local coordinate frame.
 * Existing skinned face remains the anatomical base; the parts can be swapped.
 */
export function attachFaceParts(THREE,headBone,options={}){
 if(!headBone)return null;
 const config={
  eyes:{size:1,color:'#654a32',spacing:.061,...options.eyes},
  nose:{width:1,height:1,projection:1,...options.nose},
  mouth:{width:1,fullness:1,color:'#8b4c46',...options.mouth},
  ears:{size:1,...options.ears}
 };
 const group=new THREE.Group();group.name='bom-face-components';headBone.add(group);
 const skin=new THREE.MeshStandardMaterial({color:options.skinColor||'#a77960',roughness:.92});
 const iris=new THREE.MeshStandardMaterial({color:config.eyes.color,roughness:.4});
 const lip=new THREE.MeshStandardMaterial({color:config.mouth.color,roughness:.9});
 const add=(name,geo,mat,pos,scale)=>{
  const mesh=new THREE.Mesh(geo,mat);mesh.name=name;
  mesh.position.set(...pos);mesh.scale.set(...scale);group.add(mesh);return mesh;
 };
 const ball=new THREE.SphereGeometry(1,12,10);
 for(const side of [-1,1]){
  add('eye-'+(side<0?'left':'right'),ball,iris,[side*config.eyes.spacing,.053,.098],[.013*config.eyes.size,.009*config.eyes.size,.004]);
  add('ear-'+(side<0?'left':'right'),ball,skin,[side*.116,.025,0],[.012*config.ears.size,.026*config.ears.size,.013]);
 }
 add('nose',new THREE.ConeGeometry(.014, .032,10),skin,[0,.018,.113],[config.nose.width,config.nose.height,config.nose.projection]);
 add('mouth',ball,lip,[0,-.026,.102],[.025*config.mouth.width,.004*config.mouth.fullness,.004]);
 group.userData.parts=config;
 group.userData.componentType='face-bom';
 return group;
}
