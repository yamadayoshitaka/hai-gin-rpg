/**
 * Per-instance combat gesture layer for human-rigged monsters and summons.
 * Never modifies a shared GLB, shared AnimationClip, hero or beast rig.
 * Native animation is updated first; this layer adds a short, readable
 * attack / spell gesture and reusable emissive accents on the real hand bone.
 */
import * as THREE from 'three';

export const HUMANOID_SPELL_PALETTE=Object.freeze({
 forest_spirit_female:0x6bdfa0,
 seraph_female:0xffe2a2,
 dragonkin_female:0xa36ae7,
 default:0xb88bff,
});
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const normalized=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const ease=p=>Math.sin(Math.PI*clamp(p,0,1));
function bone(model,...names){
 const wanted=new Set(names.map(normalized));let result=null;
 model.traverse(node=>{
  if(!result&&node.isBone&&wanted.has(normalized(node.name)))result=node;
 });
 return result;
}
/**
 * Gesture timing is independent of FPS: anticipation 0-32%, release
 * 32-72%, recovery 72-100%. 30/60fps share the same timing.
 */
export function humanoidGesturePhases(progress){
 const p=clamp(progress,0,1);
 return {
  anticipate:clamp(p/.32,0,1),
  release:clamp((p-.32)/.40,0,1),
  recover:clamp((p-.72)/.28,0,1),
 };
}
export function createHumanoidMonsterCombatMotion(model,profile){
 const arms=[
  bone(model,'upperarm_l','leftarm','leftupperarm'),
  bone(model,'upperarm_r','rightarm','rightupperarm')
 ];
 const wrists=[
  bone(model,'lowerarm_l','leftforearm','leftlowerarm'),
  bone(model,'lowerarm_r','rightforearm','rightlowerarm')
 ];
 const hand=bone(model,'hand_r','righthand')||wrists[1]||arms[1];
 const color=HUMANOID_SPELL_PALETTE[profile?.costume]||
  HUMANOID_SPELL_PALETTE.default;
 const group=new THREE.Group();
 group.name='monster-instance-combat-magic';
 const orbGeometry=new THREE.SphereGeometry(.065,12,8);
 const ringGeometry=new THREE.TorusGeometry(.12,.009,6,30);
 const orbMaterial=new THREE.MeshBasicMaterial({
  color,transparent:true,opacity:0,depthWrite:false
 });
 const ringMaterial=orbMaterial.clone();
 const orb=new THREE.Mesh(orbGeometry,orbMaterial);
 const ring=new THREE.Mesh(ringGeometry,ringMaterial);
 ring.rotation.x=Math.PI/2;
 group.add(orb,ring);
 group.position.set(0,-.23,.025);
 if(hand)hand.add(group);
 group.visible=false;
 let disposed=false;
 return {
  color,hasHand:!!hand,
  update(action,progress=0,time=0){
   if(disposed)return;
   const spell=action==='special',attack=action==='attack';
   group.visible=!!hand&&(spell||attack);
   if(!group.visible)return;
   const p=clamp(progress,0,1),wave=ease(p);
   const phase=humanoidGesturePhases(p);
   if(spell){
    // Overlay native idle pose after the mixer has evaluated; no persistent
    // changes accumulate on shared bones between independent characters.
    if(arms[0]){arms[0].rotation.x-=.38*wave;arms[0].rotation.z-=.45*wave;}
    if(arms[1]){arms[1].rotation.x-=.52*wave;arms[1].rotation.z+=.48*wave;}
    if(wrists[0])wrists[0].rotation.x-=.20*wave;
    if(wrists[1])wrists[1].rotation.x-=.20*wave;
   }else if(arms[1]){
    // Native attack remains authoritative; only emphasize the release.
    arms[1].rotation.x-=.12*wave;
   }
   const blast=spell?clamp(1-Math.abs(p-.58)/.42,0,1):wave;
   orb.scale.setScalar((spell?.65: .38)+blast*(spell?2.8:1.1));
   ring.scale.setScalar((spell?.45:.35)+blast*(spell?2.2:1.1));
   ring.rotation.z=time*(spell?2.8:4.2);
   orbMaterial.opacity=.08+.73*blast;
   ringMaterial.opacity=.08+.55*blast;
   // Bright charge followed by a distinct release and diminishing recovery.
   if(spell&&p<.32)ringMaterial.opacity*=phase.anticipate;
   if(spell&&p>.72){
    orbMaterial.opacity*=1-phase.recover;
    ringMaterial.opacity*=1-phase.recover;
   }
  },
  dispose(){
   if(disposed)return;disposed=true;
   group.parent?.remove(group);
   orbGeometry.dispose();ringGeometry.dispose();
   orbMaterial.dispose();ringMaterial.dispose();
  }
 };
}
