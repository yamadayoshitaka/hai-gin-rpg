import * as THREE from 'three';

/** Data-driven wardrobe preview, isolated from the game's battle classes. */
export const HERO_JOBS=Object.freeze([
 {id:'knight',label:'騎士',gear:'sword',color:'#293c65',trim:'#c9cbd3'},
 {id:'swordsman',label:'剣士',gear:'sword',color:'#354c79',trim:'#c4c5cb'},
 {id:'archer',label:'弓使い',gear:'bow',color:'#4c6745',trim:'#b8a477'},
 {id:'ninja',label:'忍者',gear:'dagger',color:'#272f43',trim:'#667b94'},
 {id:'thief',label:'シーフ',gear:'dagger',color:'#564333',trim:'#a7835d'},
 {id:'mage',label:'魔法使い',gear:'staff',color:'#483c75',trim:'#ad98dc'},
 {id:'cleric',label:'僧侶',gear:'staff',color:'#e2dcca',trim:'#cbab68'},
 {id:'shield',label:'盾騎士',gear:'shield',color:'#273b61',trim:'#cfdaeb'},
 {id:'fighter',label:'格闘家',gear:'none',color:'#6b3940',trim:'#b99577'},
 {id:'summoner',label:'召喚士',gear:'staff',color:'#36566a',trim:'#7fcee0'}
]);
export const HERO_OUTFITS=Object.freeze([
 {id:'job',label:'職業専用（推奨）'},
 {id:'armor',label:'鎧・戦闘装束',base:'#283d5f',trim:'#c8cbd4'},
 {id:'robe',label:'ローブ',base:'#493e64',trim:'#c1a886'},
 {id:'leather',label:'軽装・革装備',base:'#554132',trim:'#ab8b67'},
 {id:'travel',label:'旅装',base:'#405d52',trim:'#9bafa3'},
 {id:'casual',label:'私服',base:'#6b6880',trim:'#c3b9ba'}
]);
export const HERO_ACTIONS=Object.freeze([
 {id:'idle',label:'待機'},
 {id:'walk',label:'歩く'},
 {id:'run',label:'走る'},
 {id:'attack',label:'攻撃'},
 {id:'guard',label:'防御'},
 {id:'cast',label:'魔法詠唱'},
 {id:'victory',label:'勝利ポーズ'}
]);
const byId=(items,id)=>items.find(x=>x.id===id)||items[0];
const makeMat=color=>new THREE.MeshStandardMaterial({color,roughness:.46,metalness:.22});
const decorate=(container,geometry,color,x,y,z,rotationZ=0)=>{
 const mesh=new THREE.Mesh(geometry,makeMat(color));
 mesh.position.set(x,y,z);mesh.rotation.z=rotationZ;
 container.add(mesh);return mesh;
};
/** Actual source body mesh vertex colors change; cosmetics are not screenshots. */
export function createHeroineStudioWardrobe(bodyAttachment,actor){
 if(!bodyAttachment?.body||!bodyAttachment?.root||!actor)
  throw Error('Real body attachment and actor required for wardrobe');
 const body=bodyAttachment.body,host=bodyAttachment.root;
 body.updateWorldMatrix(true,true);
 const bounds=new THREE.Box3().setFromObject(body);
 const size=bounds.getSize(new THREE.Vector3());
 const middle=bounds.getCenter(new THREE.Vector3());
 const paletteItems=[];
 body.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible)return;
  const positions=mesh.geometry?.getAttribute('position');
  const colors=mesh.geometry?.getAttribute('color');
  if(!positions||!colors)return;
  const zones=[];
  const world=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   world.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
   zones.push([(world.y-bounds.min.y)/Math.max(.001,size.y),
    Math.abs(world.x-middle.x)/Math.max(.001,size.x*.5)]);
  }
  paletteItems.push({mesh,zones});
 });
 const equipment=new THREE.Group();
 equipment.name='HEROINE_JOB_EQUIPMENT';
 host.add(equipment);
 let actorRoot=actor;
 let jobId='knight',outfitId='job',actionId='idle',elapsed=0,visible=true;
 const actorRestPosition=actor.position.clone(),actorRestRotation=actor.rotation.clone();
 const localPoint=(x,y,z)=>host.worldToLocal(new THREE.Vector3(
  middle.x+x*size.x,bounds.min.y+y*size.y,middle.z+z*size.z));
 const accessoryRoot=new THREE.Group();
 accessoryRoot.name='HEROINE_EQUIPMENT_PROP';
 equipment.add(accessoryRoot);
 function clearAccessories(){
  for(const child of [...accessoryRoot.children]){
   child.traverse(o=>{
    if(o.isMesh){o.geometry?.dispose();o.material?.dispose();}
   });
   accessoryRoot.remove(child);
  }
 }
 function drawAccessory(gear,trim){
  clearAccessories();
  if(gear==='none')return;
  const at=localPoint(.39,.53,.42),h=size.y;
  accessoryRoot.position.copy(at);
  const metal='#c8d1d6',wood='#614736';
  if(gear==='sword'||gear==='dagger'){
   const blade=gear==='dagger'?.13:.28;
   decorate(accessoryRoot,new THREE.BoxGeometry(h*.020,h*blade,h*.008),metal,0,h*blade*.5,0);
   decorate(accessoryRoot,new THREE.BoxGeometry(h*.090,h*.012,h*.018),trim,0,0,h*.014);
   decorate(accessoryRoot,new THREE.CylinderGeometry(h*.014,h*.014,h*.110,8),wood,0,-h*.062,0);
  }else if(gear==='staff'){
   decorate(accessoryRoot,new THREE.CylinderGeometry(h*.009,h*.015,h*.41,9),
    wood,0,h*.12,0);
   decorate(accessoryRoot,new THREE.IcosahedronGeometry(h*.038,1),
    trim,0,h*.355,0);
  }else if(gear==='shield'){
   const shield=decorate(accessoryRoot,new THREE.CylinderGeometry(h*.12,h*.13,h*.018,7),
    trim,0,h*.045,0);
   shield.rotation.x=Math.PI*.5;
   const boss=decorate(accessoryRoot,new THREE.SphereGeometry(h*.041,12,8),metal,
    0,h*.045,h*.026);
   boss.scale.z=.5;
  }else if(gear==='bow'){
   const arc=decorate(accessoryRoot,new THREE.TorusGeometry(h*.18,h*.008,8,32,Math.PI*1.40),
    trim,0,h*.09,0);
   arc.rotation.z=-Math.PI*.20;
   decorate(accessoryRoot,new THREE.CylinderGeometry(h*.003,h*.003,h*.32,6),
    '#e7dcc8',h*.06,h*.08,0);
  }
 }
 const sm=THREE.MathUtils.smoothstep;
 function paint(){
  const job=byId(HERO_JOBS,jobId),outfit=byId(HERO_OUTFITS,outfitId);
  const base=new THREE.Color(outfit.base||job.color);
  const trim=new THREE.Color(outfit.trim||job.trim);
  const skin=new THREE.Color('#edcbbf');
  const pants=new THREE.Color(outfitId==='casual'?'#464458':'#202f42');
  const boots=new THREE.Color('#4d3c35');
  const vertex=new THREE.Color();
  for(const {mesh,zones} of paletteItems){
   const attribute=mesh.geometry.getAttribute('color');
   for(let i=0;i<zones.length;i++){
    const [ny,nx]=zones[i];
    const trouser=sm(ny,.13,.22)*(1-sm(ny,.46,.56));
    const boot=1-sm(ny,.16,.25);
    const torso=sm(ny,.47,.57)*(1-sm(ny,.815,.89))*(1-sm(nx,.60,.80));
    const detail=sm(ny,.65,.70)*(1-sm(ny,.78,.84))*(1-sm(nx,.43,.68));
    const shoulder=sm(ny,.70,.78)*(1-sm(ny,.82,.88))*sm(nx,.47,.59)*(1-sm(nx,.85,1));
    vertex.copy(skin).lerp(pants,trouser).lerp(base,torso)
     .lerp(trim,Math.max(detail,shoulder)*(outfitId==='robe'?.30:.90))
     .lerp(boots,boot);
    attribute.setXYZ(i,vertex.r,vertex.g,vertex.b);
   }
   attribute.needsUpdate=true;
  }
  drawAccessory(job.gear,outfit.trim||job.trim);
  equipment.visible=visible;
  host.userData.selectedHeroineJob=job.id;
  host.userData.selectedHeroineCostume=outfit.id;
  host.userData.selectedHeroineAction=actionId;
 }
 function setSelection(next={}){
  jobId=byId(HERO_JOBS,next.jobId||jobId).id;
  outfitId=byId(HERO_OUTFITS,next.outfitId||outfitId).id;
  paint();
 }
 function setAction(next){
  actionId=byId(HERO_ACTIONS,next).id;elapsed=0;
  host.userData.selectedHeroineAction=actionId;
 }
 function attachActor(next){
  actorRoot.position.copy(actorRestPosition);
  actorRoot.rotation.copy(actorRestRotation);
  actorRoot=next;
 }
 function update(dt){
  elapsed+=Math.max(0,Math.min(.05,dt));
  const t=elapsed;
  let bob=0,tilt=0,arm=0;
  if(actionId==='idle'){bob=.0018*Math.sin(t*1.5);}
  if(actionId==='walk'){bob=.008*Math.abs(Math.sin(t*6));tilt=.021*Math.sin(t*6);}
  if(actionId==='run'){bob=.019*Math.abs(Math.sin(t*11));tilt=.046*Math.sin(t*11);}
  if(actionId==='attack'){tilt=.070*Math.sin(t*5);arm=.55*Math.sin(t*5);}
  if(actionId==='guard'){tilt=-.035;arm=-.18;}
  if(actionId==='cast'){bob=.007*Math.sin(t*3);tilt=.025*Math.sin(t*3);arm=.28*Math.sin(t*3);}
  if(actionId==='victory'){bob=.012*Math.sin(t*3);tilt=.06*Math.sin(t*2);arm=.3;}
  actorRoot.position.y=actorRestPosition.y+bob;
  actorRoot.rotation.z=actorRestRotation.z+tilt;
  equipment.rotation.z=arm;
 }
 paint();
 return {
  getState:()=>({jobId,outfitId,actionId,equipmentCount:accessoryRoot.children.length,
   bodyMeshCount:paletteItems.length,animationType:'procedural-full-body-preview'}),
  setSelection,setAction,update,attachActor,
  setVisible:flag=>{visible=!!flag;equipment.visible=visible;},
  dispose:()=>{clearAccessories();equipment.removeFromParent();}
 };
}
