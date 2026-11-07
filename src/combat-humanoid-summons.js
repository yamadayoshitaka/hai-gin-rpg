/**
 * Original humanoid familiar sculptures: an adult forest archer and a winged
 * guardian. Shared parts are assembled once per species/LOD and instanced.
 * Axes: +Y up, +Z front; moving wings are LOCAL to their shoulder pivots.
 */
import * as THREE from 'three';

function feather(g,name,side,a,b,width,color,detail='high'){
  const points=[],uvs=[],faces=[],stepCount=detail==='high'?16:8;
  const acrossSections=detail==='high'?4:2;
  const delta=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
  const across=new THREE.Vector3(-delta.y,delta.x,0).normalize();
  for(let i=0;i<=stepCount;i++){
    const t=i/stepCount,w=width*Math.pow(Math.sin(Math.PI*t),.85);
    for(let j=0;j<=acrossSections;j++){
      const v=2*j/acrossSections-1;
      points.push(a[0]+delta.x*t+across.x*w*v,
        a[1]+delta.y*t+across.y*w*v,
        a[2]+delta.z*t-.045*Math.sin(Math.PI*t)*(1-v*v));
      uvs.push(t,j/acrossSections);
    }
  }
  for(let i=0;i<stepCount;i++)for(let j=0;j<acrossSections;j++){
    const k=i*(acrossSections+1)+j, n=k+acrossSections+1;
    faces.push(k,n,k+1,k+1,n,n+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(faces);geometry.computeVertexNormals();
  g.add(name,geometry,color);
}

function buildWings(g,detail){
  const fine=detail==='high';
  for(const side of [-1,1]){
    const part=side<0?'wingL':'wingR';
    const ivory=0xf6f1df,shade=0xc7c5bb,tip=0xe3ddd1;
    // Each wing is attached independently to its scapula, with flight
    // feathers layered above a second overlapping row of coverts.
    g.curved(part,ivory,[[0,0,0],[side*.55,.65,-.13],
      [side*1.25,1.55,-.19],[side*2.00,1.75,-.21]],[.16,.14,.09,.018]);
    const count=fine?34:11;
    for(let i=0;i<count;i++){
      const t=i/(count-1),angle=t*Math.PI*.83;
      const start=[side*(.23+1.13*t),.36+1.18*Math.sin(angle*.87),-.21];
      const end=[side*(.43+2.43*t),1.75+1.5*Math.sin(angle)-1.12*t,-.28-.20*t];
      feather(g,part,side,start,end,(fine?.09:.13)*(1+.28*Math.sin(Math.PI*t)),
        i%4===0?shade:i%3===0?tip:ivory,detail);
    }
    for(let i=0;i<(fine?29:7);i++){
      const t=i/((fine?29:7)-1);
      const start=[side*(.12+1.1*t),.34+.97*t,-.13];
      const end=[side*(.23+1.54*t),.95+1.01*t,-.14];
      feather(g,part,side,start,end,fine?.075:.11,i%3===0?shade:ivory,detail);
    }
    // Small overlapping tertiary coverts close gaps along the shoulder
    // and blend the photographic linen detail into the feather edge.
    if(fine)for(let i=0;i<19;i++){
      const t=i/18;
      const start=[side*(.09+.90*t),.30+.71*t,-.10];
      const end=[side*(.25+1.10*t),.64+.86*t,-.14];
      feather(g,part,side,start,end,.065,i%4===0?shade:ivory,detail);
    }
  }
}

function addFace(g,{angel,detail}){
  const skin=angel?0xe9cfc1:0xe4b9a1,shade=angel?0xc8a99d:0xb48a76;
  const hair=angel?0xc99e63:0xd7b04d,highlight=angel?0xe6ca9c:0xffdd81;
  const eyes=angel?0x667d9c:0x388a65;
  const {sphere,curved,segment,horn}=g;
  // An adult proportional skull rather than oversized button eyes.
  // A separate part allows the existing low-LOD/offline face to remain
  // visible until the CC0 anatomical face library has loaded.
  sphere('faceFallback',skin,0,2.34,.085,.185,.248,.17);
  sphere('faceFallback',shade,0,2.18,.145,.145,.07,.13);
  sphere('faceFallback',skin,0,2.29,.246,.054,.09,.055);
  horn('faceFallback',shade,[0,2.29,.25],[0,2.19,.29],.027);
  for(const side of [-1,1]){
    sphere('faceFallback',0x3b302b,side*.078,2.365,.241,.048,.018,.018);
    sphere('faceFallback',eyes,side*.078,2.369,.256,.024,.013,.007);
    sphere('faceFallback',shade,side*.08,2.394,.258,.060,.012,.019);
    sphere('faceFallback',skin,side*.184,2.33,.05,.047,.092,.041);
    if(!angel){
      // The base of each ear is buried beneath hair, not pasted visibly to
      // the outside of the anatomical donor cheek.
      sphere('core',skin,side*.17,2.35,.035,.084,.10,.077);
      horn('core',skin,[side*.19,2.36,.035],[side*.41,2.51,-.04],.053);
      curved('core',hair,[[side*.09,2.56,.07],[side*.20,2.43,.08],
        [side*.23,2.34,.025]],[.055,.045,.012]);
    }
  }
  segment('faceFallback',0x926f64,[-.06,2.175,.259],[.06,2.175,.259],.008,.008);
  sphere('core',hair,0,2.545,.03,.205,.095,.19);
  const strands=detail==='high'?(angel?28:36):10;
  for(let i=0;i<strands;i++){
    const a=i/strands*Math.PI*2,side=Math.sin(a),back=Math.cos(a);
    const x=.16*side,z=.03+.14*back;
    curved('core',i%5===0?highlight:hair,
      [[x*.7,2.56,z],[x*1.15,2.31,z-.06],[x*1.4,1.98,z-.18],
      [x*1.8,angel?1.74:1.66,z-.25]],
      [.040,.035,.025,.002]);
  }
  for(let i=0;i<(detail==='high'?9:3);i++){
    const t=i/8;
    curved('core',i%3===0?highlight:hair,
      [[-.14+t*.25,2.59,.09],[-.13+t*.23,2.49,.25],
        [-.10+t*.20,2.37,.26]], [.035,.026,.002]);
  }
  if(angel){
    const halo=new THREE.TorusGeometry(.36,.032,detail==='high'?8:5,
      detail==='high'?44:18);
    halo.rotateX(Math.PI/2);halo.translate(0,2.89,-.08);
    g.add('core',halo,0xf7df9e);
  }else{
    // A restrained elven leaf circlet and emerald, not a copied card design.
    curved('core',0x58764b,[[-.19,2.52,.12],[0,2.58,.25],[.19,2.52,.12]],
      [.018,.023,.018]);
    sphere('core',0x3ca283,0,2.555,.244,.045,.075,.025);
  }
}

function addClothing(g,{angel,detail}){
  const {sphere,verticalProfile,curved,segment,horn}=g;
  const fabric=angel?0xe3e1db:0x416943;
  const dark=angel?0xb5b5b2:0x304336;
  const trim=angel?0xf0d8b6:0xb4b16c;
  verticalProfile('core',fabric,[
    [.30,0,-.05,.34,.25],[.54,0,-.05,.36,.28],
    [1.00,0,-.02,.30,.23],[1.30,0,0,.27,.23],
    [1.50,0,.02,.30,.23],[1.72,0,.04,.36,.24],
    [1.91,0,.03,.25,.19],[2.08,0,.045,.15,.14],
    [2.13,0,.055,.135,.125]
  ]);
  // Raised, sculpted neckline hides the donor-head/body junction without
  // scaling the head or painting an opaque sphere over the face. The collar
  // physically overlaps the chin base and follows the tapered shoulders.
  verticalProfile('core',dark,[
    [1.94,0,.03,.235,.185],[2.035,0,.046,.20,.16],
    [2.11,0,.065,.167,.141],[2.165,0,.072,.155,.129]
  ]);
  for(const side of [-1,1]){
    curved('core',trim,[[side*.27,1.965,.11],[side*.18,2.085,.17],
      [side*.14,2.16,.16]],[.032,.020,.012]);
  }
  // Separate broad cloth panels and physical seams give the garment
  // depth without allocating a mesh per creature instance.
  for(let i=0;i<(detail==='high'?12:5);i++){
    const a=i/(detail==='high'?12:5)*Math.PI*2;
    curved('core',i%3===0?trim:dark,[
      [.16*Math.cos(a),1.34,.14*Math.sin(a)],
      [.27*Math.cos(a),.86,.24*Math.sin(a)],
      [.36*Math.cos(a),.36,.25*Math.sin(a)]],
      [.024,.018,.008]);
  }
  sphere('core',trim,0,1.70,.265,.07,.09,.03);
  segment('core',trim,[-.32,1.40,.235],[.32,1.40,.235],.024,.024);
  if(angel){
    verticalProfile('core',0xf1eae5,[
      [.20,0,-.04,.34,.27],[.59,0,0,.37,.29],
      [1.07,0,.02,.29,.22],[1.40,0,.03,.26,.20]]);
    for(const side of [-1,1]){
      curved('core',0xeeddbf,[[side*.2,1.83,.19],[side*.08,1.55,.29],
        [side*.25,1.18,.22]],[.023,.016,.005]);
    }
  }else{
    // Functional leather quiver and a green layered leaf cloak.
    sphere('core',0x503a29,-.23,1.63,-.31,.12,.38,.13,-.2);
    for(let i=0;i<(detail==='high'?8:4);i++){
      const x=-.31+(i%4)*.055;
      segment('core',0xb49a6f,[x,1.72,-.30],[x,2.10+(i%3)*.06,-.34],.011,.011);
    }
    for(let i=0;i<(detail==='high'?8:4);i++){
      const a=i/(detail==='high'?8:4)*Math.PI;
      const x=.37*Math.cos(a);
      curved('core',i%2?0x548e4d:0x759c59,
        [[x*.55,1.87,-.16],[x,1.25,-.36],[x*1.3,.64,-.42]],
        [.11,.077,.005]);
    }
  }
  // Adult shoulder sockets and tapered forearms; each arm is an animated part.
  for(const side of [-1,1]){
    const name=side<0?'armL':'armR';
    const x=side*.33;
    sphere(name,angel?0xefebe4:0x384a37,x,1.84,.03,.145,.18,.16);
    segment(name,angel?0xe5dfd8:0x5b6146,
      [x,1.81,.035],[side*.51,1.40,.19],.105,.070);
    sphere(name,angel?0xe8cfbe:0xcba88c,side*.52,1.34,.21,.074,.13,.076);
    for(let j=0;j<4;j++){
      segment(name,angel?0xe8cfbe:0xcba88c,
        [side*(.48+j*.027),1.27,.245],[side*(.49+j*.027),1.16,.32],
        .015,.01);
    }
  }
}

function addLegs(g,{angel}){
  const {sphere,segment,joint}=g;
  for(const side of [-1,1]){
    const part=side<0?'legBackL':'legBackR',x=side*.16;
    sphere(part,angel?0xe5e2df:0x5b563c,x,1.03,-.045,.16,.24,.18);
    segment(part,angel?0xd9d5cf:0x615a41,[x,1.0,-.025],
      [side*.18,.54,.015],.123,.092);
    joint(part,angel?0xd6c4b1:0x675b49,side*.18,.54,.03,.112,.12,.12);
    segment(part,angel?0xe5e1de:0x654e39,
      [side*.18,.52,.01],[side*.17,.11,.075],.095,.065);
    sphere(part,angel?0xf0e8df:0x3d342c,side*.17,.11,.20,.115,.09,.21);
  }
}

function addBow(g,detail){
  const {curved,segment,horn,sphere}=g;
  const woods=0x67482a,metal=0xc5c6b8;
  // The weapon remains on the left arm pivot; attack animation draws the bow.
  curved('armL',woods,[[-.53,.91,.28],[-.71,1.24,.36],
    [-.80,1.65,.26],[-.72,2.05,.36],[-.52,2.37,.25]],
    [.024,.036,.039,.034,.013]);
  segment('armL',0xe5dbc4,[-.52,2.37,.25],[-.53,.91,.28],.009,.009);
  sphere('armL',0x9b8559,-.80,1.65,.26,.035,.18,.045);
  // Drawn arrow: shaft + shaft feathering + shaped metal point.
  segment('armR',woods,[.48,1.55,.28],[-.76,1.55,.35],.011,.011);
  horn('armR',metal,[-.77,1.55,.35],[-1.05,1.55,.36],.06);
  for(const a of [-1,1])
    horn('armR',0xd7d8c7,[.39,1.55,.28],[.56,1.55+a*.06,.31],.030);
  if(detail==='high')for(let i=0;i<8;i++)
    sphere('equipment',0xc5a26d,-.74,1.63+(i-4)*.025,.31,.010,.011,.015);
}

export function addHumanoidSummon(g,type,s,detail){
  const angel=type==='seraph_guardian';
  if(type!=='seraph_guardian'&&type!=='forest_archer')
    throw Error('未登録の人型召喚獣: '+type);
  const options={angel,detail};
  addClothing(g,options);
  addLegs(g,options);
  addFace(g,options);
  if(angel)buildWings(g,detail);
  else addBow(g,detail);
}
