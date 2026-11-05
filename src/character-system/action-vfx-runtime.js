/** Bounded visual feedback for every gameplay action family. All effects are
 * cosmetic; combat and navigation remain authoritative in the simulation.
 * User-supplied sprite textures are reused and arrows follow a genuine
 * quadratic ballistic arc instead of teleporting to the target. */
import * as THREE from 'three';
import {sampleArrowArc,arrowArcVelocity,chooseArrowFlight} from './ballistic-trajectory.js';

const ROOT='./assets/vfx/user-imported/';
export const ACTION_EFFECT_TEXTURES=Object.freeze({
  slash:'slash.png',heavy:'heavy-slash.png',spark:'spark.png',
  arcane:'arcane.png',fire:'fire.png',earth:'earth.png',
  water:'water.png',nature:'nature.png'
});
const COLORS=Object.freeze({
  slash:0xe3eafa,heavy:0xffcd89,spark:0xffc57a,arcane:0xcda8ff,
  fire:0xff8140,earth:0xe2b16e,water:0x8ad8ff,nature:0x9ef2a8,
  dust:0xbcb8aa,guard:0x9bd9ff,heal:0x83edbb
});
export function actionEffectKind(action='',job=''){
  const text=String(action).toLowerCase(),role=String(job).toLowerCase();
  if(/idle|待機|立ち|stand|breathe|呼吸/.test(text))return 'idle';
  if(/land|着地/.test(text))return 'land';
  if(/death|dead|die|戦闘不能|死亡|倒れ/.test(text))return 'death';
  if(/hit|hurt|damage|被弾|のけぞ/.test(text))return 'hit';
  if(/guard|block|parry|防御|盾構え/.test(text))return 'guard';
  if(/dodge|evade|回避|ステップ/.test(text))return 'dodge';
  if(/jump|leap|跳躍|ジャンプ/.test(text))return 'jump';
  if(/dash|sprint|run|ダッシュ|走/.test(text))return 'run';
  if(/walk|忍び|歩行|歩く/.test(text))return 'walk';
  if(/heal|祈り|回復|bless/.test(text))return 'heal';
  if(/item|use|drink|道具|薬|解錠/.test(text))return 'item';
  if(/draw|aim|照準|弓を引|弓待機/.test(text))return 'aim';
  if(/arrow|bow|shoot|release|射撃|矢を放|弓/.test(text)||/archer|弓使い/.test(role)&&/attack|攻撃/.test(text))return 'arrow';
  if(/spell|cast|summon|magic|魔法|詠唱|召喚/.test(text)||/魔法使い|召喚士|僧侶/.test(role)&&/attack|攻撃/.test(text))return 'magic';
  if(/heavy|大技|強打|強斬|強連/.test(text))return 'heavy';
  if(/punch|kick|fist|拳|蹴|格闘/.test(text)||/格闘家/.test(role)&&/attack|攻撃/.test(text))return 'punch';
  if(/sword|slash|stab|attack|strike|斬|突き|攻撃|剣|連撃|ナイフ|二刀/.test(text))return 'slash';
  if(/skill|buff|技|強化|支援/.test(text))return 'buff';
  return 'interaction';
}

