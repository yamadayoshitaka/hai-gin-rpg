/**
 * Species-scaled, four-phase leap for the monster inspector.
 * Only modifies the procedural monster rig, not the human actor controller.
 * Progress is normalized across the existing 1.25 s leap action.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>t*t*(3-2*t);
export const MONSTER_LEAP_PHASES=Object.freeze([
 Object.freeze({name:'anticipation',start:0,end:.20}),
 Object.freeze({name:'takeoff',start:.20,end:.38}),
 Object.freeze({name:'airborne',start:.38,end:.74}),
 Object.freeze({name:'landing',start:.74,end:1}),
]);
const scaleByFamily=Object.freeze({
 beast:1,feline:1.16,avian:1.05,reptile:.8,insect:.8,arachnid:.77,
 undead:.66,golem:.49,fiend:.94,aquatic:.70,
});
export function monsterLeapPose(progress=0,family='beast'){
 const t=clamp(Number.isFinite(progress)?progress:0,0,1);
 const scale=scaleByFamily[family]??1;
 let phase,height=0,crouch=0,extension=0,tuck=0,impact=0;
 if(t<.20){
   phase='anticipation';
   const q=smooth(t/.20);
   crouch=q;
   height=-.12*q;
 }else if(t<.38){
   phase='takeoff';
   const q=smooth((t-.20)/.18);
   height=-.12+(.86*q);
   crouch=1-q;
   extension=Math.sin(Math.PI*q);
 }else if(t<.74){
   phase='airborne';
   const q=(t-.38)/.36;
   height=.74*Math.cos(Math.PI*.5*q);
   tuck=Math.sin(Math.PI*q)*.8+.18*(1-q);
 }else{
   phase='landing';
   const q=(t-.74)/.26;
   const impact=Math.sin(Math.PI*Math.min(1,q/.62));
   crouch=impact*.86;
   height=-.12*impact;
   // Recover smoothly to the default standing pose by the end.
 }
 return Object.freeze({phase,t,height:height*scale,crouch,extension,tuck,
   airborne:phase==='airborne'||phase==='takeoff'&&t>.28,
   pitch:(phase==='takeoff' ? -.11*extension :
     phase==='airborne'?-.09*tuck:phase==='landing'?.10*crouch:0)});
}
/** Layer on top of standard pose after gait/wing controllers are evaluated. */
export function applyMonsterLeapMotion(p,pose,family){
 if(!pose)return false;
 const {crouch,extension,tuck}=pose;
 const quadruped=['beast','feline','reptile'].includes(family);
 const multi=['insect','arachnid'].includes(family);
 const avian=family==='avian';
 const add=(name,axis,angle)=>{
   if(p[name])p[name].rotation[axis]+=angle;
 };
 if(quadruped){
   for(const key of ['frontL','frontR','rearL','rearR']){
     const front=key.startsWith('front');
     add('leg'+key,'x', (front?-1:1)*(.39*crouch-.31*extension)+
       (front?.47:-.32)*tuck);
     add('lower'+key,'x',front?-.44*crouch+.27*tuck:
       -.53*crouch+.36*tuck);
     add('hock'+key,'x',.18*crouch-.23*extension+.15*tuck);
     add('toe'+key,'x',-.13*extension+.16*crouch);
   }
   add('torso','x',-.09*extension+.12*crouch);
   add('head','x',.08*crouch-.11*extension);
 }else if(multi){
   const count=family==='arachnid'?4:3;
   for(const side of ['L','R'])for(let i=0;i<count;i++){
     const name='leg'+side+i;
     add(name,'x',-.14*crouch+.27*extension-.09*tuck);
     add(name+'Patella','z',(side==='L'?-1:1)*(.14*crouch+.22*tuck));
     add(name+'Tibia','z',(side==='L'?1:-1)*(.16*crouch+.18*tuck));
   }
 }else{
   for(const suffix of ['L','R']){
     add('leg'+suffix,'x',.45*crouch-.38*extension+.57*tuck);
     add('knee'+suffix,'x',-.70*crouch+.25*extension-.50*tuck);
     add('ankle'+suffix,'x',.25*crouch-.17*extension+.30*tuck);
     add('arm'+suffix,'x',-.32*extension-.18*tuck+.11*crouch);
   }
   add('torso','x',.12*crouch-.12*extension+.14*tuck);
   add('head','x',-.08*extension+.07*crouch);
 }
 if(avian){
   for(const side of ['L','R']){
     const sign=side==='L'?-1:1;
     add('wing'+side,'z',sign*(.39*extension+.20*tuck-.25*crouch));
     add('wingElbow'+side,'y',sign*(.20*tuck+.16*crouch));
     add('wingWrist'+side,'y',sign*.29*tuck);
   }
 }
 return true;
}
