/**
 * High-detail procedural world-object sculptures.
 *
 * All shapes are real 3D geometry (not billboards or humanoid substitutes).
 * The same blueprint generates close and distant LODs. A species/LOD/part
 * becomes ONE merged geometry, shared by every instance on the battlefield.
 * +Z is the creature's forward direction, Y is up.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CREATURE_VISUAL_SPECS = Object.freeze({
  wolf: Object.freeze({ label:'灰狼', anatomy:'quadruped', skin:0x71808a, shadow:0x38444e, highlight:0xa9b5ba, eyes:0xf5bd67, height:.76, width:.39, length:.78, legs:.61, tail:1.0, wing:0 }),
  wyvern: Object.freeze({ label:'飛竜', anatomy:'wyvern', skin:0x626c91, shadow:0x2c3658, highlight:0xb1aec6, eyes:0xffa25b, height:1.37, width:.52, length:1.03, legs:.96, tail:1.75, wing:2.12 }),
  dragon: Object.freeze({ label:'古竜', anatomy:'dragon', skin:0x427765, shadow:0x244d48, highlight:0x8eb89b, eyes:0xffbf5d, height:1.68, width:.73, length:1.34, legs:1.04, tail:2.24, wing:2.5 }),
  elder_dragon: Object.freeze({ label:'天竜', anatomy:'dragon', skin:0xb99c66, shadow:0x65523e, highlight:0xf3dcab, eyes:0x8fd9fa, height:1.76, width:.82, length:1.5, legs:1.12, tail:2.57, wing:3.03 }),
  horse: Object.freeze({ label:'軍馬', anatomy:'mount', skin:0x81553e, shadow:0x342724, highlight:0xc99b6a, eyes:0x261f1d, height:1.22, width:.43, length:.99, legs:1.07, tail:1.12, wing:0 }),
});

const P=(x,y,z)=>new THREE.Vector3(x,y,z);
const colorOf=(value)=>new THREE.Color(value);

function assemble(detail) {
  const parts = new Map();
  const add=(name,geometry,tint)=>{
    if(!parts.has(name)) parts.set(name,[]);
    const geo=geometry.toNonIndexed();
    geometry.dispose();
    if(!geo.getAttribute('uv')) geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count*2),2));
    const color=colorOf(tint),count=geo.getAttribute('position').count,colors=new Float32Array(count*3);
    for(let i=0;i<count;i++) { colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b; }
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    parts.get(name).push(geo);
  };
  const sphere=(name,tint,x,y,z,sx,sy,sz,rotX=0)=>{
    const geo=new THREE.SphereGeometry(1,detail==='high'?20:10,detail==='high'?14:8);
    geo.scale(sx,sy,sz);
    if(rotX) geo.rotateX(rotX);
    geo.translate(x,y,z); add(name,geo,tint);
  };
  const segment=(name,tint,start,end,r0,r1)=>{
    const startPoint=Array.isArray(start)?P(...start):start;
    const endPoint=Array.isArray(end)?P(...end):end;
    const axis=endPoint.clone().sub(startPoint),length=axis.length();
    const geo=new THREE.CylinderGeometry(r1,r0,length,detail==='high'?10:6,detail==='high'?4:1,false);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(P(0,1,0),axis.normalize()));
    geo.translate(...startPoint.clone().add(endPoint).multiplyScalar(.5).toArray());
    add(name,geo,tint);
  };
  const horn=(name,tint,base,tip,radius)=>{
    const a=P(...base),b=P(...tip),axis=b.clone().sub(a),len=axis.length();
    const geo=new THREE.ConeGeometry(radius,len,detail==='high'?8:5,detail==='high'?3:1);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(P(0,1,0),axis.clone().normalize()));
    geo.translate(...a.addScaledVector(axis,.5).toArray());add(name,geo,tint);
  };
  const curved=(name,tint,points,radii)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>P(...p)));
    const steps=detail==='high'?18:8,radial=detail==='high'?9:5;
    const geo=new THREE.TubeGeometry(curve,steps,1,radial,false);
    const a=geo.getAttribute('position');
    for(let j=0;j<=steps;j++){
      const t=j/steps,point=curve.getPointAt(t);
      const scaled=t*(radii.length-1),i=Math.min(radii.length-2,Math.floor(scaled));
      const fraction=scaled-i,r=radii[i]*(1-fraction)+radii[i+1]*fraction;
      for(let k=0;k<=radial;k++){
        const index=j*(radial+1)+k;
        a.setXYZ(index,point.x+(a.getX(index)-point.x)*r,point.y+(a.getY(index)-point.y)*r,point.z+(a.getZ(index)-point.z)*r);
      }
    }
    geo.computeVertexNormals();add(name,geo,tint);
  };
  const wing=(name,tint,shadow,attach,span,handed)=>{
    // Five finger-like wing ribs and truly scalloped membrane panels.
    // The wing mesh is local to its shoulder pivot for independent flapping.
    const fingers=[
      [span*.94,span*.21,span*.22],
      [span*.99,span*.09,-span*.16],
      [span*.84,-span*.045,-span*.52],
      [span*.59,-span*.11,-span*.78],
      [span*.28,-span*.16,-span*.89],
    ];
    const root=[0,0,0],elbow=[span*.35,span*.18,-span*.03];
    const positions=[],uvs=[],colors=[],triangles=[];
    const rim=colorOf(tint),deep=colorOf(shadow);
    const push=(p,u,v,gradient)=>{
      positions.push(handed*p[0],p[1],p[2]);uvs.push(u,v);
      const c=deep.clone().lerp(rim,gradient);colors.push(c.r,c.g,c.b);
      return positions.length/3-1;
    };
    const steps=detail==='high'?9:4,across=detail==='high'?8:3;
    for(let f=0;f<fingers.length-1;f++){
      const first=fingers[f],last=fingers[f+1],start=positions.length/3;
      for(let i=0;i<=steps;i++){
        const t=i/steps;
        for(let j=0;j<=across;j++){
          const q=j/across;
          const target=[first[0]*(1-q)+last[0]*q,first[1]*(1-q)+last[1]*q,first[2]*(1-q)+last[2]*q];
          // Membrane bends along each finger and between the ribs.
          const droop=-.17*Math.sin(Math.PI*q)*t*t*span;
          push([target[0]*t,target[1]*t+droop+.08*Math.sin(Math.PI*t)*span,target[2]*t],t,q,.38+.33*t+.15*Math.cos(q*Math.PI));
        }
      }
      for(let i=0;i<steps;i++)for(let j=0;j<across;j++){
        const a=start+i*(across+1)+j,b=a+1,c=a+across+1,d=c+1;
        triangles.push(a,c,b,b,c,d);
      }
    }
    const membrane=new THREE.BufferGeometry();
    membrane.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    membrane.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    membrane.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    membrane.setIndex(triangles);membrane.computeVertexNormals();
    // This geometry already owns its gradient vertex colours, so add directly.
    if(!parts.has(name)) parts.set(name,[]);
    parts.get(name).push(membrane.toNonIndexed());membrane.dispose();
    const signed=point=>[handed*point[0],point[1],point[2]];
    curved(name,tint,[root,elbow,fingers[0]].map(signed),[.105,.095,.012]);
    for(let f=1;f<fingers.length;f++) curved(name,tint,[root,[span*.25,span*.08,-span*.02],fingers[f]].map(signed),[.07,.055,.012]);
    return {pivot:P(...attach)};
  };
  const finish=()=>{
    const result={};
    for(const [name,geos] of parts){
      // All features, including wing membranes, must own identical attributes.
      const merged=mergeGeometries(geos,false);
      if(!merged) throw Error('召喚獣の部品統合に失敗: '+name);
      // Keep the smooth normals of each organic patch. Recomputing them
      // after de-indexing would turn every curved surface into hard facets.
      merged.computeBoundingSphere();
      for(const geo of geos) geo.dispose();
      result[name]=merged;
    }
    return result;
  };
  return {add,sphere,segment,horn,curved,wing,finish};
}

function addCoatSculpture(g,type,s,detail){
  const {sphere,horn}=g;
  const {skin,highlight,shadow,width:w,length:l,height:h,legs}=s;
  // Shoulder mass, ribcage, pelvis and underside form a continuous silhouette.
  sphere('core',skin,0,h,0,w,h*.39,l);
  sphere('core',skin,0,h+.07,l*.47,w*.9,h*.43,l*.48);
  sphere('core',shadow,0,h-.27,l*.06,w*.79,h*.2,l*.75);
  sphere('core',highlight,0,h-.07,l*.8,w*.53,h*.26,l*.38);
  const headY=type==='wolf'?h+.31:h+.60,headZ=l+ (type==='wolf'?.37:.65);
  const neckStart=[0,h+.13,l*.55],neckEnd=[0,headY-.13,headZ-.26];
  g.curved('core',skin,[neckStart,[0,h+.34,l*.8],neckEnd],[w*.54,w*.48,w*.38]);
  sphere('core',skin,0,headY,headZ,w*.63,h*.32,l*.48);
  sphere('core',highlight,0,headY-.12,headZ+l*.38,w*.42,h*.17,l*.41);
  sphere('core',shadow,0,headY-.24,headZ+l*.28,w*.39,h*.07,l*.42);
  for(const side of [-1,1]){
    // Facial structure and eyes remain recognisable from the game camera.
    sphere('core',shadow,side*w*.45,headY+.035,headZ+l*.32,w*.13,h*.13,l*.13);
    sphere('core',s.eyes,side*w*.5,headY+.045,headZ+l*.40,w*.078,h*.09,l*.07);
    sphere('core',0xf7f5ed,side*w*.53,headY+.071,headZ+l*.448,w*.029,h*.035,l*.025);
    horn('core',shadow,[side*w*.36,headY+.18,headZ-.1],[side*w*.49,headY+(type==='wolf'?.64:.48),headZ-.19],w*.22);
  }
  sphere('core',shadow,0,headY-.05,headZ+l*.76,w*.23,h*.14,l*.12);
  // Individual tufts at the mane, shoulders and tail root; more at close LOD.
  if(detail==='high') for(let i=0;i<54;i++){
    const t=(i%18)/17,side=Math.floor(i/18)-1,z=l*.62-t*l*1.5;
    const top=h+h*.35*Math.sqrt(Math.max(.05,1-(z/(l*1.25))**2));
    const x=side*w*.36,tip=[x*(1.05+.12*Math.sin(i*1.9)),top+.11+.14*Math.sin(i*6.1)**2,z-.12];
    horn('core',i%4===0?highlight:skin,[x,top-.11,z],tip,.055);
  }
  // Four jointed, non-human legs. Each can move independently in GPU instances.
  for(const side of [-1,1])for(const front of [true,false]){
    const name=`leg${front?'Front':'Back'}${side===-1?'L':'R'}`;
    const x=side*w*.7,z=(front?.64:-.68)*l;
    const kneeY=legs*.46,kneeZ=z+(front?-.1:.18);
    sphere(name,skin,x,legs*.79,z,w*.37,legs*.37,w*.39);
    g.curved(name,skin,[[x,legs*.85,z],[x*1.02,kneeY,kneeZ],[x,legs*.17,z+(front?.07:-.05)]],[w*.27,w*.17,w*.12]);
    sphere(name,shadow,x,legs*.12,z+.08,w*.25,legs*.14,w*.32);
    for(let c=-1;c<=1;c++)horn(name,type==='wolf'?0xddd9ce:0x302f32,[x+c*w*.15,legs*.09,z+w*.25],[x+c*w*.15,legs*.055,z+w*.49],w*.045);
  }
  const tailRoot=[0,h+.10,-l*.8];
  g.curved('tail',skin,[tailRoot,[0,h+.21,-l*1.1],[0,h+.43,-l*(1.35+s.tail*.23)],[0,h+.3,-l*(1.45+s.tail*.4)]],[w*.22,w*.23,w*.17,.025]);
  sphere('tail',highlight,0,h+.35,-l*(1.39+s.tail*.36),w*.18,h*.23,l*.25);
  if(type==='wolf' && detail==='high')for(let i=0;i<26;i++){
    const a=i*2.399,z=-l*(1.36+s.tail*.30),r=.16+.065*(i%3);
    horn('tail',i%3===0?highlight:skin,[Math.cos(a)*r,h+.33+Math.sin(a)*r,z],[Math.cos(a)*r*1.65,h+.33+Math.sin(a)*r*1.55,z-.17],.055);
  }
}

function addHorse(g,s,detail){
  const {sphere,curved,segment,horn}=g;
  const {skin,shadow,highlight,width:w,length:l,height:h}=s;
  sphere('core',skin,0,h,0,w,h*.38,l);
  sphere('core',skin,0,h+.01,-l*.65,w*.98,h*.41,l*.46);
  sphere('core',highlight,0,h-.2,l*.38,w*.74,h*.15,l*.42);
  curved('core',skin,[[0,h+.07,l*.58],[0,h+.32,l*.89],[0,h+.79,l*1.05]],[w*.49,w*.40,w*.28]);
  sphere('core',skin,0,h+.79,l*1.07,w*.50,.33,.46,-.22);
  sphere('core',highlight,0,h+.54,l*1.39,w*.34,.19,.41,-.12);
  sphere('core',shadow,0,h+.5,l*1.68,w*.32,.13,.13);
  for(const side of [-1,1]){
    horn('core',skin,[side*w*.29,h+.93,l*.93],[side*w*.41,h+1.28,l*.95],w*.15);
    sphere('core',shadow,side*w*.47,h+.8,l*1.30,w*.12,.09,.09);
    sphere('core',0xebca93,side*w*.52,h+.82,l*1.32,w*.04,.03,.03);
    sphere('core',shadow,side*w*.21,h+.51,l*1.73,w*.11,.045,.045);
  }
  for(let i=0;i<(detail==='high'?24:8);i++){
    const z=l*.87-i*.055;
    horn('core',i%4===0?0x4e3930:shadow,[(i%3-1)*w*.13,h+.86-i*.026,z],[(i%3-1)*w*.19,h+1.05-i*.022,z-.25],.065);
  }
  // Leather saddle is actual separate equipment geometry on the horse object.
  sphere('core',0x372c2b,0,h+.42,-.16,w*.9,.13,l*.41);
  sphere('core',0x946745,0,h+.53,-.18,w*.67,.065,l*.32);
  segment('core',0x56392c,[0,h+.40,-.46],[0,h-.22,-.46],.035,.035);
  for(const side of [-1,1])for(const front of [true,false]){
    const name=`leg${front?'Front':'Back'}${side===-1?'L':'R'}`;
    const x=side*w*.73,z=(front?.66:-.69)*l;
    const knee=[x,s.legs*.48,z+(front?.07:.14)];
    sphere(name,skin,x,s.legs*.91,z,w*.34,.31,w*.35);
    curved(name,skin,[[x,s.legs*.97,z],knee,[x,s.legs*.12,z+.07]],[w*.22,w*.13,w*.10]);
    sphere(name,shadow,x,.105,z+.14,w*.26,.13,w*.33);
    sphere(name,highlight,x,.16,z+.16,w*.23,.035,w*.29);
  }
  curved('tail',shadow,[[0,h+.20,-l*.9],[0,h+.08,-l*1.23],[0,h-.29,-l*1.44],[0,h-.48,-l*1.4]],[w*.19,.20,.16,.025]);
  if(detail==='high')for(let i=0;i<16;i++){
    horn('tail',shadow,[Math.sin(i*2.4)*.09,h-.09,-l*1.2],[Math.sin(i*2.4)*.15,h-.49-(i%3)*.07,-l*1.4],.04);
  }
}

function addDragon(g,type,s,detail){
  const {sphere,curved,horn,wing}=g;
  const {skin,shadow,highlight,width:w,length:l,height:h,legs,tail,anatomy}=s;
  const elder=type==='elder_dragon',wyvern=anatomy==='wyvern';
  sphere('core',skin,0,h,0,w,h*.38,l);
  sphere('core',skin,0,h+.14,l*.43,w*.82,h*.37,l*.68);
  sphere('core',shadow,0,h-.32,l*.2,w*.79,h*.17,l*.74);
  sphere('core',highlight,0,h-.14,l*.78,w*.57,h*.23,l*.49);
  const headY=h+(wyvern?.52:.81),headZ=l*1.32;
  curved('core',skin,[[0,h+.1,l*.60],[0,h+.27,l*.91],[0,headY-.16,headZ]],[w*.53,w*.43,w*.33]);
  sphere('core',skin,0,headY,headZ,w*.53,h*.21,l*.40);
  sphere('core',highlight,0,headY-.11,headZ+l*.33,w*.42,h*.13,l*.53);
  sphere('core',shadow,0,headY-.22,headZ+l*.30,w*.41,h*.07,l*.45);
  for(const side of [-1,1]){
    sphere('core',shadow,side*w*.41,headY+.05,headZ+l*.22,w*.16,.10,.15);
    sphere('core',s.eyes,side*w*.5,headY+.06,headZ+l*.26,w*.09,.075,.075);
    sphere('core',0xffffff,side*w*.54,headY+.08,headZ+l*.29,w*.028,.024,.024);
    horn('core',shadow,[side*w*.35,headY+.15,headZ-.13],[side*w*.73,headY+(elder?.98:.63),headZ-l*(elder?.61:.4)],w*.20);
    horn('core',highlight,[side*w*.39,headY-.08,headZ+l*.35],[side*w*.56,headY+.04,headZ+l*.67],w*.085);
    for(let tooth=0;tooth<4;tooth++) horn('core',0xeedec0,[side*w*(.19+tooth*.05),headY-.17,headZ+l*(.34+tooth*.07)],[side*w*(.19+tooth*.05),headY-.3,headZ+l*(.37+tooth*.07)],w*.045);
  }
  // Dragon silhouettes: overlapping dorsal spikes, articulated tails,
  // and independent wings on the shoulders; wyverns have only two legs.
  const spineCount=detail==='high'?21:10;
  for(let i=0;i<spineCount;i++){
    const t=i/(spineCount-1),z=-l*.82+t*l*2.16;
    const top=h+h*.38*Math.sqrt(Math.max(.06,1-(z/(l*1.65))**2));
    horn('core',i%3===0?highlight:shadow,[0,top-.05,z],[0,top+(elder?.39:.23)*(1-t*.38),z-.11],w*.18*(1-t*.48));
  }
  if(detail==='high'){
    // Discrete layered scales, not a flat texture: 14 longitudinal rows.
    for(let row=0;row<14;row++)for(let col=0;col<18;col++){
      const t=(row+.4)/14,z=-l*.92+t*l*1.8;
      const angle=(col+.5*(row%2))/18*Math.PI*2;
      const envelope=Math.sqrt(Math.max(.1,1-(z/(l*1.2))**2));
      const x=w*envelope*Math.cos(angle),y=h+h*.385*envelope*Math.sin(angle);
      // Skip underside and forward face, retaining layered lateral armour.
      if(Math.sin(angle)<-.4 || Math.abs(z)>.94*l) continue;
      const up=Math.max(.04,Math.sin(angle));
      horn('core',col%4===0?highlight:skin,[x,y,z],[x*1.07,y+up*.032,z-.12],w*.055);
    }
  }
  for(const side of [-1,1])for(const front of (wyvern?[false]:[true,false])){
    const name=`leg${front?'Front':'Back'}${side===-1?'L':'R'}`;
    const x=side*w*.74,z=(front?.61:-.69)*l;
    sphere(name,skin,x,legs*.87,z,w*.35,.35,w*.43);
    curved(name,skin,[[x,legs*.91,z],[x*1.16,legs*.48,z+(front?-.04:.19)],[x,legs*.16,z+.21]],[w*.31,w*.21,w*.12]);
    sphere(name,shadow,x,.14,z+.31,w*.29,.13,w*.34);
    for(let c=-1;c<=1;c++) horn(name,0xddd8c3,[x+c*w*.15,.11,z+.50],[x+c*w*.17,.08,z+.73],w*.066);
  }
  curved('tail',skin,[[0,h,-l*.88],[0,h+.19,-l*1.38],[0,h+.08,-l*2.0],[0,h+.35,-l*(2+tail*.33)]],[w*.48,w*.34,w*.19,.018]);
  if(detail==='high')for(let i=0;i<11;i++){
    const z=-l*(1.3+i*.10),y=h+.17-i*.003;
    horn('tail',highlight,[0,y,z],[0,y+.23*(1-i/14),z-.11],w*.13*(1-i/13));
  }
  for(const side of [-1,1]){
    const attach=[side*w*.71,h+.24,-l*.12],name=side===-1?'wingL':'wingR';
    wing(name,skin,shadow,attach,s.wing,side);
    // Shape is model-local; placing the pivot is a renderer responsibility.
  }
  if(elder){
    for(const side of [-1,1]){
      horn('core',0xf4e6b8,[side*w*.24,headY+.2,headZ-.2],[side*w*.37,headY+1.18,headZ-.57],w*.11);
      horn('core',0xd4b96b,[side*w*.49,h+.13,l*.24],[side*w*.80,h+.47,l*.27],w*.13);
    }
    // Crown and glowing runic chest plates, still part of the shared mesh.
    for(let i=0;i<7;i++)sphere('core',i%2?0xa3e7f4:0xe5cf8b,0,h-.18-i*.058,l*(.90-i*.07),w*(.24+.012*i),.032,.048);
  }
}

function addExplosive(g,type){
  const {add}=g;
  const body=new THREE.CylinderGeometry(.28,.31,.63,12);
  body.translate(0,.33,0);add('core',body,type==='trap'?0x67483e:0xa13d2c);
  const cap=new THREE.CylinderGeometry(.34,.34,.08,12);
  cap.translate(0,.66,0);add('core',cap,0x31353a);
  g.horn('core',0xf3b658,[0,.70,0],[0,1.02,0],.07);
}

export function buildCombatObjectGeometry(type,{detail='high'}={}){
  if(!['high','low'].includes(detail)) throw Error('不正なLOD: '+detail);
  const g=assemble(detail);
  if(type==='trap'||type==='dynamite') addExplosive(g,type);
  else {
    const s=CREATURE_VISUAL_SPECS[type];
    if(!s)throw Error('未登録の召喚・騎乗オブジェクト: '+type);
    if(type==='wolf') addCoatSculpture(g,type,s,detail);
    else if(type==='horse') addHorse(g,s,detail);
    else addDragon(g,type,s,detail);
  }
  return g.finish();
}
