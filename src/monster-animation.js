/** Per-species, per-part procedural animation for bestiary inspection.
 * Separate head, jaws, limbs, wings and tentacles keep animation readable.
 */
const durations=Object.freeze({idle:Infinity,walk:Infinity,run:Infinity,attack:1.1,
  special:1.6,roar:1.3,dodge:.7,hit:.45,leap:1.25,defeat:1.15});
export const MONSTER_ACTIONS=Object.freeze([
 ['idle','待機'],['walk','歩行'],['run','疾走'],['attack','通常攻撃'],
 ['special','固有技'],['roar','威嚇'],['dodge','回避'],
 ['hit','被弾'],['leap','跳躍'],['defeat','倒れる'],
]);
export function startMonsterAction(model,action,time=0){
 if(!Object.prototype.hasOwnProperty.call(durations,action))throw Error('Unknown monster action: '+action);
 model.userData.action=action;model.userData.actionAt=time;
 return model;
}
export function animateMonsterModel(model,time=0){
 if(!model)return;
 const p=model.userData.pivots||{};
 let action=model.userData.action||'idle';
 const elapsed=Math.max(0,time-(model.userData.actionAt??0));
 if(elapsed>durations[action]){
   action='idle';model.userData.action='idle';model.userData.actionAt=time;
 }
 const d=durations[action],progress=Number.isFinite(d)?Math.min(1,elapsed/d):0;
 const pulse=Number.isFinite(d)?Math.sin(Math.PI*progress):0;
 const locomotion=action==='walk'||action==='run';
 const speed=action==='run'?13:7,gait=time*speed;
 const strike=action==='attack'?pulse:0;
 const special=action==='special'?pulse:0;
 const hit=action==='hit'?pulse:0;
 const dodge=action==='dodge'?pulse:0;
 const leaping=action==='leap'?pulse:0;
 const dying=action==='defeat'?progress:0;
 const sway=Math.sin(time*2.1)*.027;
 model.rotation.set(-(strike*.23+special*.12+hit*.16)+dying*.19,
   dodge*Math.sin(progress*Math.PI)*.95,dying*.98+dodge*.25);
 model.position.set(dodge*Math.sin(progress*Math.PI)*1.3,Math.abs(Math.sin(gait))*(locomotion?.055:0)+
   leaping*Math.sin(Math.PI*progress)*.86-dying*.48,0);
 model.scale.setScalar((model.userData.homeScale??1)*(1-.16*dying));
 for(const [name,part] of Object.entries(p)){
   part.rotation.set(0,0,0);
   if(name==='head'){
     part.rotation.x=-strike*.27-special*.42+hit*.12+Math.sin(time*1.7)*.025;
     part.rotation.y=dodge*.30+Math.sin(time*.7)*.025;
   }else if(name==='jaw'){
     part.rotation.x=(action==='roar'?.55:pulse*.42)+Math.sin(time*3)*.022;
   }else if(name==='tail'){
     part.rotation.y=Math.sin(time*2.8)*.19+strike*.35+special*.58;
   }else if(name==='abdomen'){
     part.rotation.z=Math.sin(time*2.2)*.06;
   }else if(name.startsWith('wing')){
     const side=name.includes('L')?-1:1;
     part.rotation.z=side*(.22+.23*Math.sin(time*6.1)+special*.7+leaping*.6);
     part.rotation.x=.08*Math.sin(time*3);
   }else if(name.startsWith('tentacle')){
     const n=Number(name.slice('tentacle'.length))||0;
     part.rotation.x=Math.sin(time*4+n)*.21+strike*.35+special*.65;
     part.rotation.y=Math.cos(time*2.5+n)*.23;
   }else if(name.startsWith('leg')||name.startsWith('arm')){
     const side=name.includes('L')?-1:1,number=Number(name.slice(-1))||0;
     const gaitOffset=side>0?Math.PI:0;
     part.rotation.x=(locomotion?Math.sin(gait+gaitOffset+number*.62)*(action==='run'?.62:.34):0)+
       strike*(name.startsWith('arm')?-.70:-.2)+special*(name.startsWith('arm')?-.95:-.29);
     part.rotation.z=side*(dodge*.19+hit*.14+dying*.15);
   }else if(name==='torso'){
     part.rotation.z=sway+hit*.16;
   }
 }
 // Existing jaw pivot continues its action animation; speech adds a
 // bounded jaw opening after the usual pose (no bones duplicated).
 model.userData.facialControls?.update?.(Math.max(0,Math.min(.1,time-(model.userData.facialLastTime??time))));
 model.userData.facialLastTime=time;
 return {action,progress};
}
