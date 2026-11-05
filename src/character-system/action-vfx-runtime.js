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
/** Seven consecutive animation frames from the player's Library ZIP effects. */
export const ACTION_EFFECT_FRAMES=Object.freeze(Object.fromEntries(
  ['fire','earth','arcane','nature'].map(kind=>[kind,Object.freeze([
    ACTION_EFFECT_TEXTURES[kind],...Array.from({length:6},(_,i)=>`${kind}-${String(i+2).padStart(2,'0')}.png`)
  ])])));
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
    this.breathGeometry=new THREE.ConeGeometry(1,1,12,1,true);
    this.arrowShaft=new THREE.CylinderGeometry(.009,.012,.69,6);
    this.arrowHead=new THREE.ConeGeometry(.029,.12,6);
    this.arrowFletch=new THREE.ConeGeometry(.045,.17,4);
    this.wood=new THREE.MeshStandardMaterial({color:0x91663d,roughness:.86});
    this.metal=new THREE.MeshStandardMaterial({color:0xd6e0e8,metalness:.62,roughness:.36});
    this.feather=new THREE.MeshStandardMaterial({color:0xddd2b2,side:THREE.DoubleSide,roughness:.87});
  }
  texture(kind,frame=0){
    if(!ACTION_EFFECT_TEXTURES[kind])return Promise.resolve(null);
    const filename=ACTION_EFFECT_FRAMES[kind]?.[frame]??ACTION_EFFECT_TEXTURES[kind];
    if(!this.maps.has(filename))this.maps.set(filename,this.loader.loadAsync(this.textureRoot+filename)
      .then(texture=>{texture.colorSpace=THREE.SRGBColorSpace;return texture})
      .catch(()=>null));
    return this.maps.get(filename);
  }
  setFrame(entry,frame){
    if(entry.frame===frame)return;
    entry.frame=frame;
    this.texture(entry.effectKind,frame).then(map=>{
      if(map&&!this.disposed&&this.effects.includes(entry)&&entry.frame===frame){
        entry.material.map=map;entry.material.needsUpdate=true;
      }
    });
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
    const entry={object,material,life,age:0,scale:size,ringOnly,effectKind:kind,frame:-1};this.effects.push(entry);
    if(!ringOnly)this.setFrame(entry,0);
    return entry;
  }
  /** A ring covers the same world radius as the real AoE hit test. */
  emitArea(center,radius,{element='fire',heal=false}={}){
    if(this.disposed||!center)return false;
    const r=Math.max(.45,Math.min(16,radius||.75));
    const at={x:center.x,y:center.y+.07,z:center.z};
    this.flash(heal?'nature':element,at,{ground:true,scale:r/.24,life:.8,
      color:heal?0x78ffd0:COLORS[element]});
    const particles=Math.min(5,Math.max(2,Math.ceil(r)));
    for(let i=0;i<particles;i++){
      const phi=(i+.5)*Math.PI*2/particles,dist=r*(i%2?.76:.42);
      this.flash(heal?'nature':element,{x:at.x+Math.cos(phi)*dist,y:at.y+.35+(i%3)*.28,
        z:at.z+Math.sin(phi)*dist},{scale:heal?.72:.76,life:.35+i*.07});
    }
    return true;
  }
  /** Fire/arcane cone grows from the creature's mouth toward its actual target. */
  emitBreath(from,to,{element='fire',radius=1}={}){
    if(this.disposed||!from||!to||this.effects.length+1>=this.maxEffects)return false;
    const start=new THREE.Vector3(from.x,from.y,from.z),end=new THREE.Vector3(to.x,to.y+.35,to.z);
    const axis=end.clone().sub(start),length=Math.max(.2,axis.length());
    const direction=axis.normalize(),baseColor=element==='arcane'?0xa46eff:0xff631e;
    const group=new THREE.Group(),materials=[];
    for(const [factor,color,opacity] of [[1,baseColor,.52],[.56,0xffe9ad,.8]]){
      const material=new THREE.MeshBasicMaterial({color:element==='arcane'&&factor<1?0xe6ccff:color,
        transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
      const cone=new THREE.Mesh(this.breathGeometry,material);
      cone.scale.set(Math.max(.1,radius)*factor,1,Math.max(.1,radius)*factor);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().negate());
      group.add(cone);materials.push(material);
    }
    group.position.copy(start);group.renderOrder=25;this.scene.add(group);
    this.effects.push({kind:'breath',object:group,materials,age:0,life:.83,
      start,direction,length,radius});
    this.flash(element,start,{scale:1.2,life:.38});
    // A dragon's jet has overlapping animated embers along the entire cone,
    // rather than a single transparent triangle. The budget stays bounded.
    const embers=Math.min(10,Math.max(0,this.maxEffects-this.effects.length-8));
    for(let i=0;i<embers;i++){
      const t=(i+.4)/Math.max(1,embers),side=i*2.399963;
      const drift=radius*(.13+.18*t);
      const p=start.clone().addScaledVector(direction,length*t);
      p.x+=Math.cos(side)*drift;p.z+=Math.sin(side)*drift;
      const ember=this.flash(element,p,{scale:.43+t*.75,life:.25+.4*t});
      if(ember)ember.velocity=new THREE.Vector3(Math.cos(side)*.38,.4+t*.5,Math.sin(side)*.38);
    }
    this.emitArea({x:end.x,y:to.y,z:end.z},Math.max(.75,radius),{element});
    return true;
  }
  /** A bounded burst of flying masonry, embers or magical shards. */
  emitImpactDebris(center,{element='earth',intensity=1}={}){
    if(this.disposed||!center)return false;
    const count=Math.min(this.maxEffects-this.effects.length,Math.max(3,Math.min(13,Math.ceil(6+intensity*2))));
    const radius=Math.min(2.5,.4+intensity*.19);
    for(let i=0;i<count;i++){
      const phi=i*2.39996323,offset=radius*(.24+(i%5)*.12);
      const p={x:center.x+Math.cos(phi)*offset,y:center.y+.1+(i%3)*.2,
        z:center.z+Math.sin(phi)*offset};
      const particle=this.flash(i%4===0?'spark':element,p,
        {scale:.2+(i%4)*.12,life:.4+(i%3)*.15});
      if(particle)particle.velocity=new THREE.Vector3(Math.cos(phi)*(.9+intensity*.25),
        .85+(i%5)*.34,Math.sin(phi)*(.9+intensity*.25));
    }
    return count>0;
  }
  emitExplosion(center,radius,{element='fire'}={}){
    if(this.disposed||!center)return false;
    const r=Math.max(.8,Math.min(10,radius));
    this.emitArea(center,r,{element});
    // Four concentric blast fronts plus a rising plume sell the force without
    // spawning any per-frame physics bodies or unbounded GPU particles.
    for(let i=0;i<3;i++)this.flash(i===1?'spark':element,
      {x:center.x,y:center.y+.07+i*.22,z:center.z},
      {ground:true,scale:r*(1+i*.21)/.24,life:.35+i*.14});
    for(let i=0;i<4;i++){
      const p=this.flash(element,{x:center.x,y:center.y+.45+i*.36,z:center.z},
        {scale:Math.min(5,1.2+r*.28+i*.3),life:.42+i*.1});
      if(p)p.velocity=new THREE.Vector3(0,.6+i*.32,0);
    }
    this.emitImpactDebris(center,{element,intensity:Math.max(1,r*.8)});
    return true;
  }
  emitTether(from,to){
    if(this.disposed||!from||!to||this.effects.length>=this.maxEffects)return false;
    const geometry=new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x,from.y+1.3,from.z),new THREE.Vector3(to.x,to.y+.6,to.z)]);
    const material=new THREE.LineBasicMaterial({color:0xe7cfa8,transparent:true,opacity:.9,depthWrite:false});
    const object=new THREE.Line(geometry,material);this.scene.add(object);
    this.effects.push({kind:'tether',object,material,geometry,age:0,life:.5});
    this.flash('spark',to,{scale:.48,life:.3});return true;
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
      if(fx.kind==='breath'){
        const extend=Math.min(1,t/.3),len=fx.length*extend;
        fx.object.position.copy(fx.start).addScaledVector(fx.direction,len*.5);
        for(const cone of fx.object.children)cone.scale.y=len;
        for(const mat of fx.materials)mat.opacity=(t<.38?1:Math.max(0,(1-t)/.62))*(mat===fx.materials[0]?.52:.8);
        if(t>=1){this.scene.remove(fx.object);fx.materials.forEach(mat=>mat.dispose());this.effects.splice(i,1)}
        continue;
      }
      if(fx.kind==='tether'){
        fx.material.opacity=Math.max(0,1-t);
        if(t>=1){this.scene.remove(fx.object);fx.geometry.dispose();fx.material.dispose();this.effects.splice(i,1)}
        continue;
      }
      fx.material.opacity=(fx.ringOnly?.55:.94)*(1-t)*(1-t);
      if(!fx.ringOnly&&ACTION_EFFECT_FRAMES[fx.effectKind])
        this.setFrame(fx,Math.min(ACTION_EFFECT_FRAMES[fx.effectKind].length-1,
          Math.floor(t*ACTION_EFFECT_FRAMES[fx.effectKind].length)));
      const s=fx.scale*(1+.6*t);fx.object.scale.set(s,s,1);
      if(fx.velocity)fx.object.position.addScaledVector(fx.velocity,dt*(1-t*.7));
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
    for(const fx of this.effects){this.scene.remove(fx.object);
      if(fx.kind==='breath')fx.materials.forEach(mat=>mat.dispose());
      else{fx.material.dispose();fx.geometry?.dispose();}}
    this.effects.length=0;
    for(const arrow of this.arrows)this.scene.remove(arrow.root);this.arrows.length=0;
    for(const map of this.maps.values())map.then(t=>t?.dispose());this.maps.clear();
    this.ringGeometry.dispose();this.breathGeometry.dispose();this.arrowShaft.dispose();this.arrowHead.dispose();this.arrowFletch.dispose();
    this.wood.dispose();this.metal.dispose();this.feather.dispose();
  }
}
