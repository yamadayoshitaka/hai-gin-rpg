/**
 * Anatomical skin renderer. The visible surface is one skinned geometry while the
 * source-of-truth joint BOM stays in the character controller.
 * Units are metres in the unscaled canonical humanoid coordinate system.
 */
export function attachSmoothHumanSkin(THREE,root,joints,material){
 const bones=[joints.spine,joints.neck,joints.head,
  joints.hips[0],joints.knees[0],joints.ankles[0],
  joints.hips[1],joints.knees[1],joints.ankles[1],
  joints.shoulders[0],joints.elbows[0],joints.wrists[0],
  joints.shoulders[1],joints.elbows[1],joints.wrists[1]];
 const positions=[],uvs=[],indices=[],skinIndex=[],skinWeight=[],groups=[];
 const addTube=({rings,segment=20,mat=0,boneWeights})=>{
  const start=indices.length,first=positions.length/3;
  for(let i=0;i<rings.length;i++){
   const [y,x,z,rx,rz]=rings[i];
   for(let j=0;j<segment;j++){
    const a=Math.PI*2*j/segment;
    positions.push(x+rx*Math.cos(a),y,z+rz*Math.sin(a));
    uvs.push(j/(segment-1),i/(rings.length-1));
    const weights=boneWeights(y);
    skinIndex.push(weights[0][0],weights[1][0],0,0);
    skinWeight.push(weights[0][1],weights[1][1],0,0);
   }
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<segment;j++){
   const a=first+i*segment+j,b=first+i*segment+(j+1)%segment,
    c=a+segment,d=b+segment;
   indices.push(a,c,b,b,c,d);
  }
  groups.push({start,count:indices.length-start,materialIndex:mat});
 };
 const blend=(upper,lower,t)=>{
  const f=Math.max(0,Math.min(1,t));return [[upper,1-f],[lower,f]];
 };
 const lerp=(a,b,t)=>a+(b-a)*t;
 const torso=[];
 for(let i=0;i<=20;i++){
  const y=lerp(.83,1.53,i/20);
  const chest=Math.exp(-(((y-1.28)/.24)**2));
  const radiusX=.17+.08*chest,radiusZ=.122+.033*chest;
  torso.push([y,0,0,radiusX,radiusZ]);
 }
 torso.push([1.57,0,0,.119,.11],[1.63,0,0,.069,.068],[1.685,0,0,.064,.064]);
 addTube({rings:torso,mat:0,boneWeights:y=>blend(0,1,(y-1.44)/.16)});
 for(let side=0;side<2;side++){
  const sign=side?1:-1,arm=[];
  for(let i=0;i<=22;i++){
   const y=lerp(.65,1.45,i/22);
   const radius=.057+.041*Math.sin(Math.PI*(i/22))+.016*(i/22);
   arm.push([y,sign*.256,0,radius,radius*.94]);
  }
  const shoulder=side?12:9,elbow=side?13:10,wrist=side?14:11;
  addTube({rings:arm,mat:0,boneWeights:y=>
   y>1.04?blend(elbow,shoulder,(y-1.04)/.25):blend(wrist,elbow,(y-.68)/.29)});
  const leg=[];
  for(let i=0;i<=24;i++){
   const y=lerp(.07,.9,i/24),t=i/24;
   const radius=.068+.077*t+.011*Math.sin(t*Math.PI);
   leg.push([y,sign*.115,0,radius,radius*.93]);
  }
  const hip=side?6:3,knee=side?7:4,ankle=side?8:5;
  addTube({rings:leg,mat:1,boneWeights:y=>
   y>.46?blend(knee,hip,(y-.46)/.33):blend(ankle,knee,(y-.08)/.31)});
 }
 const head=[];
 for(let i=0;i<=20;i++){
  const y=lerp(1.626,1.91,i/20);
  const v=(y-1.77)/.153;
  const radius=Math.max(.015,.119*Math.sqrt(Math.max(0,1-v*v)));
  head.push([y,0,.005,radius,radius*.96]);
 }
 addTube({rings:head,mat:2,boneWeights:y=>[[2,1],[2,0]]});
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 for(const group of groups)geometry.addGroup(group.start,group.count,group.materialIndex);
 const mesh=new THREE.SkinnedMesh(geometry,[material('linen'),material('leather'),material('skin')]);
 mesh.name='continuous-anatomical-skin';mesh.castShadow=true;mesh.receiveShadow=true;
 mesh.frustumCulled=false;
 root.add(mesh);root.updateMatrixWorld(true);
 mesh.bind(new THREE.Skeleton(bones));
 mesh.userData.skinDrivenBy='human-joint-bom';
 return mesh;
}
