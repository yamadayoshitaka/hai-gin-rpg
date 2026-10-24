/** Detailed hero visual BOM v52.
 * All geometry/placement/material input is declared below; renderer owns no actor identity.
 * Visual additions are parented to animated humanoid joint pivots.
 */
export const HERO_DETAIL_BOM=Object.freeze({
 plates:[
  {id:'breast-plate',joint:'spine',shape:'ellipsoid',at:[0,.255,.153],size:[.194,.248,.057],material:'steel'},
  {id:'waist-armor',joint:'spine',shape:'ellipsoid',at:[0,-.115,.134],size:[.183,.112,.042],material:'leather'},
  {id:'center-ridge',joint:'spine',shape:'box',at:[0,.23,.205],size:[.025,.33,.021],material:'brass'},
  {id:'collar-pin',joint:'spine',shape:'octa',at:[0,.51,.133],size:[.044,.05,.022],material:'brass'},
  {id:'belt-buckle',joint:'spine',shape:'box',at:[0,-.135,.178],size:[.071,.059,.027],material:'brass'},
  {id:'belt-core',joint:'spine',shape:'box',at:[0,-.137,.158],size:[.33,.061,.034],material:'walnut'},
  {id:'neck-scarf',joint:'spine',shape:'torus',at:[0,.495,.017],size:[.139,.047,.116],material:'royal'},
  {id:'forehead-band',joint:'head',shape:'torus',at:[0,.162,0],size:[.126,.020,.116],material:'leather'},
  {id:'forehead-stone',joint:'head',shape:'octa',at:[0,.167,.126],size:[.026,.029,.014],material:'brass'}
 ],
 mirrored:[
  {id:'chest-detail',joint:'spine',shape:'box',at:[.099,.28,.19],size:[.055,.23,.018],rotate:[0,0,.31],material:'brass'},
  {id:'shoulder-plate',joint:'shoulders',shape:'ellipsoid',at:[0,-.005,0],size:[.133,.099,.12],material:'steel'},
  {id:'shoulder-rivet',joint:'shoulders',shape:'octa',at:[0,-.012,.117],size:[.023,.026,.012],material:'brass'},
  {id:'upper-sleeve',joint:'shoulders',shape:'cone',at:[0,-.17,0],size:[.107,.375,.102],material:'linen'},
  {id:'vambrace',joint:'elbows',shape:'cone',at:[0,-.155,.005],size:[.08,.267,.082],material:'leather'},
  {id:'vambrace-edge',joint:'wrists',shape:'torus',at:[0,-.016,0],size:[.061,.019,.067],material:'brass'},
  {id:'glove-armor',joint:'wrists',shape:'ellipsoid',at:[0,-.081,.028],size:[.058,.088,.050],material:'walnut'},
  {id:'thigh-panel',joint:'hips',shape:'ellipsoid',at:[0,-.20,.081],size:[.114,.201,.059],material:'linen'},
  {id:'knee-plate',joint:'knees',shape:'ellipsoid',at:[0,-.010,.082],size:[.088,.085,.037],material:'steel'},
  {id:'shin-guard',joint:'knees',shape:'ellipsoid',at:[0,-.19,.074],size:[.071,.19,.039],material:'leather'},
  {id:'boot',joint:'ankles',shape:'ellipsoid',at:[0,-.07,.071],size:[.098,.115,.154],material:'walnut'},
  {id:'boot-buckle',joint:'ankles',shape:'box',at:[0,.023,.117],size:[.102,.031,.026],material:'brass'},
  {id:'cheek-highlight',joint:'head',shape:'ellipsoid',at:[.087,.048,.091],size:[.027,.012,.009],material:'skin'}
 ],
 hair:{rows:3,count:17,length:.215,radius:.022,material:'hair'},
 cape:{rows:20,columns:16,topWidth:.19,bottomWidth:.41,length:.86,material:'royal'},
 weapon:{joint:'wrists',side:1,handle:.21,blade:.64,material:'steel'}
});
export function validateHeroDetailBom(){
 const all=[...HERO_DETAIL_BOM.plates,...HERO_DETAIL_BOM.mirrored];
 if(new Set(all.map(x=>x.id)).size!==all.length)throw Error('Duplicate hero component');
 for(const x of all)if(!['ellipsoid','box','octa','torus','cone'].includes(x.shape)||x.size.some(n=>!Number.isFinite(n)||n<=0))throw Error('Invalid detail '+x.id);
 return true;
}
const CACHE=new WeakMap();
export function attachHeroDetails(T,joints,material){
 validateHeroDetailBom();
 const cache=CACHE.get(T)||new Map();CACHE.set(T,cache);
 const geometry=(type)=>{
  if(cache.has(type))return cache.get(type);
  const g=type==='ellipsoid'?new T.SphereGeometry(1,28,20):
   type==='box'?new T.BoxGeometry(1,1,1):
   type==='octa'?new T.OctahedronGeometry(1,0):
   type==='torus'?new T.TorusGeometry(1,.19,10,32):
   new T.CylinderGeometry(.75,1,1,20,3);
  cache.set(type,g);return g;
 };
 const target=(name,i)=>Array.isArray(joints[name])?joints[name][i]:joints[name];
 const part=(item,side=0)=>{
  const idx=side<0?0:1,sign=side||1,node=target(item.joint,idx);
  if(!node)throw Error('Missing hero joint '+item.joint);
  const mesh=new T.Mesh(geometry(item.shape),material(item.material));
  const [x,y,z]=item.at,[sx,sy,sz]=item.size;
  mesh.position.set(x*sign,y,z);mesh.scale.set(sx,sy,sz);
  if(item.rotate)mesh.rotation.set(...item.rotate.map((v,k)=>k===2?v*sign:v));
  if(item.shape==='torus')mesh.rotation.x=Math.PI/2;
  mesh.name='detail:'+item.id+(side?'_'+idx:'');
  mesh.castShadow=true;mesh.receiveShadow=true;node.add(mesh);return mesh;
 };
 HERO_DETAIL_BOM.plates.forEach(p=>part(p));
 for(const p of HERO_DETAIL_BOM.mirrored)for(const side of [-1,1])part(p,side);
 // Pointed swept hair strands: varied length, density and direction; scalp follows head joint.
 const h=HERO_DETAIL_BOM.hair;
 for(let row=0;row<h.rows;row++)for(let i=0;i<h.count;i++){
  const angle=i/h.count*Math.PI*2+(row%2)*.13;
  const forward=Math.cos(angle)>0, length=h.length*(.65+.18*row+.13*Math.sin(i*3.4));
  const strand=new T.Mesh(new T.ConeGeometry(h.radius*(1.1+row*.3),length,7),material(h.material));
  strand.position.set(Math.sin(angle)*(.108+row*.006),.245-row*.038,Math.cos(angle)*(.105+row*.006));
  strand.rotation.z=Math.sin(angle)*(.20+row*.09);
  strand.rotation.x=-Math.cos(angle)*(forward?.42:.21);
  strand.castShadow=true;joints.head.add(strand);
 }
 // Hem-shaped articulated cape, visible from behind even at mobile distance.
 const cape=HERO_DETAIL_BOM.cape,verts=[],uv=[],tri=[];
 for(let r=0;r<=cape.rows;r++){
  const t=r/cape.rows,w=cape.topWidth+(cape.bottomWidth-cape.topWidth)*t;
  for(let c=0;c<=cape.columns;c++){
   const u=c/cape.columns,x=(u*2-1)*w;
   verts.push(x,.42-t*cape.length,-.202-.15*t*t+.022*Math.sin(u*14)*t);
   uv.push(u,t);
  }
 }
 for(let r=0;r<cape.rows;r++)for(let c=0;c<cape.columns;c++){
  const a=r*(cape.columns+1)+c,b=a+cape.columns+1;tri.push(a,b,a+1,a+1,b,b+1);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(tri);g.computeVertexNormals();
 const cloak=new T.Mesh(g,material(cape.material));cloak.name='detail:tailored-cape';
 cloak.castShadow=true;cloak.receiveShadow=true;joints.spine.add(cloak);
 // Rich sword: tapered blade, fuller and golden guard, attached to the animated hand.
 const weapon=HERO_DETAIL_BOM.weapon,hand=target(weapon.joint,weapon.side);
 const swordRoot=new T.Group();swordRoot.position.set(0,-.12,.075);swordRoot.scale.setScalar(.52);swordRoot.name='hero-sword-scale-mount';hand.add(swordRoot);
 const sword=(name,geom,mat,x,y,z)=>{const m=new T.Mesh(geom,material(mat));m.name='detail:'+name;
  m.position.set(x,y,z);m.castShadow=true;swordRoot.add(m);return m;};
 sword('grip',new T.CylinderGeometry(.019,.025,weapon.handle,12),'walnut',0,-.07,0);
 sword('pommel',new T.OctahedronGeometry(.04,0),'brass',0,.053,0);
 sword('crossguard',new T.BoxGeometry(.245,.035,.063),'brass',0,-.19,0);
 const bladeShape=new T.BufferGeometry();
 const v=[-.048,-.21,-.009,.048,-.21,-.009,-.037,-.69,-.007,.037,-.69,-.007,0,-.21,.032,0,-.69,.025,0,-.83,0];
 bladeShape.setAttribute('position',new T.Float32BufferAttribute(v,3));
 bladeShape.setIndex([0,1,4,0,4,2,1,3,4,2,4,5,4,3,5,2,5,6,3,6,5,0,2,6,0,6,1,1,6,3]);
 bladeShape.computeVertexNormals();
 sword('tapered-blade',bladeShape,weapon.material,0,0,0);
 return {parts:HERO_DETAIL_BOM.plates.length+HERO_DETAIL_BOM.mirrored.length*2+h.rows*h.count+5,kind:'hero-v52'};
}
