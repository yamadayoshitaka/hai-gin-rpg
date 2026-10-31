// Shared physical metadata for characters, equipment and scenery.
export const OBJECT_PHYSICS={
 sword:{massKg:1.4,shape:'capsule',radius:.045,length:1.05,friction:.55,restitution:.08,grip:'handR'},
 shield:{massKg:4,shape:'box',size:[.6,.8,.12],friction:.7,restitution:.04,grip:'handL'},
 table:{massKg:24,shape:'box',size:[1.4,.8,.9],friction:.8,restitution:.05},
 chair:{massKg:6,shape:'box',size:[.55,.9,.55],friction:.7,restitution:.08},
 barrel:{massKg:18,shape:'cylinder',radius:.34,height:.9,friction:.7,restitution:.1},
 wall:{massKg:0,shape:'mesh',static:true,friction:.85,restitution:0},
 floor:{massKg:0,shape:'mesh',static:true,friction:.9,restitution:0}
};
export function physicsObject(name,overrides={}){return {...OBJECT_PHYSICS[name],...overrides};}
