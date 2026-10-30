/** Data-driven two-bone foot contact: operates on imported THREE bones.
 * Contact state belongs to an actor, not a job or a renderer.
 */
export const DEFAULT_FOOT_CONTACT=Object.freeze({
 stanceFraction:.56,phaseOffset:[0,.5],iterations:12,maxCorrectionRadians:.75,
 groundOffset:0, releaseOnDiscontinuityMeters:.6
});
export function createFootContactController({THREE,model,host,bones,config=DEFAULT_FOOT_CONTACT}){
 const legs=['l','r'].map(side=>{
  const hip=bones.get('thigh_'+side),foot=bones.get('foot_'+side);
  // Exporters may name the calf differently. Resolve the two-bone chain by hierarchy.
  let knee=bones.get('shin_'+side)||null;
  if(!knee&&hip&&foot){
   let cursor=foot.parent;
   while(cursor&&cursor!==hip){
    if(cursor.isBone){knee=cursor;break;}
    cursor=cursor.parent;
   }
   let ancestor=knee;
   while(ancestor&&ancestor!==hip)ancestor=ancestor.parent;
   if(ancestor!==hip)knee=null;
  }
  return {hip,knee,foot,anchor:null,plant:false};
 });
 if(legs.some(x=>!x.hip||!x.knee||!x.foot))return {valid:false,reason:'missing connected leg chain',tick:()=>{}};
 const at=new THREE.Vector3(),end=new THREE.Vector3(),pivot=new THREE.Vector3(),a=new THREE.Vector3(),c=new THREE.Vector3();
 const q=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),delta=new THREE.Quaternion();
 function steer(bone,target){
  model.updateMatrixWorld(true);
  bone.getWorldPosition(pivot);
  const foot=bone===legs[0].hip||bone===legs[0].knee?legs[0].foot:legs[1].foot;
  foot.getWorldPosition(end);
  a.copy(end).sub(pivot);c.copy(target).sub(pivot);
  if(a.lengthSq()<1e-8||c.lengthSq()<1e-8)return;
  delta.setFromUnitVectors(a.normalize(),c.normalize());
  const angle=2*Math.acos(Math.min(1,Math.max(-1,delta.w)));
  if(angle>(config.maxCorrectionRadians??.75))delta.slerp(new THREE.Quaternion(),1-(config.maxCorrectionRadians||.4)/angle);
  bone.parent.getWorldQuaternion(parentQ);
  q.copy(parentQ).invert().multiply(delta).multiply(parentQ);
  bone.quaternion.premultiply(q).normalize();
 }
 function tick({action,time,period}){
  if(!['walk','run'].includes(action)||!Number.isFinite(time)||!(period>0)){
   for(const leg of legs){leg.anchor=null;leg.plant=false;}
   return;
  }
  model.updateMatrixWorld(true);
  for(let i=0;i<legs.length;i++){
   const leg=legs[i],phase=((time/period+(config.phaseOffset?.[i]??i*.5))%1+1)%1;
   const planted=phase<(config.stanceFraction??.56);
   leg.foot.getWorldPosition(at);
   if(!planted){leg.anchor=null;leg.plant=false;continue;}
   if(!leg.plant||!leg.anchor||leg.anchor.distanceTo(at)>(config.releaseOnDiscontinuityMeters??.6)){
    leg.anchor=at.clone();leg.plant=true;
   }
   for(let n=0;n<(config.iterations??12);n++){steer(leg.knee,leg.anchor);steer(leg.hip,leg.anchor);}
  }
  model.updateMatrixWorld(true);
  const errors=legs.filter(leg=>leg.plant&&leg.anchor).map(leg=>{
   leg.foot.getWorldPosition(at);
   return at.distanceTo(leg.anchor);
  });
  host.userData.footContactDiagnostics={action,planted:errors.length,maxError:errors.length?Math.max(...errors):0};
 }
 return {valid:true,tick,legs};
}
