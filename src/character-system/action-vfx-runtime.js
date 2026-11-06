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
const SPRITE_ASPECT=Object.freeze({slash:2.12,heavy:2.12,water:1.25,nature:1.4});
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
  constructor(scene,{maxEffects=64,maxArrows=24,textureRoot=ROOT,camera=null,accentMultiplier=5}={}){
    this.scene=scene;this.maxEffects=maxEffects;this.maxArrows=maxArrows;
    this.emittedByKind=new Map();
    this.textureRoot=textureRoot;this.effects=[];this.arrows=[];this.maps=new Map();
    this.loader=new THREE.TextureLoader();this.disposed=false;
    // Every textured effect is accompanied by four short-lived light flecks.
    // A single GPU instance batch renders ALL flecks, regardless of whether
    // there are 50 or 1000 soldiers; the original user-imported PNG stays.
    this.camera=camera;
    this.accentMultiplier=Math.max(1,Math.min(5,Math.floor(accentMultiplier)));
    this.maxAccents=this.maxEffects*(this.accentMultiplier-1);
    this.accents=[];this.accentSerial=0;
    this.accentMatrix=new THREE.Matrix4();this.accentPosition=new THREE.Vector3();
    this.accentScale=new THREE.Vector3();this.accentOrientation=new THREE.Quaternion();
    if(this.maxAccents){
      const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
      const context=canvas.getContext('2d');
      const halo=context.createRadialGradient(16,16,1,16,16,16);
      halo.addColorStop(0,'rgba(255,255,255,1)');halo.addColorStop(.27,'rgba(255,255,255,.8)');
      halo.addColorStop(1,'rgba(255,255,255,0)');
      context.fillStyle=halo;context.fillRect(0,0,32,32);
      this.accentTexture=new THREE.CanvasTexture(canvas);
      this.accentMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),
        new THREE.MeshBasicMaterial({map:this.accentTexture,transparent:true,depthWrite:false,
          side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}),this.maxAccents);
      this.accentMesh.name='BatchedActionVfxAccents';this.accentMesh.count=0;
      this.accentMesh.frustumCulled=false;this.accentMesh.renderOrder=21;
      this.accentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(this.accentMesh);
    }
    this.ringGeometry=new THREE.TorusGeometry(1,.075,6,20);
    this.slashArcGeometry=new THREE.TorusGeometry(1,.045,6,30,Math.PI*1.48);
    this.breathGeometry=new THREE.ConeGeometry(1,1,12,1,true);
    this.arrowShaft=new THREE.CylinderGeometry(.009,.012,.69,6);
    this.arrowHead=new THREE.ConeGeometry(.029,.12,6);
    this.arrowFletch=new THREE.ConeGeometry(.045,.17,4);
    this.wood=new THREE.MeshStandardMaterial({color:0x91663d,roughness:.86});
    this.metal=new THREE.MeshStandardMaterial({color:0xd6e0e8,metalness:.62,roughness:.36});
    this.feather=new THREE.MeshStandardMaterial({color:0xddd2b2,side:THREE.DoubleSide,roughness:.87});
    // Warm the user's original effect atlases while the character models load.
    // Otherwise a 0.28-second sword slash can disappear before its PNG arrives.
    for(const kind of Object.keys(ACTION_EFFECT_TEXTURES)){
      const count=ACTION_EFFECT_FRAMES[kind]?.length||1;
      for(let frame=0;frame<count;frame++)this.texture(kind,frame);
    }
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
      new THREE.SpriteMaterial({map:this.accentTexture||null,color:color||COLORS[kind]||0xffffff,transparent:true,opacity:.94,
        depthWrite:false,blending:THREE.AdditiveBlending});
    const object=ringOnly?new THREE.Mesh(this.ringGeometry,material):new THREE.Sprite(material);
    object.position.copy(p);if(ringOnly)object.rotation.x=-Math.PI/2;
    const size=ringOnly?.24*scale:.9*scale;
    const widthFactor=ringOnly?1:(SPRITE_ASPECT[kind]||1),heightFactor=ringOnly?1:kind==='slash'||kind==='heavy'?.8:1;
    object.scale.set(size*widthFactor,size*heightFactor,1);object.renderOrder=20;
    this.scene.add(object);
    const entry={object,material,life,age:0,scale:size,widthFactor,heightFactor,ringOnly,effectKind:kind,frame:-1};this.effects.push(entry);
    this.emitAccents(kind,p,{scale:size,life,ground,color});
    if(!ringOnly)this.setFrame(entry,0);
    return entry;
  }
  emitAccents(kind,point,{scale=1,life=.4,ground=false,color=null}={}){
    if(!this.accentMesh)return;
    const available=Math.min(this.accentMultiplier-1,this.maxAccents-this.accents.length);
    const tint=new THREE.Color(color||COLORS[kind]||0xffffff);
    for(let i=0;i<available;i++){
      const serial=this.accentSerial++,angle=serial*2.39996323;
      const spread=Math.min(5,scale)*(ground?.36:.27),distance=spread*(.3+.19*(i%3));
      const particle={x:point.x+Math.cos(angle)*distance,y:point.y+(ground?.10:.04*i),
        z:point.z+Math.sin(angle)*distance,age:0,life:life*(.65+.09*i),
        size:Math.max(.08,Math.min(.55,scale*(.18+.065*i))),tint,
        vx:Math.cos(angle)*(.13+.12*i),vy:ground?.14:.32+.14*i,vz:Math.sin(angle)*(.13+.12*i)};
      this.accents.push(particle);
      this.accentMesh.setColorAt(this.accents.length-1,tint);
    }
    if(available&&this.accentMesh.instanceColor)this.accentMesh.instanceColor.needsUpdate=true;
  }
  /** A curved blade trail complements the original textured slash sprite. */
  emitSlashArc(point,target,{scale=1,heavy=false}={}){
    if(this.disposed||this.effects.length>=this.maxEffects)return false;
    const material=new THREE.MeshBasicMaterial({color:heavy?0xffb96b:0xcdeaff,
      side:THREE.DoubleSide,transparent:true,opacity:.88,depthWrite:false,
      blending:THREE.AdditiveBlending,toneMapped:false});
    const arc=new THREE.Mesh(this.slashArcGeometry,material);
    const direction=target?Math.atan2(target.x-point.x,target.z-point.z):0;
    arc.rotation.set(0,direction,-.52);
    arc.position.set(point.x+(target?Math.sin(direction)*.45:0),point.y+1.05*scale,
      point.z+(target?Math.cos(direction)*.45:0));
    arc.scale.setScalar((heavy?1.1:.78)*scale);
    arc.renderOrder=22;this.scene.add(arc);
    this.effects.push({kind:'slashArc',object:arc,material,age:0,
      life:heavy?.42:.30,baseScale:(heavy?1.1:.78)*scale});
    return true;
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
    this.emittedByKind.set(kind,(this.emittedByKind.get(kind)||0)+1);
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
      this.emitSlashArc(p,target,{scale,heavy:kind==='heavy'});
      this.flash(kind,at(1.1),{scale:(kind==='heavy'?2.0:1.5)*scale,life:kind==='heavy'?.45:.33});
    }else if(kind==='magic'||kind==='buff'||kind==='heal'||kind==='item'){
      const element=kind==='heal'?'nature':kind==='item'?'water':magic;
      this.flash(element,at(.9),{scale:2.1*scale,life:.82});
      this.flash(element,at(.06),{ground:true,scale:2.4*scale,life:.85});
      this.emitAccents(element,at(1.3),{scale:1.6*scale,life:.65});
    }else if(kind==='guard'||kind==='hit'||kind==='punch'||kind==='aim'){
      this.flash(kind==='guard'?'guard':'spark',at(1.08),{scale:kind==='aim'?.35:.65*scale,life:.28});
    }else if(kind==='death'){
      this.flash('dust',at(.12),{ground:true,scale:2.0*scale,life:.85});
    }else this.flash('arcane',at(.8),{scale:.35*scale,life:.24});
    return kind;
  }
  update(dt){
    if(this.disposed)return;
    // Compact expired particles in place and keep one shared draw call.
    let active=0;
    for(let i=0;i<this.accents.length;i++){
      const particle=this.accents[i];particle.age+=dt;
      if(particle.age>=particle.life)continue;
      const fraction=particle.age/particle.life;
      particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.z+=particle.vz*dt;
      this.accents[active]=particle;
      if(active!==i)this.accentMesh.setColorAt(active,particle.tint);
      this.accentPosition.set(particle.x,particle.y,particle.z);
      const size=particle.size*(1-fraction*.83);
      this.accentScale.set(size,size,size);
      if(this.camera)this.accentOrientation.copy(this.camera.quaternion);
      else this.accentOrientation.identity();
      this.accentMatrix.compose(this.accentPosition,this.accentOrientation,this.accentScale);
      this.accentMesh.setMatrixAt(active,this.accentMatrix);active++;
    }
    this.accents.length=active;
    if(this.accentMesh){this.accentMesh.count=active;if(active){
      this.accentMesh.instanceMatrix.needsUpdate=true;
      if(this.accentMesh.instanceColor)this.accentMesh.instanceColor.needsUpdate=true;
    }}
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
      if(fx.kind==='slashArc'){
        fx.material.opacity=.88*(1-t)*(1-t);
        fx.object.rotation.z-=dt*(fx.life>.4?7:9);
        fx.object.scale.setScalar(fx.baseScale*(.74+t*.52));
        if(t>=1){this.scene.remove(fx.object);fx.material.dispose();this.effects.splice(i,1)}
        continue;
      }
      fx.material.opacity=(fx.ringOnly?.55:.94)*(1-t)*(1-t);
      if(!fx.ringOnly&&ACTION_EFFECT_FRAMES[fx.effectKind])
        this.setFrame(fx,Math.min(ACTION_EFFECT_FRAMES[fx.effectKind].length-1,
          Math.floor(t*ACTION_EFFECT_FRAMES[fx.effectKind].length)));
      const s=fx.scale*(1+.6*t);fx.object.scale.set(s*fx.widthFactor,s*fx.heightFactor,1);
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
  get stats(){return {activeEffects:this.effects.length,activeArrows:this.arrows.length,accentParticles:this.accents.length,
    vfxMultiplier:this.accentMultiplier,accentDrawCalls:this.accentMesh?1:0,
    arrowsInFlight:this.arrows.length,maxEffects:this.maxEffects,maxArrows:this.maxArrows,
    magicEmitted:this.emittedByKind.get('magic')||0,arrowEmitted:this.emittedByKind.get('arrow')||0}}
  dispose(){this.disposed=true;
    if(this.accentMesh){this.scene.remove(this.accentMesh);this.accentMesh.geometry.dispose();
      this.accentMesh.material.dispose();this.accentMesh.dispose();this.accentTexture.dispose();}
    for(const fx of this.effects){this.scene.remove(fx.object);
      if(fx.kind==='breath')fx.materials.forEach(mat=>mat.dispose());
      else{fx.material.dispose();fx.geometry?.dispose();}}
    this.effects.length=0;
    for(const arrow of this.arrows)this.scene.remove(arrow.root);this.arrows.length=0;
    for(const map of this.maps.values())map.then(t=>t?.dispose());this.maps.clear();
    this.ringGeometry.dispose();this.slashArcGeometry.dispose();this.breathGeometry.dispose();this.arrowShaft.dispose();this.arrowHead.dispose();this.arrowFletch.dispose();
    this.wood.dispose();this.metal.dispose();this.feather.dispose();
  }
}
