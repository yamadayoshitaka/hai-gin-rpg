/** Character assembly BOM v47: data-only presets, slots and compatibility checks. */
export const CHARACTER_PARTS=Object.freeze({
 bodies:{
  adult:{height:1.72,scale:[1,1,1],compat:'humanoid'},
  tall:{height:1.88,scale:[1.045,1.08,1.045],compat:'humanoid'},
  slim:{height:1.68,scale:[.9,1,.9],compat:'humanoid'},
  child:{height:1.30,scale:[.83,.78,.83],compat:'humanoid'},
  sturdy:{height:1.72,scale:[1.13,.98,1.13],compat:'humanoid'}
 },
 faces:{
  calm:{eyes:1,browAngle:0,cheeks:.05},
  stern:{eyes:.85,browAngle:-.16,cheeks:.03},
  youthful:{eyes:1.18,browAngle:.08,cheeks:.09},
  noble:{eyes:1.02,browAngle:.02,cheeks:.06}
 },
 hairs:{
  short:{length:.12,layers:12,sweep:0,fullness:1},
  layered:{length:.20,layers:22,sweep:.14,fullness:1.1},
  long:{length:.33,layers:30,sweep:.08,fullness:1.08},
  bob:{length:.235,layers:26,sweep:0,fullness:1.12},
  swept:{length:.19,layers:21,sweep:.34,fullness:1.03},
  bald:{length:0,layers:0,sweep:0,fullness:0}
 },
 outfits:{
  traveler:{coat:1,hem:1,armor:false,cape:true},
  villager:{coat:1,hem:.85,armor:false,cape:false},
  guard:{coat:1,hem:.83,armor:true,cape:false},
  noble:{coat:1,hem:1.25,armor:false,cape:true},
  merchant:{coat:1.08,hem:1.1,armor:false,cape:false},
  mage:{coat:.94,hem:1.55,armor:false,cape:true},
  bandit:{coat:.9,hem:.75,armor:true,cape:false}
 },
 equipment:{
  none:{right:null,left:null},
  sword:{right:'sword',left:null},
  guard:{right:'sword',left:'shield'},
  staff:{right:'staff',left:null}
 }
});
export const CHARACTER_PRESETS=Object.freeze({
 hero:{role:'hero',body:'adult',face:'calm',hair:'layered',outfit:'traveler',equipment:'sword'},
 villager:{role:'civilian',body:'adult',face:'calm',hair:'short',outfit:'villager',equipment:'none'},
 guard:{role:'guard',body:'tall',face:'stern',hair:'short',outfit:'guard',equipment:'guard'},
 noble:{role:'royal',body:'slim',face:'noble',hair:'long',outfit:'noble',equipment:'none'},
 merchant:{role:'civilian',body:'sturdy',face:'calm',hair:'swept',outfit:'merchant',equipment:'none'},
 mage:{role:'civilian',body:'slim',face:'calm',hair:'long',outfit:'mage',equipment:'staff'},
 child:{role:'civilian',body:'child',face:'youthful',hair:'bob',outfit:'villager',equipment:'none'},
 bandit:{role:'guard',body:'adult',face:'stern',hair:'swept',outfit:'bandit',equipment:'sword'}
});
const styles=['villager','merchant','mage','child','villager','bandit','noble','villager'];
export function resolveCharacterAssembly({role='civilian',variant=0,preset=null,overrides={}}={}){
 const id=preset||(role==='hero'?'hero':role==='guard'?'guard':role==='royal'?'noble':styles[((variant%styles.length)+styles.length)%styles.length]);
 const recipe=CHARACTER_PRESETS[id];
 if(!recipe)throw Error('Unknown character assembly '+id);
 const result={id,...recipe,...overrides};
 for(const [slot,table] of Object.entries({body:CHARACTER_PARTS.bodies,face:CHARACTER_PARTS.faces,hair:CHARACTER_PARTS.hairs,outfit:CHARACTER_PARTS.outfits,equipment:CHARACTER_PARTS.equipment})){
  if(!table[result[slot]])throw Error('Unknown character BOM '+slot+':'+result[slot]);
 }
 return Object.freeze(result);
}
export function validateCharacterAssemblies(){
 for(const key of Object.keys(CHARACTER_PRESETS))resolveCharacterAssembly({preset:key});
 return true;
}
