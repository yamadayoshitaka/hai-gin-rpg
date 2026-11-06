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
  wolf: Object.freeze({ label:'灰狼', anatomy:'quadruped', skin:0x65717a, shadow:0x303942, highlight:0x94a0a5, eyes:0x9b2027, height:.76, width:.39, length:.78, legs:.61, tail:1.0, wing:0 }),
  wyvern: Object.freeze({ label:'飛竜', anatomy:'wyvern', skin:0x4e566d, shadow:0x273347, highlight:0x9292a3, eyes:0xb32620, height:1.37, width:.52, length:1.03, legs:.96, tail:1.75, wing:2.12 }),
  dragon: Object.freeze({ label:'古竜', anatomy:'dragon', skin:0x376050, shadow:0x1a3b37, highlight:0x759a86, eyes:0xb52018, height:1.68, width:.73, length:1.34, legs:1.04, tail:2.24, wing:2.5 }),
  elder_dragon: Object.freeze({ label:'天竜', anatomy:'dragon', skin:0xa1885c, shadow:0x534636, highlight:0xdbc49b, eyes:0x871522, height:1.76, width:.82, length:1.5, legs:1.12, tail:2.57, wing:3.03 }),
  horse: Object.freeze({ label:'軍馬', anatomy:'mount', skin:0x6f4a39, shadow:0x2f2520, highlight:0x9d7a5c, eyes:0x381b1b, height:1.22, width:.43, length:.99, legs:1.07, tail:1.12, wing:0 }),
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
  const joint=(name,tint,x,y,z,sx,sy,sz)=>{
    // Smooth shaded, low-vertex anatomical fillet instead of a separate
    // expensive high-detail sphere for every socket, knee and tendon.
    const geo=new THREE.SphereGeometry(1,detail==='high'?14:8,detail==='high'?10:6);
    geo.scale(sx,sy,sz);geo.translate(x,y,z);add(name,geo,tint);
  };
  const eyeSlit=(name,tint,side,x,y,z,halfLength,halfHeight,slope=0)=>{
    // Low-relief, pointed almond surface running down the animal's cheek.
    // A sphere catches a round highlight and makes an adult predator cute;
    // this thin non-bulging aperture sits inside its sculpted eyelid.
    const along=detail==='high'?24:12,across=detail==='high'?7:4;
    const vertices=[],uvs=[],triangles=[];
    for(let i=0;i<=along;i++){
      const t=i/along,point=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.72);
      for(let j=0;j<=across;j++){
        const v=j/across*2-1;
        // Shallow convex cornea: enough curvature to catch a light streak,
        // without restoring the protruding spherical cartoon eyeball.
        vertices.push(side*(x+.0035*(1-v*v)*point),
          y+slope*(t-.5)+v*halfHeight*point,z+(t*2-1)*halfLength);
        uvs.push(t,j/across);
      }
    }
    for(let i=0;i<along;i++)for(let j=0;j<across;j++){
      const a=i*(across+1)+j,b=a+1,c=a+across+1,d=c+1;
      if(side>0)triangles.push(a,c,b,b,c,d);
      else triangles.push(a,b,c,b,d,c);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geo.setIndex(triangles);geo.computeVertexNormals();add(name,geo,tint);
  };
  const profile=(name,tint,sections)=>{
    // The main silhouette comes from anatomical cross sections, rather than
    // overlapping balls. Subdividing THESE surfaces yields smaller polygons
    // without making the creature's head or limbs look round and toy-like.
    const radial=detail==='high'?32:12,subdivisions=detail==='high'?4:1;
    const points=[],uv=[],indices=[];
    const curve=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+
      (2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
    const sectionAt=(i,t)=>sections[i].map((_,dim)=>{
      const before=sections[Math.max(0,i-1)][dim],start=sections[i][dim];
      const end=sections[i+1][dim],after=sections[Math.min(sections.length-1,i+2)][dim];
      return detail==='high'?curve(before,start,end,after,t):start*(1-t)+end*t;
    });
    const rings=(sections.length-1)*subdivisions+1;
    for(let ring=0;ring<rings;ring++){
      const idx=Math.min(sections.length-2,Math.floor(ring/subdivisions));
      const t=ring===rings-1?1:(ring%subdivisions)/subdivisions;
      const [z,y,rx,ry]=sectionAt(idx,t);
      for(let angle=0;angle<=radial;angle++){
        const a=2*Math.PI*angle/radial;
        points.push(Math.cos(a)*Math.max(.003,rx),y+Math.sin(a)*Math.max(.003,ry),z);
        uv.push(angle/radial,ring/(rings-1));
      }
    }
    for(let ring=0;ring<rings-1;ring++)for(let angle=0;angle<radial;angle++){
      const a=ring*(radial+1)+angle,b=a+1,c=a+radial+1,d=c+1;
      indices.push(a,b,c,b,d,c);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(indices);geo.computeVertexNormals();add(name,geo,tint);
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
  return {add,sphere,joint,eyeSlit,profile,segment,horn,curved,wing,finish};
}

function addCoatSculpture(g,type,s,detail){
  const {sphere,joint,eyeSlit,profile,horn,curved}=g;
  const {skin,highlight,shadow,width:w,length:l,height:h,legs}=s;
  // Lean wolf silhouette: narrow tucked abdomen, high shoulder and pelvis.
  profile('core',skin,[
    [-l*1.14,h+.08,.01,.05],[-l*.92,h+.045,w*.65,h*.27],
    [-l*.65,h+.035,w*.84,h*.34],[-l*.26,h-.025,w*.78,h*.30],
    [l*.18,h-.025,w*.84,h*.31],[l*.57,h+.065,w*.99,h*.39],
    [l*.85,h+.09,w*.72,h*.31],[l*1.03,h+.05,.012,.06],
  ]);
  const headY=h+.275,headZ=l+.32;
  const neckStart=[0,h+.13,l*.55],neckEnd=[0,headY-.13,headZ-.26];
  g.curved('core',skin,[neckStart,[0,h+.34,l*.8],neckEnd],[w*.54,w*.48,w*.38]);
  // Adult wolf: small wedge-shaped cranium, long nasal bridge, tight jaw.
  // The head is not a puppy-sized sphere attached to the shoulders.
  profile('core',skin,[
    [headZ-l*.43,headY-.045,.012,.04],[headZ-l*.22,headY,w*.43,h*.19],
    [headZ,headY+.012,w*.46,h*.205],[headZ+l*.22,headY-.052,w*.365,h*.145],
    [headZ+l*.51,headY-.13,w*.255,h*.091],
    [headZ+l*.71,headY-.15,w*.20,h*.074],
    [headZ+l*.81,headY-.17,.009,.022],
  ]);
  profile('jaw',shadow,[
    [headZ+l*.13,headY-.21,.01,.017],[headZ+l*.36,headY-.225,w*.28,h*.052],
    [headZ+l*.64,headY-.216,w*.20,h*.035],
    [headZ+l*.77,headY-.23,.008,.013],
  ]);
  for(const side of [-1,1]){
    // Black tear-duct to rear corner: the eyes are deep, angry slits with no
    // round eyeball or bright glint. The brow overhangs the recessed iris.
    eyeSlit('core',shadow,side,w*.396,headY+.020,headZ+l*.205,l*.082,h*.017,-.018);
    eyeSlit('eyes',s.eyes,side,w*.401,headY+.020,headZ+l*.208,l*.050,h*.008,-.012);
    eyeSlit('eyes',0x121517,side,w*.407,headY+.019,headZ+l*.213,l*.015,h*.007,-.004);
    if(detail==='high')eyeSlit('eyes',0xc9ada8,side,w*.414,headY+.027,headZ+l*.180,l*.012,h*.0016,-.002);
    horn('core',shadow,[side*w*.29,headY+.14,headZ-.1],
      [side*w*.39,headY+.43,headZ-.19],w*.105);
    if(detail==='high'){
      curved('core',shadow,[[side*w*.34,headY+.070,headZ+l*.09],
        [side*w*.411,headY+.049,headZ+l*.21],
        [side*w*.365,headY+.031,headZ+l*.31]],[.027,.022,.007]);
      horn('core',highlight,[side*w*.32,headY+.17,headZ-.13],
        [side*w*.385,headY+.41,headZ-.16],w*.060);
      for(let tooth=0;tooth<5;tooth++)horn('jaw',0xece9d9,
        [side*w*.23,headY-.21,headZ+l*(.36+tooth*.078)],
        [side*w*.23,headY-.115,headZ+l*(.37+tooth*.078)],w*.045);
    }
  }
  sphere('core',shadow,0,headY-.15,headZ+l*.78,w*.205,h*.077,l*.06);
  for(const side of [-1,1]){
    horn('jaw',0xf5eadd,[side*w*.22,headY-.21,headZ+l*.47],[side*w*.22,headY-.09,headZ+l*.53],w*.065);
    if(detail==='high')for(let i=0;i<6;i++){
      const whiskerZ=headZ+l*(.46+i*.045);
      horn('core',i%2?highlight:shadow,[side*w*.40,headY-.12,whiskerZ],[side*w*.68,headY-.16+(i%2)*.07,whiskerZ+.12],.009);
    }
  }
  // Leather seat with a raised front pommel and side straps. A rider is a
  // regular soldier in a separate scene node, never merged into the wolf.
  sphere('core',0x3f3332,0,h+.36,-l*.12,w*.86,.095,l*.43);
  sphere('core',0x966b48,0,h+.44,-l*.12,w*.68,.052,l*.32);
  for(const side of [-1,1])g.curved('core',0x4f3930,[
    [side*w*.58,h+.38,-l*.26],[side*w*.89,h+.08,-l*.23],[side*w*.86,h-.30,-l*.22]],[.038,.033,.027]);
  // Individual tufts at the mane, shoulders and tail root; more at close LOD.
  if(detail==='high') for(let i=0;i<54;i++){
    const t=(i%18)/17,side=Math.floor(i/18)-1,z=l*.62-t*l*1.5;
    const top=h+h*.35*Math.sqrt(Math.max(.05,1-(z/(l*1.25))**2));
    const x=side*w*.36,tip=[x*(1.05+.12*Math.sin(i*1.9)),top+.11+.14*Math.sin(i*6.1)**2,z-.12];
    horn('core',i%4===0?highlight:skin,[x,top-.11,z],tip,.055);
  }
  if(detail==='high'){
    // Small overlapping fur guards follow the actual elliptical ribcage.
    // They remain one merged GPU mesh, even for dozens of summoned wolves.
    for(let ring=0;ring<18;ring++)for(let around=0;around<20;around++){
      const z=-l*.83+(ring+.3)/18*l*1.72;
      const angle=(around+(ring%2)*.5)*Math.PI/10;
      const envelope=Math.sqrt(Math.max(.06,1-(z/(l*1.24))**2));
      if(Math.sin(angle)<-.27)continue;
      const x=w*envelope*Math.cos(angle),y=h+h*.38*envelope*Math.sin(angle);
      const length=.078+.039*((ring*17+around*7)%5)/4;
      const direction=Math.sign(x)||1;
      horn('core',(around+ring)%9===0?highlight:(around+ring)%7===0?shadow:skin,
        [x,y,z],[x+direction*.025,y+.034,z-length],.017);
    }
    // Cheek ruff and an inner surface make the face read as fur, not plastic.
    for(const side of [-1,1]){
      sphere('core',skin,side*w*.31,headY+.22,headZ-.13,w*.10,.072,.026);
      for(let i=0;i<21;i++){
        const z=headZ-l*.18+i*.024,y=headY-.08+Math.sin(i*.45)*.12;
        horn('core',i%6===0?highlight:skin,[side*w*.36,y,z],
          [side*w*(.47+(.032*Math.sin(i*2.3))),y-.065,z-.13],.017);
      }
    }
  }
  // Four jointed, non-human legs. Each can move independently in GPU instances.
  for(const side of [-1,1])for(const front of [true,false]){
    const name=`leg${front?'Front':'Back'}${side===-1?'L':'R'}`;
    const x=side*w*.7,z=(front?.64:-.68)*l;
    const kneeY=legs*.46,kneeZ=z+(front?-.1:.18);
    // Buried upper tendons plus overlapping shoulder/haunch skin hide the
    // body's rigid-mesh seam even when the four limbs swing independently.
    joint('core',skin,side*w*.61,h-.115,z,w*.40,h*.265,l*.27);
    joint(name,skin,x,legs*.88,z,w*.33,legs*.42,w*.34);
    g.curved(name,skin,[[x,h-.01,z],[x*1.02,kneeY,kneeZ],[x,legs*.17,z+(front?.07:-.05)]],[w*.25,w*.17,w*.12]);
    joint(name,skin,x*1.02,kneeY,kneeZ,w*.18,legs*.14,w*.19);
    sphere(name,shadow,x,legs*.12,z+.08,w*.25,legs*.14,w*.32);
    for(let c=-1;c<=1;c++)horn(name,type==='wolf'?0xddd9ce:0x302f32,[x+c*w*.15,legs*.09,z+w*.25],[x+c*w*.15,legs*.055,z+w*.49],w*.045);
  }
  const tailRoot=[0,h+.10,-l*.8];
  g.curved('tail',skin,[tailRoot,[0,h+.21,-l*1.1],[0,h+.43,-l*(1.35+s.tail*.23)],[0,h+.3,-l*(1.45+s.tail*.4)]],[w*.22,w*.23,w*.17,.025]);
  profile('tail',skin,[
    [-l*(1.62+s.tail*.39),h+.29,.006,.014],
    [-l*(1.47+s.tail*.34),h+.36,w*.12,h*.14],
    [-l*(1.23+s.tail*.25),h+.28,w*.17,h*.19],
    [-l*1.15,h+.20,.012,.06],
  ]);
  if(type==='wolf' && detail==='high')for(let i=0;i<26;i++){
    const a=i*2.399,z=-l*(1.36+s.tail*.30),r=.16+.065*(i%3);
    horn('tail',i%3===0?highlight:skin,[Math.cos(a)*r,h+.33+Math.sin(a)*r,z],[Math.cos(a)*r*1.65,h+.33+Math.sin(a)*r*1.55,z-.17],.055);
  }
}

function addHorse(g,s,detail){
  const {sphere,joint,eyeSlit,profile,curved,segment,horn}=g;
  const {skin,shadow,highlight,width:w,length:l,height:h}=s;
  // Horse conformation: defined with a realistic long topline, deep chest,
  // tucked flank, angular shoulder and a full but not spherical croup.
  profile('core',skin,[
    [-l*1.18,h+.04,.01,.04],[-l*.99,h+.06,w*.70,h*.26],
    [-l*.77,h+.055,w*.99,h*.39],[-l*.35,h-.015,w*.90,h*.355],
    [l*.05,h-.045,w*.84,h*.345],[l*.46,h-.015,w*.89,h*.39],
    [l*.72,h,w*.96,h*.43],[l*.94,h-.04,w*.55,h*.26],
    [l*1.04,h-.07,.012,.06],
  ]);
  // Neck rises from the shoulders; the mature horse has a relatively SMALL
  // angular skull, a long nasal bridge and a narrow, firm muzzle. Keep the
  // head's mass much smaller than the torso to avoid a friendly pony look.
  profile('core',skin,[
    [l*.47,h+.12,w*.31,h*.26],[l*.65,h+.25,w*.42,h*.35],
    [l*.82,h+.48,w*.34,h*.32],[l*1.04,h+.70,w*.26,h*.25],
    [l*1.18,h+.75,w*.165,.105],
  ]);
  profile('core',skin,[
    [l*.82,h+.735,.025,.035],[l*1.04,h+.76,w*.335,.178],
    [l*1.23,h+.735,w*.345,.168],[l*1.40,h+.625,w*.285,.132],
    [l*1.60,h+.50,w*.208,.100],[l*1.71,h+.46,w*.206,.082],
    [l*1.79,h+.45,.012,.023],
  ]);
  profile('jaw',0x4b3430,[
    [l*1.18,h+.46,.012,.020],[l*1.38,h+.432,w*.235,.057],
    [l*1.60,h+.395,w*.22,.046],[l*1.74,h+.398,.012,.014],
  ]);
  for(const side of [-1,1]){
    // Horse eyes are dark recessed ALMONDS with a heavier upper lid. An
    // eyeball bead, bright reflection or oversized cheek patch reads as cute.
    horn('core',skin,[side*w*.245,h+.85,l*.99],
      [side*w*.345,h+1.065,l*1.01],w*.071);
    horn('core',0x4b3430,[side*w*.254,h+.88,l*1.01],
      [side*w*.342,h+1.054,l*1.02],w*.027);
    // Horses have horizontal pupils. Keep the aperture beneath a heavy lid
    // and flush with the skull: a shiny spherical button looks like a pony.
    eyeSlit('core',shadow,side,w*.348,h+.735,l*1.232,.061,.014,-.010);
    eyeSlit('eyes',s.eyes,side,w*.356,h+.732,l*1.236,.040,.006,-.006);
    eyeSlit('eyes',0x080707,side,w*.360,h+.730,l*1.241,.026,.003,-.005);
    if(detail==='high')eyeSlit('eyes',0xb4a29d,side,w*.372,h+.738,l*1.210,.010,.0015,-.002);
    sphere('core',shadow,side*w*.198,h+.48,l*1.64,w*.045,.015,.047);
    if(detail==='high'){
      sphere('core',0x79564a,side*w*.251,h+.974,l*.991,w*.026,.065,.010);
      // Bit, noseband, cheek strap, brass fasteners, and a rein extending
      // towards the saddle are real 3D curves rather than painted lines.
      curved('core',0x3c2822,[[side*w*.33,h+.68,l*1.24],
        [side*w*.27,h+.47,l*1.45],[side*w*.26,h+.40,l*1.60]],
        [.023,.020,.014]);
      curved('core',0x523428,[[side*w*.26,h+.44,l*1.46],
        [side*w*.38,h+.64,l*.99],[side*w*.69,h+.47,l*.35],
        [side*w*.69,h+.22,-l*.12]],[.016,.015,.014,.013]);
      sphere('core',0x9f8a68,side*w*.275,h+.45,l*1.46,.025,.021,.019);
      sphere('core',0x9f8a68,side*w*.38,h+.64,l*.99,.024,.021,.020);
      // Brow ridge, long tear-trough and long nasal cartilage, not a ball head.
      curved('core',shadow,[[side*w*.30,h+.795,l*1.15],
        [side*w*.370,h+.760,l*1.23],[side*w*.31,h+.741,l*1.315]],
        [.022,.021,.004]);
      curved('core',highlight,[[side*w*.30,h+.69,l*1.26],
        [side*w*.285,h+.63,l*1.39],[side*w*.22,h+.52,l*1.58]],
        [.010,.009,.004]);
      sphere('core',0x281a18,side*w*.17,h+.468,l*1.68,.013,.010,.024);
    }
  }
  for(let i=0;i<(detail==='high'?110:14);i++){
    const f=i/(detail==='high'?109:13),z=l*1.04-f*l*.54;
    const spread=(i%5-2)*w*.062;
    const crestY=h+.75-f*.56;
    horn('core',i%9===0?highlight:(i%3===0?0x4e3930:shadow),
      [spread,crestY,z],[spread+Math.sin(i*2.4)*.046,crestY+.04-f*.03,z-.20-f*.05],
      detail==='high'?.014:.034);
  }
  // Leather saddle is actual separate equipment geometry on the horse object.
  sphere('core',0x372c2b,0,h+.42,-.16,w*.9,.13,l*.41);
  sphere('core',0x946745,0,h+.53,-.18,w*.67,.065,l*.32);
  segment('core',0x56392c,[0,h+.40,-.46],[0,h-.22,-.46],.035,.035);
  if(detail==='high'){
    for(const side of [-1,1]){
      sphere('core',skin,side*w*.56,h+.03,l*.56,w*.27,h*.24,l*.29);
      sphere('core',skin,side*w*.58,h-.07,-l*.66,w*.28,h*.25,l*.25);
      curved('core',0x3f2b26,[[side*w*.83,h+.40,-.39],
        [side*w*.97,h+.09,-.36],[side*w*.81,h-.27,-.36]],
        [.052,.046,.035]);
      // Real stirrup below the saddle, with leather hanger and metal footrest.
      curved('core',0xb2a5a0,[[side*w*.88,h-.20,-.30],
        [side*w*1.02,h-.34,-.31],[side*w*.92,h-.40,-.26],
        [side*w*.80,h-.34,-.21]], [.025,.027,.025,.017]);
      sphere('core',0xd9bb72,side*w*.91,h+.42,-.16,.048,.04,.046);
      curved('core',0x4b3129,[[side*w*.56,h+.26,l*.54],
        [side*w*.88,h-.17,l*.50],[side*w*.57,h-.29,l*.48]],
        [.053,.04,.034]);
      // Fine hairlines and coat-direction highlights along the flanks.
      for(let row=0;row<10;row++)for(let col=0;col<9;col++){
        const z=-l*.71+(col+.5)*l*.17;
        const y=h-.1+(row-4.5)*.065;
        const envelope=Math.sqrt(Math.max(.03,1-((y-h)/(h*.46))**2-(z/(l*1.24))**2));
        if(envelope<.35)continue;
        const x=side*w*envelope*.96;
        horn('core',(row+col)%7===0?highlight:skin,[x,y,z],
          [x+side*.015,y+.007,z-.057],.007);
      }
    }
    // Subtle nasal blaze stays flush with the bridge (no domed forehead).
    sphere('core',highlight,0,h+.77,l*1.35,w*.07,.029,.020);
  }
  for(const side of [-1,1])for(const front of [true,false]){
    const name=`leg${front?'Front':'Back'}${side===-1?'L':'R'}`;
    const x=side*w*.73,z=(front?.66:-.69)*l;
    const shoulder=[x,s.legs*(front?1.18:1.20),z-(front?.05:.10)];
    const knee=[x,s.legs*(front?.58:.69),z+(front?.025:.24)];
    const hock=front?knee:[x,s.legs*.37,z-.25];
    const fetlock=[x,.21,z+(front?.13:.07)];
    // Muscle sockets overlap the torso while the actual limb swings. A
    // subtle thigh-to-knee taper replaces flat capped cylinder junctions.
    joint('core',skin,side*w*.57,h-.075,z,w*.36,h*.31,l*.30);
    joint(name,skin,x,s.legs*1.06,z-.045,w*.31,s.legs*.23,l*.19);
    // Long cannon bones and a bent hind hock are essential to a convincing
    // horse. Rounded stumps read as a pony; tapered skeletal limbs do not.
    segment(name,skin,shoulder,knee,w*(front?.29:.36),w*.16);
    if(!front)segment(name,skin,knee,hock,w*.15,w*.12);
    segment(name,skin,hock,fetlock,w*.105,w*.071);
    joint(name,skin,...knee,w*.166,s.legs*.106,w*.155);
    if(!front)joint(name,skin,...hock,w*.118,s.legs*.085,w*.128);
    const toeZ=z+(front?.19:.12);
    const hoof=new THREE.CylinderGeometry(w*.235,w*.295,.16,8,1);
    hoof.scale(.94,1,1.28);
    hoof.translate(x,.095,toeZ);
    g.add(name,hoof,0x302923);
    // A thin coronet band separates the hairline from the hoof wall.
    const coronet=new THREE.CylinderGeometry(w*.218,w*.232,.035,9,1);
    coronet.scale(.99,1,1.24);coronet.translate(x,.177,toeZ);
    g.add(name,coronet,shadow);
    if(detail==='high'){
      curved(name,highlight,[[x-side*.04,s.legs*.55,z],
        [x-side*.04,s.legs*.33,z+.03],[x-side*.02,.22,z+.10]],
        [.016,.012,.006]);
      // Metallic horseshoe rims around each actual hoof.
      const shoe=new THREE.TorusGeometry(w*.22,.014,6,20,Math.PI*1.68);
      shoe.rotateX(-Math.PI/2);
      shoe.translate(x,.028,toeZ);
      g.add(name,shoe,0x958c81);
    }
  }
  curved('tail',shadow,[[0,h+.20,-l*.9],[0,h+.08,-l*1.23],[0,h-.29,-l*1.44],[0,h-.48,-l*1.4]],[w*.19,.20,.16,.025]);
  if(detail==='high')for(let i=0;i<86;i++){
    const angle=i*2.399,r=.035+(i%9)*.011;
    horn('tail',i%9===0?highlight:shadow,
      [Math.cos(angle)*r,h-.08+Math.sin(angle)*r,-l*1.20],
      [Math.cos(angle)*r*1.45,h-.52-(i%7)*.018,-l*(1.39+(i%5)*.025)],.018);
  }
}

function addDragon(g,type,s,detail){
  const {sphere,joint,eyeSlit,profile,curved,segment,horn,wing}=g;
  const {skin,shadow,highlight,width:w,length:l,height:h,legs,tail,anatomy}=s;
  const elder=type==='elder_dragon',wyvern=anatomy==='wyvern';
  profile('core',skin,[
    [-l*1.21,h+.07,.01,.045],[-l*.96,h+.04,w*.59,h*.29],
    [-l*.68,h+.02,w*.93,h*.36],[-l*.26,h-.015,w*.94,h*.36],
    [l*.16,h+.025,w*.89,h*.39],[l*.52,h+.125,w*.87,h*.41],
    [l*.80,h+.08,w*.70,h*.36],[l*1.03,h+.02,.018,.065],
  ]);
  const headY=h+(wyvern?.44:.66),headZ=l*1.31;
  curved('core',skin,[[0,h+.1,l*.60],[0,h+.27,l*.91],[0,headY-.16,headZ]],[w*.53,w*.43,w*.33]);
  // Adult reptilian proportions: reduce the oversized skull and eye socket,
  // lengthen the sharp nasal bridge relative to the cranium. The jaw has
  // independent volume; small eyelids replace cartoon-like round orbs.
  // Long predatory skull, angular brow, tapered snout and a separate jaw.
  profile('core',skin,[
    [headZ-l*.37,headY-.035,.014,.044],
    [headZ-l*.12,headY+.025,w*.385,h*.164],
    [headZ+l*.11,headY+.03,w*.42,h*.172],
    [headZ+l*.30,headY-.04,w*.34,h*.125],
    [headZ+l*.55,headY-.107,w*.255,h*.087],
    [headZ+l*.79,headY-.125,w*.196,h*.073],
    [headZ+l*.88,headY-.126,.008,.020],
  ]);
  profile('jaw',shadow,[
    [headZ+l*.10,headY-.218,.014,.020],
    [headZ+l*.37,headY-.238,w*.29,h*.066],
    [headZ+l*.65,headY-.235,w*.207,h*.048],
    [headZ+l*.85,headY-.22,.008,.014],
  ]);
  profile('jaw',0x743d3b,[
    [headZ+l*.29,headY-.19,.008,.009],
    [headZ+l*.51,headY-.192,w*.18,h*.012],
    [headZ+l*.69,headY-.184,.01,.009],
  ]);
  for(const side of [-1,1]){
    eyeSlit('core',shadow,side,w*.393,headY+.054,headZ+l*.193,l*.065,.013,-.013);
    eyeSlit('eyes',s.eyes,side,w*.398,headY+.052,headZ+l*.199,l*.039,.008,-.009);
    // A narrow upright reptilian pupil sits inside the heavy overhanging lid.
    eyeSlit('eyes',0x111615,side,w*.404,headY+.052,headZ+l*.203,l*.008,.007,-.002);
    if(detail==='high')eyeSlit('eyes',0xd8aaa4,side,w*.414,headY+.060,headZ+l*.178,l*.010,.0015,-.002);
    horn('core',shadow,[side*w*.29,headY+.12,headZ-.13],[side*w*.62,headY+(elder?.83:.54),headZ-l*(elder?.51:.36)],w*.175);
    horn('core',highlight,[side*w*.33,headY-.08,headZ+l*.34],[side*w*.47,headY+.01,headZ+l*.61],w*.073);
    for(let tooth=0;tooth<4;tooth++) horn('jaw',0xeedec0,[side*w*(.19+tooth*.05),headY-.23,headZ+l*(.34+tooth*.07)],[side*w*(.19+tooth*.05),headY-.12,headZ+l*(.37+tooth*.07)],w*.045);
    if(detail==='high'){
      // Sculpted eyebrow ridge, nostril and lower-jaw fangs: a recognisable
      // face even with the mouth open for its animated elemental breath.
      curved('core',shadow,[[side*w*.27,headY+.115,headZ+.06],
        [side*w*.42,headY+.083,headZ+l*.18],[side*w*.38,headY+.050,headZ+l*.31]],
        [.042,.034,.008]);
      sphere('core',shadow,side*w*.18,headY-.098,headZ+l*.745,w*.047,.021,.038);
      for(let fang=0;fang<7;fang++){
        const z=headZ+l*(.23+fang*.073),offset=side*w*(.23+fang*.007);
        horn('jaw',0xf3e9d6,[offset,headY-.245,z],
          [offset*.98,headY-.36-(fang%3)*.025,z+.018],w*.040);
      }
      curved('core',shadow,[[side*w*.34,headY-.12,headZ-l*.1],
        [side*w*.64,headY-.06,headZ-l*.34],
        [side*w*.72,headY+.12,headZ-l*.48]],
        [w*.085,w*.066,.012]);
    }
  }
  if(detail==='high'){
    // Flexible segmented throat armour and raised shoulder scutes create
    // depth when the creature pitches its head during the breath wind-up.
    for(let i=0;i<10;i++){
      const t=i/9,z=l*(.61+t*.63),y=h+.05+t*(headY-h)*.55;
      sphere('core',i%3===0?highlight:shadow,0,y-.2,z,w*(.49-t*.16),.04,l*.065);
    }
    for(const side of [-1,1])for(let i=0;i<9;i++){
      const z=l*(.23-i*.14),x=side*w*(.63+.06*Math.cos(i*.6));
      sphere('core',i%3===0?highlight:skin,x,h+.18,z,w*.16,.055,l*.11);
      horn('core',shadow,[x,h+.23,z],[x*1.12,h+.35+(i%3)*.035,z-.1],w*.09);
    }
  }
  // Visible dorsal barding: a continuous dark leather blanket under the
  // throne plus overlapping bronze/iron side plates. Previously the tiny
  // saddle left most of the dragon's back looking entirely bare from above.
  sphere('core',0x342f32,0,h+h*.38,-l*.19,w*1.05,.09,l*.72);
  sphere('core',elder?0xbba170:0x586b74,0,h+h*.44,-l*.19,w*.88,.055,l*.56);
  for(const side of [-1,1])for(let plate=0;plate<7;plate++){
    const z=-l*.70+plate*l*.17;
    sphere('core',plate%2?(elder?0x8c7450:0x45545e):(elder?0xc1a269:0x85949b),
      side*w*.55,h+h*.415,z,w*.37,.055,l*.11);
  }
  // Real seat, girth, raised pommel and stirrup mounts on the dragon's spine.
  sphere('core',0x3e3434,0,h+h*.42,-l*.17,w*.77,.115,l*.34);
  sphere('core',elder?0xcdad68:0x906e4a,0,h+h*.47,-l*.17,w*.63,.055,l*.28);
  sphere('core',0x4e3832,0,h+h*.54,l*.03,w*.66,.08,.12);
  for(const side of [-1,1]){
    curved('core',0x4b3631,[[side*w*.60,h+h*.38,-l*.2],[side*w*.89,h+.13,-l*.2],[side*w*.83,h-.30,-l*.16]],[.045,.037,.025]);
    if(detail==='high'){
      sphere('core',0xd4bc87,side*w*.85,h+.05,-l*.17,w*.09,.07,.07);
      for(let j=0;j<5;j++)horn('core',highlight,[side*w*.35,headY*.85,headZ*.62+j*.12],[side*w*.56,headY*.85+.08,headZ*.65+j*.12],w*.09);
    }
  }
  if(detail==='high')for(let i=0;i<9;i++){
    const z=l*(.22+i*.11);
    sphere('core',i%2?highlight:skin,0,h-h*.27-i*.012,z,w*(.54-i*.013),.042,l*.075);
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
    const hip=[x,legs*1.18,z-.1],elbow=[x*1.10,legs*.59,z+(front?-.03:.20)];
    const ankle=[x,legs*.17,z+.24];
    joint('core',skin,side*w*.61,h-.10,z,w*.38,h*.29,l*.28);
    joint(name,skin,x,legs*1.05,z-.10,w*.32,legs*.30,l*.18);
    segment(name,skin,hip,elbow,w*.35,w*.22);
    segment(name,skin,elbow,ankle,w*.20,w*.115);
    joint(name,skin,...elbow,w*.21,legs*.15,w*.22);
    const foot=new THREE.CylinderGeometry(w*.245,w*.31,.19,7,1);
    foot.scale(1,1,1.25);foot.translate(x,.115,z+.32);g.add(name,foot,shadow);
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
    if(detail==='high')for(let i=0;i<12;i++){
      const angle=i*Math.PI*2/12;
      sphere('core',i%2?0xb2eaf5:0xf3d89e,
        Math.sin(angle)*w*.48,h+.14+Math.cos(angle)*h*.38,-l*.08,
        .045,.055,.06);
    }
  }
}

function addExplosive(g,type){
  const {add}=g;
  if(type==='c4'){
    const block=new THREE.BoxGeometry(.68,.24,.48);
    block.translate(0,.15,0);add('core',block,0x535954);
    const indicator=new THREE.BoxGeometry(.17,.035,.12);
    indicator.translate(0,.29,0);add('core',indicator,0xee5038);
    g.horn('core',0xe2bb60,[-.14,.27,0],[.14,.33,.15],.025);
    return;
  }
  const body=new THREE.CylinderGeometry(.28,.31,.63,12);
  body.translate(0,.33,0);add('core',body,type==='trap'?0x67483e:0xa13d2c);
  const cap=new THREE.CylinderGeometry(.34,.34,.08,12);
  cap.translate(0,.66,0);add('core',cap,0x31353a);
  g.horn('core',0xf3b658,[0,.70,0],[0,1.02,0],.07);
}

export function buildCombatObjectGeometry(type,{detail='high'}={}){
  if(!['high','low'].includes(detail)) throw Error('不正なLOD: '+detail);
  const g=assemble(detail);
  if(type==='trap'||type==='dynamite'||type==='c4') addExplosive(g,type);
  else {
    const s=CREATURE_VISUAL_SPECS[type];
    if(!s)throw Error('未登録の召喚・騎乗オブジェクト: '+type);
    if(type==='wolf') addCoatSculpture(g,type,s,detail);
    else if(type==='horse') addHorse(g,s,detail);
    else addDragon(g,type,s,detail);
  }
  return g.finish();
}
