/** Lightweight action envelope shared by creature gallery and the battle renderer.
 * Only pose and timestamp are stored per creature; no new skeletal rig or
 * per-frame allocations are required.
 */
export const CREATURE_POSE_DURATIONS=Object.freeze({
  roar:1.3, special:1.6, dodge:.72, hit:.46, guard:1.25,
  leap:1.15, defeat:1.0,
});
export function startCreaturePose(object,action,time){
 if(!Object.prototype.hasOwnProperty.call(CREATURE_POSE_DURATIONS,action))
   throw Error('Unknown creature action: '+action);
 object.poseAction=action;
 object.poseStartedAt=time;
 return object;
}
export function creaturePoseFrame(object,time){
 const action=object?.poseAction;
 if(!action||!Number.isFinite(object?.poseStartedAt))return {action:null,t:0,pulse:0};
 const duration=CREATURE_POSE_DURATIONS[action];
 const t=Math.max(0,(time-object.poseStartedAt)/duration);
 if(t>1)return {action:null,t:1,pulse:0};
 return {action,t,pulse:Math.sin(Math.PI*t)};
}
