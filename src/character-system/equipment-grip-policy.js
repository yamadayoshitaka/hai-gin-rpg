// The grip belongs at the actual palm, not at an imported model's arbitrary
// origin. Fractions refer to the source prop's vertical bounds, bottom to top.
export const HELD_GRIP_FRACTIONS=Object.freeze({
 sword:.095,dagger:.095,axe:.16,bow:.50,spear:.22,staff:.22,scepter:.24,
 'command-baton':.19
});

export function sourceGripFromBounds(kind,min,max){
 const fraction=HELD_GRIP_FRACTIONS[kind];
 if(fraction===undefined)throw Error('握り点未登録: '+kind);
 for(const value of [min.x,min.y,min.z,max.x,max.y,max.z])if(!Number.isFinite(value))
  throw Error('握り点の原点座標が不正: '+kind);
 return {x:(min.x+max.x)*.5,y:min.y+(max.y-min.y)*fraction,z:(min.z+max.z)*.5};
}
