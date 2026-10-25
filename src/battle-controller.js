/** v115 battle controller: deterministic data -> command state; no rendering dependencies. */
export const BATTLE_RULES=Object.freeze({
 tapMs:340,resetThreshold:.28,pressThreshold:.58,guardThreshold:.55,
 combos:[{sequence:['mid','low','mid'],bonus:1.65,name:'三連撃'},{sequence:['low','mid','special'],bonus:1.8,name:'崩し奥義'}],
 strikes:{mid:{label:'中段',damage:1,cooldown:.35,windup:.19},low:{label:'下段',damage:.74,cooldown:.37,windup:.22},special:{label:'奥義',damage:1.42,cooldown:.58,windup:.28}},
 movement:{battleSpeed:2.7,battleDash:5.2,fieldSpeed:3.7,fieldDash:7.1}
});
export function createBattleInputState(){return {lastDir:null,releaseAt:-Infinity,pressed:false,activeDash:false,attackHistory:[],lastAttackAt:-Infinity};}
export function resolveBattleInput(state,{x=0,z=0,time=0,battle=false,hasTarget=false,canGuard=true,shift=false}){
 const length=Math.min(1,Math.hypot(x,z));
 const dir=length>=BATTLE_RULES.pressThreshold?(Math.abs(x)>Math.abs(z)?(x>0?'right':'left'):(z>0?'back':'forward')):null;
 // The state machine owns double taps; a held lever never starts sprinting.
 if(dir===null){if(state.pressed)state.releaseAt=time;state.pressed=false;state.activeDash=false;}
 else if(!state.pressed||state.lastDir!==dir){
   state.activeDash=!state.pressed&&state.lastDir===dir&&time-state.releaseAt<=BATTLE_RULES.tapMs;
   state.lastDir=dir;state.pressed=true;
 }
 const guard=battle&&hasTarget&&canGuard&&z>=BATTLE_RULES.guardThreshold&&Math.abs(x)<.65&&!state.activeDash;
 return {x,z,length,dir,dash:!!(state.activeDash||shift)&&!guard,guard,
   // screen vertical maps to opponent axis, screen horizontal to sidestep
   longitudinal:battle?-z:-z,lateral:x};
}
export function resolveStrike(state,type,time){
 const spec=BATTLE_RULES.strikes[type]||BATTLE_RULES.strikes.mid;
 if(time-state.lastAttackAt>2100)state.attackHistory=[];
 state.attackHistory.push(type);state.attackHistory=state.attackHistory.slice(-3);
 state.lastAttackAt=time;
 const finisher=BATTLE_RULES.combos.find(c=>c.sequence.join('|')===state.attackHistory.join('|'));
 if(finisher)state.attackHistory=[];
 return {type,label:spec.label,damageMultiplier:spec.damage*(finisher?.bonus||1),cooldown:spec.cooldown,windup:spec.windup,finisher:finisher?.name||null};
}
export function battleMovementVector(input,hero,target,camera){
 if(target){
   const ox=target.x-hero.x,oz=target.z-hero.z,d=Math.max(.001,Math.hypot(ox,oz));
   const fx=ox/d,fz=oz/d;
   return {x:fx*input.longitudinal+fz*input.lateral,z:fz*input.longitudinal-fx*input.lateral};
 }
 const ox=camera.x-hero.x,oz=camera.z-hero.z,d=Math.max(.001,Math.hypot(ox,oz));
 return {x:(-ox*input.longitudinal+oz*input.lateral)/d,z:(-oz*input.longitudinal-ox*input.lateral)/d};
}
export function battleFacingYaw(hero,target){return Math.atan2(target.x-hero.x,target.z-hero.z);}
