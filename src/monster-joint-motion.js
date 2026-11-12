/**
 * Reference-led nonhumanoid procedural joint controller.
 *
 * Each named Group is a real geometry pivot (not a fake pose value).
 * Source references: monster-anatomy-reference.js. This is articulated rigid
 * mesh, NOT skin-weight deformation. The latter requires future glTF/GLB
 * per-vertex JOINTS_0/WEIGHTS_0 and bind matrices.
 */
import {MONSTER_ANATOMY_RESEARCH} from './monster-anatomy-reference.js';

const PI=Math.PI;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pivot=(p,key)=>p[key]??null;
const apply=(p,key,axis,value)=>{
  const node=pivot(p,key);
  if(node)node.rotation[axis]=value;
};
function quadrupedMotion(p,phase,locomotion,run,actionPulse,spine){
 // Dogs walk lateral sequence and trot diagonally; felines at high speeds
 // gather and extend fore/hind pairs and flex their lumbar column.
 const strength=locomotion?(run?.65:.38):0;
 const names=['frontL','frontR','rearL','rearR'];
 const phases=run&&spine==='feline'
   ?[0,.38*PI,1.02*PI,1.4*PI]
   :run?[0,PI,PI,0]:[0,PI,PI*.52,PI*1.52];
 for(let i=0;i<4;i++){
  const q=phase+phases[i];
  const sine=Math.sin(q),lift=Math.max(0,Math.cos(q));
  const name=names[i];
  const front=name.startsWith('front');
  apply(p,'leg'+name,'x',strength*sine+(front?-.12:.10)*actionPulse);
  apply(p,'leg'+name,'z',(i%2?1:-1)*strength*.13*lift);
  // Elbow/hock folds in swing and extends when weight-bearing; the
  // distal paw is no longer welded to the proximal bone.
  apply(p,'lower'+name,'x',-strength*.30+strength*.62*lift);
  apply(p,'lower'+name,'z',(i%2?1:-1)*strength*.05*lift);
 }
 const travel=locomotion?1:0;
 const flex=run&&spine==='feline'?.13*Math.sin(phase*2+.25):.023*Math.sin(phase);
 apply(p,'torso','x',travel*flex);
 apply(p,'torso','y',spine==='reptile'?travel*.07*Math.sin(phase):0);
 apply(p,'tail','y',Math.sin(phase*.55)*.18+actionPulse*.20);
 apply(p,'tailMid','y',Math.sin(phase*.55-.55)*.22+actionPulse*.09);
 apply(p,'tailTip','y',Math.sin(phase*.55-1.1)*.26);
}
function wingMotion(p,phase,action,actionPulse,reference){
 const hasFlap=action==='special'||action==='leap'||action==='run'||action==='attack';
 const power=hasFlap?1:.25;
 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  const wave=Math.sin(phase*1.18+(side<0?0:.11));
  apply(p,'wing'+suffix,'z',side*(.12+power*.62*wave+actionPulse*.10));
  apply(p,'wing'+suffix,'x',power*.13*Math.sin(phase+.23));
  // Elevation/sweep/folding are different joints; no rigid paper-card flap.
  apply(p,'wingElbow'+suffix,'y',side*(.20+power*.28*Math.sin(phase+.65)));
  apply(p,'wingElbow'+suffix,'x',power*.26*Math.cos(phase-.40));
  apply(p,'wingWrist'+suffix,'y',side*(.09+power*.31*Math.sin(phase+1.04)));
  apply(p,'wingWrist'+suffix,'z',side*.21*power*Math.cos(phase-.73));
  apply(p,'birdAnkle'+suffix,'x',hasFlap?-.20+.11*Math.sin(phase):-0.03);
 }
 apply(p,'tail','x',power*.075*Math.sin(phase+.31));
}
function arthropodMotion(p,phase,locomotion,actionPulse,spider){
 const count=spider?4:3;
 for(const side of [-1,1])for(let i=0;i<count;i++){
  // Six-leg alternating tripod: LF+LR+RM; eight legs alternating
  // tetrapods, with separate diagonal swing.
  const offset=(((side<0?0:1)+i)%2)?PI:0;
  const wave=Math.sin(phase+offset),swing=Math.max(0,Math.cos(phase+offset));
  const id='leg'+(side<0?'L':'R')+i;
  apply(p,id,'x',(locomotion?.28:0)*wave+actionPulse*(i===0?-.34:0));
  apply(p,id,'z',side*((locomotion?.22:0)*swing+actionPulse*.08));
  // If a spider was previously individually rigged, use its real nested
  // joint names too; do not mutate leg geometry from any human rig.
  for(const suffix of ['Femur','Patella','Tibia','Tarsus']){
   const child=pivot(p,id+suffix);
   if(child)child.rotation.x=(locomotion?.2:0)*Math.sin(phase+offset+1.0);
  }
 }
 for(const side of [-1,1]){
   const label=side<0?'L':'R';
   apply(p,'raptorial'+label,'x',-.12-.74*actionPulse);
   apply(p,'raptorialElbow'+label,'x',.28+.56*actionPulse);
 }
}
function hydrostatMotion(p,phase,action,actionPulse){
 for(let i=0;i<8;i++){
  const q=phase*.6+i*PI/4;
  const power=action==='special'||action==='attack'?.9:.45;
  apply(p,'tentacle'+i,'x',power*.25*Math.sin(q)+actionPulse*.22);
  apply(p,'tentacle'+i,'y',power*.30*Math.cos(q));
  apply(p,'tentacle'+i+'Mid','x',power*.31*Math.sin(q-.5)+actionPulse*.25);
  apply(p,'tentacle'+i+'Mid','y',power*.29*Math.cos(q-.33));
  apply(p,'tentacle'+i+'Tip','x',power*.38*Math.sin(q-1.0)+actionPulse*.16);
  apply(p,'tentacle'+i+'Tip','y',power*.35*Math.cos(q-.9));
  const tip=pivot(p,'tentacle'+i+'Tip');
  if(tip)tip.scale.z=clamp(1+.12*Math.sin(q-1.8)+.09*actionPulse,.83,1.22);
 }
}
export function applyMonsterBiologicalMotion(model,{time=0,phase=0,action='idle',pulse=0,locomotion=false,run=false}={}){
 const study=MONSTER_ANATOMY_RESEARCH[model?.userData?.speciesId];
 if(!study||study.status==='protected-humanlike')return false;
 const p=model.userData.pivots||{};
 const movement=locomotion;
 if(['canine','feline','reptile'].includes(study.source)||
   (study.source==='serpent'&&p.legfrontL)){
  quadrupedMotion(p,phase,movement,run,pulse,study.source);
 }
 if(study.source==='serpent'&&p.spineRear){
  const amount=movement?.23:.10;
  apply(p,'spineRear','y',amount*Math.sin(phase*.66));
  apply(p,'tail','y',amount*1.3*Math.sin(phase*.66-.8));
  apply(p,'tailMid','y',amount*1.5*Math.sin(phase*.66-1.6));
  apply(p,'tailTip','y',amount*1.6*Math.sin(phase*.66-2.4));
 }
 if(study.source==='avian')wingMotion(p,phase,action,pulse,study);
 if(study.source==='insect'||study.source==='spider')
   arthropodMotion(p,phase,movement,pulse,study.source==='spider');
 if(study.source==='octopus'){
   hydrostatMotion(p,phase,action,pulse);
   if(study.id==='m046'){
    const compression=(Math.sin(time*3.2)+1)*.05;
    model.scale.y*=1-compression;
    model.scale.x*=1+compression*.5;
    model.scale.z*=1+compression*.5;
   }
 }
 if(study.id==='m003'){
   // Fenrir's winter mantle lags the scapula and head during stride,
   // and digitigrade toe joints flex in swing, extend at ground contact.
   const attack=(action==='attack'||action==='special')?pulse:0;
   const stride=locomotion?(run?.19:.11):0;
   for(const side of [-1,1]){
     const suffix=side<0?'L':'R',offset=side<0?0:PI;
     const wave=Math.sin(phase+offset);
     apply(p,'ear'+suffix,'x',.10+.22*attack+.065*Math.sin(time*1.4+offset));
     apply(p,'ear'+suffix,'z',side*(.08+.08*Math.sin(time*.93+offset)));
     apply(p,'scapula'+suffix,'x',stride*wave+.13*attack);
     apply(p,'ruff'+suffix,'x',-.05+.08*Math.sin(phase+offset-.48)*Number(locomotion));
     apply(p,'ruff'+suffix,'z',side*(.035*Math.sin(time*1.15+offset)));
     for(const fore of ['front','rear']){
       const key=fore+suffix;
       const q=phase+offset+(fore==='rear'?PI*.54:0);
       const swing=locomotion?Math.max(0,Math.cos(q)):0;
       apply(p,'toe'+key,'x',-.045+.34*swing-.09*attack);
     }
   }
   if(p.head)p.head.rotation.x-=.08*attack;
 }
 if(study.id==='m002'){
   // Wolf pinnae are muscular, not welded to the skull. During a bite lunge
   // both ears flatten; outside combat they track slightly different bearings.
   // Scapular relief advances/retreats with the front limb stride, and the
   // jaw opens on its own pivot before the muzzle lunges forward.
   const bite=(action==='attack'||action==='special')?pulse:0;
   const gait=locomotion?(run?.22:.13):0;
   for(const side of [-1,1]){
     const suffix=side<0?'L':'R',phaseOffset=side<0?0:Math.PI;
     const anticipation=.06*Math.sin(time*1.3+phaseOffset);
     apply(p,'ear'+suffix,'x',.07+.46*bite+anticipation);
     apply(p,'ear'+suffix,'y',side*(.05+.10*Math.sin(time*.8+phaseOffset)));
     apply(p,'ear'+suffix,'z',side*(.10+.15*Math.sin(time*.9+phaseOffset)-.16*bite));
     apply(p,'scapula'+suffix,'x',gait*Math.sin(phase+phaseOffset)+.19*bite);
     apply(p,'scapula'+suffix,'z',side*(.04*Math.cos(phase+phaseOffset)+.07*bite));
   }
   if(p.jaw)p.jaw.rotation.x+=.24*bite;
   if(p.head)p.head.rotation.x-=.10*bite;
 }
 if(study.id==='m001'){
   // Canid ears swivel asymmetrically toward sound. Both have individual
   // physical pivot Groups and their skin/inner-ear geometry follows them.
   apply(p,'earL','z',-.04+.14*Math.sin(time*.94));
   apply(p,'earR','z',.04-.13*Math.sin(time*.94+.65));
   apply(p,'earL','x',.12+.09*Math.sin(time*1.37));
   apply(p,'earR','x',.12+.09*Math.sin(time*1.37+.45));
 }
 // Stable gaze under galloping, with a small counter pitch at the neck.
 if(p.head&&(study.source==='canine'||study.source==='feline')){
   p.head.rotation.x+=-p.torso?.rotation.x*.35||0;
 }
 return true;
}
