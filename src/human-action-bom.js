/** Declarative humanoid action BOM. Angles in radians, applied to existing joint pivots. */
export const HUMAN_ACTIONS=Object.freeze({
 idle:{frequency:1.35,blend:9,hips:.012,knees:.035,shoulders:.04,elbows:.025,spine:.012,bob:.003},
 walk:{frequency:8.4,blend:12,hips:.56,knees:.72,shoulders:.48,elbows:.18,spine:.075,bob:.024},
 run:{frequency:12.2,blend:14,hips:.83,knees:.94,shoulders:.72,elbows:.30,spine:.12,bob:.045},
 attack:{frequency:10,blend:16,hips:.18,knees:.19,shoulders:.92,elbows:.55,spine:.20,bob:.012},
 guard:{frequency:2,blend:15,hips:.025,knees:.08,shoulders:.04,elbows:.50,spine:.02,bob:0},
 hit:{frequency:5,blend:16,hips:.03,knees:.24,shoulders:.18,elbows:.4,spine:.22,bob:0},
 dead:{frequency:0,blend:5,hips:0,knees:0,shoulders:0,elbows:0,spine:0,bob:0}
});
export const HUMAN_REST_POSE=Object.freeze({
 shoulderSpread:.18,shoulderForward:.11,elbowBend:.17,kneeBend:.06,footAngle:0
});
export function resolveHumanAction(state={}){
 if(state.dead)return 'dead';
 if(state.hit)return 'hit';
 if(state.attack)return 'attack';
 if(state.guard)return 'guard';
 return state.moving?(state.running?'run':'walk'):'idle';
}
export function calculateHumanPose(action='idle',time=0,style=null){
 const a=HUMAN_ACTIONS[action];if(!a)throw Error('Unknown action '+action);
 const moving=action==='walk'||action==='run',attacking=action==='attack',guarding=action==='guard';
 const phase=time*a.frequency*(style?.tempo??1);
 const stride=action==='run'?1:action==='walk'?.69:0;
 const sway=style?.idleSway??.015;
 const out={hips:[],knees:[],ankles:[],shoulders:[],elbows:[],wrists:[],
  spineY:Math.sin(phase*.5)*(moving?.075:.025)+(attacking?(style?.attackLean??.16):0),
  spineZ:Math.sin(phase*.5)*(moving?.055:sway),
  headX:Math.sin(phase*.42)*.018,bob:moving?Math.abs(Math.sin(phase))*(action==='run'?.035:.016):Math.sin(phase*.6)*.006};
 for(let i=0;i<2;i++){
  const side=i===0?-1:1,step=Math.sin(phase+i*Math.PI),footLift=Math.max(0,-step);
  const opposite=-step;
  out.hips.push(moving?step*(style?.hipSwing??.36)*stride:guarding?side*.06:attacking?side*.15:Math.sin(phase*.35+i)*.014);
  out.knees.push(.09+(moving?footLift*(action==='run'?.82:.55):guarding?.16:attacking?.19:.016*Math.sin(phase*.4+i)));
  out.ankles.push(moving?-.17*step-.21*footLift:0);
  const armSwing=moving?opposite*(style?.shoulderSwing??.27)*stride:Math.sin(phase*.43+i*1.8)*(sway+.012);
  out.shoulders.push(guarding?-1.06:attacking?(i===0?-.67:-1.34):.08+armSwing);
  out.elbows.push(guarding?-.65:attacking?-.75:(i===0?.15:.21)+(moving?footLift*.08:.012*Math.sin(phase*.33+i)));
  out.wrists.push(moving?-.07:0);
 }
 return out;
}
export function validateHumanActions(){
 for(const [name,a] of Object.entries(HUMAN_ACTIONS)){
  if(!Number.isFinite(a.frequency)||!Number.isFinite(a.blend)||a.blend<=0)throw Error('Invalid action '+name);
  const pose=calculateHumanPose(name,.37);
  if(![...pose.hips,...pose.knees,...pose.shoulders,pose.bob].every(Number.isFinite))throw Error('Invalid pose '+name);
 }
 return true;
}
