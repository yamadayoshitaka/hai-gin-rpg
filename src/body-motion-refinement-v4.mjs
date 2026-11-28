// Original gait v4: continuous ankle targets, independent contact and swing phases.
export const STYLES=Object.freeze({natural:{label:'自然',tempo:1,stride:1,lift:1,gesture:1,emotion:'neutral'},calm:{label:'穏やか',tempo:.84,stride:.85,lift:.82,gesture:.76,emotion:'joy'},energetic:{label:'元気',tempo:1.12,stride:1.06,lift:1.12,gesture:1.17,emotion:'fun'},strong:{label:'力強い',tempo:1.04,stride:1.05,lift:1,gesture:1.12,emotion:'anger'},tired:{label:'疲労',tempo:.72,stride:.70,lift:.65,gesture:.65,emotion:'sad'}});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>x*x*(3-2*x);
const lerp=(a,b,t)=>a+(b-a)*t;
const R=Math.PI/180;
export function gaitTargets(action,phase,{ageAmp=1,style='natural',build='normal'}={}){
 const run=action==='run',s=STYLES[style]||STYLES.natural,heavy=build==='fat'?.86:1,amp=clamp(ageAmp,.45,1.2);
 const duty=run?.40:.62,step=(run?.26:.20)*amp*s.stride*heavy,raise=(run?.125:.065)*amp*s.lift*heavy;
 const cycle=((phase%1)+1)%1;
 function foot(u){const stance=u<duty;let z,y,pitch;if(stance){const f=u/duty;z=lerp(step,-step,f);y=0;pitch=run?lerp(4,-19,smooth(f)):f<.28?lerp(11,0,smooth(f/.28)):lerp(0,-14,smooth((f-.28)/.72))}else{const f=(u-duty)/(1-duty);const m=-2*step*(1-duty)/duty;z=lerp(-step,step,smooth(f))+m*(2*f*f*f-3*f*f+f);y=raise*Math.sin(Math.PI*f)**2;pitch=lerp(run?-19:-14,run?4:11,smooth(f))}return {z,y,pitch:pitch*R,contact:stance}}
 const feet=[foot(cycle),foot((cycle+.5)%1)];
 // pelvis height is continuous even when the supporting foot changes.
 const half=cycle%.5,flight=run&&half>duty?Math.sin(Math.PI*(half-duty)/(.5-duty))**2:0;const bob=(run?-.058:-.030)+(run?.008:.006)*Math.cos(4*Math.PI*(cycle-.10))+.025*flight;
 return {feet,bob,roll:Math.sin(2*Math.PI*cycle)*(run?.018:.026),phase:cycle};
}
export function actionEmotion(action,style){if(style!=='natural')return STYLES[style]?.emotion||'neutral';return ({wave:'joy',punch:'anger',run:'neutral',jump:'fun',point:'neutral',grasp:'neutral',pickup:'neutral'})[action]||'neutral'}
