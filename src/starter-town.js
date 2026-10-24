import { resolveEntityRoles } from './entity-roles.js';
/**
 * Ariahan-inspired original 3D town layout for Hai-Gin RPG.
 * Architectural motifs: northern royal castle, western guild/tavern,
 * southern family homes, commercial quarter and east-side chapel.
 * This is not a tile-for-tile reproduction or extracted DQ3 map/artwork.
 * Coordinates are in existing outdoor house generator grid units.
 */
export const STARTER_TOWN={
 id:'revna-ariahan-inspired',name:'黎明の王都レヴナ',theme:'royal-starting-town',
 districts:[
  {id:'royal',name:'北の王城地区',center:[0,-79.5],purpose:'royal court and castle'},
  {id:'guild',name:'西の旅人街',center:[-50,-65],purpose:'inn, companions and trade'},
  {id:'market',name:'東の商店街',center:[45,-55],purpose:'weapons, armor and supplies'},
  {id:'homes',name:'南の居住区',center:[0,-15],purpose:'family homes and chapel'}
 ],
 // id/kind is resolved by index to remain compatible with existing indoor rooms.
 buildings:[
  {id:'home-hero',kind:'home',name:'旅立ちの家',grid:[-12,-5,6,6,5,0,Math.PI/2],capabilities:['rest','dialogue']},
  {id:'home-east',kind:'home',name:'東の民家',grid:[12,-5,6,6,5,1,-Math.PI/2]},
  {id:'weapon-shop',kind:'weapons',name:'王都武器店',grid:[-18,-16,7,7,6,2,Math.PI/2],capabilities:['shop']},
  {id:'armor-shop',kind:'armor',name:'王都防具店',grid:[18,-17,7,6,5.4,3,-Math.PI/2],capabilities:['shop']},
  {id:'old-house',kind:'old',name:'老人の家',grid:[-13,-33,7,6,6,1,Math.PI/2]},
  {id:'item-shop',kind:'items',name:'旅支度の道具屋',grid:[13,-34,8,6,6.4,2,-Math.PI/2],capabilities:['shop']},
  {id:'workshop',kind:'artisan',name:'城下の工房',grid:[-10,-45,6,6,5.2,0,Math.PI/2]},
  {id:'library',kind:'scholar',name:'王立資料室',grid:[11,-46,7,7,5.9,3,-Math.PI/2]},
  {id:'tavern',kind:'inn',name:'旅人の酒場・宿屋',grid:[-25,-27,14,12,8.8,0,Math.PI/2],capabilities:['inn','dialogue']},
  {id:'guild',kind:'merchant',name:'冒険者ギルド',grid:[25,-28,14,12,8.8,1,-Math.PI/2],capabilities:['shop','dialogue']},
  {id:'chapel',kind:'church',name:'黎明の礼拝堂',grid:[-17,6,7,7,5,2,Math.PI/2]},
  {id:'castle',kind:'manor',name:'レヴナ王城',grid:[0,-27,26,19,16,3,0],capabilities:['dialogue']}
 ],
 landmarks:[
  {id:'castle',kind:'royal-castle',label:'北の王城',buildingId:'castle'},
  {id:'central-square',kind:'square',position:[0,0,-37],label:'中央大通り'},
  {id:'fountain',kind:'fountain',position:[0,0,6.8],label:'町の噴水'},
  {id:'southern-gate',kind:'gate',position:[0,0,22],label:'南門'}
 ],
 // NPC coordinates are authored explicitly; remaining generic citizens can still be generated.
 citizens:[
  {id:'merchant-mira',x:-5,z:-13,name:'商人ミラ',role:'merchant',line:'王城へ続く通りには、旅人と商人が集まるの。'},
  {id:'traveler-leon',x:5.6,z:-14,name:'旅人レオン',role:'traveler',line:'北に見えるのがレヴナ王城だ。まずは王様に会うといい。'},
  {id:'citizen',x:-5,z:-36,name:'町の住人',role:'civilian',line:'西の酒場には、冒険の仲間を探す旅人が集まるよ。'},
  {id:'guard-west',x:-8,z:-73,name:'城門衛兵',role:'guard',line:'王城に入るなら武器を納めてくれ。'},
  {id:'guard-east',x:8,z:-74,name:'城門衛兵',role:'guard',line:'この王都は古い王家に守られている。'},
  {id:'tavern-regular',x:-6,z:-54,name:'酒場の常連',role:'civilian',line:'西の酒場なら旅の情報が聞けるぞ。'},
  {id:'market-buyer',x:7,z:-51,name:'買い物客',role:'civilian',line:'東には武器や防具のお店が並んでいるわ。'},
  {id:'young-apprentice',x:-8,z:-23,name:'見習い職人',role:'civilian',line:'旅立つなら、まず装備を整えないとね。'},
  {id:'chapel-pilgrim',x:6,z:4,name:'巡礼者',role:'civilian',line:'礼拝堂には旅の安全を祈る人々が集まる。'},
  {id:'old-soldier',x:-7,z:-45,name:'老兵',role:'civilian',line:'王都の石畳は何百年も人々を見守ってきた。'},
  {id:'courier',x:5,z:-66,name:'王城の使い',role:'civilian',line:'王から新しい布告が届いたところだ。'},
  {id:'farmer',x:-5,z:8,name:'農夫',role:'civilian',line:'町の南には畑と穏やかな街道がある。'},
  {id:'child',x:6,z:-4,name:'町の子ども',role:'civilian',line:'大きくなったら、ぼくも冒険者になるんだ！'},
  {id:'scholar',x:7,z:-40,name:'学者',role:'civilian',line:'この都はかつて大陸交易の要だったという。'},
  {id:'inn-guest',x:-7,z:-62,name:'宿泊客',role:'civilian',line:'長旅なら酒場の宿で休むといい。'}
 ]
};
/** Canonical town-space transform. All renderers and entrances use this. */
export function townBuildingPosition(building){
 if(building.position)return [...building.position];
 const [gx,gz]=building.grid;
 return [gx*2.65,gz*2.5-12];
}
export function townHouseStructures(town=STARTER_TOWN){
 return town.buildings.map(b=>{
  const [gx,gz,w,d,h,variant,yaw]=b.grid;
  const [x,z]=townBuildingPosition(b);
  return [x,z,w,d,h,variant,yaw];
 });
}
export function townNpcInfo(town=STARTER_TOWN){return town.citizens.map(n=>[n.x,n.z,n.name,n.line]);}


