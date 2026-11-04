import * as THREE from 'three';

// This is the 10 motion-test jobs plus the six court/NPC roles, not the 50-unit battle roster.
export const JOBS = [
  ['job01','剣士'],['job02','格闘家'],['job03','魔法使い'],['job04','弓使い'],
  ['job05','盾戦士'],['job06','盗賊'],['job07','忍者'],['job08','農民・職人'],
  ['job09','僧侶'],['job10','召喚士'],['king','王様'],['minister','大臣'],
  ['servant','召使い'],['princess','姫'],['prince','王子'],['queen','女王']
];

// No material-only palette swaps: every entry specifies different garment construction.
const styles = {
  job01: {base:'ranger',fabric:'leather',tint:0x9c9e9a,armor:true,sleeve:'long',hem:'short',badge:'sword'},
  job02: {base:'peasant',fabric:'linen',tint:0xe9c29b,sleeve:'short',hem:'short',badge:'wraps'},
  job03: {base:'peasant',fabric:'velvet',tint:0x8876c6,sleeve:'long',hem:'robe',hood:true,badge:'crystal'},
  job04: {base:'ranger',fabric:'leather',tint:0x86a27e,sleeve:'long',hem:'tunic',badge:'quiver'},
  job05: {base:'ranger',fabric:'steel',tint:0xb7bec9,armor:true,sleeve:'long',hem:'tunic',badge:'shield'},
  job06: {base:'ranger',fabric:'leather',tint:0x9d897c,sleeve:'short',hem:'tunic',hood:true,badge:'pouches'},
  job07: {base:'ranger',fabric:'linen',tint:0x505968,sleeve:'long',hem:'short',hood:true,badge:'mask'},
  job08: {base:'peasant',fabric:'linen',tint:0xb8a487,sleeve:'long',hem:'tunic',badge:'apron'},
  job09: {base:'peasant',fabric:'linen',tint:0xfaf5df,sleeve:'long',hem:'robe',badge:'holy'},
  job10:{base:'peasant',fabric:'velvet',tint:0xa68cdb,sleeve:'long',hem:'robe',cape:true,badge:'runes'},
  king: {base:'peasant',fabric:'velvet',tint:0xb89ace,sleeve:'long',hem:'robe',cape:true,crown:'high',badge:'medal'},
  minister:{base:'peasant',fabric:'damask',tint:0x71829e,sleeve:'long',hem:'robe',badge:'chain'},
  servant:{base:'peasant',fabric:'linen',tint:0xd5c8b6,sleeve:'long',hem:'tunic',badge:'apron'},
  princess:{base:'peasant',fabric:'damask',tint:0xe8aec8,sleeve:'puff',hem:'gown',crown:'tiara',badge:'jewel'},
  prince:{base:'ranger',fabric:'velvet',tint:0x7fa7db,sleeve:'long',hem:'tunic',cape:true,crown:'circlet',badge:'sash'},
  queen: {base:'peasant',fabric:'damask',tint:0xb96d9d,sleeve:'puff',hem:'gown',cape:true,crown:'high',badge:'jewel'}
};
export const outfitStyle = job => styles[job] || styles.job01;

