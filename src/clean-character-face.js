/** Stable single-head preview: no donor facial mesh, no floating wig overlay.
 * Mounted directly on the animated outfit head bone.
 */
export function attachCleanCharacterFace({THREE,model,donor,sex='male',face}){
 const head=model.getObjectByName('Head')||model.getObjectByName('head')||model.getObjectByName('head_01');
 if(!head||!head.isBone)throw Error('Clean face: missing animated head bone');
 donor.traverse(n=>{if(n.isMesh)n.visible=false;});
 const group=new THREE.Group();group.name='clean-character-face-v1';
 head.add(group);
 const skin=new THREE.MeshStandardMaterial({color:sex==='female'?0xd7a789:0xc49a7e,roughness:.86});
 const hair=new THREE.MeshStandardMaterial({color:0x352b26,roughness:.94});
 const white=new THREE.MeshStandardMaterial({color:0xf4eee3,roughness:.82});
 const iris=new THREE.MeshStandardMaterial({color:0x46372e,roughness:.65});
 const feature=new THREE.MeshStandardMaterial({color:0x8f6558,roughness:.9});
 const part=(name,geo,mat,pos,scale)=>{
  const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.position.set(...pos);mesh.scale.set(...scale);mesh.castShadow=true;group.add(mesh);return mesh;
 };
 const sphere=new THREE.SphereGeometry(1,24,16);
 part('face-head',sphere,skin,[0,.045,0],[.105,.137,.100]);
 part('face-hair-cap',sphere,hair,[0,.135,-.004],[.108,.065,.105]);
 for(const side of [-1,1]){
  part('eye-white-'+side,sphere,white,[side*.040,.065,.089],[.021,.013,.009]);
  part('iris-'+side,sphere,iris,[side*.040,.065,.098],[.009,.010,.004]);
  part('ear-'+side,sphere,skin,[side*.106,.025,0],[.016,.031,.022]);
 }
 part('nose',sphere,skin,[0,.017,.104],[.016,.025,.020]);
 part('mouth',sphere,feature,[0,-.033,.096],[.031,.005,.005]);
 group.userData.faceBase=face?.id||'clean-face-v1';
 return group;
}
