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
   const neck=Math.exp(-((t-.70)/.13)**2);
   const chest=Math.exp(-((t-.53)/.24)**2);
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
 const ventral=tube(belly,.22,.91);ventral.scale.set(1,.985,.985);
 // Restrict ventral material to lower hemisphere with explicit separate mesh.
 const vpos=ventral.geometry.getAttribute('position');
 const vind=ventral.geometry.index.array;const keep=[];
 for(let k=0;k<vind.length;k+=3){
  const ids=[vind[k],vind[k+1],vind[k+2]];
  if(ids.every(id=>vpos.getY(id)<profile((vpos.getX(id)+5.4)/11.4).y+.08))keep.push(...ids);
 }
 ventral.geometry.setIndex(keep);ventral.geometry.computeVertexNormals();ventral.name='ventral-scutes';body.add(ventral);
 const head=new THREE.Group();head.position.set(5.95,.13,0);body.add(head);
 function ellipsoid(parent,name,material,pos,scale){
  const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),material);
  m.name=name;m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;
 }
 ellipsoid(head,'cranial-skull',skin,[.26,.02,0],[1.30,.64,.78]);
 ellipsoid(head,'tapered-rostrum',skin,[1.22,-.13,0],[1.05,.34,.50]);
 const jaw=new THREE.Group();jaw.position.set(.20,-.30,0);head.add(jaw);
 ellipsoid(jaw,'articulated-mandible',belly,[.84,-.19,0],[1.33,.22,.51]);
 for(const side of [-1,1]){
  ellipsoid(head,'orbital-ridge-'+side,skin,[.35,.29,side*.66],[.41,.29,.20]);
  ellipsoid(head,'cornea-'+side,iris,[.52,.25,side*.80],[.19,.18,.085]);
  ellipsoid(head,'vertical-pupil-'+side,black,[.57,.25,side*.866],[.06,.135,.028]);
  ellipsoid(head,'nostril-'+side,black,[1.94,-.035,side*.30],[.08,.035,.06]);
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
  g.setIndex(idx);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,material);mesh.name=name;body.add(mesh);return mesh;
 }
 for(let n=0;n<6;n++){
  const t=.21+n*.115,p=profile(t),x=p.x;
  fin('dorsal-spine-'+n,[x,p.y+p.ry*.93,0],[[x-.30,p.y+p.ry+(.50-n*.055),0],[x+.21,p.y+p.ry+(.74-n*.075),0],[x+.50,p.y+p.ry*.96,0]]);
 }
 for(const side of [-1,1]){
  const p=profile(.65);
  fin('pectoral-fin-'+side,[p.x,p.y-.10,side*p.rz*.85],
    [[p.x-.50,p.y-.30,side*2.05],[p.x-1.35,p.y-.47,side*2.65],[p.x-.96,p.y-.23,side*p.rz]]);
  const q=profile(.32);
  fin('pelvic-fin-'+side,[q.x,q.y-.20,side*q.rz*.82],
    [[q.x-.40,q.y-.62,side*1.45],[q.x-1.03,q.y-.82,side*1.66],[q.x-.60,q.y-.28,side*q.rz]]);
 }
 const tail=new THREE.Group();tail.position.set(-5.4,0,0);body.add(tail);
 function tailLobe(name,sign){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.45,sign*.95,0,-1.75,sign*1.45,0,-1.22,sign*.28,0],3));
  g.setIndex([0,1,3,1,2,3]);g.computeVertexNormals();
  const m=new THREE.Mesh(g,finMat);m.name=name;tail.add(m);
 }
 tailLobe('caudal-upper',1);tailLobe('caudal-lower',-1);
 root.userData={creatureId:'m020',source:'original-anatomical-prototype',certified:false,
  anatomicalParts:['axial-musculature','cranial-skull','articulated-mandible','pectoral-fins','pelvic-fins','caudal-lobes'],
  update:(seconds)=>{
   const phase=seconds*1.6;
   body.rotation.y=.045*Math.sin(phase);
   tail.rotation.y=.29*Math.sin(phase-.9);
   head.rotation.y=.035*Math.sin(phase+.4);
   jaw.rotation.z=-.08-.08*(.5+.5*Math.sin(seconds*.7));
   body.position.y=.12*Math.sin(seconds*.85);
  }};
 return root;
}
