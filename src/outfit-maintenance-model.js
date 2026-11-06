import * as THREE from 'three';

// Ten motion-test jobs, six court/NPC roles and a dedicated field strategist.
// This is not the fifty-unit battle roster.
export const JOBS = [
  ['job01','剣士'],['job02','格闘家'],['job03','魔法使い'],['job04','弓使い'],
  ['job05','盾戦士'],['job06','盗賊'],['job07','忍者'],['job08','農民・職人'],
  ['job09','僧侶'],['job10','召喚士'],['king','王様'],['minister','大臣'],
  ['servant','召使い'],['princess','姫'],['prince','王子'],['queen','女王'],
  ['strategist','軍師']
];

// Job identity is a complete equipment specification, not a color palette swap.
// Gear values are shared by the maintenance screen and external motion preview.
const styles = {
  job01: {concept:'体形に沿った銀鋼の胸甲・濃紺の下衣・肩鎧・片手剣',base:'ranger',fabric:'leather',tint:0x52657b,armor:true,sleeve:'long',hem:'short',badge:'sword',gear:'sword',pauldron:true,leggings:true},
  job02: {concept:'身軽な稽古着・布の拳帯・脚絆',base:'peasant',fabric:'linen',tint:0xd9b68e,sleeve:'short',hem:'short',badge:'wraps',leggings:true},
  job03: {concept:'魔導書を携えたフード付き魔術師長衣',base:'peasant',fabric:'velvet',tint:0x8d7bc3,sleeve:'long',hem:'robe',hood:true,badge:'crystal',gear:'staff'},
  job04: {concept:'森色の革装束・弓・矢筒・フード',base:'ranger',fabric:'leather',tint:0x7f9974,sleeve:'long',hem:'tunic',hood:true,badge:'quiver',gear:'bow',leggings:true},
  job05: {concept:'重厚な鋼製胸甲・幅広の肩当て・大型盾・剣',base:'ranger',fabric:'steel',tint:0x78899c,armor:true,sleeve:'long',hem:'short',badge:'shield',gear:'shield',pauldron:true,leggings:true},
  job06: {concept:'フード・革の分割腰垂れ・軽量短剣・身体に密着した道具袋',base:'ranger',fabric:'leather',tint:0x756252,sleeve:'short',hem:'tunic',hood:true,badge:'pouches',gear:'dagger',leggings:true},
  job07: {concept:'黒い忍装束・覆面・二刀',base:'ranger',fabric:'linen',tint:0x444e5d,sleeve:'long',hem:'short',hood:true,badge:'mask',gear:'dual-daggers',leggings:true},
  job08: {concept:'丈夫な作業着・前掛け・工具',base:'peasant',fabric:'linen',tint:0xb7a38a,sleeve:'long',hem:'tunic',badge:'apron',gear:'axe',leggings:true},
  job09: {concept:'純白の修道服・聖印・法杖',base:'peasant',fabric:'linen',tint:0xeee7d5,sleeve:'long',hem:'robe',badge:'holy',gear:'staff'},
  job10:{concept:'刺繍入り儀式服・召喚の杖',base:'peasant',fabric:'velvet',tint:0x9d83ca,sleeve:'long',hem:'robe',cape:true,badge:'runes',gear:'staff'},
  king: {concept:'深紅の王衣・金刺繍・王冠・王笏',base:'peasant',fabric:'velvet',tint:0x923a50,sleeve:'long',hem:'robe',cape:true,crown:'high',badge:'medal',gear:'scepter'},
  minister:{concept:'濃紺の正装・飾り鎖（王冠なし）',base:'peasant',fabric:'damask',tint:0x687b9a,sleeve:'long',hem:'tunic',badge:'chain',leggings:true},
  servant:{concept:'簡素なリネン服・実用的な前掛け',base:'peasant',fabric:'linen',tint:0xc7b49c,sleeve:'long',hem:'tunic',badge:'apron',leggings:true},
  princess:{concept:'バラ色のドレス・刺繍・ティアラ',base:'peasant',fabric:'damask',tint:0xda9db9,sleeve:'puff',hem:'gown',crown:'tiara',badge:'jewel'},
  prince:{concept:'紺青の礼装・肩掛け・細身の剣',base:'ranger',fabric:'velvet',tint:0x608aca,sleeve:'long',hem:'tunic',cape:true,crown:'circlet',badge:'sash',gear:'sword',leggings:true},
  queen: {concept:'深紫の大礼服・宝飾・女王冠',base:'peasant',fabric:'damask',tint:0x965277,sleeve:'puff',hem:'gown',cape:true,crown:'high',badge:'jewel'},
  strategist:{concept:'藍黒の軍師礼装・金糸の方位紋・分割軍衣・指揮用マント・軍配杖（男女共通の軍師意匠）',base:'ranger',fabric:'damask',tint:0x344e6a,sleeve:'long',hem:'tunic',cape:true,badge:'command',gear:'command-baton',leggings:true}
};
export const outfitStyle = job => styles[job] || styles.job01;

