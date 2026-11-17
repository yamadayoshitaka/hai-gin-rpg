/**
 * m020 deep-sea leviathan: independent anatomical source prototype.
 * Native procedural geometry, NOT a photoreal/approved production GLB.
 * +X is rostral; Y dorsal; Z lateral. Requires injected THREE namespace.
 * Never mutates legacy GLB or protected m005/m006.
 */
export function buildLeviathanAnatomicalSource(THREE,{segments=56,radial=18}={}){
 if(!THREE?.BufferGeometry||segments<16||radial<8)throw Error('THREE or topology invalid');
 const root=new THREE.Group();root.name='m020-leviathan-anatomical-source';
 const skin=new THREE.MeshStandardMaterial({color:0x183b4a,roughness:.48,metalness:.09,side:THREE.DoubleSide});
 const belly=new THREE.MeshStandardMaterial({color:0x6b8790,roughness:.69,metalness:0});
 const finMat=new THREE.MeshStandardMaterial({color:0x275e70,roughness:.53,metalness:.04,side:THREE.DoubleSide});
 const bone=new THREE.MeshStandardMaterial({color:0xa7b6a2,roughness:.78});
 const iris=new THREE.MeshPhysicalMaterial({color:0xb8d8bd,roughness:.14,clearcoat:.9});
 const black=new THREE.MeshStandardMaterial({color:0x071017,roughness:.17});
 const body=new THREE.Group();root.add(body);
 const profile=t=>{
   const x=-5.4+11.4*t;
   const neck=Math.exp(-(((t-.70)/.13)**2));
   const chest=Math.exp(-(((t-.53)/.24)**2));
   const tail=Math.max(.07,Math.pow(Math.sin(Math.PI*Math.min(.98,t)),.8));
   return {x,y:.25*Math.sin(t*Math.PI*1.4),ry:.16+1.15*tail+.34*chest-.15*neck,rz:.14+.92*tail+.20*chest};
 };
 function tube(material,start,end){
  const vertices=[],normals=[],uv=[],indices=[];
  for(let i=0;i<=segments;i++){
   const t=start+(end-start)*i/segments,p=profile(t);
   for(let j=0;j<=radial;j++){
    const a=2*Math.PI*j/radial;
    const ridge=1+.055*Math.cos(8*a+22*t)*Math.sin(Math.PI*t)**2;
    vertices.push(p.x,p.y+Math.cos(a)*p.ry*ridge,Math.sin(a)*p.rz*ridge);
    uv.push(t,j/radial);
   }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<radial;j++){
   const a=i*(radial+1)+j,b=a+radial+1;
   indices.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();
  const m=new THREE.Mesh(g,material);m.name='axial-musculature';return m;
 }
 body.add(tube(skin,0,1));
 // Lower ventral surface is an independent anatomical plate, not a recolored whole body.
 const ventral=tube(belly,.22,.91);
 // Lift the underside plate *outward* along each elliptical cross-section.
 // Scaling it below 1 buried the entire PBR plate inside the opaque trunk.
 // Keep a shallow 2 cm clearance and preserve its axial anatomical curvature.
 const vpos=ventral.geometry.getAttribute('position');
 const vind=ventral.geometry.index.array;const keep=[];
 for(let k=0;k<vind.length;k+=3){
  const ids=[vind[k],vind[k+1],vind[k+2]];
  if(ids.every(id=>vpos.getY(id)<profile((vpos.getX(id)+5.4)/11.4).y-.025))keep.push(...ids);
 }
 for(let i=0;i<vpos.count;i++){
  const t=(vpos.getX(i)+5.4)/11.4,p=profile(t);
  const dy=vpos.getY(i)-p.y,dz=vpos.getZ(i);
  const ny=dy/Math.max(.01,p.ry*p.ry),nz=dz/Math.max(.01,p.rz*p.rz);
  const norm=Math.hypot(ny,nz)||1;
  vpos.setXYZ(i,vpos.getX(i),vpos.getY(i)+.025*ny/norm,vpos.getZ(i)+.025*nz/norm);
 }
 ventral.geometry.setIndex(keep);
 ventral.geometry.computeVertexNormals();
 ventral.geometry.computeBoundingSphere();
 ventral.name='ventral-scutes';body.add(ventral);
 const head=new THREE.Group();head.position.set(5.95,.13,0);body.add(head);
 function ellipsoid(parent,name,material,pos,scale){
  const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),material);
  m.name=name;m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;
 }
 ellipsoid(head,'cranial-skull',skin,[.26,.02,0],[1.30,.64,.78]);
 ellipsoid(head,'tapered-rostrum',skin,[1.22,-.13,0],[1.05,.34,.50]);
 const jaw=new THREE.Group();jaw.position.set(.20,-.30,0);head.add(jaw);
 ellipsoid(jaw,'articulated-mandible',belly,[.84,-.19,0],[1.33,.22,.51]);
 // Lower dental arcade is attached to the articulated jaw pivot, so the teeth
 // open with the mandible instead of remaining suspended in the upper skull.
 for(const side of [-1,1])for(let tooth=0;tooth<10;tooth++){
  const u=tooth/9;
  const rootX=.13+1.86*u;
  const rootZ=side*(.43-.18*u);
  const height=.11+.075*Math.sin(Math.PI*u);
  const fang=new THREE.Mesh(new THREE.ConeGeometry(.037*(1-.3*u),height,8),bone);
  fang.name='mandibular-tooth-'+side+'-'+tooth;
  fang.position.set(rootX,-.005+height*.45,rootZ);
  fang.rotation.z=-.18*(1-u);
  jaw.add(fang);
 }

 // Paired mechanosensory barbels: tapered, segmented swept anatomy attached to the rostrum.
 // The filaments are independent articulated chains, not painted lines or sphere subdivisions.
 const barbelPivots=[];
 for(const side of [-1,1]){
  const pivot=new THREE.Group();pivot.name='rostral-barbel-pivot-'+side;
  pivot.position.set(1.63,-.25,side*.36);head.add(pivot);
  barbelPivots.push({pivot,side});
  const rings=20,sides=7,vertices=[],indices=[],uv=[];
  for(let i=0;i<=rings;i++){
   const u=i/rings,rad=.052*Math.pow(1-u,.8)+.002;
   const centerX=.18+1.30*u,centerY=-.10-.48*u*u;
   const centerZ=side*(.10+.43*u+.12*Math.sin(u*Math.PI));
   for(let j=0;j<=sides;j++){
    const a=j/sides*Math.PI*2;
    vertices.push(centerX,centerY+rad*Math.cos(a),centerZ+rad*Math.sin(a));
    uv.push(u,j/sides);
   }
  }
  for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){
   const a=i*(sides+1)+j,b=a+sides+1;
   indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const filament=new THREE.Mesh(geometry,skin);
  filament.name='tapered-mechanosensory-barbel-'+side;pivot.add(filament);
 }
 const branchialPivots=[];
 for(const side of [-1,1]){
  ellipsoid(head,'orbital-ridge-'+side,skin,[.35,.29,side*.66],[.41,.29,.20]);
  ellipsoid(head,'cornea-'+side,iris,[.52,.25,side*.80],[.19,.18,.085]);
  ellipsoid(head,'vertical-pupil-'+side,black,[.57,.25,side*.866],[.06,.135,.028]);
  ellipsoid(head,'nostril-'+side,black,[1.94,-.035,side*.30],[.08,.035,.06]);
  // Four independent curved opercular slits follow the skull's lateral contour.
  // They are inset dark grooves, not markings projected onto the eye sphere.
  for(let gill=0;gill<4;gill++){
   const x=-.74+gill*.19,curve=[];
   for(let k=0;k<=12;k++){
    const t=k/12,angle=-.63+1.18*t;
    curve.push(new THREE.Vector3(
     x-.085*Math.sin(Math.PI*t),
     -.06+.44*Math.sin(angle),
     side*(.62+.105*Math.cos(angle)-.025*gill)));
   }
   const slit=new THREE.Mesh(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(curve),20,.018,5,false),black);
   slit.name='opercular-gill-slit-'+side+'-'+gill;head.add(slit);
  }
  // A paired branchial chamber is a hinged anatomical volume, not a painted slit.
  // Each chamber has four curved support arches with independent respiratory motion.
  const chamber=new THREE.Group();chamber.name='branchial-chamber-'+side;
  chamber.position.set(-.48,-.10,side*.55);head.add(chamber);
  branchialPivots.push({chamber,side});
  for(let arch=0;arch<4;arch++){
   const curve=[];
   for(let k=0;k<=16;k++){
    const t=k/16,angle=-1.12+2.24*t;
    curve.push(new THREE.Vector3(-.27+arch*.18-.045*Math.sin(Math.PI*t),
     .43*Math.sin(angle),side*(.08+.13*Math.cos(angle))));
   }
   const archMesh=new THREE.Mesh(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(curve),24,.033,7,false),belly);
   archMesh.name='branchial-support-arch-'+side+'-'+arch;chamber.add(archMesh);
  }
  for(let i=0;i<9;i++){
   const x=.12+i*.19;
   const fang=new THREE.Mesh(new THREE.ConeGeometry(.044,.17,6),bone);
   fang.name='maxillary-tooth-'+side+'-'+i;
   fang.position.set(x,-.37,side*(.39-.08*i/9));fang.rotation.z=Math.PI;
   head.add(fang);
  }
 }
 function fin(name,base,points,material=finMat){
  const g=new THREE.BufferGeometry(),v=[...base,...points.flat()],idx=[];
  for(let i=0;i<points.length-1;i++)idx.push(0,i+1,i+2);
  g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  // Fin membrane requires its own non-degenerate UVs for baked PBR maps.
  // U follows the leading-to-trailing fin edge; V follows distance from root.
  const span=Math.max(1e-6,...points.map(p=>Math.hypot(
   p[0]-base[0],p[1]-base[1],p[2]-base[2])));
  const finUV=[.5,0];
  for(let i=0;i<points.length;i++){
   const p=points[i];
   finUV.push(points.length===1?.5:i/(points.length-1),
    Math.hypot(p[0]-base[0],p[1]-base[1],p[2]-base[2])/span);
  }
  g.setAttribute('uv',new THREE.Float32BufferAttribute(finUV,2));
  g.setIndex(idx);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,material);mesh.name=name;body.add(mesh);return mesh;
 }
 for(let n=0;n<6;n++){
  const t=.21+n*.115,p=profile(t),x=p.x;
  fin('dorsal-spine-'+n,[x,p.y+p.ry*.93,0],[[x-.30,p.y+p.ry+(.50-n*.055),0],[x+.21,p.y+p.ry+(.74-n*.075),0],[x+.50,p.y+p.ry*.96,0]]);
 }
 // Pectoral fins have a swept cambered web, cartilage rays and independent pivots.
 const pectoralPivots=[];
 for(const side of [-1,1]){
  const p=profile(.65);
  const pivot=new THREE.Group();pivot.name='pectoral-articulation-'+side;
  pivot.position.set(p.x,p.y-.10,side*p.rz*.85);body.add(pivot);pectoralPivots.push({pivot,side});
  // Chord-wise spread prevents collapsed web strips and gives the cartilage rays distinct attachment paths.
  const verts=[],uv=[],idx=[],span=12,chord=8;
  for(let i=0;i<=span;i++){
   const u=i/span;
   for(let j=0;j<=chord;j++){
    const v=j/chord;
    verts.push(-1.48*u+(.40-.18*u)*(v-.5)+.18*u*Math.sin(Math.PI*v),
      -.22*u-.18*Math.sin(Math.PI*u)*Math.sin(Math.PI*v),
      side*(1.83*u+.14*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)));
    uv.push(u,v);
   }
  }
  for(let i=0;i<span;i++)for(let j=0;j<chord;j++){
   const a=i*(chord+1)+j,b=a+chord+1;idx.push(a,b,a+1,b,b+1,a+1);
  }
  const wingGeometry=new THREE.BufferGeometry();
  wingGeometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  wingGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  wingGeometry.setIndex(idx);wingGeometry.computeVertexNormals();
  const web=new THREE.Mesh(wingGeometry,finMat);web.name='pectoral-cambered-web-'+side;pivot.add(web);
  for(let rayIndex=0;rayIndex<=chord;rayIndex+=2){
   const v=rayIndex/chord,path=[];
   for(let i=0;i<=span;i++){
    const u=i/span;
    path.push(new THREE.Vector3(-1.48*u+(.40-.18*u)*(v-.5)+.18*u*Math.sin(Math.PI*v),
     -.22*u-.18*Math.sin(Math.PI*u)*Math.sin(Math.PI*v),
     side*(1.83*u+.14*Math.sin(Math.PI*u)*Math.sin(Math.PI*v))+.014));
   }
   const ray=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),18,.012,5,false),bone);
   ray.name='pectoral-cartilage-ray-'+side+'-'+rayIndex;pivot.add(ray);
  }
  const q=profile(.32);
  fin('pelvic-fin-'+side,[q.x,q.y-.20,side*q.rz*.82],
    [[q.x-.40,q.y-.62,side*1.45],[q.x-1.03,q.y-.82,side*1.66],[q.x-.60,q.y-.28,side*q.rz]]);
 }
 const tail=new THREE.Group();tail.position.set(-5.4,0,0);body.add(tail);
 // Caudal fin is a swept, rib-supported membrane with real camber and thickness,
 // rather than a pair of flat triangles. Rays taper from the caudal peduncle.
 function tailLobe(name,sign){
  const span=12,chord=8,vertices=[],indices=[],uv=[];
  for(let i=0;i<=span;i++){
   const u=i/span,spread=sign*(.08+1.55*u),sweep=-.12-1.75*u;
   for(let j=0;j<=chord;j++){
    const v=j/chord,edge=Math.sin(Math.PI*v);
    const x=sweep+(.62*(1-u))*Math.cos(Math.PI*v);
    const y=spread+sign*.14*edge*Math.sin(Math.PI*u);
    const z=.16*edge*Math.sin(Math.PI*u)+.055*Math.sin(v*Math.PI*7)*u;
    vertices.push(x,y,z);
    // Independent caudal-lobe UV chart: spanwise U, chordwise V.
    // Both lobes retain the same orientation for consistent PBR baking.
    uv.push(u,v);
   }
  }
  for(let i=0;i<span;i++)for(let j=0;j<chord;j++){
   const a=i*(chord+1)+j,b=a+chord+1;
   indices.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();
  const membrane=new THREE.Mesh(g,finMat);membrane.name=name+'-cambered-membrane';tail.add(membrane);
  const rayMaterial=bone;
  for(let j=0;j<=chord;j+=2){
   const path=[];
   for(let i=0;i<=span;i++){
    const u=i/span,v=j/chord,edge=Math.sin(Math.PI*v);
    path.push(new THREE.Vector3(
     -.12-1.75*u+(.62*(1-u))*Math.cos(Math.PI*v),
     sign*(.08+1.55*u)+sign*.14*edge*Math.sin(Math.PI*u),
     .16*edge*Math.sin(Math.PI*u)+.055*Math.sin(v*Math.PI*7)*u+.012));
   }
   const ray=new THREE.Mesh(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(path),24,.018,5,false),rayMaterial);
   ray.name=name+'-support-ray-'+j;tail.add(ray);
  }
 }
 tailLobe('caudal-upper',1);tailLobe('caudal-lower',-1);
 root.userData={creatureId:'m020',source:'original-anatomical-prototype',certified:false,
  anatomicalParts:['axial-musculature','cranial-skull','articulated-mandible','pectoral-fins','pelvic-fins','caudal-lobes'],
  update:(seconds)=>{
   const phase=seconds*1.6;
   body.rotation.y=.045*Math.sin(phase);
   tail.rotation.y=.29*Math.sin(phase-.9);
   for(const {pivot,side} of pectoralPivots)pivot.rotation.x=side*(.10+.14*Math.sin(phase-.55));
   head.rotation.y=.035*Math.sin(phase+.4);
   for(const {pivot,side} of barbelPivots){
    pivot.rotation.y=side*.09*Math.sin(phase*.75+side);
    pivot.rotation.z=.07*Math.sin(phase*.55+side);
   }
   for(const {chamber,side} of branchialPivots){
    chamber.rotation.y=side*(.045+.055*Math.sin(seconds*1.35));
    chamber.scale.z=1+.09*Math.sin(seconds*1.35);
   }
   jaw.rotation.z=-.08-.08*(.5+.5*Math.sin(seconds*.7));
   body.position.y=.12*Math.sin(seconds*.85);
  }};
 return root;
}
