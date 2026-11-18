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
function quadrupedMotion(p,phase,locomotion,run,actionPulse,spine,speciesId){
 // Dogs walk lateral sequence and trot diagonally; felines at high speeds
 // gather and extend fore/hind pairs and flex their lumbar column.
 const strength=locomotion?(run?.65:.38):0;
 const names=['frontL','frontR','rearL','rearR'];
 // Only the four unprotected sculpted wolves. The legacy generic gait
 // over-swung all four straight-looking limbs and left feet airborne.
 const springBeast=['m001','m002','m003','m004','m005'].includes(speciesId);
 const referenceFeline=['m007','m008','m009','m010'].includes(speciesId);
 const phases=run&&spine==='feline'
   ?[0,.38*PI,1.02*PI,1.4*PI]
   :run?[0,PI,PI,0]:[0,PI,PI*.52,PI*1.52];
 for(let i=0;i<4;i++){
  const q=phase+phases[i];
  const sine=Math.sin(q),lift=Math.max(0,Math.cos(q));
  const name=names[i];
  const front=name.startsWith('front');
  if(speciesId==='m001'){
    // A separately articulated hip/shoulder and knee/elbow spring.
    // Keep the actual limb segment lengths fixed: scaling the thigh each
    // support phase opens a geometry/coat seam at the knee. Swing folds
    // the stifle while stance extends the hock, without rigid-column gait.
    // The hip/knee/hock form a visible zig-zag even during IDLE:
    // hips trail, stifles project forward, hocks rise and toes plant.
    const power=locomotion?(run?1:.74):0;
    // The negative-sine half is swing (fold and recover); the positive
    // half is stance (extend and push off). They must not bend in unison.
    const swing=Math.pow(Math.max(0,-sine),2);
    const stance=Math.pow(Math.max(0,sine),2);
    const breath=locomotion?0:Math.sin(phase*.24+i*.35)*.015;
    const hipRest=front?.195:-.315;
    const kneeRest=front?-.340:.555;
    const hip=hipRest+power*(front?.305:.282)*sine+
      (front?-.060:.045)*actionPulse+breath*.5;
    const knee=kneeRest+power*((front?.345:.395)*swing-
      (front?.110:.142)*stance)+breath;
    apply(p,'leg'+name,'x',hip);
    apply(p,'leg'+name,'z',(i%2?1:-1)*power*.022*lift);
    apply(p,'lower'+name,'x',knee);
    apply(p,'lower'+name,'z',(i%2?1:-1)*power*.012*lift);
    apply(p,'beastHock'+name,'x',(front?-.126:-.408)+
      power*((front?.205:.255)*swing-(front?.075:.112)*stance));
    apply(p,'beastPastern'+name,'x',(front?-.065:.120)+
      power*((front?.095:.155)*swing-(front?.055:.080)*stance));
    apply(p,'beastToe'+name,'x',.035+
      power*(.136*swing-.060*stance));
    // Preserve original rest-length in both locomotion and idle; the
    // visual spring comes from the independent joint angles, not scaling.
    const upperJoint=p['leg'+name];
    if(upperJoint)upperJoint.scale.y=
      upperJoint.userData.restLengthScale??1;
    continue;
  }
  if(springBeast){
    // Bent canine ready pose persists even in IDLE. In a stride, the
    // swing leg folds while the stance leg compresses then pushes off.
    const power=locomotion?(run?1:.60):0;
    const swing=locomotion?Math.max(0,sine):0;
    const support=locomotion?Math.max(0,-sine):0;
    const upper=front?.115:-.185;
    apply(p,'leg'+name,'x',upper+power*.255*sine+
      (front?-.065:.055)*actionPulse);
    apply(p,'leg'+name,'z',(i%2?1:-1)*power*.038*lift);
    apply(p,'lower'+name,'x',(front?-.165:.225)+
      power*(.205*swing-.155*support));
    apply(p,'lower'+name,'z',(i%2?1:-1)*power*.028*lift);
    // The source m001 bone lengths are copied to m002/m003/m004.
    // Changing their lengths each support frame opens gaps at the knee
    // and moves the fur seam away from the distal pivot. Locomotion is
    // articulated entirely by hip, knee, hock and toe rotations instead.
    const upperJoint=p['leg'+name];
    if(upperJoint)upperJoint.scale.y=
      upperJoint.userData.restLengthScale??1;
    if(p['beastHock'+name]){
      apply(p,'beastHock'+name,'x',(front?-.095:-.285)+
        power*(.260*swing-.205*support));
      apply(p,'beastToe'+name,'x',.045+
        power*(.260*swing-.140*support));
      if(speciesId==='m001'){
        // Distinct carpal/metatarsal flexion separates the wrist/ankle
        // from the digit pad. Small angles preserve planted-paw contact.
        apply(p,'beastPastern'+name,'x',(front?-.052:.088)+
          power*((front?.13:.19)*swing-(front?.07:.10)*support));
      }
    }
  }else if(referenceFeline){
    // Four-beat stalk/walk and gathered-release gallop on real hip,
    // elbow/stifle and toe pivots; no mechanical pogo-straight legs.
    const power=locomotion?(run?1:.64):0;
    const swing=Math.max(0,-sine),stance=Math.max(0,sine);
    apply(p,'leg'+name,'x',(front?.09:-.19)+
      (front?.44:.37)*power*sine+(front?-.15:.10)*actionPulse);
    apply(p,'leg'+name,'z',(i%2?1:-1)*power*.022*lift);
    apply(p,'lower'+name,'x',(front?-.31:.38)+
      power*((front?.46:.52)*swing-(front?.10:.16)*stance));
    apply(p,'lower'+name,'z',(i%2?1:-1)*power*.014*lift);
    apply(p,'toe'+name,'x',.038+power*(.16*swing-.095*stance));
    const upperJoint=p['leg'+name];
    if(upperJoint)upperJoint.scale.y=
      upperJoint.userData.restLengthScale??1;
  }else{
    apply(p,'leg'+name,'x',strength*sine+(front?-.12:.10)*actionPulse);
    apply(p,'leg'+name,'z',(i%2?1:-1)*strength*.13*lift);
    // Protected m005 and other quadrupeds retain previous joint motion.
    apply(p,'lower'+name,'x',-strength*.30+strength*.62*lift);
    apply(p,'lower'+name,'z',(i%2?1:-1)*strength*.05*lift);
    if(p['beastHock'+name]){
      apply(p,'beastHock'+name,'x',(front?-.025:-.105)+strength*.43*lift);
      apply(p,'beastToe'+name,'x',-.035+strength*(.21*lift-.14*(1-lift)));
    }
  }
 }
 const travel=locomotion?1:0;
 const flex=run&&spine==='feline'?.13*Math.sin(phase*2+.25):.023*Math.sin(phase);
 apply(p,'torso','x',springBeast?-.042+travel*.018*Math.sin(phase*2):
   referenceFeline?-.018+travel*.035*Math.sin(phase*2+.25):travel*flex);
 apply(p,'torso','y',spine==='reptile'?travel*.07*Math.sin(phase):0);
 apply(p,'tail','y',Math.sin(phase*.55)*.18+actionPulse*.20);
 apply(p,'tailMid','y',Math.sin(phase*.55-.55)*.22+actionPulse*.09);
 apply(p,'tailTip','y',Math.sin(phase*.55-1.1)*.26);
}
function wingMotion(p,phase,action,actionPulse,reference){
 // Dedicated airborne rig for m013; the other birds keep their existing
 // approved biomechanics. Flap phase is slowed from the walking gait,
 // while flying actions accelerate it naturally.
 if(reference?.id==='m013'){
  const flying=action!=='defeat';
  const q=phase*.42;
  const power=!flying?0:action==='idle'?.60:
    action==='walk'?.53:action==='guard'?.28:
    action==='run'?.90:action==='attack'?.96:1;
  for(const side of [-1,1]){
   const suffix=side<0?'L':'R';
   const flap=Math.sin(q+(side<0?0:.05));
   const featherLag=Math.sin(q-.63);
   // A real downstroke and recovery: shoulder drives, elbow follows,
   // wrist feathers lag. Flight remains leg-free.
   apply(p,'wing'+suffix,'z',side*(.13+power*.58*flap));
   apply(p,'wing'+suffix,'x',-.10+power*.15*Math.cos(q-.18));
   apply(p,'wingElbow'+suffix,'y',
      side*(.23+power*.24*Math.sin(q-.43)));
   apply(p,'wingElbow'+suffix,'x',
      -.04+power*.22*Math.cos(q-.55));
   apply(p,'wingWrist'+suffix,'y',
      side*(.09+power*.26*Math.sin(q-.88)));
   apply(p,'wingWrist'+suffix,'z',
      side*power*.20*featherLag);
   if(p['phoenixArm'+suffix]){
    apply(p,'phoenixArm'+suffix,'z',side*(.03+power*.09*flap));
    apply(p,'phoenixArm'+suffix,'x',-.07*actionPulse);
    apply(p,'phoenixForearm'+suffix,'x',
      -.06*actionPulse+power*.08*featherLag);
    apply(p,'phoenixFeatherHand'+suffix,'z',
      side*(.06+power*.10*featherLag));
   }
   // Flight legs retract underneath the belly; grounded standing
   // is only permitted for the terminal defeat/landing animation.
   const tuck=flying?1:0;
   const pedal=power*.06*Math.sin(q+(side<0?0:PI));
   apply(p,'leg'+suffix,'x',.50*tuck+pedal);
   apply(p,'birdKnee'+suffix,'x',-.74*tuck+.10*pedal);
   apply(p,'birdAnkle'+suffix,'x',.40*tuck);
   apply(p,'avianFoot'+suffix,'x',.22*tuck);
  }
  apply(p,'tail','x',flying?-.08+power*.06*Math.sin(q-.30):0);
  return;
 }

 const hasFlap=action==='special'||action==='leap'||action==='run'||action==='attack';
 // The Phoenix idle pose must NOT use a gallop-speed phase (7rad/s).
 // Previously its whole silhouette shook while the viewer was stationary.
 const stablePhoenix=reference?.id==='m013'&&action==='idle';
 if(stablePhoenix)phase*=.14;
 const power=stablePhoenix?.035:hasFlap?1:.25;
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
  // Separate feather-covered hand in front of the chest: slight wing-
  // synchronized sway, never the full rigid 82-feather wing flap.
  if(p['phoenixArm'+suffix]){
   apply(p,'phoenixArm'+suffix,'z',
    side*(.045+power*.095*Math.sin(phase*.88+.28)));
   apply(p,'phoenixArm'+suffix,'x',
    -.12*actionPulse+.055*Math.sin(phase*.68));
   apply(p,'phoenixForearm'+suffix,'x',
    -.16*actionPulse+.12*power*Math.sin(phase*.96-.35));
   apply(p,'phoenixFeatherHand'+suffix,'z',
    side*(.09+power*.12*Math.cos(phase*.94-.45)));
  }
  // Phoenix: muscular femur / actual knee / narrow chicken tarsus must
  // articulate separately. A modest flex retains a planted foot in idle.
  if(p['birdKnee'+suffix]){
   const step=Math.sin(phase+(side<0?0:Math.PI));
   apply(p,'birdKnee'+suffix,'x',
    hasFlap?-.12+.20*step:.035+.09*Math.max(0,step));
  }
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
  quadrupedMotion(p,phase,movement,run,pulse,study.source,study.id);
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