// A separate, authored silhouette/finish for every selectable occupation.
// These are real wardrobe pieces on the existing 65-bone garments, not a
// replacement body or a colour swap. The same data is used by the preview and
// the instanced army source, with different geometric tessellation budgets.
export const JOB_COUTURE = Object.freeze({
  job01:{motif:'chevron',accent:0xc3b19b,hardware:'steel',harness:'none',detail:'rivets'},
  job02:{motif:'circle',accent:0xdcc69d,hardware:'leather',harness:'single',detail:'wraps'},
  job03:{motif:'star',accent:0xb1a2df,hardware:'gold',harness:'none',detail:'runes'},
  job04:{motif:'arrow',accent:0x9eae88,hardware:'leather',harness:'cross',detail:'feathers'},
  job05:{motif:'shield',accent:0xc9d8e4,hardware:'steel',harness:'none',detail:'rivets'},
  job06:{motif:'diamond',accent:0xb99e7e,hardware:'leather',harness:'double',detail:'pouches'},
  job07:{motif:'cross',accent:0x8994a9,hardware:'steel',harness:'cross',detail:'wraps'},
  job08:{motif:'chevron',accent:0xc7ad83,hardware:'leather',harness:'single',detail:'pouches'},
  job09:{motif:'cross',accent:0xf3dca0,hardware:'gold',harness:'none',detail:'beads'},
  job10:{motif:'star',accent:0xd6b9f8,hardware:'gold',harness:'double',detail:'runes'},
  king:{motif:'crown',accent:0xe9c46e,hardware:'gold',harness:'none',detail:'jewels'},
  minister:{motif:'diamond',accent:0xaabbd4,hardware:'gold',harness:'single',detail:'beads'},
  servant:{motif:'circle',accent:0xe1cfb6,hardware:'leather',harness:'single',detail:'pouches'},
  princess:{motif:'star',accent:0xf1d0e5,hardware:'gold',harness:'none',detail:'jewels'},
  prince:{motif:'chevron',accent:0xd9c28d,hardware:'gold',harness:'cross',detail:'rivets'},
  queen:{motif:'crown',accent:0xd6b3de,hardware:'gold',harness:'none',detail:'jewels'},
  strategist:{motif:'compass',accent:0xd9c388,hardware:'gold',harness:'single',detail:'beads'}
});

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
  // The original coarse burlap photograph is appropriate for close-up sacks,
  // but looks like dark latticework when wrapped over small sleeves and legs.
  // Preserve the photo's fiber structure at much lower contrast, once at load
  // time; all 17 jobs reuse this one GPU texture in preview and battle.
  if(typeof document!=='undefined'&&textures.linen?.image){
    try{
      const image=textures.linen.image;
      const canvas=document.createElement('canvas');
      canvas.width=image.naturalWidth||image.width;
      canvas.height=image.naturalHeight||image.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(ctx&&canvas.width&&canvas.height){
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        for(let i=0;i<pixels.data.length;i+=4){
          const grey=.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2];
          const neutral=Math.round(Math.min(235,Math.max(172,210+(grey-175)*.18)));
          pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=neutral;
        }
        ctx.putImageData(pixels,0,0);
        const fine=new THREE.CanvasTexture(canvas);
        fine.colorSpace=THREE.SRGBColorSpace;
        fine.wrapS=fine.wrapT=THREE.RepeatWrapping;
        fine.anisotropy=8;
        textures['linen-fine']=fine;
      }
    }catch(error){console.warn('Fine photographed fabric fallback:',error)}
  }
  // Lift the *photograph*, not a flat material swatch. The original steel JPG
  // averages charcoal grey and renders nearly black as a metallic diffuse
  // texture. White untextured plates are equally implausible. A one-time
  // brightness/contrast curve keeps every real scratch and pit in the albedo.
  // The untouched original remains the small-scale bump map.
  if(typeof document!=='undefined'&&textures.steel?.image){
    try{
      const image=textures.steel.image;
      const canvas=document.createElement('canvas');
      canvas.width=image.naturalWidth||image.width;
      canvas.height=image.naturalHeight||image.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(ctx&&canvas.width&&canvas.height){
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        for(let i=0;i<pixels.data.length;i+=4){
          for(let c=0;c<3;c++){
            const value=pixels.data[i+c];
            pixels.data[i+c]=Math.min(230,Math.round(24+value*1.82));
          }
        }
        ctx.putImageData(pixels,0,0);
        const polished=new THREE.CanvasTexture(canvas);
        polished.colorSpace=THREE.SRGBColorSpace;
        polished.wrapS=polished.wrapT=THREE.RepeatWrapping;
        polished.anisotropy=8;
        textures['steel-grain']=textures.steel;
        textures.steel=polished;
      }
    }catch(error){console.warn('Photographic steel tone correction unavailable:',error)}
  }
  return textures;
}

