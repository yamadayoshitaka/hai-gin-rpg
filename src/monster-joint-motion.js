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
  // Articulated limb chain: the supporting leg extends while the
  // airborne leg folds at the knee and re-extends before touchdown.
  // The signs mirror across the body; avoid all joints bending together.
  const power=locomotion?1:0;
  apply(p,id+'Femur','x',power*.12*wave);
  apply(p,id+'Femur','z',side*power*.08*swing);
  apply(p,id+'Patella','z',side*(.10+power*.25*swing+actionPulse*.08));
  apply(p,id+'Tibia','z',side*(-.10-power*.24*swing-actionPulse*.06));
  apply(p,id+'Tibia','x',power*.09*Math.sin(phase+offset-.52));
  apply(p,id+'Tarsus','x',power*(-.10*swing+.035*wave));
  apply(p,id+'Tarsus','z',side*power*.045*swing);
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
 if(study.id==='m006'){
   // Scapulae translate/rotate along the ribcage. Distinct wrist and
   // distal claw pivots support a stealthy feline footfall and grasp.
   const strike=(action==='attack'||action==='special')?pulse:0;
   const stalk=action==='walk',power=locomotion?(run?.17:.085):0;
   apply(p,'paraspinal','x',locomotion?(run?.065:.022)*Math.sin(phase*2):0);
   for(const side of [-1,1]){
     const suffix=side<0?'L':'R',offset=side<0?0:PI;
     apply(p,'scapula'+suffix,'x',
       power*Math.sin(phase+offset-.36)+.20*strike);
     apply(p,'scapula'+suffix,'z',side*power*.20*
       Math.cos(phase+offset));
     for(const fore of ['front','rear']){
       const name=fore+suffix,q=phase+offset+
         (fore==='rear'?PI*.64:0);
       const swing=locomotion?Math.max(0,Math.cos(q)):0;
       const stance=locomotion?Math.max(0,-Math.cos(q)):0;
       if(stalk)apply(p,'leg'+name,'x',
         .24*Math.sin(q)+(fore==='front'?-.035:.035));
       apply(p,'wrist'+name,'x',clamp(
         -.075+.26*swing-.085*stance+.085*strike,-.25,.38));
       apply(p,'paw'+name,'x',clamp(
         -.04+.22*swing-.105*stance-.065*strike,-.28,.32));
       for(let digit=0;digit<4;digit++){
         // Strong claw extension only on prey grab, retracted during
         // quiet approach. A tiny spread makes all toes non-rigid.
         apply(p,'claw'+name+digit,'x',clamp(
           .32-.64*strike-.055*swing+
           (digit-1.5)*.009,-.48,.39));
       }
     }
   }
   apply(p,'caudalMuscle','y',.07*Math.sin(phase*.53-.42));
   if(p.head&&stalk)p.head.rotation.x-=.06;
 }
 if(study.id==='m005'){
   // Canid gait studies: slow walking and obstacle stepping call for
   // carpal/tarsal flexion; forepaw placement and hindlimb push differ.
   // This 'creep' is a game posture, not a claim of observed wolf data.
   const threat=(action==='attack'||action==='special')?pulse:0;
   const quiet=action==='walk';
   apply(p,'neckGuard','x',quiet?-.065+.018*Math.sin(phase*.50):
     -.025-.08*threat);
   if(p.head)p.head.rotation.x+=quiet?-.055:-.035*threat;
   for(const side of [-1,1]){
     const suffix=side<0?'L':'R',offset=side<0?0:PI;
     apply(p,'scapula'+suffix,'x',
       (locomotion?(run?.18:.10):0)*Math.sin(phase+offset-.25)
       +.13*threat);
     apply(p,'ear'+suffix,'x',
       .085+.17*threat+.038*Math.sin(time*1.05+offset));
     apply(p,'ear'+suffix,'y',
       side*(.06+.11*Math.sin(time*.84+offset)));
     for(const fore of ['front','rear']){
       const key=fore+suffix;
       const q=phase+offset+(fore==='rear'?PI*.52:0);
       const swing=locomotion?Math.max(0,Math.cos(q)):0;
       const stance=locomotion?Math.max(0,-Math.cos(q)):0;
       if(quiet)apply(p,'leg'+key,'x',
         .23*Math.sin(q)+(fore==='front'?-.10:.06)*threat);
       apply(p,'carpal'+key,'x',clamp(
         -.065+(fore==='front'?.24:.19)*swing-.08*stance
         +.08*threat,-.26,.36));
       apply(p,'toe'+key,'x',clamp(
         -.035+.24*swing-.12*stance-.07*threat,-.23,.32));
     }
   }
   // Dog caudal-muscle EMG supports independent pitch and left-right
   // stabilization. Avoid frantic tail wagging in a quiet approach.
   apply(p,'tail','y',locomotion?
     (run?.10:.055)*Math.sin(phase*.55):.035*Math.sin(time*.8));
   apply(p,'tail','x',quiet?.055: -.045*threat);
   apply(p,'tailMid','y',locomotion?
     (run?.14:.075)*Math.sin(phase*.55-.50):.06*Math.sin(time*.75));
 }
 if(study.id==='m004'){
   // Wolf studies distinguish relatively stiff endurance pursuit from the
   // stronger sagittal flexion used when accelerating for a final strike.
   // The posterior trunk and pelvis use real nested Three.js joints.
   const strike=(action==='attack'||action==='special')?pulse:0;
   const takeoff=action==='leap'?pulse:0;
   const gallop=locomotion?Math.sin(phase-.35):0;
   const lumbarBend=clamp((run?.145:.060)*gallop-.115*strike+
     .16*takeoff,-.31,.31);
   apply(p,'lumbar','x',lumbarBend);
   apply(p,'pelvis','x',clamp(-lumbarBend*.60+
     (locomotion?.043*Math.sin(phase+.7):0),-.26,.26));
   apply(p,'pelvis','y',(locomotion?.042:0)*Math.sin(phase*.53));
   apply(p,'neckCollar','x',-.36*lumbarBend-.07*strike);
   if(p.head)p.head.rotation.x-=.20*lumbarBend+.11*strike;
   // Foot contact timing differs for the leading and trailing limb;
   // a flexed hock lifts the toe in swing, then extends for the push.
   for(const side of [-1,1]){
     const suffix=side<0?'L':'R',offset=side<0?0:PI;
     const step=phase+offset;
     apply(p,'scapula'+suffix,'x',
       (locomotion?(run?.23:.12):0)*Math.sin(step-.25)+.16*strike);
     apply(p,'scapula'+suffix,'z',
       side*(.05*Math.cos(step)+.05*strike));
     apply(p,'ear'+suffix,'x',
       .11+.18*strike+.045*Math.sin(time*1.29+offset));
     apply(p,'ear'+suffix,'z',
       side*(.08+.055*Math.sin(time*.88+offset)-.06*strike));
     for(const fore of ['front','rear']){
       const name=fore+suffix,q=step+(fore==='rear'?PI*.63:0);
       const swing=locomotion?Math.max(0,Math.cos(q)):0;
       const push=locomotion?Math.max(0,-Math.cos(q)):0;
       apply(p,'hock'+name,'x',
         clamp(-.08+.31*swing-.12*push+.13*takeoff,-.30,.40));
       apply(p,'toe'+name,'x',
         clamp(-.035+.29*swing-.16*push-.12*strike,-.29,.37));
     }
   }
   // The tail base follows the pelvic group instead of a fixed root point.
   apply(p,'tail','x',-.13*lumbarBend+.16*takeoff);
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
