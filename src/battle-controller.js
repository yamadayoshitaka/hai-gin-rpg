/** v115 battle controller: deterministic data -> command state; no rendering dependencies. */
export const BATTLE_RULES=Object.freeze({
 tapMs:340,resetThreshold:.28,pressThreshold:.58,guardThreshold:.55,
 fighter:{crouchDown:.52,jumpUp:-.42,guardAway:-.5,commandWindowMs:650,specialBufferMs:320,jumpSeconds:.72,jumpHorizontalSpeed:2.65,jumpDiagonalThreshold:.20},
 guard:{perfectWindowSeconds:.19,recoverySeconds:.95,retreatSpeed:0.65,backwalkPlayback:0.38,staggerSeconds:2.0},
 combos:[{sequence:['weak','mid','strong'],bonus:1.45,name:'三連撃'},{sequence:['strong','mid','weak'],bonus:1.30,name:'逆連撃'}],
 strikes:{weak:{label:'弱',damage:.65,cooldown:.15,windup:.067},mid:{label:'中',damage:1,cooldown:.34,windup:.18},strong:{label:'強',damage:1.45,cooldown:.51,windup:.29},low:{label:'下段',damage:.74,cooldown:.37,windup:.22},special:{label:'必殺技',damage:1.85,cooldown:.67,windup:.30}},
 camera:{distanceFactor:0.95,maxWiden:17,baseOutdoor:6.4,baseIndoor:5.5},
 movement:{battleSpeed:2.7,battleDash:5.2,fieldSpeed:3.7,fieldDash:7.1}
});
// Classic arcade 2D fighter: direction is relative to opponent, vertical is jump/crouch.
export function createBattleInputState(){return {lastDir:null,releaseAt:-Infinity,pressed:false,activeDash:false,attackHistory:[],lastAttackAt:-Infinity,lastBattleGesture:null,stepSide:1,lastStepTap:null,lastStepAt:-Infinity,stepPressed:null,jumpPressed:false,commandStage:0,commandAt:-Infinity,specialReadyUntil:-Infinity};}
export function resolveBattleInput(state,{x=0,z=0,time=0,battle=false,hasTarget=false,canGuard=true,shift=false,hero=null,target=null,camera=null}){
 const length=Math.min(1,Math.hypot(x,z));
 const dir=length>=BATTLE_RULES.pressThreshold?(Math.abs(x)>Math.abs(z)?(x>0?'right':'left'):(z>0?'down':'up')):null;
 if(dir===null){if(state.pressed)state.releaseAt=time;state.pressed=false;state.activeDash=false;}
 else if(!state.pressed||state.lastDir!==dir){
  state.activeDash=!state.pressed&&state.lastDir===dir&&time-state.releaseAt<=BATTLE_RULES.tapMs;
  state.lastDir=dir;state.pressed=true;
 }
 const toTarget=hero&&target?{x:target.x-hero.x,z:target.z-hero.z}:null;
 const cx=camera&&hero?camera.x-hero.x:0,cz=camera&&hero?camera.z-hero.z:-1;
 const distanceCamera=Math.max(.001,Math.hypot(cx,cz));
 const screenRight={x:cz/distanceCamera,z:-cx/distanceCamera};
 const sideProjection=toTarget?toTarget.x*screenRight.x+toTarget.z*screenRight.z:0;
 const forwardSide=Math.abs(sideProjection)>.15?Math.sign(sideProjection):1;
 const forward=x*forwardSide;
 const crouch=battle&&hasTarget&&z>=BATTLE_RULES.fighter.crouchDown;
 const jumpHeld=battle&&hasTarget&&z<=BATTLE_RULES.fighter.jumpUp;
 const jump=jumpHeld&&!state.jumpPressed;
 state.jumpPressed=jumpHeld;
 const guard=battle&&hasTarget&&canGuard&&forward<=BATTLE_RULES.fighter.guardAway;
 // ↓ ↘ → + attack: one command, not a separately displayed magic button.
 // Track the direction edges; command expires after 650ms.
 if(battle&&hasTarget){
  if(time-state.commandAt>BATTLE_RULES.fighter.commandWindowMs)state.commandStage=0;
  const down=z>.6&&Math.abs(x)<.35;
  const downForward=z>.32&&forward>.32;
  const toward=forward>.58&&Math.abs(z)<.38;
  if(down&&state.commandStage===0){state.commandStage=1;state.commandAt=time;}
  else if(downForward&&state.commandStage===1){state.commandStage=2;state.commandAt=time;}
  else if(toward&&state.commandStage===2){state.commandStage=0;state.specialReadyUntil=time+BATTLE_RULES.fighter.specialBufferMs;}
 }else{state.commandStage=0;state.specialReadyUntil=-Infinity;}
 return {x,z,length,dir,jumpDirection:jump&&Math.abs(x)>=BATTLE_RULES.fighter.jumpDiagonalThreshold?Math.sign(x):0,dash:!!(shift||(!battle&&state.activeDash))&&!guard,guard,crouch,jump,
  parry:false,step:null,stepSide:state.stepSide,longitudinal:-z,lateral:x,forwardSide,forward,
  specialReady:battle&&time<=state.specialReadyUntil};
}
export function consumeSpecialCommand(state,time){
 if(!state||time>state.specialReadyUntil)return false;
 state.specialReadyUntil=-Infinity;
 return true;
}
export const FIGHTER_FRAME_RULES=Object.freeze({fps:60,weak:{startup:4,active:3,recovery:5,hitstun:13,cancelTo:['weak','mid','strong']},mid:{startup:10,active:4,recovery:10,hitstun:17,cancelTo:['strong']},strong:{startup:17,active:5,recovery:15,hitstun:23,cancelTo:[]}});
export const JOB_FRAME_PROFILES=Object.freeze({
 monk:{weakRecovery:-2,midRecovery:-2},rogue:{weakRecovery:-1},
 assassin:{weakRecovery:-2,midRecovery:-1},samurai:{strongStartup:-2},
 knight:{strongRecovery:3},mage:{weakRecovery:2},priest:{weakRecovery:1},
 swordsman:{strongStartup:-1},ranger:{weakRecovery:-1}
});
export function resolveStrike(state,type,time,job='swordsman'){
 const base=BATTLE_RULES.strikes[type]||BATTLE_RULES.strikes.mid;
 const profile=JOB_FRAME_PROFILES[job]||{};
 const frameBase=FIGHTER_FRAME_RULES[type]||null;
 const frames=frameBase?{...frameBase,
  startup:Math.max(2,frameBase.startup+(profile[type+'Startup']||0)),
  recovery:Math.max(2,frameBase.recovery+(profile[type+'Recovery']||0))}:null;
 const spec=frames?{...base,windup:frames.startup/60,cooldown:(frames.startup+frames.active+frames.recovery)/60}:base;
 if(time-state.lastAttackAt>2100)state.attackHistory=[];
 state.attackHistory.push(type);state.attackHistory=state.attackHistory.slice(-3);
 state.lastAttackAt=time;
 const finisher=BATTLE_RULES.combos.find(c=>c.sequence.join('|')===state.attackHistory.join('|'));
 if(finisher)state.attackHistory=[];
 return {type,label:spec.label,damageMultiplier:spec.damage*(finisher?.bonus||1),cooldown:spec.cooldown,windup:spec.windup,frames,finisher:finisher?.name||null};
}
export function battleMovementVector(input,hero,target,camera){
 // Direction is camera-relative in both exploration and combat.
 // Camera right is the world-space horizontal vector to the RIGHT of the screen.
 // Joystick UP goes away from camera (screen depth), DOWN comes toward camera.
 // Opponent facing determines forward/back commands; camera basis determines horizontal travel.
 const cx=camera.x-hero.x,cz=camera.z-hero.z,d=Math.max(.001,Math.hypot(cx,cz));
 const rightX=cz/d,rightZ=-cx/d;
 const forwardX=-cx/d,forwardZ=-cz/d;
 return {x:forwardX*input.longitudinal+rightX*input.lateral,z:forwardZ*input.longitudinal+rightZ*input.lateral};
}
export function battleFacingYaw(hero,target){return Math.atan2(target.x-hero.x,target.z-hero.z);}