export async function loadPhotoMaterials() {
  const loader = new THREE.TextureLoader();
  const kinds = ['linen','leather','steel','velvet','damask','gold-brocade'];
  const textures = {};
  await Promise.all(kinds.map(async kind => {
    const texture = await loader.loadAsync(`./assets/textures/outfits/${kind}.jpg`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    textures[kind] = texture;
  }));
  return textures;
}

// The cylinder in v1.3 had 16x1 faces, and the costume used open planes.
// Torso here is 96x32 (~192x surface facets), sleeves 64x28 and gowns 96x48.
// All main pieces are closed around the body. The skinned Quaternius garments
// underneath supply the articulated clothing layer, including the back.
export function createDetailedOutfit(job, sex, body, textures) {
  const style=outfitStyle(job), group=new THREE.Group();
  group.name=`DetailedOutfit_${job}_${sex}`;
  body.updateMatrixWorld(true);
  const bones={};body.traverse(o=>{if(o.isBone)bones[o.name.toLowerCase()]=o});
  const at=name=>bones[name]?.getWorldPosition(new THREE.Vector3());
  const pelvis=at('pelvis'),chest=at('spine_03'),neck=at('neck_01'),head=at('head');
  const left=at('clavicle_l'),right=at('clavicle_r');
  if(!pelvis||!chest||!neck||!left||!right)throw Error('衣装生成に必要な関節が見つかりません');
  const bounds=new THREE.Box3().setFromObject(body), H=Math.max(1.3,bounds.getSize(new THREE.Vector3()).y);
  // The clavicle joints sit *inside* the body silhouette: do not mistake their
  // separation for the outer torso width, which caused naked sides in v1.3.
  const sx=Math.max(left.distanceTo(right)*.92,H*(sex==='female'?.159:.174)),sz=sx*.78;
  const cy=(left.y+right.y)*.5,hips=pelvis.y,torsoHeight=Math.max(H*.21,cy-hips+H*.065);
  const mx=(left.x+right.x)*.5,mz=(left.z+right.z)*.5;
  const front=mz-sz*1.14;
  const mats=[];
  function material(type,tint,metalness=0,roughness=.84){
    const t=textures[type]||textures.linen;
    const m=new THREE.MeshStandardMaterial({map:t,color:tint,metalness,roughness,
      bumpMap:t,bumpScale:type==='steel'?.0018:.0035,side:THREE.DoubleSide});
    mats.push(m);return m;
  }
  const cloth=material(style.fabric,style.tint,style.fabric==='steel'?.67:0,style.fabric==='steel'?.34:.84);
  const lining=material('linen',style.fabric==='linen'?0xcbbdae:0xb5a9a1);
  const leather=material('leather',0xb6a99c);
  const steel=material('steel',0xcdd5e1,.82,.31);
  const gold=material('gold-brocade',0xffe2a4,.26,.48);
  const trim=(style.crown||style.cape||['jewel','sash','chain','holy','medal','runes','crystal'].includes(style.badge))?gold:leather;
  function add(name,geom,mat,pos,scale){
    const mesh=new THREE.Mesh(geom,mat);mesh.name=name;
    if(pos)mesh.position.copy(pos);
    if(scale)mesh.scale.set(...scale);
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  const v=(x,y,z)=>new THREE.Vector3(x,y,z);
  function tube(name,a,b,rTop,rBottom,mat,radial=64,rings=28){
    if(!a||!b)return;
    const delta=new THREE.Vector3().subVectors(b,a),len=delta.length();
    if(len<.025)return;
    const mesh=add(name,new THREE.CylinderGeometry(rTop,rBottom,len,radial,rings,true),mat,a.clone().add(b).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    return mesh;
  }
  function orb(name,r,x,y,z,mat=trim,detail=24){return add(name,new THREE.SphereGeometry(r,detail,16),mat,v(x,y,z))}
  function block(name,w,h,d,x,y,z,mat=trim){return add(name,new THREE.BoxGeometry(w,h,d,12,12,4),mat,v(x,y,z))}
  function ring(name,r,t,x,y,z,mat=trim){const m=add(name,new THREE.TorusGeometry(r,t,18,96),mat,v(x,y,z),[1,sz/sx,1]);m.rotation.x=Math.PI/2;return m}

  // Opaque, continuous 360-degree torso: no backless plane and no transparent cut-outs.
  add('full-wrap-torso',new THREE.CylinderGeometry(sx*.94,sx*.83,torsoHeight,96,32,true),cloth,
    v(mx,cy-torsoHeight*.46,mz),[1,1,sz/sx]);
  const collarY=cy+H*.015;
  ring('sewn-neckline',sx*.49,H*.009,mx,collarY,mz,trim);
  const beltY=hips+H*.035;
  ring('waist-belt',sx*.89,H*.017,mx,beltY,mz,leather);
  block('belt-buckle',H*.055,H*.045,H*.017,mx,beltY,front-H*.015,trim);

  // Full tubular sleeves follow real shoulder/elbow/wrist points, not world-axis boxes.
  for(const side of ['l','r']){
    const upper=at('upperarm_'+side),lower=at('lowerarm_'+side),hand=at('hand_'+side);
    const shoulder=at('clavicle_'+side);
    const start=upper||shoulder;
    const mid=lower||hand;
    const radius=sx*(style.armor?.38:style.sleeve==='puff'?.46:.30);
    tube(`${side}-sleeve-upper`,start,mid,radius,radius*.87,style.armor?steel:cloth);
    if(style.sleeve!=='short'&&mid&&hand){tube(`${side}-sleeve-forearm`,mid,hand,radius*.88,radius*.70,cloth)}
    if(style.armor){const p=start||v(mx,cy,mz);const plate=orb(`${side}-pauldron`,sx*.45,p.x,p.y,p.z,steel,48);plate.scale.set(1.1,.68,1)}
    if(style.sleeve==='puff'&&start){const p=orb(`${side}-puff`,sx*.48,start.x,start.y,start.z,cloth,48);p.scale.set(1,.83,1)}
    if(style.badge==='wraps'&&hand){tube(`${side}-hand-wrap`,mid,hand,sx*.20,sx*.18,leather)}
  }

  const ankleL=at('foot_l'),ankleR=at('foot_r');
  const ankle=Math.min(ankleL?.y??hips-H*.50,ankleR?.y??hips-H*.50);
  if(style.hem==='tunic'||style.hem==='robe'||style.hem==='gown'){
    const skirtTop=hips+H*.045;
    const skirtBottom=style.hem==='gown'?ankle+H*.015:style.hem==='robe'?ankle+H*.09:hips-H*.19;
    const len=Math.max(H*.16,skirtTop-skirtBottom);
    const topRadius=sx*.85,flare=style.hem==='gown'?2.15:style.hem==='robe'?1.72:1.23;
    const bottomRadius=sx*flare;
    const geom=new THREE.CylinderGeometry(topRadius,bottomRadius,len,96,48,true);
    // Subtle radial fabric folds, displaced smoothly at all 49 vertical rings.
    const p=geom.attributes.position,uv=geom.attributes.uv;
    for(let i=0;i<p.count;i++){
      const a=Math.atan2(p.getX(i),p.getZ(i));
      const t=uv.getY(i);
      const wave=1+(.025+.035*t)*Math.sin(a*22+Math.sin(a*7)*.6);
      p.setX(i,p.getX(i)*wave);p.setZ(i,p.getZ(i)*wave*(sz/sx));
    }
    geom.computeVertexNormals();
    add('closed-circumference-tailored-skirt',geom,cloth,v(mx,skirtTop-len*.5,mz));
    // Separate physical-looking finished hem, not a floating flat plane.
    ring('bottom-hem-seam',bottomRadius*.97,H*.008,mx,skirtBottom,mz,style.hem==='gown'?gold:trim);
  }

  if(style.hem==='short'){
    // The Quaternius dressed mesh supplies trousers underneath a closed waistcoat.
    ring('double-stitched-short-hem',sx*.85,H*.008,mx,hips-H*.023,mz,trim);
  }

  if(style.cape){
    const top=cy+H*.07,bottom=Math.max(ankle+H*.05,hips-H*.42);
    const geom=new THREE.CylinderGeometry(sx*.90,sx*1.80,top-bottom,96,40,true,-Math.PI/2,Math.PI);
    geom.scale(1,1,sz/sx*1.17);
    add('three-dimensional-back-and-side-cape',geom,style.crown?material('damask',0xc7aacd):cloth,v(mx,(top+bottom)*.5,mz+sz*.17));
    for(const s of [-1,1])orb('mantle-clasp',H*.027,mx+s*sx*.64,cy+H*.045,front,trim,32);
  }

  if(style.hood){
    // High-poly cowl with a face opening. Retains the underlying head and hair.
    const hy=(head?.y??neck.y)+H*.015;
    const geo=new THREE.SphereGeometry(H*.125,64,32,0,Math.PI*2,0,Math.PI*.66);
    const hoodMaterial=cloth.clone();hoodMaterial.side=THREE.DoubleSide;mats.push(hoodMaterial);
    add('hood-cowl',geo,hoodMaterial,v(mx,hy,mz+H*.025),[1,1,.94]);
    ring('hood-seam',H*.10,H*.009,mx,hy-H*.085,mz,trim);
  }

  if(style.crown){
    const hy=(head?.y??neck.y)+H*.10;
    const r=H*(style.crown==='high'?.086:.075);
    ring('circumferential-crown-band',r,H*.014,mx,hy,mz,gold);
    const points=style.crown==='tiara'?7:12;
    for(let i=0;i<points;i++){
      const a=i*2*Math.PI/points;
      const t=style.crown==='high'?H*.075:style.crown==='tiara'?H*.04:H*.025;
      const cone=add('crown-finial',new THREE.ConeGeometry(H*.018,t,24,6),gold,
        v(mx+Math.cos(a)*r,hy+t*.45,mz+Math.sin(a)*r));
      if(i%2===0)orb('crown-jewel',H*.012,cone.position.x,cone.position.y+t*.28,cone.position.z,steel);
    }
  }

  switch(style.badge){
    case 'sword':{
      block('engraved-breastplate',sx*1.18,H*.18,sz*.40,mx,cy-H*.08,front+sz*.35,steel);
      orb('sword-sigil',H*.033,mx,cy-H*.03,front-H*.01,gold,40);break;
    }
    case 'shield':{
      const p=at('hand_l')||v(mx-sx*1.3,cy-H*.1,mz);
      const sh=add('tall-shield',new THREE.CylinderGeometry(sx*.80,sx*.66,H*.028,8,6),steel,
        v(p.x-sx*.15,p.y,front-H*.025));sh.rotation.x=Math.PI/2;
      orb('shield-boss',H*.055,sh.position.x,sh.position.y,sh.position.z-H*.025,gold);break;
    }
    case 'quiver':{
      const q=add('back-quiver',new THREE.CylinderGeometry(H*.055,H*.047,H*.26,48,16),leather,
        v(mx+sx*.7,cy-H*.07,mz+sz));q.rotation.z=.25;
      for(let i=0;i<5;i++)tube('quiver-arrow',v(q.position.x+(i-2)*H*.014,cy+H*.06,mz+sz),v(q.position.x+(i-2)*H*.014,cy+H*.17,mz+sz),H*.003,H*.003,steel,16,8);
      break;
    }
    case 'pouches':for(const s of [-1,1])block('leather-pouch',sx*.36,H*.09,sz*.50,mx+s*sx*.85,beltY-H*.04,front,leather);break;
    case 'mask':block('face-wrap',sx*.94,H*.072,sz*.23,mx,(head?.y??neck.y)-H*.065,mz-H*.11,cloth);break;
    case 'apron':{
      const a=block('tailored-front-apron',sx*1.35,H*.32,H*.020,mx,hips-H*.125,front-H*.015,lining);
      a.geometry.translate(0,-H*.015,0);break;
    }
    case 'holy':{
      block('stole-left',H*.035,H*.38,H*.015,mx-sx*.30,cy-H*.18,front-H*.03,gold);
      block('stole-right',H*.035,H*.38,H*.015,mx+sx*.30,cy-H*.18,front-H*.03,gold);
      block('holy-vertical',H*.018,H*.10,H*.018,mx,cy-H*.03,front-H*.05,gold);
      block('holy-horizontal',H*.065,H*.018,H*.018,mx,cy-H*.025,front-H*.055,gold);break;
    }
    case 'crystal':case 'jewel':case 'runes':{
      orb('gemstone-pendant',H*.035,mx,cy-H*.08,front-H*.025,style.badge==='runes'?steel:gold,48);
      if(style.badge==='runes')for(const s of [-1,1])orb('arcane-rune',H*.024,mx+s*sx*.60,cy-H*.03,front-H*.01,gold);break;
    }
    case 'chain':for(let i=0;i<8;i++)orb('minister-chain-link',H*.012,mx+Math.cos(i/7*Math.PI)*sx*.65,cy-H*.09+Math.sin(i/7*Math.PI)*H*.07,front-H*.012,gold);break;
    case 'medal':orb('royal-order-medal',H*.045,mx,cy-H*.13,front-H*.03,gold,48);break;
    case 'sash':{
      const s=block('princely-diagonal-sash',H*.055,H*.40,H*.018,mx+sx*.05,cy-H*.10,front-H*.035,gold);s.rotation.z=.52;
      break;
    }
  }

  let triangles=0;
  group.traverse(o=>{if(o.isMesh){const g=o.geometry;triangles+=g.index?g.index.count/3:g.attributes.position.count/3}});
  group.userData={procedural:true,triangles:Math.round(triangles),source:'16-role-detailed-mesh-photo-materials-v2',materials:mats};
  return group;
}