/**
 * Building recipes are independent of mesh implementations. Any building can
 * select a recipe or override its exterior / floor plan with data alone.
 */
export const BUILDING_RECIPES={
 cottage:{exterior:{material:'plaster',roof:'gable',windows:4,roofRiseRatio:.23},rooms:[{id:'living',usage:'living',floor:1},{id:'bedroom',usage:'sleep',floor:2}]},
 shop:{exterior:{material:'timber',roof:'gable',windows:4,roofRiseRatio:.28},rooms:[{id:'sales',usage:'shop',floor:1},{id:'storage',usage:'storage',floor:1},{id:'quarters',usage:'sleep',floor:2}]},
 tavern:{exterior:{material:'timber',roof:'gable',windows:6,roofRiseRatio:.30},rooms:[{id:'counter',usage:'inn',floor:1},{id:'hall',usage:'dialogue',floor:1},{id:'lodging',usage:'sleep',floor:2}]},
 temple:{exterior:{material:'stone',roof:'gable',windows:4,roofRiseRatio:.35},rooms:[{id:'sanctuary',usage:'dialogue',floor:1},{id:'vestry',usage:'storage',floor:2}]},
 castle:{exterior:{material:'stone',roof:'high-gable',windows:8,roofRiseRatio:.43},rooms:[{id:'foyer',usage:'entrance',floor:1},{id:'throne',usage:'dialogue',floor:1},{id:'royal-chamber',usage:'sleep',floor:2}]}
};
export const BUILDING_RECIPE_FOR_KIND={
 home:'cottage',old:'cottage',scholar:'cottage',artisan:'shop',weapons:'shop',
 armor:'shop',items:'shop',merchant:'shop',inn:'tavern',church:'temple',manor:'castle'
};
export function resolveTownBuilding(building){
 const recipeId=building.recipe??BUILDING_RECIPE_FOR_KIND[building.kind]??'cottage';
 const recipe=BUILDING_RECIPES[recipeId];
 if(!recipe)throw Error('Unknown building recipe: '+recipeId);
 return {...building,recipe:recipeId,exterior:{...recipe.exterior,...building.exterior},
  rooms:(building.rooms??recipe.rooms).map(room=>({...room}))};
}

