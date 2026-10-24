import {attachHeroDetails} from './hero-detail-bom.js?v=82.0';
import {CHARACTER_PARTS,resolveCharacterAssembly} from './character-assembly-bom.js?v=47.0';
import {makeCharacterMaterialFactory} from './character-material-bom.js?v=51.0';
const HUMAN_GEOMETRIES=new WeakMap();
import {HUMAN_PARTS,expandHumanBom} from './human-bom.js';
import {makeMaterialFactory} from './material-catalog.js';
import {createAnimeMaterialFactory} from './anime-materials.js';
import {HUMAN_JOINT_BOM} from './human-bom.js';
import {attachSmoothHumanSkin} from './human-skin.js?v=46.0';
/** Character parts are original-size reusable meshes; pivots preserve walking animation. */
export function createHumanBomRig(THREE,host,{id='person',role='civilian',variant=0,assembly=null}={}){
 const recipe=resolveCharacterAssembly({role,variant,overrides:assembly?{body:assembly.body,face:assembly.face,hair:assembly.hair,outfit:assembly.outfit,equipment:assembly.equipment}: {}});
 const body=CHARACTER_PARTS.bodies[recipe.body],hairStyle=CHARACTER_PARTS.hairs[recipe.hair],outfit=CHARACTER_PARTS.outfits[recipe.outfit];
 const bom=expandHumanBom(role),root=new THREE.Group();host.add(root);
 const baseMaterial=makeMaterialFactory(THREE),toAnime=createAnimeMaterialFactory(THREE);
 // Physically based surface response preserves leather grain, skin variation and metallic sheen.
 const characterMaterial=makeCharacterMaterialFactory(THREE,{role,variant});
 const material=id=>['skin','linen','leather','walnut','hair','royal','steel','brass','iron','lip'].includes(id)?characterMaterial(id):baseMaterial(id);
 const geoCache=HUMAN_GEOMETRIES.get(THREE)??new Map();
 HUMAN_GEOMETRIES.set(THREE,geoCache);
 const geom=(key)=>{
  if(geoCache.has(key))return geoCache.get(key);
  const p=HUMAN_PARTS[key],[x,y,z]=p.size;
  const g=p.shape==='sphere'||p.shape==='box'?new THREE.SphereGeometry(1,24,16):
   p.shape==='capsule'?new THREE.LatheGeometry([
    new THREE.Vector2(.02,-y*.5),new THREE.Vector2(x*.34,-y*.49),
    new THREE.Vector2(x*.49,-y*.32),new THREE.Vector2(x*.5,-y*.08),
    new THREE.Vector2(x*.53,y*.15),new THREE.Vector2(x*.46,y*.36),
    new THREE.Vector2(x*.2,y*.49),new THREE.Vector2(.02,y*.5)
   ],20):
   p.shape==='cylinder'?new THREE.CylinderGeometry(x/2,x/2,y,20):
   new THREE.SphereGeometry(1,20,12);
  geoCache.set(key,g);return g;
 };
 const leg=[-1,1].map(side=>{const g=new THREE.Bone();g.position.set(side*.115,.88,0);root.add(g);return g});
 const arm=[-1,1].map(side=>{const g=new THREE.Bone();g.position.set(side*.255,1.40,0);root.add(g);return g});
 // Additional articulated joints are children of the upper limb pivots.
 const knee=leg.map(g=>{const k=new THREE.Group();k.position.set(0,-.39,0);g.add(k);return k});
 const elbow=arm.map(g=>{const e=new THREE.Group();e.position.set(0,-.32,0);g.add(e);return e});
 const wrist=elbow.map(e=>{const w=new THREE.Group();w.position.set(0,-.29,0);e.add(w);return w});
 const ankle=knee.map(k=>{const a=new THREE.Group();a.position.set(0,-.39,0);k.add(a);return a});
 const neck=new THREE.Bone();neck.position.set(0,1.52,0);root.add(neck);
 const spine=new THREE.Bone();spine.position.set(0,.98,0);root.add(spine);
 // Reparent torso, shoulders and neck as one anatomical kinematic chain.
 arm.forEach((group,i)=>{spine.add(group);group.position.set((i===0?-1:1)*.255,.39,0);});
 spine.add(neck);neck.position.set(0,.54,0);
 const headPivot=new THREE.Bone();headPivot.position.set(0,.13,0);neck.add(headPivot);
 const fingers=arm.map((_,i)=>{const group=new THREE.Group();group.position.set(0,-.08,.035);wrist[i].add(group);return group});
 const parents={body:root,head:neck,legLeft:leg[0],legRight:leg[1],armLeft:arm[0],armRight:arm[1]};
 const addPart=(partId,parent,position,materialId,componentId)=>{
  const info=HUMAN_PARTS[partId],mesh=new THREE.Mesh(geom(partId),material(materialId??info.material));
  mesh.position.set(...position);
  if(info.shape==='sphere'||info.shape==='box')mesh.scale.set(...info.size);
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData.partId=partId;mesh.userData.componentId=componentId;parent.add(mesh);return mesh;
 };
 for(const p of bom.parts){
  let parent=parents[p.attach],position=p.position;
  if(['torso','breastplate','cape'].includes(p.partId)){parent=spine;position=[p.position[0],p.position[1]-.98,p.position[2]];}
  if(p.partId==='shin'){parent=knee[p.attach==='legLeft'?0:1];position=[0,-.185,0];}
  if(p.partId==='boot'){parent=ankle[p.attach==='legLeft'?0:1];position=[0,-.055,.06];}
  if(p.partId==='forearm'){parent=elbow[p.attach==='armLeft'?0:1];position=[0,-.15,0];}
  if(p.partId==='hand'){parent=wrist[p.attach==='armLeft'?0:1];position=[0,-.075,0];}
  if(['head','hair','eye','nose','ear','brow','mouth'].includes(p.partId)){
   parent=headPivot;position=[p.position[0],p.position[1]-1.65,p.position[2]];
  }
  const mesh=addPart(p.partId,parent,position,p.materialId,id+':'+p.id);
  if(p.partId==='boot'){mesh.scale.set(.092,.097,.17);mesh.position.z+=.075;}
  if(p.partId==='head'){mesh.scale.set(.118,.139,.12);}
  if(p.partId==='hair'){mesh.scale.set(.126,.081,.137);}
  if(p.partId==='pelvis'){mesh.scale.set(.19,.13,.15);}
  if(p.partId==='belt'){mesh.scale.set(.205,.043,.155);}
 }
 // Details are also catalog items, not independently constructed faces.
 const facialDetails=[
  ['nose',0,1.752,.13,'skin'],['mouth',0,1.707,.123,'lip'],
  ['brow',-.046,1.82,.121,'hair'],['brow',.046,1.82,.121,'hair'],
  ['ear',-.114,1.77,0,'skin'],['ear',.114,1.77,0,'skin']
 ];
 facialDetails.forEach(([key,x,y,z,finish],i)=>addPart(key,headPivot,[x,y-1.65,z],finish,id+':face:'+i));
 // Anatomical clothing overlays and hair locks stay attached to the articulated torso/head.
 const extra=(parent,partId,pos,scale,finish,geometry='sphere')=>{
  const mesh=new THREE.Mesh(
   geometry==='cone'?new THREE.ConeGeometry(1,1,9):new THREE.SphereGeometry(1,20,14),
   material(finish));
  mesh.position.set(...pos);mesh.scale.set(...scale);
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData.partId=partId;parent.add(mesh);
 };
 // Torso silhouette: shoulder taper, chest, waist, tunic skirt and belt.
 extra(spine,'chest-shell',[0,.24,0],[.224,.285,.146],role==='hero'||role==='guard'?'steel':'linen');
 extra(spine,'waist-shell',[0,-.075,0],[.183,.205,.138],role==='royal'?'royal':'leather');
 extra(spine,'tunic-hem',[0,-.19,0],[.205,.145,.155],role==='royal'?'royal':'leather');
 for(const side of [-1,1]){
  extra(spine,'shoulder-cap',[side*.215,.37,0],[.082,.092,.105],role==='guard'?'steel':'linen');
  extra(headPivot,'hair-lock',[side*.085,.165,.045],[.061,.13,.079],'hair');
  extra(headPivot,'cheek',[side*.066,.06,.083],[.043,.055,.038],'skin');
  extra(leg[side<0?0:1],'thigh-shell',[0,-.18,0],[.108,.23,.108],'leather');
  extra(knee[side<0?0:1],'calf-shell',[0,-.19,0],[.079,.205,.084],'leather');
 }
 extra(headPivot,'fringe',[0,.205,.092],[.14,.043,.09],'hair');
 extra(headPivot,'chin',[0,-.072,.067],[.074,.048,.069],'skin');
 // Small cloth folds and boot cuffs make the parts read as clothing rather than exposed joints.
 for(const side of [-1,1]){
  const idx=side<0?0:1;
  extra(elbow[idx],'sleeve-cuff',[0,.03,0],[.077,.052,.078],role==='royal'?'royal':'linen');
  extra(ankle[idx],'boot-cuff',[0,.09,0],[.091,.065,.092],'walnut');
 }
 extra(spine,'collar',[0,.47,.015],[.125,.052,.121],role==='royal'?'royal':'linen');
 // Articulated elbow/knee covering volumes eliminate the separated wooden-puppet silhouette.
 for(let i=0;i<2;i++){
  extra(elbow[i],'elbow-skin',[0,0,0],[.061,.072,.066],'leather');
  extra(knee[i],'kneecap',[0,0,.012],[.09,.105,.088],'leather');
  extra(wrist[i],'wrist-skin',[0,0,0],[.055,.067,.057],'skin');
  extra(ankle[i],'ankle-leather',[0,-.015,0],[.077,.09,.077],'walnut');
 }
 // Stylized anime face: layered sclera, irises, pupils, eyelids and eyebrows.
 // All details are attached to the head bone and follow its animation.
 const faceMaterial=(color,roughness=0.82)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0});
 const eyeWhite=faceMaterial(0xf7eee4),iris=faceMaterial(variant%3===0?0x54768c:variant%3===1?0x836a50:0x547364);
 const pupil=faceMaterial(0x151d27),lash=faceMaterial(0x2d211f),cheek=faceMaterial(0xce8d7b);
 const faceShape=(name,geometry,finish,x,y,z,scale,parent=headPivot)=>{
  const mesh=new THREE.Mesh(geometry,finish);mesh.name=name;
  mesh.position.set(x,y,z);mesh.scale.set(...scale);
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.partId=name;parent.add(mesh);return mesh;
 };
 for(const side of [-1,1]){
  const x=side*.047;
  faceShape('anime-sclera',new THREE.SphereGeometry(1,16,12),eyeWhite,x,.122,.116,[.027,.017,.009]);
  faceShape('anime-iris',new THREE.SphereGeometry(1,16,12),iris,x,.121,.125,[.014,.015,.005]);
  faceShape('anime-pupil',new THREE.SphereGeometry(1,12,10),pupil,x,.12,.129,[.007,.01,.004]);
  faceShape('upper-eyelid',new THREE.SphereGeometry(1,12,8),lash,x,.139,.124,[.031,.004,.005]);
  faceShape('lower-eyelid',new THREE.SphereGeometry(1,12,8),material('skin'),x,.104,.122,[.027,.003,.005]);
  faceShape('anime-eyebrow',new THREE.SphereGeometry(1,12,8),material('hair'),x,.161,.113,[.029,.006,.006]);
  faceShape('subtle-cheek',new THREE.SphereGeometry(1,14,8),cheek,side*.083,.068,.085,[.029,.014,.003]).visible=false;
 }
 // Layered tapered hair is preferred to the former round cap-like front fringe.
 for(const side of [-1,1]){
  for(let i=0;i<3;i++){
   const lock=faceShape('tapered-hair-lock',new THREE.ConeGeometry(.032,.19,8),material('hair'),
     side*(.036+i*.033),.196-i*.012,.068-i*.015,[1,1,1]);
   lock.rotation.z=side*(.1+i*.17);
  }
  const sideLock=faceShape('temple-hair',new THREE.ConeGeometry(.048,.20,9),material('hair'),
    side*.104,.11,.005,[1,1,1]);sideLock.rotation.z=side*.17;
 }
 // Shirt seams are attached to the spine, while sleeve edges follow each arm.
 for(const side of [-1,1]){
  const seam=faceShape('tunic-side-seam',new THREE.CylinderGeometry(.004,.004,.39,6),material('walnut'),
    side*.162,.09,.126,[1,1,1],spine);seam.rotation.z=side*.13;
  faceShape('shoulder-stitch',new THREE.SphereGeometry(1,12,8),material('linen'),
    side*.188,.367,.106,[.07,.009,.011],spine);
 }
 faceShape('waist-buckle',new THREE.BoxGeometry(.05,.042,.012),material('brass'),0,-.087,.15,[1,1,1],spine);
 // The cape is a draped tapered cloth surface, never an oversized spherical BOM part.
 if(role==='hero'||role==='royal'){
  const verts=[],uv=[],faces=[],rows=12,cols=10;
  for(let r=0;r<=rows;r++){
   const t=r/rows,halfWidth=.17+t*.105;
   for(let c=0;c<=cols;c++){
    const u=c/cols,x=(u*2-1)*halfWidth;
    const y=.44-t*.77;
    const z=-.19-.08*t*t+.022*Math.sin(u*Math.PI*4)*t;
    verts.push(x,y,z);uv.push(u,t);
   }
  }
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
   const a=r*(cols+1)+c,b=a+cols+1;
   faces.push(a,b,a+1,a+1,b,b+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(faces);geometry.computeVertexNormals();
  const cape=new THREE.Mesh(geometry,material('royal'));
  cape.userData.partId='draped-cloth-cape';
  cape.castShadow=true;cape.receiveShadow=true;spine.add(cape);
 }

 // v44 visibly differentiated equipment. Shapes are wearable pieces attached to the
 // same articulated BOM, not spherical primitive body anatomy.
 const palette={
  hero:{cloth:0x223c65,trim:0xe2b666,hair:0x524138,metal:0xaab7c2},
  guard:{cloth:0x555f72,trim:0xd6a966,hair:0x392f30,metal:0xb7c0ca},
  royal:{cloth:0x76384e,trim:0xe9c17e,hair:0x51362e,metal:0xc7b1a0},
  civilian:{cloth:[0x536f65,0x786149,0x53677e,0x87635e][variant%4],trim:0xd4c0a0,hair:0x49382b,metal:0x9b948b}
 }[role]||{cloth:0x536f65,trim:0xd4c0a0,hair:0x49382b,metal:0xb0b0b0};
 const jrpgColors={navy:0x273c78,crimson:0xa23a52,gold:0xd9b75f,blue:0x356ab6,silver:0xc3cad5,brown:0x865735,white:0xf2e8d8,green:0x477b5a,cream:0xe0bd92,darkred:0x743a34,iron:0x77818b,gray:0x878d92,yellow:0xd8ad4e,pink:0xc67f9f,skyblue:0x79b1cf,beige:0xc7aa82,orange:0xc98545,red:0xbb5250,leather:0x8a5d40,purple:0x8360a4};
 if(assembly?.palette?.length){
  palette.cloth=jrpgColors[assembly.palette[0]]??palette.cloth;
  palette.trim=jrpgColors[assembly.palette[1]]??palette.trim;
  palette.metal=jrpgColors[assembly.palette[2]]??palette.metal;
  palette.hair=assembly.hair==='bald'?palette.hair:(assembly.role==='royal'?0x52453e:assembly.role==='guard'?0x352c27:palette.hair);
 }
 const toon=(hex)=>{const m=material('linen').clone();m.color=new THREE.Color(hex);return m;};
 const cloth=toon(palette.cloth),trim=toon(palette.trim),metal=toon(palette.metal),hairFinish=toon(palette.hair);
 const wearable=(parent,name,geometry,mat,x,y,z)=>{
  const m=new THREE.Mesh(geometry,mat);m.name='v44-'+name;m.position.set(x,y,z);
  m.castShadow=true;m.receiveShadow=true;m.userData.partId='v44-'+name;parent.add(m);return m;
 };
 // Tailored 3D tunic rather than a plain skin-coloured cylinder. Flaring lower hem.
 const tunic=wearable(spine,'tailored-coat',
  new THREE.CylinderGeometry(.225,.275,.76,32,12,false),cloth,0,.115,0);
 tunic.scale.z=.78;tunic.scale.x*=outfit.coat;tunic.scale.y*=outfit.coat;
 const lower=wearable(spine,'flared-hem',
  new THREE.CylinderGeometry(.205,.325,.29,32,5,false),cloth,0,-.28,0);lower.scale.z=.82;
 for(const side of [-1,1]){
  const k=side<0?0:1;
  // Distinct shaped upper arm and long tapering sleeve.
  const sleeve=wearable(arm[k],'tailored-sleeve',
   new THREE.CylinderGeometry(.105,.079,.38,20,8),cloth,0,-.18,0);sleeve.scale.z=.84;
  const forearm=wearable(elbow[k],'forearm-glove',
   new THREE.CylinderGeometry(.086,.060,.26,18,6),cloth,0,-.155,0);forearm.scale.z=.88;
  const cuff=wearable(elbow[k],'contrasting-cuff',
   new THREE.TorusGeometry(.078,.009,7,18),trim,0,-.305,0);cuff.rotation.x=Math.PI/2;
  // Armoured silhouettes for military roles, tailoring for civilians.
  if(outfit.armor){
   const pad=wearable(arm[k],'sculpted-pauldron',
    new THREE.SphereGeometry(.145,24,14,0,Math.PI*2,0,Math.PI*.7),
    metal,0,.008,0);pad.scale.set(1.15,.70,1.08);
  }
  const legCover=wearable(leg[k],'trouser-leg',
   new THREE.CylinderGeometry(.128,.095,.40,20,8),cloth,0,-.18,0);legCover.scale.z=.90;
  // Layered mane-like locks, tapering along temples and around the back of the head.
  for(let j=0;j<hairStyle.layers;j++){
   const phi=j/Math.max(1,hairStyle.layers)*Math.PI*2;
   const r=.119*hairStyle.fullness,xx=Math.sin(phi)*r,zz=Math.cos(phi)*r;
   const strand=wearable(headPivot,'layered-hair',
    new THREE.ConeGeometry(.020+(j%3)*.004,hairStyle.length*(.85+(j%4)*.12),7),
    hairFinish,xx+hairStyle.sweep*.025,.225-(j%3)*.016,zz);
   strand.rotation.z=Math.sin(phi)*.18;strand.rotation.x=-Math.cos(phi)*.12;
  }
 }
 // Visible lapels, collar, cross-body straps and high-contrast outfit details.
 for(const side of [-1,1]){
  const lapel=wearable(spine,'lapel',
   new THREE.BoxGeometry(.068,.35,.016),trim,side*.10,.275,.145);
  lapel.rotation.z=side*.33;
  const belt=wearable(spine,'belt-side',
   new THREE.BoxGeometry(.16,.055,.018),trim,side*.12,-.13,.153);
 }
 wearable(spine,'front-buckle',new THREE.BoxGeometry(.078,.073,.024),metal,0,-.13,.17);
 const collar=wearable(spine,'stand-collar',
  new THREE.CylinderGeometry(.116,.15,.11,24,4,true),trim,0,.515,0);collar.scale.z=.80;

 // Data-driven equipment attachment points (independent of actor role).
 const equipment=CHARACTER_PARTS.equipment[recipe.equipment];
 const grip=(hand,kind)=>{
  if(!kind)return;
  const handJoint=hand===0?wrist[0]:wrist[1],mount=new THREE.Group();handJoint.add(mount);mount.name='weapon-bom-mount';mount.scale.setScalar(.68);const handle=wearable(mount,'equipment-grip',
   new THREE.CylinderGeometry(.018,.018,.20,10),material('walnut'),0,-.16,.075);
  if(kind==='sword'){
   const blade=wearable(mount,'sword-blade',new THREE.BoxGeometry(.052,.48,.018),
    material('steel'),0,-.49,.078);
   blade.rotation.z=.08;
   wearable(mount,'sword-guard',new THREE.BoxGeometry(.19,.027,.04),
    material('brass'),0,-.265,.078);
  }else if(kind==='staff'){
   wearable(mount,'magic-staff',new THREE.CylinderGeometry(.022,.027,1.1,12),
    material('walnut'),0,-.49,.08);
   wearable(mount,'staff-gem',new THREE.OctahedronGeometry(.085),
    material('royal'),0,-1.04,.08);
  }else if(kind==='shield'){
   const shield=wearable(mount,'shield',new THREE.CylinderGeometry(.25,.27,.045,12),
    material('steel'),.11,-.22,.18);
   shield.rotation.x=Math.PI/2;
   wearable(mount,'shield-boss',new THREE.SphereGeometry(.068,12,8),
    material('brass'),.11,-.22,.215);
  }
 };
 grip(0,equipment.left);
 grip(1,equipment.right);
 // Face presets adjust an existing bone-attached facial hierarchy rather than duplicating actors.
 const face=CHARACTER_PARTS.faces[recipe.face];
 headPivot.traverse(node=>{
  if(!node.isMesh)return;
  if(node.name==='anime-sclera'||node.name==='anime-iris'||node.name==='anime-pupil')
   node.scale.y*=face.eyes;
  if(node.name==='anime-eyebrow')node.rotation.z+=node.position.x<0?face.browAngle:-face.browAngle;
 });
 // Human-sized silhouettes with smaller equipment rather than oversized toy swords.
 root.userData.visualRevision=role==='hero'?'v52-hero-sculpted-bom':'v47-data-driven-character-assembly';


 const joints={hip:root,spine,neck,head:headPivot,shoulders:arm,elbows:elbow,wrists:wrist,fingers,hips:leg,knees:knee,ankles:ankle};
 const skin=attachSmoothHumanSkin(THREE,root,joints,material);
 if(role==='hero')root.userData.heroDetails=attachHeroDetails(THREE,joints,material);
 // The historical primitive surface is no longer visible; it is still present as BOM metadata.
 const retired=new Set(['torso','pelvis','neck','head','upperArm','forearm','hand','thigh','shin','chest-shell','waist-shell','tunic-hem','shoulder-cap','thigh-shell','calf-shell','cheek','chin','elbow-skin','kneecap','wrist-skin','ankle-leather','cape','fringe','hair-lock','eye','brow']);
 root.traverse(node=>{if(node!==skin&&node.isMesh&&retired.has(node.userData?.partId))node.visible=false;});
 root.traverse(node=>{if(node.isMesh&&node.userData?.partId==='eye')node.position.z+=.025;});
 // Match a human silhouette (1.55–1.9 metres), never the former 2.45m chibi height.
 root.scale.set(body.scale[0]*body.height/1.96,body.scale[1]*body.height/1.96,body.scale[2]*body.height/1.96);
 root.scale.multiplyScalar(role==='hero'?1.31:1.24);
 root.userData.characterRecipe={...recipe,sourcePresetId:assembly?.id??null,palette:assembly?.palette??null};root.userData.bomId=role;root.userData.heightM=body.height;root.userData.jointBom=HUMAN_JOINT_BOM;
 const state={root,skin,leg,arm,joints,t:variant*.73,moving:false,running:false,velocity:0,bomId:role,heightM:body.height,restPose:{height:body.height},recipe};
 root.userData.jointCount=Object.values(joints).reduce((n,j)=>n+(Array.isArray(j)?j.length:1),0);
 host.userData.chibi=state;
 return state;
}