// The fitted Quaternius skinned garments form the full body layer. In particular,
// do not hide them with a straight cylinder: that made the characters look like
// they wore cardboard barrels, despite a high triangle count.
export function createDetailedOutfit(job, sex, body, textures, {quality='preview'}={}) {
  if(quality!=='preview'&&quality!=='battle')throw Error('未対応の衣装ディテール品質: '+quality);
  const battle=quality==='battle',couture=JOB_COUTURE[job]||JOB_COUTURE.job01;
  const style=outfitStyle(job), group=new THREE.Group();
  group.name=`DetailedOutfit_${job}_${sex}`;
  body.updateMatrixWorld(true);
  const bones={};body.traverse(o=>{if(o.isBone)bones[o.name.toLowerCase()]=o});
  const at=name=>bones[name]?.getWorldPosition(new THREE.Vector3());
  const pelvis=at('pelvis'),chest=at('spine_03'),neck=at('neck_01'),head=at('head');
  const left=at('clavicle_l'),right=at('clavicle_r');
  if(!pelvis||!chest||!neck||!left||!right)throw Error('衣装生成に必要な関節が見つかりません');
  const bounds=new THREE.Box3().setFromObject(body);
  // Dressed source GLTFs have no head mesh; include the head joint in height.
  const H=Math.max(1.3,bounds.getSize(new THREE.Vector3()).y,(head?.y??neck.y)-bounds.min.y+0.045);
  // The clavicle joints sit *inside* the body silhouette: do not mistake their
  // separation for the outer torso width, which caused naked sides in v1.3.
  const sx=Math.max(left.distanceTo(right)*.92,H*(sex==='female'?.159:.174)),sz=sx*.78;
  const cy=(left.y+right.y)*.5,hips=pelvis.y,torsoHeight=Math.max(H*.21,cy-hips+H*.065);
  const mx=(left.x+right.x)*.5,mz=(left.z+right.z)*.5;
  // Locate the *actual deformed fabric surface* at each anatomical slice.
  // A fixed sx-derived Z used to place trim more than 10 cm in front of the
  // tunic, creating apparently floating buttons, medals, and sword belts.
  const torsoSamples=[];const point=new THREE.Vector3();
  body.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||!/(body|torso)/i.test(mesh.name))return;
    const pos=mesh.geometry?.attributes?.position;if(!pos)return;
    for(let i=0;i<pos.count;i+=Math.max(1,Math.ceil(pos.count/2800))){
      mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
      if(Number.isFinite(point.x+point.y+point.z)&&Math.abs(point.x-mx)<sx*.92)
        torsoSamples.push([point.x,point.y,point.z]);
    }
  });
  function surfaceAt(y,back=false,x=mx){
    // Fit trim and breastplate to the *same lateral slice* of the dressed
    // chest. The old centerline-only Z estimate suspended plates at the ribs
    // while cutting into the pectorals when the character turned sideways.
    const band=torsoSamples.filter(([px,py])=>Math.abs(py-y)<H*.069&&Math.abs(px-x)<sx*.20);
    const eligible=band.length>=9?band:torsoSamples.filter(([,py])=>Math.abs(py-y)<H*.077);
    const z=eligible.map(p=>p[2]).sort((a,b)=>a-b);
    return z.length>10?z[Math.floor((z.length-1)*(back?.08:.92))]:mz+(back?-1:1)*sz*.69;
  }
  // The Superhero face points +Z; decorations must remain against that skin.
  const front=surfaceAt(cy-H*.09)+H*.008;
  const mats=[];
  function material(type,tint,metalness=0,roughness=.84){
    const t=textures[type]||textures.linen;
    // Photo maps already contain lighting/color variation. A dark color multiply
    // crushed the fabric details to near-black on mobile ACES tonemapping.
    const color=new THREE.Color(tint).lerp(new THREE.Color(0xffffff),.57);
    const m=new THREE.MeshStandardMaterial({map:t,color,metalness,roughness,
      bumpMap:t,bumpScale:type==='steel'?.0013:.0027,side:THREE.DoubleSide});
    mats.push(m);return m;
  }
  const cloth=material(style.fabric,style.tint,style.fabric==='steel'?.67:0,style.fabric==='steel'?.34:.84);
  const lining=material('linen',style.fabric==='linen'?0xcbbdae:0xb5a9a1);
  const leather=material('leather',0xb6a99c);
  const steel=material('steel',0xcdd5e1,.82,.31);
  const gold=material('gold-brocade',0xffe2a4,.26,.48);
  const trim=(style.crown||style.cape||['jewel','sash','chain','holy','medal','runes','crystal'].includes(style.badge))?gold:leather;
  const embroidery=material(couture.hardware==='steel'?'steel':couture.hardware==='gold'?'gold-brocade':'leather',
    couture.accent,couture.hardware==='steel'?.58:couture.hardware==='gold'?.35:0,.46);
  function add(name,geom,mat,pos,scale){
    const mesh=new THREE.Mesh(geom,mat);mesh.name=name;
    if(pos)mesh.position.copy(pos);
    if(scale)mesh.scale.set(...scale);
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  const v=(x,y,z)=>new THREE.Vector3(x,y,z);
  function tube(name,a,b,rTop,rBottom,mat,radial=battle?8:24,rings=battle?1:8){
    if(!a||!b)return;
    const delta=new THREE.Vector3().subVectors(b,a),len=delta.length();
    if(len<.025)return;
    const mesh=add(name,new THREE.CylinderGeometry(rTop,rBottom,len,radial,rings,true),mat,a.clone().add(b).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    return mesh;
  }
  function orb(name,r,x,y,z,mat=trim,detail=battle?8:20){return add(name,new THREE.SphereGeometry(r,detail,battle?6:12),mat,v(x,y,z))}
  function block(name,w,h,d,x,y,z,mat=trim){return add(name,new THREE.BoxGeometry(w,h,d,battle?1:4,battle?1:4,1),mat,v(x,y,z))}
  function ring(name,r,t,x,y,z,mat=trim){const m=add(name,new THREE.TorusGeometry(r,t,battle?5:10,battle?16:48),mat,v(x,y,z),[1,sz/sx,1]);m.rotation.x=Math.PI/2;return m}

  // No generated cylinder may sit over the chest. Plate-equipped jobs load
  // actual separately modeled cuirass and shoulder armor from GLB parts.
  const collarY=cy+H*.015;
  ring('sewn-neckline',sx*.43,H*.004,mx,collarY,mz,trim);
  const beltY=hips+H*.035;
  const waistFront=surfaceAt(beltY)+H*.007;
  // Large decorative toruses hovered outside the hip and looked like a
  // floating hula-hoop (especially on plate jobs). Keep a fitted leather
  // belt for cloth jobs; steel breastplates end in segmented fauld lames.
  if(!style.armor){
    ring('waist-belt',sx*.49,H*.0045,mx,beltY,mz,leather);
    block('belt-buckle',H*.027,H*.023,H*.009,mx,beltY,waistFront+H*.001,trim);
    // Make the leather buckle look stitched into the cloth instead of a
    // disconnected copper plaque across the belly.
    if(!battle){
      for(const side of [-1,1])for(let i=0;i<3;i++){
        const x=mx+side*sx*(.19+i*.07);
        orb(`belt-stitch-${side}-${i}`,H*.0026,x,beltY,waistFront+H*.003,lining,7);
      }
    }
  }

  // Photo-textured seam binding, harnesses and relief insignia. These retain
  // the existing natural cloth silhouette instead of covering it with a box.
  // Battle instances use the same recognizable shapes at a far smaller cost.
  const chestFront=front+H*.009;
  // Under-tunic back coverage is mandatory for EVERY job. Some imported
  // Ranger/Peasant clothes have only thin front surfaces, while the old
  // underlying-body occlusion removed the anatomical back completely.
  // This panel is skinned with the spine like the rest of the clothing.
  {
    const columns=battle?14:24,rows=battle?10:18;
    const points=[],uv=[],faces=[];
    const yTop=cy+H*.045,yBottom=hips+H*.024;
    for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
      const t=row/rows,u=col/columns*2-1;
      const y=yTop+(yBottom-yTop)*t;
      const x=mx+u*sx*(.83-.13*t)*Math.sqrt(Math.max(.03,1-.10*u*u));
      const z=surfaceAt(y,true,x)-H*.006;
      points.push(x,y,z);uv.push(col/columns,t);
      if(row<rows&&col<columns){const i=row*(columns+1)+col;
        faces.push(i,i+1,i+columns+1,i+1,i+columns+2,i+columns+1);
      }
    }
    const back=new THREE.BufferGeometry();
    back.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    back.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    back.setIndex(faces);back.computeVertexNormals();
    add('complete-back-tunic-lining',back,cloth);
  }
  if(style.armor){
    // Sculpted front and back plate over the actual torso surface.
    // The source GLB has segmented pauldrons but its chest texture exposes a
    // large flat green panel. This plate is an anatomical front *surface*,
    // not the old full-cylinder body replacement. All vertices are skinned.
    // The former 10x7 game cuirass faceted visibly around the chest while
    // the wardrobe's 30x24 preview looked sculpted. Retain the silhouette
    // with a modest 18x12 mesh; trim and decals remain instanced by job.
    const heavy=job==='job05',cols=battle?18:30,rows=battle?12:24;
    const vertices=[],uv=[],indices=[];
    const top=cy+H*.036,bottom=hips+H*.098;
    const halfWidth=sx*(heavy?.74:.64);
    const edge=(x,y)=>{
      const t=THREE.MathUtils.clamp((top-y)/(top-bottom),0,1);
      // Shoulder/armhole cut, broad pectoral region and a tapered waist.
      // A rectangle-wide shell used to read as a large shield on the chest.
      const width=halfWidth*(.72+.28*Math.sin(Math.PI*t*.90))*(1-.18*t);
      const px=mx+x*width;
      const sculptedY=y-H*.038*Math.exp(-Math.pow(Math.abs(x)/.46,4))*(1-t)
        +H*.014*Math.pow(Math.abs(x),2)*t;
      const pectoral=Math.exp(-Math.pow((t-.30)/.22,2))*Math.pow(Math.sin(Math.PI*Math.abs(x)),2);
      const ridge=H*(heavy?.011:.009)*pectoral;
      const z=surfaceAt(sculptedY,false,px)+H*(heavy?.012:.010)
        +H*.008*(1-x*x)+ridge-H*.008*Math.pow(Math.abs(x),3);
      return v(px,sculptedY,z);
    };
    for(let row=0;row<=rows;row++){
      const t=row/rows,y=top+(bottom-top)*t;
      for(let col=0;col<=cols;col++){
        const u=col/cols*2-1,p=edge(u,y);
        vertices.push(p.x,p.y,p.z);uv.push(col/cols,row/rows);
        if(row<rows&&col<cols){const i=row*(cols+1)+col;indices.push(i,i+cols+1,i+1,i+1,i+cols+1,i+cols+2)}
      }
    }
    const plateGeometry=new THREE.BufferGeometry();
    plateGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    plateGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    plateGeometry.setIndex(indices);plateGeometry.computeVertexNormals();
    // Keep the photographed scratch pattern as albedo and original bump, with
    // its tonal range lifted once at asset load rather than flattening it to
    // the smooth white plastic seen in the first bright-plate experiment.
    const plate=new THREE.MeshPhysicalMaterial({
      map:textures.steel,color:heavy?0xbbcad8:0xdbe5ec,metalness:.23,roughness:.43,
      bumpMap:textures['steel-grain']||textures.steel,bumpScale:.00145,
      clearcoat:.15,clearcoatRoughness:.4,side:THREE.DoubleSide
    });
    mats.push(plate);
    add('heroic-cuirass-shell',plateGeometry,plate);
    // The front-only shell produced a visibly bare back whenever the hidden
    // anatomical torso was occluded, and the rear of the swordsman looked
    // like a hollow shield. Cover the measured *back* of the same skeleton,
    // with closed flank seams instead of a flat box floating off the body.
    const backPoints=[],backUv=[],backFaces=[];
    const backEdge=(x,y)=>{
      const frontPoint=edge(x,y);
      return v(frontPoint.x,frontPoint.y,
        surfaceAt(frontPoint.y,true,frontPoint.x)-H*(heavy?.013:.010));
    };
    for(let row=0;row<=rows;row++){
      const y=top+(bottom-top)*row/rows;
      for(let col=0;col<=cols;col++){
        const p=backEdge(col/cols*2-1,y);
        backPoints.push(p.x,p.y,p.z);backUv.push(col/cols,row/rows);
        if(row<rows&&col<cols){const i=row*(cols+1)+col;
          backFaces.push(i,i+1,i+cols+1,i+1,i+cols+2,i+cols+1);
        }
      }
    }
    const backGeometry=new THREE.BufferGeometry();
    backGeometry.setAttribute('position',new THREE.Float32BufferAttribute(backPoints,3));
    backGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(backUv,2));
    backGeometry.setIndex(backFaces);backGeometry.computeVertexNormals();
    add('heroic-cuirass-backplate',backGeometry,plate);
    for(const side of [-1,1]){
      const seamPoints=[],seamUv=[],seamFaces=[];
      for(let row=0;row<=rows;row++){
        const y=top+(bottom-top)*row/rows;
        const frontPoint=edge(side,y),rearPoint=backEdge(side,y);
        for(const p of [frontPoint,rearPoint])seamPoints.push(p.x,p.y,p.z);
        seamUv.push(0,row/rows,1,row/rows);
        if(row<rows){const i=row*2;seamFaces.push(i,i+2,i+1,i+1,i+2,i+3)}
      }
      const seam=new THREE.BufferGeometry();
      seam.setAttribute('position',new THREE.Float32BufferAttribute(seamPoints,3));
      seam.setAttribute('uv',new THREE.Float32BufferAttribute(seamUv,2));
      seam.setIndex(seamFaces);seam.computeVertexNormals();
      add(`${side<0?'l':'r'}-cuirass-closed-flank`,seam,plate);
    }
    const edgeMaterial=heavy?gold:steel;
    // Metal piping follows the actual V neckline, not an impossible flat
    // top edge across the wearer's throat. The curved pectoral stamping
    // adds silhouette relief without overlaying a second full chest mesh.
    const neckPoints=[];
    for(let i=0;i<=16;i++){
      const u=i/8-1,p=edge(u,top);
      neckPoints.push(p.add(v(0,H*.001,H*.006)));
    }
    add('cuirass-shaped-neck-welt',new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(neckPoints),battle?12:56,H*.0045,battle?5:9,false),edgeMaterial);
    for(const side of [-1,1]){
      const stamp=[];
      for(let i=0;i<=11;i++){
        const u=side*(.06+.72*i/11),y=top-(top-bottom)*(.24+.085*Math.sin(Math.PI*i/11));
        stamp.push(edge(u,y).add(v(0,0,H*.007)));
      }
      add(`${side<0?'l':'r'}-hammered-pectoral-relief`,new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(stamp),battle?10:40,H*.003,battle?4:8,false),edgeMaterial);
    }
    for(const side of [-1,1]){
      // Fitted welt and rivets follow the breastplate's curved perimeter.
      const points=[];for(let i=0;i<=7;i++)points.push(edge(side,top+(bottom-top)*i/7));
      const welt=add(`${side<0?'l':'r'}-cuirass-welt`,new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),battle?7:28,H*.005,battle?5:10,false),edgeMaterial);
      welt.userData.armorFinish='welt';
      for(const y of [top-H*.060,bottom+H*.033]){
        const p=edge(side*.91,y);
        orb(`${side<0?'l':'r'}-cuirass-fastener`,H*.009,p.x,p.y,p.z+H*.006,heavy?gold:steel,12);
      }
    }
    for(let segment=0;segment<(heavy?7:5);segment++){
      const u=(segment+.5)/(heavy?7:5)*2-1,p=edge(u,bottom-H*.003);
      const lame=block(`cuirass-faulds-${segment}`,halfWidth*2/(heavy?7:5)*.91,H*(heavy?.064:.046),H*.011,
        p.x,p.y-H*.028,p.z-H*.003,heavy?steel:leather);
      lame.rotation.z=-u*.09;
    }
    // Narrow, joint-mounted tassets protect the very top of each thigh. The
    // first version reached the knees and looked like two white drainpipes;
    // the woven trousers now remain visible between the short armored flaps.
    for(const side of ['l','r']){
      const thigh=at(`thigh_${side}`);
      if(!thigh)continue;
      const height=H*(heavy?.125:.090),radius=H*(heavy?.060:.053);
      const geom=new THREE.CylinderGeometry(radius*.98,radius*.91,height,
        battle?8:26,battle?3:12,true,-Math.PI*.36,Math.PI*.72);
      const p=geom.getAttribute('position');
      for(let i=0;i<p.count;i++){
        const u=Math.atan2(p.getX(i),p.getZ(i));
        p.setZ(i,p.getZ(i)*(1+.026*Math.cos(u*4)));
      }
      geom.computeVertexNormals();
      const flapMaterial=heavy?plate:material('leather',0x526278);
      add(`cuirass-thigh-tasset-${side}`,geom,flapMaterial,
        v(thigh.x,hips-height*.30,thigh.z+H*.008));
    }
  }
  const upperY=cy-H*.015,lowerY=hips+H*.105;
  const strapW=H*(battle?.018:.021);
  const harness=(side,from,to)=>{
    const x1=mx+sx*from,x2=mx+sx*to;
    const length=Math.hypot(upperY-lowerY,x2-x1);
    const diagonal=block(`${side}-photo-leather-harness`,strapW,length,H*.012,
      (x1+x2)*.5,(upperY+lowerY)*.5,chestFront,leather);
    diagonal.rotation.z=Math.atan2(x2-x1,upperY-lowerY);
    orb(`${side}-harness-pin`,H*.013,x1,upperY,chestFront+H*.008,embroidery);
  };
  if(couture.harness==='single'||couture.harness==='cross')harness('l',-.6,.48);
  if(couture.harness==='double'||couture.harness==='cross')harness('r',.6,-.48);
  if(couture.harness==='double'){
    tube('tailored-horizontal-strap',v(mx-sx*.6,lowerY,chestFront),v(mx+sx*.6,lowerY,chestFront),H*.009,H*.009,leather);
  }
  const insigniaY=cy-H*.14,insigniaZ=chestFront+H*(style.armor?.042:.004);
  const inscription=(name,ax,ay,bx,by)=>tube(`insignia-${couture.motif}-${name}`,
    v(mx+ax*H,insigniaY+ay*H,insigniaZ),v(mx+bx*H,insigniaY+by*H,insigniaZ),
    H*(battle?.0035:.0045),H*(battle?.0035:.0045),embroidery);
  switch(couture.motif){
    case 'chevron':inscription('left',-.062,.029,0,-.026);inscription('right',0,-.026,.062,.029);break;
    case 'cross':inscription('vertical',0,-.052,0,.052);inscription('horizontal',-.038,0,.038,0);break;
    case 'arrow':inscription('shaft',0,-.06,0,.055);inscription('left',-.035,.020,0,.058);inscription('right',.035,.020,0,.058);break;
    case 'shield':inscription('top',-.055,.04,.055,.04);inscription('left',-.055,.04,0,-.055);inscription('right',.055,.04,0,-.055);break;
    case 'star':inscription('a',-.057,-.03,.058,.037);inscription('b',.058,.037,-.058,.037);inscription('c',-.058,.037,.057,-.03);break;
    case 'diamond':inscription('a',0,.065,-.044,0);inscription('b',-.044,0,0,-.065);inscription('c',0,-.065,.044,0);inscription('d',.044,0,0,.065);break;
    case 'crown':inscription('base',-.068,-.035,.068,-.035);inscription('l',-.068,-.035,-.053,.055);inscription('mid',-.053,.055,0,.005);inscription('top',0,.005,.053,.055);inscription('r',.053,.055,.068,-.035);break;
    case 'compass':{
      inscription('north',0,0,0,.075);inscription('south',0,0,0,-.065);
      inscription('east',0,0,.065,0);inscription('west',0,0,-.065,0);
      inscription('northwest',0,.075,-.018,.031);inscription('northeast',0,.075,.018,.031);
      orb('command-compass-boss',H*.012,mx,insigniaY,insigniaZ+H*.008,embroidery,battle?8:18);
      break;
    }
    default:ring('circle-signature',H*.048,H*.004,mx,insigniaY,insigniaZ,embroidery);
  }
  if(!battle){
    for(const s of [-1,1])for(let k=0;k<3;k++){
      orb(`${s<0?'l':'r'}-hand-sewn-hem-stud`,H*.006,mx+s*sx*(.48+k*.11),beltY,chestFront,embroidery,10);
    }
    if(couture.detail==='rivets')for(const s of [-1,1])for(let k=0;k<3;k++)
      orb(`${s<0?'l':'r'}-armor-rivet`,H*.007,mx+s*sx*.73,upperY-k*H*.055,chestFront+H*.005,steel,10);
    if(couture.detail==='jewels')for(const s of [-1,1])
      orb(`${s<0?'l':'r'}-set-gem`,H*.024,mx+s*sx*.43,cy+H*.025,chestFront+H*.009,gold,20);
    if(couture.detail==='runes')for(const s of [-1,1])for(let k=0;k<2;k++)
      ring('embroidered-rune',H*.021,H*.003,mx+s*sx*.68,cy-k*H*.083,chestFront,embroidery);
    if(couture.detail==='pouches')for(const s of [-1,1])
      block('stitched-side-pocket',sx*.23,H*.067,H*.032,mx+s*sx*.82,beltY-H*.035,chestFront,leather);
    if(couture.detail==='wraps')for(const s of [-1,1])for(let k=0;k<3;k++)
      tube(`${s<0?'l':'r'}-bandage-seam`,v(mx+s*sx*.58,hips-H*(.12+k*.018),front),
        v(mx+s*sx*.76,hips-H*(.12+k*.018),front),H*.004,H*.004,lining);
    if(couture.detail==='beads')for(let k=-3;k<=3;k++)
      orb('polished-prayer-bead',H*.010,mx+k*H*.026,cy-H*.22,chestFront+H*.011,gold,12);
    if(couture.detail==='feathers')for(let k=-2;k<=2;k++)
      tube('quiver-fletching',v(mx+sx*.87+k*H*.011,cy+H*.048,surfaceAt(cy,true)-H*.025),
        v(mx+sx*.87+k*H*.012,cy+H*.105,surfaceAt(cy,true)-H*.025),H*.007,H*.002,lining);
  }

  // Sleeves are constructed as bone-mounted, rigidly tailored fabric segments
  // by the runtime; vertex-weighted tubes tore around elbows in real devices.
  for(const side of ['l','r']){
    const upper=at('upperarm_'+side),lower=at('lowerarm_'+side),hand=at('hand_'+side);
    const shoulder=at('clavicle_'+side);
    const start=upper||shoulder;
    const mid=lower||hand;
    if(style.sleeve==='puff'&&start){const p=orb(`${side}-tailored-puff`,sx*.27,start.x,start.y,start.z,cloth,48);p.scale.set(1,.72,1)}
  }

  // Trouser panels are similarly bone-mounted to avoid skin-weight pinching.

  const ankleL=at('foot_l'),ankleR=at('foot_r');
  const ankle=Math.min(ankleL?.y??hips-H*.50,ankleR?.y??hips-H*.50);
  if(style.hem==='tunic'){
    // Independent leather/cloth hip panels, with air gaps around each thigh.
    // The old closed CylinderGeometry formed the rigid brown barrel visible
    // on the thief screenshot. Real tunics consist of overlapping pieces that
    // split and follow the left/right thigh as the wearer runs or crouches.
    const thief=job==='job06';
    // Both renderers must have the same twelve independent garment panels.
    // Reduce tessellation, never the number of recognizable silhouette parts.
    const panels=12,rows=battle?6:14,columns=battle?4:6;
    const topY=hips+H*.027,length=H*(thief?.145:.183);
    const panelCloth=thief?material('leather',0x75604f):cloth;
    const wornPanel=thief?material('leather',0x685448):cloth;
    const edgeCloth=thief?material('leather',0x9c8061):trim;
    for(let panel=0;panel<panels;panel++){
      const centerAngle=(panel+.5)*Math.PI*2/panels;
      const halfAngle=Math.PI/panels*(thief?.83:.91);
      const side=Math.sin(centerAngle)<0?'l':'r';
      const vertices=[],uv=[],faces=[];
      for(let row=0;row<=rows;row++){
        const t=row/rows;
        const hemLength=length*(1+(panel%3-1)*.10);
        // Rounded/V-cut lower leather tabs, not straight rectangular boards.
        const radius=sx*(thief?.705+.012*t:.715+.065*t);
        for(let col=0;col<=columns;col++){
          const u=col/columns,edge=u*2-1;
          const taper=thief?1-.43*t*t:1-.12*t*t;
          const a=centerAngle+edge*halfAngle*taper;
          // Leather tabs are darted at the waist, then become scalloped,
          // raised side corners around an independently hanging center tip.
          // Asymmetric length/curvature prevents a row of square cutboards.
          const hemCurve=thief?H*(.027*Math.pow(Math.abs(edge),1.65)
            +.006*Math.sin(panel*2.2+edge*2.3))*t*t:0;
          const y=topY-hemLength*t+hemCurve;
          const fold=1+(.009+.040*t)*Math.cos((u-.5)*Math.PI*2)*Math.sin(panel*2.4+.8);
          const pleat=(t*t)*sx*.040*Math.sin(3*a+panel*.7);
          vertices.push(mx+Math.sin(a)*radius*fold+Math.sin(a)*pleat,
            y+H*.004*Math.sin(u*Math.PI)*Math.sin(t*Math.PI),
            mz+Math.cos(a)*radius*fold*(sz/sx)+Math.cos(a)*pleat*(sz/sx));
          uv.push(u,t);
          if(row<rows&&col<columns){const i=row*(columns+1)+col;
            faces.push(i,i+1,i+columns+1,i+1,i+columns+2,i+columns+1)}
        }
      }
      const geom=new THREE.BufferGeometry();
      geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      geom.setIndex(faces);geom.computeVertexNormals();
      add(`tailored-tunic-pleat-${side}-${panel}`,geom,thief&&panel%4===0?wornPanel:panelCloth);
      // Short edge binding belongs to its own panel, not a floating torus.
      const hem=[];
      for(let col=0;col<=columns;col++){
        const i=(rows*(columns+1)+col)*3;
        hem.push(v(vertices[i],vertices[i+1]-H*.001,vertices[i+2]));
      }
      add(`tunic-pleat-${side}-${panel}-hem-binding`,new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(hem),battle?3:12,H*(battle?.0018:.0025),battle?4:6,false),edgeCloth);
    }
  }else if(style.hem==='robe'||style.hem==='gown'){
    const skirtTop=hips+H*.045;
    const skirtBottom=style.hem==='gown'?ankle+H*.015:style.hem==='robe'?ankle+H*.09:hips-H*.19;
    const len=Math.max(H*.16,skirtTop-skirtBottom);
    const topRadius=sx*.76,flare=style.hem==='gown'?2.03:style.hem==='robe'?1.53:1.07;
    const bottomRadius=sx*flare;
    const geom=new THREE.CylinderGeometry(topRadius,bottomRadius,len,battle?20:96,battle?6:40,true);
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

  if(style.hem==='short'&&!style.armor)ring('double-stitched-short-hem',sx*.56,H*.003,mx,hips-H*.023,mz,trim);

  if(style.cape){
    const top=cy+H*.07,bottom=Math.max(ankle+H*.05,hips-H*.42);
    // CylinderGeometry -PI/2..PI creates its half shell at +Z (the face).
    // PI/2..3PI/2 places the cape behind the shoulders at -Z instead.
    const geom=new THREE.CylinderGeometry(sx*.90,sx*1.80,top-bottom,battle?20:96,battle?6:40,true,Math.PI/2,Math.PI);
    geom.scale(1,1,sz/sx*.82);
    add('three-dimensional-back-and-side-cape',geom,style.crown?material('damask',0xc7aacd):cloth,v(mx,(top+bottom)*.5,mz+sz*.02));
    for(const s of [-1,1])orb('mantle-clasp',H*.027,mx+s*sx*.64,cy+H*.045,front,trim,32);
  }

  // Distinct field-commander silhouette, kept at both inspection and crowd
  // quality. Every piece is skinned onto the existing anatomical skeleton.
  // Never replace the scalp with an opaque cap or the torso with a barrel.
  if(job==='strategist'){
    const shoulderY=cy+H*.038;
    for(const side of [-1,1]){
      const px=mx+side*sx*.83;
      const epaulette=add(`command-epaulette-${side<0?'l':'r'}`,
        new THREE.SphereGeometry(H*.058,battle?12:28,battle?8:16,0,Math.PI*2,0,Math.PI*.55),
        gold,v(px,shoulderY,mz));
      epaulette.scale.set(1.45,.45,.83);
      tube(`command-gold-aiguillette-${side<0?'l':'r'}`,
        v(px,shoulderY-H*.008,front+H*.008),
        v(mx+side*sx*.35,cy-H*.11,chestFront),H*.0038,H*.0038,embroidery);
    }
    const collar=add('military-standing-collar',
      new THREE.CylinderGeometry(sx*.47,sx*.52,H*.068,battle?14:36,battle?2:10,true,
        Math.PI*.12,Math.PI*1.76),cloth,v(mx,cy+H*.080,mz));
    collar.scale.z=sz/sx;
    const seal=orb('strategist-seal',H*.025,mx-sx*.57,cy+H*.041,front+H*.025,
      gold,battle?12:24);
    seal.scale.z=.42;
    // Split twelve-piece command tunic follows both legs during locomotion.
    for(let i=0;i<4;i++)orb(`command-belt-medallion-${i}`,H*.009,
      mx+(i-1.5)*sx*.24,beltY,waistFront+H*.012,embroidery,battle?8:12);
  }

  if(style.hood){
    // The separate 65-bone Ranger hood supplies the actual face opening.
    // No opaque hemisphere over the face/hair.
    const hy=(head?.y??neck.y)+H*.015;
    ring('hood-seam',H*.092,H*.004,mx,hy-H*.085,mz,trim);
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
      // The full forge-steel armor and real sword are modular objects.
      break;
    }
    case 'shield':{
      // The true 3D wooden shield is attached to the left hand by the shared runtime.
      break;
    }
    case 'quiver':{
      const back=surfaceAt(cy-H*.07,true)-H*.025;
      const q=add('back-quiver',new THREE.CylinderGeometry(H*.055,H*.047,H*.26,48,16),leather,
        v(mx+sx*.7,cy-H*.07,back));q.rotation.z=.25;
      for(let i=0;i<5;i++)tube('quiver-arrow',v(q.position.x+(i-2)*H*.014,cy+H*.06,back),v(q.position.x+(i-2)*H*.014,cy+H*.17,back),H*.003,H*.003,steel,16,8);
      break;
    }
    case 'pouches':for(const s of [-1,1]){
      // Equipment is sewn to the belt and rests against the hips. A huge
      // face-forward rectangular block used to hang in front of the torso.
      const x=mx+s*sx*.67;
      const pouch=block('belt-attached-leather-pouch',sx*.22,H*.067,sz*.25,
        x,beltY-H*.05,mz+sz*.70,leather);
      pouch.rotation.y=s*.21;
      block('pouch-stitched-lid',sx*.24,H*.012,sz*.29,x,beltY-H*.021,mz+sz*.70,trim);
    }break;
    case 'mask':block('face-wrap',sx*.94,H*.072,sz*.23,mx,(head?.y??neck.y)-H*.065,(head?.z??mz)+H*.080,cloth);break;
    case 'apron':{
      const a=block('tailored-front-apron',sx*1.35,H*.32,H*.020,mx,hips-H*.125,waistFront+H*.014,lining);
      a.geometry.translate(0,-H*.015,0);break;
    }
    case 'holy':{
      block('stole-left',H*.035,H*.38,H*.015,mx-sx*.30,cy-H*.18,front+H*.012,gold);
      block('stole-right',H*.035,H*.38,H*.015,mx+sx*.30,cy-H*.18,front+H*.012,gold);
      block('holy-vertical',H*.018,H*.10,H*.018,mx,cy-H*.03,front+H*.015,gold);
      block('holy-horizontal',H*.065,H*.018,H*.018,mx,cy-H*.025,front+H*.015,gold);break;
    }
    case 'crystal':case 'jewel':case 'runes':{
      orb('gemstone-pendant',H*.035,mx,cy-H*.08,front+H*.025,style.badge==='runes'?steel:gold,48);
      if(style.badge==='runes')for(const s of [-1,1])orb('arcane-rune',H*.024,mx+s*sx*.60,cy-H*.03,front+H*.01,gold);break;
    }
    case 'chain':for(let i=0;i<8;i++)orb('minister-chain-link',H*.012,mx+Math.cos(i/7*Math.PI)*sx*.65,cy-H*.09+Math.sin(i/7*Math.PI)*H*.07,front+H*.012,gold);break;
    case 'medal':orb('royal-order-medal',H*.045,mx,cy-H*.13,front+H*.03,gold,48);break;
    case 'sash':{
      const s=block('princely-diagonal-sash',H*.055,H*.40,H*.018,mx+sx*.05,cy-H*.10,front+H*.035,gold);s.rotation.z=.52;
      break;
    }
  }

  let triangles=0;
  group.traverse(o=>{if(o.isMesh){const g=o.geometry;triangles+=g.index?g.index.count/3:g.attributes.position.count/3}});
  group.userData={procedural:true,triangles:Math.round(triangles),source:'17-role-photo-pbr-couture-v6',quality,
    motif:couture.motif,materials:mats,
    tunicPanels:group.children.filter(m=>/^tailored-tunic-pleat-[lr]-\d+$/.test(m.name)).length};
  return group;
}
