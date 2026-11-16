/**
 * m048 abyssal sea serpent - independent axial anatomy prototype.
 * +X headward, Y dorsal, Z lateral. NOT an approved game asset.
 * No shared humanoid/leviathan geometry, no donor asset dependencies.
 */
export function buildSeaSerpentAnatomicalSource(THREE,{rings=112,sides=16}={}){
 if(!THREE?.BufferGeometry||rings<32||sides<8)throw Error('Invalid THREE or topology');
 const root=new THREE.Group();root.name='m048-sea-serpent-anatomical-source';
 const skin=new THREE.MeshStandardMaterial({color:0x174c57,roughness:.58,metalness:.04,side:THREE.DoubleSide});
 const ventral=new THREE.MeshStandardMaterial({color:0x9cae9a,roughness:.79,metalness:0,side:THREE.DoubleSide});
 const eyeMat=new THREE.MeshPhysicalMaterial({color:0xc7d79a,roughness:.17,clearcoat:.85});
 const pupil=new THREE.MeshStandardMaterial({color:0x071014,roughness:.12});
 const spineMat=new THREE.MeshStandardMaterial({color:0x356f72,roughness:.64,side:THREE.DoubleSide});
 const animatedFins=[];
 const radius=t=>.09+.57*Math.pow(Math.sin(Math.PI*Math.min(.999,t)),.7)+.17*Math.exp(-Math.pow((t-.79)/.11,2));
 const center=t=>new THREE.Vector3(-7.8+15.6*t,.28*Math.sin(t*8.4),.34*Math.sin(t*9.2));
 const verts=[],uv=[],idx=[],ventralIdx=[];
 for(let i=0;i<=rings;i++){
  const t=i/rings,c=center(t),ahead=center(Math.min(1,t+.001)),behind=center(Math.max(0,t-.001));
  const tangent=ahead.sub(behind).normalize();
  const lateral=new THREE.Vector3(0,0,1),up=new THREE.Vector3().crossVectors(lateral,tangent).normalize();
  const transverse=new THREE.Vector3().crossVectors(tangent,up).normalize();
  const r=radius(t);
  for(let j=0;j<=sides;j++){
   const a=j/sides*Math.PI*2;
   const p=c.clone().addScaledVector(up,Math.cos(a)*r*.78).addScaledVector(transverse,Math.sin(a)*r);
   verts.push(p.x,p.y,p.z);uv.push(t*7,j/sides);
  }
 }
 for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){
  const a=i*(sides+1)+j,b=a+sides+1;
  idx.push(a,b,a+1,b,b+1,a+1);
  if(Math.cos((j+.5)/sides*Math.PI*2)<-.40)ventralIdx.push(a,b,a+1,b,b+1,a+1);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(idx);geometry.computeVertexNormals();
 const body=new THREE.Mesh(geometry,skin);body.name='continuous-axial-trunk';root.add(body);
 const bellyGeo=geometry.clone();bellyGeo.setIndex(ventralIdx);
 // Offset each belly vertex in the LOCAL axial cross-section, not by scaling
 // world coordinates: world scaling displaced the curved spine and opened seams.
 // The same ring basis used for the skin is retained through animation.
 const bellyPosition=bellyGeo.getAttribute('position');
 for(let i=0;i<=rings;i++){
  const t=i/rings,c=center(t);
  const ahead=center(Math.min(1,t+.001)),behind=center(Math.max(0,t-.001));
  const tangent=ahead.sub(behind).normalize();
  const up=new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,1),tangent).normalize();
  const transverse=new THREE.Vector3().crossVectors(tangent,up).normalize();
  for(let j=0;j<=sides;j++){
   const n=i*(sides+1)+j,a=j/sides*Math.PI*2;
   const outward=up.clone().multiplyScalar(Math.cos(a)/.78)
    .addScaledVector(transverse,Math.sin(a)).normalize();
   bellyPosition.setXYZ(n,
    bellyPosition.getX(n)+outward.x*.018,
    bellyPosition.getY(n)+outward.y*.018,
    bellyPosition.getZ(n)+outward.z*.018);
  }
 }
 bellyGeo.computeVertexNormals();bellyGeo.computeBoundingSphere();
 const bellyMesh=new THREE.Mesh(bellyGeo,ventral);bellyMesh.name='ventral-keel-scales';root.add(bellyMesh);
 const head=new THREE.Group();head.name='skull-and-hinged-mandible';head.position.copy(center(.992));root.add(head);
 const ellipsoid=(parent,name,mat,x,y,z,sx,sy,sz)=>{
  const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),mat);m.name=name;
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
 };
 ellipsoid(head,'flattened-serpentine-cranium',skin,.35,0,0,.72,.33,.51);
 ellipsoid(head,'elongated-maxilla',skin,1.04,-.12,0,.76,.17,.37);
 // Paired branchial folds are curved, independently articulated gill membranes.
 // These sit behind the skull and oscillate subtly during respiration.
 const gillPivots=[];
 const gillMaterial=new THREE.MeshPhysicalMaterial({color:0x285b62,roughness:.44,metalness:0,side:THREE.DoubleSide,clearcoat:.28});
 for(const side of [-1,1]){
  const chamber=new THREE.Group();chamber.name='branchial-operculum-'+side;
  chamber.position.set(-.28,-.04,side*.30);head.add(chamber);
  gillPivots.push({chamber,side});
  for(let arch=0;arch<4;arch++){
   const samples=[];
   for(let j=0;j<=12;j++){
    const u=j/12,theta=-.95+1.9*u;
    samples.push(new THREE.Vector3(-.28+arch*.13-.045*Math.sin(Math.PI*u),
      .26*Math.sin(theta),side*(.13+.075*Math.cos(theta))));
   }
   const archMesh=new THREE.Mesh(new THREE.TubeGeometry(
     new THREE.CatmullRomCurve3(samples),24,.019,6,false),gillMaterial);
   archMesh.name='curved-gill-fold-'+side+'-'+arch;chamber.add(archMesh);
  }
 }
 const jaw=new THREE.Group();jaw.position.set(.26,-.27,0);head.add(jaw);
 ellipsoid(jaw,'mobile-dentary',ventral,.78,-.06,0,.93,.12,.36);
 for(const side of [-1,1]){
  ellipsoid(head,'supraorbital-brow-'+side,skin,.25,.21,side*.38,.28,.18,.20);
  ellipsoid(head,'eye-'+side,eyeMat,.37,.15,side*.49,.14,.13,.065);
  ellipsoid(head,'slit-pupil-'+side,pupil,.41,.15,side*.55,.038,.10,.018);
  ellipsoid(head,'nostril-'+side,pupil,1.56,-.06,side*.20,.045,.025,.03);
  // Independent dentary tooth row is parented to the mobile jaw, not the skull.
  // Recurved fangs follow the jaw pivot during strike and gape animations.
  for(let k=0;k<10;k++){
   const u=k/9;
   const height=.075+.055*Math.sin(Math.PI*u);
   const fang=new THREE.Mesh(new THREE.ConeGeometry(.022*(1-.25*u),height,8),ventral);
   fang.name='mobile-dentary-fang-'+side+'-'+k;
   fang.position.set(.28+1.08*u,.055+height*.38,side*(.29-.095*u));
   fang.rotation.z=-.20*(1-u);
   jaw.add(fang);
  }
  for(let k=0;k<11;k++){
   const tooth=new THREE.Mesh(new THREE.ConeGeometry(.025,.12,6),ventral);
   tooth.position.set(.55+k*.11,-.24,side*(.27-.04*k/11));tooth.rotation.z=Math.PI;
   tooth.name='recurved-maxillary-fang-'+side+'-'+k;head.add(tooth);
  }
 }
 // Paired lateral-line sensory ridges: continuous curved geometry following the
 // sea serpent's axial body, rather than isolated spherical ornaments.
 // Each ridge is a narrow tube with an independent normal and wet PBR surface.
 const lateralLineMaterial=new THREE.MeshPhysicalMaterial({
  color:0x79b7a6,roughness:.27,metalness:.02,clearcoat:.8,clearcoatRoughness:.18
 });
 const animatedLateralLines=[];
 for(const side of [-1,1]){
  const samples=[];
  for(let k=0;k<=88;k++){
   const t=.08+.84*k/88,c=center(t),r=radius(t);
   // Project the sensory canal onto the same moving cross-section as the trunk.
   // A world-Z offset detached the ridge wherever the spine bends in 3D.
   const tangent=center(Math.min(1,t+.001)).sub(center(Math.max(0,t-.001))).normalize();
   const up=new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,1),tangent).normalize();
   const transverse=new THREE.Vector3().crossVectors(tangent,up).normalize();
   const a=side*(Math.PI/2-.13);
   samples.push(c.addScaledVector(up,Math.cos(a)*r*.78*1.025)
    .addScaledVector(transverse,Math.sin(a)*r*1.025));
  }
  const curve=new THREE.CatmullRomCurve3(samples);
  const ridge=new THREE.Mesh(new THREE.TubeGeometry(curve,176,.017,6,false),lateralLineMaterial);
  ridge.name='continuous-lateral-sensory-ridge-'+side;
  root.add(ridge);
  const position=ridge.geometry.getAttribute('position');
  animatedLateralLines.push({mesh:ridge,base:Float32Array.from(position.array)});
 }
 // Distinct webbed dorsal crest grows from axial body, with independently shaped finlets.
 for(let k=0;k<18;k++){
  const t=.12+k*.042,c=center(t),r=radius(t),h=.18+.29*Math.sin(Math.PI*k/18);
  // Anchor the crest to the bent spine's dorsal normal, not world Y.
  // The four fin corners share the trunk's local axial/tangential frame.
  const tangent=center(Math.min(1,t+.001)).sub(center(Math.max(0,t-.001))).normalize();
  const up=new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,1),tangent).normalize();
  const anchor=c.clone().addScaledVector(up,r*.78);
  const corners=[
   anchor.clone().addScaledVector(tangent,-.15),
   anchor.clone().addScaledVector(tangent,-.30).addScaledVector(up,h),
   anchor.clone().addScaledVector(tangent,.09).addScaledVector(up,h*.65),
   anchor.clone().addScaledVector(tangent,.20)
  ];
  const points=corners.flatMap(p=>[p.x,p.y,p.z]);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
  const fin=new THREE.Mesh(g,spineMat);fin.name='axial-crest-finlet-'+k;root.add(fin);
  animatedFins.push({mesh:fin,base:Float32Array.from(g.getAttribute('position').array),t});
 }
 // Axial undulation uses actual per-ring vertex deformation, not whole-object rotation.
 const original=Float32Array.from(geometry.getAttribute('position').array);
 const bellyOriginal=Float32Array.from(bellyGeo.getAttribute('position').array);
 const swimOffset=(t,seconds)=>.22*(1-t)*Math.sin(seconds*2.2-t*13);
 function deform(mesh,base,seconds){
  const a=mesh.geometry.getAttribute('position');
  for(let i=0;i<=rings;i++){
   const t=i/rings,offset=swimOffset(t,seconds);
   for(let j=0;j<=sides;j++){
    const n=3*(i*(sides+1)+j);
    a.array[n]=base[n];a.array[n+1]=base[n+1];a.array[n+2]=base[n+2]+offset;
   }
  }
  a.needsUpdate=true;mesh.geometry.computeVertexNormals();
 }
 root.userData={creatureId:'m048',source:'original-anatomical-prototype',certified:false,
  anatomicalParts:['continuous-axial-trunk','ventral-keel-scales','flattened-serpentine-cranium','mobile-dentary','axial-crest-finlets','continuous-lateral-sensory-ridges','paired-branchial-opercula'],
  update(seconds){deform(body,original,seconds);deform(bellyMesh,bellyOriginal,seconds);
   for(const {mesh,base,t} of animatedFins){
    const p=mesh.geometry.getAttribute('position'),offset=swimOffset(t,seconds);
    for(let n=0;n<base.length;n+=3){p.array[n]=base[n];p.array[n+1]=base[n+1];p.array[n+2]=base[n+2]+offset;}
    p.needsUpdate=true;mesh.geometry.computeVertexNormals();
   }
   for(const {mesh,base} of animatedLateralLines){
    const p=mesh.geometry.getAttribute('position');
    for(let n=0;n<base.length;n+=3){
     const t=Math.max(0,Math.min(1,(base[n]+7.8)/15.6));
     p.array[n]=base[n];p.array[n+1]=base[n+1];
     p.array[n+2]=base[n+2]+swimOffset(t,seconds);
    }
    p.needsUpdate=true;mesh.geometry.computeVertexNormals();
   }
   // Align the skull to the deformed axial tangent; the head must follow the
   // swimming spine rather than yaw independently through the neck junction.
   const neckT=.992,delta=.006;
   const neckBase=center(neckT),behind=center(neckT-delta);
   neckBase.z+=swimOffset(neckT,seconds);
   behind.z+=swimOffset(neckT-delta,seconds);
   head.position.copy(neckBase);
   const direction=neckBase.sub(behind);
   head.rotation.y=-Math.atan2(direction.z,direction.x);
   head.rotation.z=Math.atan2(direction.y,Math.hypot(direction.x,direction.z));
   for(const {chamber,side} of gillPivots){chamber.rotation.y=side*(.045+.04*Math.sin(seconds*1.4));}
   jaw.rotation.z=-.06-.16*(.5+.5*Math.sin(seconds*.8));
  }};
 return root;
}
