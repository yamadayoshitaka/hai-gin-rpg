// Shared physical metadata for characters, equipment and scenery.
export const OBJECT_PHYSICS={
 sword:{force:{type:'impact',impulseNs:24,direction:[0,0,-1]},massKg:1.4,shape:'capsule',radius:.045,length:1.05,friction:.55,restitution:.08,grip:'handR'},
 shield:{force:{type:'impact',impulseNs:32,direction:[0,0,-1]},massKg:4,shape:'box',size:[.6,.8,.12],friction:.7,restitution:.04,grip:'handL'},
 bow:{massKg:1.1,shape:'capsule',radius:.025,length:1.3,force:{type:'projectile',impulseNs:8,direction:[0,0,-1]}},
 fan:{massKg:8,shape:'box',size:[.5,.5,.25],force:{type:'continuous',newtons:12,direction:[0,0,-1]}},
 table:{massKg:24,shape:'box',size:[1.4,.8,.9],friction:.8,restitution:.05},
 chair:{massKg:6,shape:'box',size:[.55,.9,.55],friction:.7,restitution:.08},
 barrel:{massKg:18,shape:'cylinder',radius:.34,height:.9,friction:.7,restitution:.1},
 wall:{massKg:0,shape:'mesh',static:true,friction:.85,restitution:0},
 floor:{massKg:0,shape:'mesh',static:true,friction:.9,restitution:0}
};
export function physicsObject(name,overrides={}){return {...OBJECT_PHYSICS[name],...overrides};}

export function forceImpulse(object,dt=0){const f=object.force;if(!f)return [0,0,0];const d=f.direction||[0,0,0],norm=Math.hypot(...d)||1;const amount=f.type==='continuous'?(f.newtons||0)*Math.max(0,dt):(f.impulseNs||0);return d.map(v=>v*amount/norm);}