/**
 * Canonical building hierarchy: building -> layout -> objects.
 * Layouts use building-local coordinates. Objects are declarative, never meshes.
 * A new shop, castle or home can be authored entirely by data overrides.
 */
export const LAYOUT_OBJECT_PRESETS={
 living:[{id:'table',type:'furniture',model:'table_low',position:[0,0,0],collision:true},{id:'lamp',type:'light',model:'lamp_standing',position:[-3,0,-3],lighting:{intensity:1.3}}],
 sleep:[{id:'bed',type:'furniture',model:'bed_single_A',position:[2,0,0],collision:true}],
 shop:[{id:'counter',type:'furniture',model:'table_low',position:[0,0,-3],collision:true,interaction:'shop'},{id:'shelf',type:'furniture',model:'shelf_A_big',position:[-5,0,-5],collision:true}],
 storage:[{id:'shelf',type:'furniture',model:'shelf_A_big',position:[0,0,-2],collision:true}],
 inn:[{id:'counter',type:'furniture',model:'table_low',position:[0,0,-3],collision:true,interaction:'inn'}],
 dialogue:[{id:'table',type:'furniture',model:'table_low',position:[0,0,0],collision:true}],
 entrance:[{id:'door',type:'door',model:'wooden_door',position:[0,0,7],collision:true,interactionKey:'toggle'}]
};
export function composeBuildingLayouts(building){
 const resolved=resolveTownBuilding(building);
 const layouts=(building.layouts??resolved.rooms.map((room,index)=>({
   id:room.id,floor:room.floor,usage:room.usage,
   bounds:room.bounds??{center:[0,0,0],size:[12,0,12]},
   objects:(room.objects??LAYOUT_OBJECT_PRESETS[room.usage]??[]).map(item=>({...item}))
 }))).map((layout,index)=>({
   id:String(layout.id??'layout-'+index),
   floor:layout.floor??1,
   usage:layout.usage??'generic',
   bounds:structuredClone(layout.bounds??{center:[0,0,0],size:[12,0,12]}),
   objects:(layout.objects??[]).map((item,i)=>resolveObjectDefinition({
     ...structuredClone(item),id:String(item.id??'object-'+i),
     position:[...(item.position??[0,0,0])],
     type:item.type??'object'
   }))
 }));
 const seen=new Set();
 for(const layout of layouts){
   if(seen.has(layout.id))throw Error('Duplicate layout: '+layout.id);
   seen.add(layout.id);
   const objects=new Set();
   for(const object of layout.objects){
     if(objects.has(object.id))throw Error('Duplicate object: '+layout.id+'/'+object.id);
     objects.add(object.id);
   }
 }
 return resolveEntityRoles({...resolved,type:'building',roles:[...(resolved.roles??[]),...(resolved.capabilities??[]).filter(key=>['shop','inn','dialogue'].includes(key))],layouts});
}

/**
 * Object keys specify capabilities, not executable functions.
 * One handler catalog can be used by doors, chests, lamps and switches.
 */
export const OBJECT_INTERACTION_RULES={
 toggle:{requires:[],updates:{open:{op:'toggle'}},effects:[{type:'state-changed',params:{property:'open'}}]},
 light:{requires:[],updates:{enabled:{op:'toggle'}},effects:[{type:'lighting-changed'}]},
 inspect:{requires:[],effects:[{type:'show-description'}]}
};
export function resolveObjectDefinition(object){
 const interactionKey=object.interactionKey??(object.type==='door'?'toggle':null);
 if(interactionKey&&!OBJECT_INTERACTION_RULES[interactionKey])throw Error('Unknown interaction key: '+interactionKey);
 return resolveEntityRoles({...object,interactionKey,roles:object.roles??(object.type==='door'?['openable']:undefined),actions:interactionKey?{[interactionKey]:structuredClone(OBJECT_INTERACTION_RULES[interactionKey])}:object.actions??{}});
}