export class ActionVfxRuntime{
  constructor(scene,{maxEffects=64,maxArrows=24,textureRoot=ROOT}={}){
    this.scene=scene;this.maxEffects=maxEffects;this.maxArrows=maxArrows;
    this.textureRoot=textureRoot;this.effects=[];this.arrows=[];this.maps=new Map();
    this.loader=new THREE.TextureLoader();this.disposed=false;
    this.ringGeometry=new THREE.TorusGeometry(1,.075,6,20);
    this.arrowShaft=new THREE.CylinderGeometry(.009,.012,.69,6);
    this.arrowHead=new THREE.ConeGeometry(.029,.12,6);
    this.arrowFletch=new THREE.ConeGeometry(.045,.17,4);
    this.wood=new THREE.MeshStandardMaterial({color:0x91663d,roughness:.86});
    this.metal=new THREE.MeshStandardMaterial({color:0xd6e0e8,metalness:.62,roughness:.36});
    this.feather=new THREE.MeshStandardMaterial({color:0xddd2b2,side:THREE.DoubleSide,roughness:.87});
  }
  texture(kind){
    if(!ACTION_EFFECT_TEXTURES[kind])return Promise.resolve(null);
    if(!this.maps.has(kind))this.maps.set(kind,this.loader.loadAsync(this.textureRoot+ACTION_EFFECT_TEXTURES[kind])
      .then(texture=>{texture.colorSpace=THREE.SRGBColorSpace;return texture})
      .catch(()=>null));
    return this.maps.get(kind);
  }
  flash(kind,point,{scale=1,life=.45,color=null,ground=false}={}){
    if(this.disposed||this.effects.length>=this.maxEffects)return null;
    const p=new THREE.Vector3(point.x,point.y,point.z),ringOnly=ground||!ACTION_EFFECT_TEXTURES[kind];
    const material=ringOnly?new THREE.MeshBasicMaterial({color:color||COLORS[kind]||0xffffff,
      transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}):
      new THREE.SpriteMaterial({color:color||COLORS[kind]||0xffffff,transparent:true,opacity:.94,
        depthWrite:false,blending:THREE.AdditiveBlending});
    const object=ringOnly?new THREE.Mesh(this.ringGeometry,material):new THREE.Sprite(material);
    object.position.copy(p);if(ringOnly)object.rotation.x=-Math.PI/2;
    const size=ringOnly?.24*scale:.9*scale;
    object.scale.set(size,size,1);object.renderOrder=20;
    this.scene.add(object);
    const entry={object,material,life,age:0,scale:size,ringOnly};this.effects.push(entry);
    if(!ringOnly)this.texture(kind).then(map=>{if(map&&!this.disposed&&this.effects.includes(entry)){
      material.map=map;material.needsUpdate=true;
    }});
    return entry;
  }
  createArrow(){
    const root=new THREE.Group();
    const shaft=new THREE.Mesh(this.arrowShaft,this.wood);root.add(shaft);
    const tip=new THREE.Mesh(this.arrowHead,this.metal);tip.position.y=.40;root.add(tip);
    const feather=new THREE.Mesh(this.arrowFletch,this.feather);feather.rotation.z=Math.PI;feather.position.y=-.39;
    feather.scale.set(1,.7,.6);root.add(feather);
    root.traverse(mesh=>{if(mesh.isMesh)mesh.castShadow=true});return root;
  }
  shootArrow(from,to,{onImpact=null,duration=null,arcHeight=null}={}){
    if(this.disposed||this.arrows.length>=this.maxArrows)return false;
    const flight=chooseArrowFlight(from,to),root=this.createArrow();
    const start=new THREE.Vector3(from.x,from.y,from.z),end=new THREE.Vector3(to.x,to.y,to.z);
    const arrow={root,start,end,age:0,duration:duration??flight.duration,arcHeight:arcHeight??flight.arcHeight,onImpact};
    if(arrow.duration<=0)return false;
    root.position.copy(start);this.scene.add(root);this.arrows.push(arrow);
    this.flash('spark',start,{scale:.36,life:.14});return true;
  }
  emit(action,{position,target=null,job='',scale=1,onImpact=null,magic='arcane'}={}){
    if(!position)return 'none';
    const kind=actionEffectKind(action,job),p=new THREE.Vector3(position.x,position.y,position.z);
    if(kind==='idle')return kind;
    if(kind==='arrow'){
      const landing=target||{x:p.x,y:p.y,z:p.z+8};
      const from={x:p.x,y:p.y+1.25*scale,z:p.z};
      const to={x:landing.x,y:landing.y+(target?1.03*scale:0),z:landing.z};
      const launched=this.shootArrow(from,to,{onImpact:()=>{
        this.flash('spark',to,{scale:.55*scale,life:.23});onImpact?.();
      }});
      if(!launched)onImpact?.();return kind;
    }
    const at=(dy=1)=>({x:p.x,y:p.y+dy*scale,z:p.z});
    if(kind==='run'||kind==='walk'||kind==='land'||kind==='jump'||kind==='dodge'){
      this.flash('dust',at(.055),{ground:true,scale:kind==='run'?.95:kind==='jump'||kind==='land'?1.5:.55,
        life:kind==='walk'?.21:.34});
    }else if(kind==='slash'||kind==='heavy'){
      this.flash(kind,at(1.1),{scale:(kind==='heavy'?1.5:1.1)*scale,life:kind==='heavy'?.38:.28});
    }else if(kind==='magic'||kind==='buff'||kind==='heal'||kind==='item'){
      this.flash(kind==='heal'?'nature':kind==='item'?'water':magic,at(.9),{scale:1.3*scale,life:.65});
      this.flash('arcane',at(.06),{ground:true,scale:1.8*scale,life:.75});
    }else if(kind==='guard'||kind==='hit'||kind==='punch'||kind==='aim'){
      this.flash(kind==='guard'?'guard':'spark',at(1.08),{scale:kind==='aim'?.35:.65*scale,life:.28});
    }else if(kind==='death'){
      this.flash('dust',at(.12),{ground:true,scale:2.0*scale,life:.85});
    }else this.flash('arcane',at(.8),{scale:.35*scale,life:.24});
    return kind;
  }
  update(dt){
    if(this.disposed)return;
    for(let i=this.effects.length-1;i>=0;i--){
      const fx=this.effects[i];fx.age+=dt;const t=Math.min(1,fx.age/fx.life);
      fx.material.opacity=(fx.ringOnly?.55:.94)*(1-t)*(1-t);
      const s=fx.scale*(1+.6*t);fx.object.scale.set(s,s,1);
      if(t>=1){this.scene.remove(fx.object);fx.material.dispose();this.effects.splice(i,1)}
    }
    for(let i=this.arrows.length-1;i>=0;i--){
      const arrow=this.arrows[i];arrow.age+=dt;const t=Math.min(1,arrow.age/arrow.duration);
      const pos=sampleArrowArc(arrow.start,arrow.end,t,arrow.arcHeight);
      const velocity=arrowArcVelocity(arrow.start,arrow.end,t,arrow.arcHeight);
      arrow.root.position.set(pos.x,pos.y,pos.z);
      const tangent=new THREE.Vector3(velocity.x,velocity.y,velocity.z);
      if(tangent.lengthSq()>.00001)arrow.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent.normalize());
      if(t>=1){this.scene.remove(arrow.root);this.arrows.splice(i,1);arrow.onImpact?.()}
    }
  }
  get stats(){return {activeEffects:this.effects.length,arrowsInFlight:this.arrows.length,maxEffects:this.maxEffects,maxArrows:this.maxArrows}}
  dispose(){this.disposed=true;
    for(const fx of this.effects){this.scene.remove(fx.object);fx.material.dispose()}this.effects.length=0;
    for(const arrow of this.arrows)this.scene.remove(arrow.root);this.arrows.length=0;
    for(const map of this.maps.values())map.then(t=>t?.dispose());this.maps.clear();
    this.ringGeometry.dispose();this.arrowShaft.dispose();this.arrowHead.dispose();this.arrowFletch.dispose();
    this.wood.dispose();this.metal.dispose();this.feather.dispose();
  }
}
