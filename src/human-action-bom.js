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
 const a=HUMAN_ACTIONS[action];if(!a)throw Error('Unknown human action '+action);
 const p=time*a.frequency*(style?.tempo??1),walking=action==='walk'||action==='run',attack=action==='attack',guard=action==='guard';
 const out={hips:[],knees:[],ankles:[],shoulders:[],elbows:[],wrists:[],
  spineY:Math.sin(p*.52)*a.spine+(attack?(style?.attackLean??0):0),spineZ:Math.sin(p*.5)*a.spine*.22,headX:Math.sin(p*.44)*.011,
  bob:Math.abs(Math.sin(p)) * a.bob};
 for(let i=0;i<2;i++){
  const sign=i===0?-1:1,step=Math.sin(p+i*Math.PI+(style?.stance??0)),lift=Math.max(0,-step);
  out.hips.push(walking?step*(style?.hipSwing??a.hips):attack?sign*.12:Math.sin(p*.45+i)*.012);
  out.knees.push(HUMAN_REST_POSE.kneeBend+(walking?lift*a.knees:guard?.18:Math.sin(p*.6+i)*.016));
  out.ankles.push(walking?(-step*.20-lift*.24):0);
  out.shoulders.push(guard?-1.07:attack?(i===0?-1.45:-.45):HUMAN_REST_POSE.shoulderForward-(walking?step*(style?.shoulderSwing??a.shoulders):Math.sin(p*.48+i)*((style?.idleSway??.015)+.018)));
  out.elbows.push(guard?-.62:attack?-.65:HUMAN_REST_POSE.elbowBend+(walking?lift*a.elbows:0));
  out.wrists.push(walking?-.11:0);
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
