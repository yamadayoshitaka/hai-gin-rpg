/**
 * Initial battle territories: the blue army owns the WEST (small X),
 * the red army the EAST (large X). A 3-tile neutral corridor straddles
 * the stage's actual river centre or its virtual midline when riverless.
 *
 * Ownership is fixed for the current battle. Advancing troops do not silently
 * rewrite the boundaries or grant a strategist free enemy-side teleports.
 */
export const NEUTRAL_HALF_WIDTH=3;
export function territoryAt(x,z,{width,height,riverXAt,neutral=NEUTRAL_HALF_WIDTH}={}){
 if(!Number.isFinite(x)||!Number.isFinite(z)||x<0||x>=width||z<0||z>=height)return 'outside';
 const center=typeof riverXAt==='function'?riverXAt(Math.round(z)):width/2;
 if(x<center-neutral)return 'blue';
 if(x>center+neutral)return 'red';
 return 'neutral';
}
export function ownTerritory(team,x,z,world){
 return territoryAt(x,z,world)===(team===0?'blue':'red');
}
export function legalHomeWarpCell(unit,x,z,world,{walkable,occupied,units=[],objects=[]}={}){
 if(!unit?.alive||!unit.isStrategist||unit.rarity!=='UR'||unit.strategistWarpUsed)return false;
 if(!Number.isInteger(x)||!Number.isInteger(z)||!ownTerritory(unit.team,x,z,world))return false;
 if(!walkable?.[z*world.width+x])return false;
 if(occupied?.[z*world.width+x]!==undefined&&occupied[z*world.width+x]!==-1)return false;
 if(units.some(other=>other.alive&&other.id!==unit.id&&other.x===x&&other.z===z))return false;
 if(objects.some(o=>o.alive&&o.blocking&&o.x===x&&o.z===z))return false;
 return true;
}

/**
 * Automatic UR emergency escape uses a bounded candidate search over the
 * ENTIRE home half, not the former 6-12 tiles directly behind the general.
 * Manual warp may still target ANY legal tile in that home half.
 */
export function chooseHomeWarpLanding(unit,world,state){
 if(!unit||!unit.alive)return null;
 const {width,height}=world;
 const xs=[];
 for(let i=1;i<width-1;i+=Math.max(1,Math.floor(width/14)))xs.push(i);
 const zs=[];
 for(let i=1;i<height-1;i+=Math.max(1,Math.floor(height/14)))zs.push(i);
 const enemies=(state.units||[]).filter(o=>o.alive&&o.team!==unit.team);
 let best=null,bestScore=-Infinity;
 for(const x of xs)for(const z of zs){
  if(!legalHomeWarpCell(unit,x,z,world,state))continue;
  let nearest=Infinity;
  for(const enemy of enemies){
   const d=(enemy.x-x)**2+(enemy.z-z)**2;
   if(d<nearest)nearest=d;
   if(nearest<=9)break;
  }
  if(nearest<=9)continue;
  // Prefer a defensible withdrawal point near the friendly corner, not
  // an arbitrary far bank just outside the neutral corridor.
  const borderDistance=unit.team===0?width-x:x;
  const score=Math.min(nearest,900)+borderDistance*.08-
    Math.abs(z-unit.z)*.18;
  if(score>bestScore){best={x,z};bestScore=score;}
 }
 return best;
}
