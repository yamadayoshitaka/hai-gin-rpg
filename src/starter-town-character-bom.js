/** Original starter-kingdom JRPG civilian presets. Data-only and safely mapped onto existing rigs.
 * These presets describe the desired characters; missing external meshes remain catalog references,
 * and must never trigger unvalidated asset loading or pretend to be installed.
 */
export const STARTER_KINGDOM_CHARACTER_PRESETS=Object.freeze([
 {id:'royal-king',modelId:'Male_Ranger',name:'王',job:'国王',role:'royal',body:'sturdy',face:'noble',hair:'short',outfit:'noble',equipment:'none',palette:['navy','crimson','gold'],area:'castle',behavior:'throne_idle'},
 {id:'castle-sentinel',modelId:'Male_Ranger',name:'近衛兵',job:'近衛兵',role:'guard',body:'tall',face:'stern',hair:'short',outfit:'guard',equipment:'guard',palette:['blue','silver','brown'],area:'castle',behavior:'guard'},
 {id:'castle-guide',modelId:'Female_Peasant',name:'城の案内人',job:'案内役',role:'civilian',body:'adult',face:'calm',hair:'bob',outfit:'noble',equipment:'none',palette:['blue','cream','gold'],area:'castle',behavior:'greet'},
 {id:'chapel-priest',modelId:'Male_Peasant',name:'礼拝堂の司祭',job:'司祭',role:'civilian',body:'slim',face:'calm',hair:'short',outfit:'mage',equipment:'staff',palette:['white','green','gold'],area:'church',behavior:'pray'},
 {id:'innkeeper',modelId:'Male_Peasant',name:'宿屋の主人',job:'宿屋',role:'civilian',body:'sturdy',face:'calm',hair:'swept',outfit:'merchant',equipment:'none',palette:['cream','brown','green'],area:'inn',behavior:'counter'},
 {id:'weaponsmith',modelId:'Male_Peasant',name:'武器職人',job:'武器屋',role:'civilian',body:'sturdy',face:'stern',hair:'short',outfit:'merchant',equipment:'none',palette:['brown','darkred','iron'],area:'weapons',behavior:'counter'},
 {id:'armorer',modelId:'Male_Ranger',name:'防具商',job:'防具屋',role:'civilian',body:'adult',face:'calm',hair:'short',outfit:'guard',equipment:'none',palette:['gray','blue','brown'],area:'armor',behavior:'counter'},
 {id:'item-merchant',modelId:'Female_Peasant',name:'道具屋の店主',job:'道具屋',role:'civilian',body:'slim',face:'calm',hair:'long',outfit:'merchant',equipment:'none',palette:['green','yellow','brown'],area:'items',behavior:'counter'},
 {id:'town-maiden',modelId:'Female_Peasant',name:'町娘',job:'町人',role:'civilian',body:'slim',face:'youthful',hair:'bob',outfit:'villager',equipment:'none',palette:['pink','white','skyblue'],area:'residential',behavior:'wander'},
 {id:'town-craftsman',modelId:'Male_Peasant',name:'町の職人',job:'職人',role:'civilian',body:'adult',face:'calm',hair:'swept',outfit:'villager',equipment:'none',palette:['beige','green','brown'],area:'market',behavior:'wander'},
 {id:'elder',modelId:'Male_Peasant',name:'町の長老',job:'長老',role:'civilian',body:'slim',face:'calm',hair:'bald',outfit:'noble',equipment:'none',palette:['gray','green','brown'],area:'residential',behavior:'talk'},
 {id:'child',modelId:'Female_Peasant',name:'町の子ども',job:'子ども',role:'civilian',body:'child',face:'youthful',hair:'bob',outfit:'villager',equipment:'none',palette:['yellow','green','orange'],area:'residential',behavior:'wander'},
 {id:'traveler',modelId:'Male_Ranger',name:'旅人',job:'旅人',role:'civilian',body:'adult',face:'calm',hair:'layered',outfit:'traveler',equipment:'sword',palette:['blue','brown','red'],area:'square',behavior:'wander'},
 {id:'novice-adventurer',modelId:'Male_Ranger',name:'新米冒険者',job:'冒険者',role:'civilian',body:'adult',face:'youthful',hair:'swept',outfit:'traveler',equipment:'sword',palette:['red','blue','leather'],area:'square',behavior:'wander'},
 {id:'wealthy-citizen',modelId:'Male_Ranger',name:'裕福な町人',job:'町人',role:'royal',body:'adult',face:'noble',hair:'long',outfit:'noble',equipment:'none',palette:['purple','white','gold'],area:'market',behavior:'wander'}
]);
export function resolveStarterKingdomCharacter(index){
 const a=STARTER_KINGDOM_CHARACTER_PRESETS;
 return a[((index%a.length)+a.length)%a.length];
}
export function validateStarterKingdomCharacters(){
 const ids=new Set();
 for(const preset of STARTER_KINGDOM_CHARACTER_PRESETS){
  if(ids.has(preset.id))throw Error('Duplicate starter character '+preset.id);
  ids.add(preset.id);
  if(!['hero','royal','guard','civilian'].includes(preset.role))throw Error('Invalid role '+preset.id);
  if(!['Male_Peasant','Female_Peasant','Male_Ranger','Female_Ranger'].includes(preset.modelId))throw Error('Invalid model ID '+preset.id);
  if(!preset.body||!preset.face||!preset.hair||!preset.outfit||!preset.equipment)throw Error('Incomplete preset '+preset.id);
 }
 return true;
}
