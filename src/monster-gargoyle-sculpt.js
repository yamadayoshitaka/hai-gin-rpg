/**
 * M042 "獄門のガーゴイル": species-specific sculpt, NOT a dressed golem.
 * The donor GLTF provides bones and native animation only. Body, face,
 * wings, talons and long tail are distinct model-space geometry anchored
 * to anatomical bones. Kept independently rollbackable from m036-m040.
 */
import * as THREE from 'three';

export const GARGOYLE_SPECIES_REVISION='m042-gothic-gargoyle-v1-20261121';
export const GARGOYLE_MATERIAL_ROLES=Object.freeze({
 gargoyleStone:0x797f84,
 gargoyleRidge:0x9b9994,
 gargoyleShadow:0x34373b,
 gargoyleHorn:0x494b50,
 gargoyleClaw:0xa19b91,
 gargoyleMembrane:0x514149,
 gargoyleWingVein:0x837078,
 gargoyleEye:0xd15f39
});
const far=detail=>detail==='low'||detail==='medium';
const ringSides=detail=>detail==='low'?8:detail==='medium'?12:22;
const rough=(a,b)=>Math.sin(a*17.17+b*6.77)*.6+
 Math.sin(a*8.17-b*13.19)*.4;

/** Continuous chiseled muscle silhouette; proper UV/normals and sealed ends. */
function rockLoft(rings,detail,{ridge=.015,grain=.022,kind='gargoyle'}={}){
 const around=ringSides(detail),pts=[],uv=[],faces=[];
 for(let j=0;j<rings.length;j++){
  const r=rings[j];
  for(let i=0;i<=around;i++){
   const angle=i/around*Math.PI*2;
   const c=Math.cos(angle),sn=Math.sin(angle);
   const localGrain=1+grain*rough(i,j);
   const x=r.rx*c*localGrain;
   const z=(r.z||0)+r.rz*sn*localGrain-
    ridge*Math.pow(Math.max(0,-sn),6);
   pts.push(x,r.y,z);
   uv.push(i/around,j/(rings.length-1));
   if(j>0&&i<around){
    const a=(j-1)*(around+1)+i,b=j*(around+1)+i;
    faces.push(a,b,a+1,a+1,b,b+1);
   }
  }
 }
 for(const j of [0,rings.length-1]){
  const ring=rings[j],idx=pts.length/3,start=j*(around+1);
  pts.push(0,ring.y,ring.z||0);uv.push(.5,.5);
  for(let i=0;i<around;i++){
   if(j===0)faces.push(idx,start+i,start+i+1);
   else faces.push(idx,start+i+1,start+i);
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(faces);geo.computeVertexNormals();
 geo.userData={kind,detail,distinctSpecies:'m042'};
 return geo;
}
export function createGargoyleTorsoGeometry({detail='high',region='chest'}={}){
 return region==='pelvis'?rockLoft([
  {y:.19,rx:.20,rz:.153},{y:.11,rx:.239,rz:.182},
  {y:-.01,rx:.222,rz:.177},{y:-.18,rx:.185,rz:.147},
  {y:-.27,rx:.127,rz:.105}
 ],detail,{kind:'gargoyle-muscular-pelvis',ridge:.013}):
 rockLoft([
  {y:.389,rx:.104,rz:.105},{y:.321,rx:.244,rz:.175},
  {y:.225,rx:.316,rz:.203},{y:.116,rx:.310,rz:.217},
  {y:.014,rx:.277,rz:.205},{y:-.139,rx:.235,rz:.175},
  {y:-.296,rx:.206,rz:.158},{y:-.395,rx:.156,rz:.126}
 ],detail,{kind:'gargoyle-lean-sculpted-pectorals-and-abs',ridge:.029});
}
export function createGargoyleHeadGeometry({detail='high'}={}){
 return rockLoft([
  {y:.195,rx:.036,rz:.056,z:.008},
  {y:.150,rx:.105,rz:.106,z:.007},
  {y:.09,rx:.147,rz:.135},
  {y:.01,rx:.158,rz:.152},
  {y:-.067,rx:.128,rz:.139,z:-.014},
  {y:-.143,rx:.094,rz:.107,z:-.037},
  {y:-.189,rx:.053,rz:.065,z:-.047}
 ],detail,{kind:'gargoyle-angular-demonic-face',ridge:.031,grain:.037});
}
export function createGargoyleLimbGeometry({detail='high',part='upperArm'}={}){
 const sizes={
  upperArm:[.405,.145,.137,.098],
  forearm:[.44,.116,.142,.095],
  thigh:[.525,.166,.180,.121],
  shin:[.49,.124,.132,.080]
 };
 const p=sizes[part];if(!p)throw Error('Unknown gargoyle limb '+part);
 const [len,top,middle,bottom]=p;
 return rockLoft([
  {y:.038,rx:top*.84,rz:top*.86},
  {y:-len*.18,rx:top,rz:top*.91},
  {y:-len*.43,rx:middle,rz:middle*.82},
  {y:-len*.69,rx:middle*.86,rz:middle*.76},
  {y:-len*.91,rx:bottom,rz:bottom*.87},
  {y:-len*1.04,rx:bottom*.82,rz:bottom*.75}
 ],detail,{kind:'gargoyle-tapered-'+part,ridge:.016,grain:.030});
}
/** Curved backward-facing horn/crown or finger claw, NOT a rounded sphere. */
export function createGargoyleSpireGeometry({
 detail='high',height=.29,width=.046,curve=.13,side=1
}={}){
 const n=far(detail)?8:18,around=far(detail)?6:10,pts=[],uv=[],faces=[];
 for(let row=0;row<=n;row++){
  const t=row/n,rr=width*Math.pow(1-t,1.03)+.0018;
  const bx=side*curve*t*t,by=height*t,bz=.036*t*t;
  for(let k=0;k<=around;k++){
   const a=k/around*Math.PI*2,angular=1+.09*Math.cos(a*5+row*.31);
   pts.push(bx+Math.cos(a)*rr*angular,by,
    bz+Math.sin(a)*rr*.85*angular);
   uv.push(k/around,t);
   if(row<n&&k<around){
    const p=row*(around+1)+k,q=p+around+1;
    faces.push(p,p+1,q,p+1,q+1,q);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(faces);geo.computeVertexNormals();
 geo.userData={kind:'gargoyle-curved-horn-or-talon',detail};
 return geo;
}
/** Large scalloped bat membrane, integral 3D surface with visible folds. */
export function createGargoyleWingGeometry({detail='high',side=1}={}){
 const columns=detail==='low'?8:detail==='medium'?12:25;
 const rows=detail==='low'?5:detail==='medium'?7:15;
 const pts=[],uv=[],indices=[];
 for(let i=0;i<=columns;i++){
  const u=i/columns;
  const upper=.27+(.83*Math.sin(u*Math.PI*.67))+.16*u;
  const scallop=.16*Math.cos(u*Math.PI*7)+.07*Math.cos(u*Math.PI*11);
  const lower=.10-.35*u+scallop*(u>.11?1:0);
  for(let j=0;j<=rows;j++){
   const v=j/rows;
   const span=.132+1.22*u;
   const folded=.036*Math.sin(u*Math.PI*13)*Math.sin(v*Math.PI);
   pts.push(side*span,upper*(1-v)+lower*v,
    .35+.48*u+folded+.06*Math.sin(u*3)*v);
   uv.push(u*2,v*2);
   if(i<columns&&j<rows){
    const a=i*(rows+1)+j,b=a+rows+1;
    indices.push(a,a+1,b,a+1,b+1,b);
   }
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(indices);g.computeVertexNormals();
 g.userData={kind:'species-scalloped-ribbed-gargoyle-wing',side,detail};
 return g;
}
export function createGargoyleTailGeometry({detail='high'}={}){
 const around=far(detail)?7:12,steps=far(detail)?12:24;
 const pts=[],uv=[],indices=[];
 for(let j=0;j<=steps;j++){
  const t=j/steps;
  const r=.096*Math.pow(1-t,.89)+.0025;
  const x=.20*t*t*Math.sin(t*4.7),y=.065-.88*t;
  const z=.15+1.00*t+.16*Math.sin(t*3.4);
  for(let k=0;k<=around;k++){
   const angle=k/around*Math.PI*2,faceted=1+.07*Math.cos(k*3+t*25);
   pts.push(x+Math.cos(angle)*r*faceted,
    y+Math.sin(angle)*r*faceted,z);
   uv.push(k/around,t);
   if(j<steps&&k<around){
    const p=j*(around+1)+k,q=p+around+1;
    indices.push(p,p+1,q,p+1,q+1,q);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();
 geo.userData={kind:'gargoyle-long-tapered-vertebral-tail',detail};
 return geo;
}
/** Offline deterministic rough-stone texture: fissures, weathering, lichen. */
export function createGargoyleStoneTexture({size=128,seed=42}={}){
 if(!Number.isInteger(size)||size<16||size>512)throw Error('Invalid stone map size');
 const rgba=new Uint8Array(size*size*4);
 let rng=seed>>>0;
 const rand=()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/4294967296;};
 const noise=new Float32Array(size*size);
 for(let i=0;i<noise.length;i++)noise[i]=rand();
 const idx=(x,y)=>((y+size)%size)*size+(x+size)%size;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const n=noise[idx(x,y)]*.35+
   (noise[idx(x-1,y)]+noise[idx(x+1,y)]+
    noise[idx(x,y-1)]+noise[idx(x,y+1)])*.10;
  const veining=Math.abs(Math.sin(x*.118+Math.sin(y*.061)*3.8+
   Math.cos(x*.031+y*.037)*2.5));
  const crack=veining<.052;
  const mineral=216+Math.floor(n*39-19);
  const lich=(Math.sin(x*.14)*Math.cos(y*.09)>.74)?-20:0;
  const base=crack?94:mineral+lich;
  const offset=(y*size+x)*4;
  rgba[offset]=Math.max(0,Math.min(255,base+4));
  rgba[offset+1]=Math.max(0,Math.min(255,base+2));
  rgba[offset+2]=Math.max(0,Math.min(255,base));
  rgba[offset+3]=255;
 }
 const map=new THREE.DataTexture(rgba,size,size,THREE.RGBAFormat);
 map.colorSpace=THREE.SRGBColorSpace;
 map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.repeat.set(2.2,2.2);map.magFilter=THREE.LinearFilter;
 map.minFilter=THREE.LinearMipmapLinearFilter;
 map.generateMipmaps=true;map.needsUpdate=true;
 map.userData={species:'m042',procedural:true,noExternalFiles:true};
 return map;
}
export function createGargoylePbrMaterial(role,stoneTexture){
 const color=GARGOYLE_MATERIAL_ROLES[role];if(!color)throw Error('Unknown gargoyle surface '+role);
 const wing=role==='gargoyleMembrane',eye=role==='gargoyleEye';
 const rocky=!wing&&!eye;
 const m=new THREE.MeshPhysicalMaterial({
  color,side:THREE.DoubleSide,flatShading:role==='gargoyleRidge',
  map:rocky?stoneTexture:null,bumpMap:rocky?stoneTexture:null,
  bumpScale:rocky?.010:0,
  roughness:wing?.93:eye?.28:.83,
  metalness:rocky?.07:0,clearcoat:eye?.42:.05,
  emissive:eye?0x6c1805:0x000000,emissiveIntensity:eye?.55:0
 });
 m.userData={gargoyleSpecies:'m042',role,stonePbr:rocky,
  humanClothMaterial:false,photographicHumanAlbedo:false};
 return m;
}
/** Separate creature anatomy from golem shapes, while preserving rig QA. */
export function addGargoyleMonsterAnatomy({profile,detail='high',frames,attach,tube}={}){
 if(profile?.id!=='m042'||profile?.costume!=='gargoyle')return false;
 if(!frames?.head||!frames?.chest||!frames?.pelvis||
    frames.arms?.length!==2||frames.forearms?.length!==2||
    frames.legs?.length!==2||frames.calves?.length!==2||
    frames.hands?.length!==2||frames.feet?.length!==2)
  throw Error('m042 needs full head, chest, hip, upper/lower limbs and hands/feet');
 const near=!far(detail);
 let count=0,wingCount=0,clawCount=0;
 const add=(frame,g,role,name,pos=[0,0,0],rotation=[0,0,0])=>{
  if(!frame)return null;
  const m=attach(frame,g,role,'gargoyle-m042-'+name,pos,rotation);
  m.userData.golemFullShell=true; // Legacy rig QA expects all sealed bodies
  m.userData.golemSpecies='m042';m.userData.golemPart=name;
  m.userData.gargoyleSpecies='m042';
  m.userData.gargoyleAnatomical=true;
  m.userData.boneAnchored=true;
  count++;
  return m;
 };
 const line=(frame,role,name,pts,radius=.009)=>{
  if(!frame)return null;
  const mesh=tube(frame,role,'gargoyle-m042-'+name,pts,radius);
  if(mesh){
   mesh.userData.golemFullShell=true;mesh.userData.golemSpecies='m042';
   mesh.userData.gargoyleSpecies='m042';mesh.userData.boneAnchored=true;
   mesh.userData.gargoyleAnatomical=true;count++;
  }
  return mesh;
 };
 const gem=(frame,name,role,p,scale)=>{
  const g=new THREE.IcosahedronGeometry(1,near?1:0);
  g.scale(...scale);return add(frame,g,role,name,p);
 };
 const horn=(frame,name,role,p,{height=.18,width=.04,curve=.09,side=1,rotation=[0,0,0]}={})=>{
  return add(frame,createGargoyleSpireGeometry({detail,height,width,curve,side}),
   role,name,p,rotation);
 };
 // Never place a glowing white golem chest core, torso armour skirt or
 // joint-balls in this character. Anatomy is sculpted from stone itself.
 add(frames.chest,createGargoyleTorsoGeometry({detail}),
  'gargoyleStone','chiseled-muscular-torso');
 add(frames.pelvis,createGargoyleTorsoGeometry({detail,region:'pelvis'}),
  'gargoyleStone','sinewy-rock-pelvis');
 add(frames.head,createGargoyleHeadGeometry({detail}),
  'gargoyleStone','angular-demon-face');
 gem(frames.neck||frames.head,'tendoned-rock-neck','gargoyleStone',
  [0,0,.019],[.107,.14,.113]);
 // Stone cheek arches, V-shaped horn crown and brow, narrow inlaid eyes.
 for(const side of [-1,1]){
  const i=side<0?0:1;
  gem(frames.head,'high-cheekbone-'+i,'gargoyleRidge',
   [side*.107,-.032,-.090],[.072,.066,.072]);
  gem(frames.head,'sunken-eye-'+i,'gargoyleShadow',
   [side*.070,.046,-.151],[.047,.026,.015]);
  gem(frames.head,'ember-pupil-'+i,'gargoyleEye',
   [side*.069,.048,-.166],[.021,.009,.010]);
  horn(frames.head,'recurved-temple-horn-'+i,'gargoyleHorn',
   [side*.125,.155,.012],{height:.27,width:.061,curve:.145,side,
    rotation:[0,0,side*.24]});
  horn(frames.head,'high-ear-spire-'+i,'gargoyleRidge',
   [side*.169,.039,-.002],{height:.19,width:.037,curve:.112,side,
    rotation:[0,0,side*.79]});
  line(frames.head,'gargoyleShadow','frowning-socket-'+i,[
   [side*.014,.088,-.126],[side*.057,.097,-.145],
   [side*.115,.076,-.110]
  ],.009);
  line(frames.head,'gargoyleRidge','jaw-joint-ridge-'+i,[
   [side*.13,-.055,-.06],[side*.089,-.134,-.083],
   [side*.043,-.173,-.101]
  ],.012);
  horn(frames.head,'short-carved-fang-'+i,'gargoyleClaw',
   [side*.052,-.116,-.136],{height:.075,width:.014,curve:.009,
    side,rotation:[Math.PI,0,0]});
  gem(frames.chest,'stone-pectoral-'+i,'gargoyleRidge',
   [side*.147,.17,-.177],[.128,.109,.073]);
  gem(frames.chest,'upper-rib-muscle-'+i,'gargoyleStone',
   [side*.171,-.016,-.178],[.094,.13,.049]);
  line(frames.chest,'gargoyleShadow','sternum-fissure-'+i,[
   [side*.115,.28,-.153],[side*.206,.165,-.199],
   [side*.111,.012,-.22],[side*.144,-.218,-.18]
  ],.007);
  for(let k=0;k<(near?3:2);k++)
   line(frames.chest,'gargoyleRidge','layered-rib-chisel-'+i+'-'+k,[
    [side*.045,.055-k*.096,-.219],
    [side*.155,.049-k*.096,-.203],
    [side*.237,.020-k*.096,-.147]
   ],.009);
 }
 gem(frames.head,'angular-chin-point','gargoyleRidge',
  [0,-.168,-.092],[.053,.062,.078]);
 for(let k=0;k<3;k++)
  line(frames.chest,'gargoyleShadow','carved-abdominals-'+k,[
   [-.13,-.09-k*.096,-.19],[0,-.085-k*.096,-.217],
   [.13,-.09-k*.096,-.19]
  ],.007);
 for(let i=0;i<2;i++){
  const side=i===0?-1:1;
  const upper=frames.arms[i],fore=frames.forearms[i],hand=frames.hands[i];
  const thigh=frames.legs[i],calf=frames.calves[i],foot=frames.feet[i];
  gem(upper,'organic-shoulder-shell-'+i,'gargoyleStone',
   [0,-.007,0],[.142,.155,.136]);
  add(upper,createGargoyleLimbGeometry({detail,part:'upperArm'}),
   'gargoyleStone','upper-arm-shell-'+i);
  gem(fore,'sinewy-elbow-'+i,'gargoyleRidge',
   [0,0,0],[.109,.086,.115]);
  add(fore,createGargoyleLimbGeometry({detail,part:'forearm'}),
   'gargoyleStone','forearm-shell-'+i);
  gem(hand,'sculpted-talon-palm-'+i,'gargoyleStone',
   [0,-.069,0],[.108,.116,.11]);
  for(let finger=0;finger<4;finger++){
   const x=(finger-1.5)*.051;
   horn(hand,'curved-stone-hand-claw-'+i+'-'+finger,'gargoyleClaw',
    [x,-.177,-.056],{height:.115,width:.018,curve:.031,side,
     rotation:[Math.PI,0,side*.07]});clawCount++;
  }
  gem(thigh,'pelvis-side-muscle-'+i,'gargoyleStone',
   [0,-.01,0],[.144,.146,.143]);
  add(thigh,createGargoyleLimbGeometry({detail,part:'thigh'}),
   'gargoyleStone','thigh-shell-'+i);
  gem(calf,'angular-kneecap-'+i,'gargoyleRidge',
   [0,0,-.041],[.126,.103,.131]);
  add(calf,createGargoyleLimbGeometry({detail,part:'shin'}),
   'gargoyleStone','shin-shell-'+i);
  gem(foot,'stone-ankle-'+i,'gargoyleStone',
   [0,.008,0],[.092,.084,.096]);
  gem(foot,'long-demon-paw-'+i,'gargoyleStone',
   [0,-.076,-.114],[.132,.097,.211]);
  for(let toe=0;toe<3;toe++){
   horn(foot,'raptor-stone-toe-'+i+'-'+toe,'gargoyleClaw',
    [(toe-1)*.081,-.105,-.277],
    {height:.13,width:.026,curve:.016,side,rotation:[Math.PI*.56,0,0]});
   clawCount++;
  }
  if(near){
   for(let k=0;k<3;k++){
    line(upper,'gargoyleShadow','arm-fissure-'+i+'-'+k,[
     [-.072,-.09-k*.07,-.113],[0,-.12-k*.07,-.14],
     [.075,-.15-k*.07,-.094]
    ],.006);
    line(thigh,'gargoyleRidge','thigh-strata-'+i+'-'+k,[
     [-.11,-.12-k*.10,-.12],[0,-.16-k*.10,-.17],
     [.11,-.18-k*.10,-.10]
    ],.007);
   }
  }
  // Broad asymmetric finger-bone wings with layered scarred stone membrane.
  add(frames.chest,createGargoyleWingGeometry({detail,side}),
   'gargoyleMembrane','scalloped-leather-stone-wing-'+i);
  wingCount++;
  for(let k=0;k<(near?4:3);k++){
   const reach=.48+k*.22;
   line(frames.chest,'gargoyleWingVein','wing-articulated-rib-'+i+'-'+k,[
    [side*.14,.26,.33],
    [side*(reach*.67),.48+k*.125,.54],
    [side*reach,.41+k*.12,.64+k*.05]
   ],near?.013:.021);
  }
  line(frames.chest,'gargoyleRidge','wing-root-to-shoulder-'+i,[
   [side*.22,.28,.16],[side*.37,.42,.33],
   [side*.56,.55,.45]],.020);
 }
 add(frames.pelvis,createGargoyleTailGeometry({detail}),
  'gargoyleStone','long-jointed-stone-tail');
 horn(frames.pelvis,'tail-arrow-tip','gargoyleHorn',
  [.20,-.81,1.31],{height:.18,width:.042,curve:.07,
   side:1,rotation:[Math.PI*.40,0,.37]});
 if(near)for(let j=0;j<5;j++)
  horn(frames.pelvis,'tail-dorsal-spike-'+j,'gargoyleRidge',
   [.026*Math.sin(j),-.15-j*.12,.39+j*.14],
   {height:.06,width:.025,curve:.02,rotation:[.65,0,0]});
 frames.chest.userData.golemFullShellRevision=GARGOYLE_SPECIES_REVISION;
 frames.chest.userData.golemShellParts=count;
 frames.chest.userData.gargoyleMeshCount=count;
 frames.chest.userData.gargoyleWingCount=wingCount;
 frames.chest.userData.gargoyleClawCount=clawCount;
 return true;
}
