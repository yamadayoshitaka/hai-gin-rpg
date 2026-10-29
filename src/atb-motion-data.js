/** Original 3D JRPG battle motion timing. Shared by allies and enemies. */
export const ATB_ACTION=Object.freeze({
 duration:3.15, approachEnd:.44, strikeEnd:.63, impact:.54, hitSeconds:.38,
 moveSpeedBlend:11, poseLean:.12
});
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{const t=clamp(x);return t*t*(3-2*t);};
export function atbMotionSample(elapsed,duration=ATB_ACTION.duration){
 const t=clamp(elapsed/Math.max(.001,duration));
 const travel=t<ATB_ACTION.approachEnd?ease(t/ATB_ACTION.approachEnd):
 t<ATB_ACTION.strikeEnd?1:ease((1-t)/(1-ATB_ACTION.strikeEnd));
 const state=t<ATB_ACTION.approachEnd?'approach':
  t<ATB_ACTION.strikeEnd?'attack':t<1?'return':'idle';
 return {t,travel,state,hit:t>=ATB_ACTION.impact,complete:t>=1};
}
export function resolveAtbVictory(enemies){
 return Array.isArray(enemies)&&enemies.length>0&&enemies.every(e=>e.hp<=0);
}
