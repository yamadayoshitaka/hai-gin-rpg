import {decorateInteriorLayouts} from './interior-decor.js';
/**
 * Original 3D RPG interiors inspired by the functional arrangement of
 * Aliahan (DQIII). All placements are building-local metres.
 * Building -> layout -> objects. No texture assets or copyright game maps.
 */
const O=(id,model,x,z,extras={})=>({id,type:extras.type??'furniture',model,position:[x,0,z],collision:extras.collision??false,...extras});
const R=(id,floor,usage,objects,npcRoles=[])=>({id,floor,usage,bounds:{center:[0,0,0],size:[12,0,12]},objects,npcRoles});
const bed=(id,x,z)=>O(id,'bed_single_A',x,z,{collision:true});
const lamp=(id,x,z)=>O(id,'lamp_standing',x,z,{type:'light',roles:['light'],state:{enabled:true}});
const barrel=(id,x,z)=>O(id,'barrel',x,z,{collision:true,roles:['inspectable']});
const chest=(id,x,z,key=null)=>O(id,'chest',x,z,{type:'chest',roles:['openable','lootable'],state:{open:false,locked:!!key},requiredKey:key,collision:true});
const shelf=(id,x,z)=>O(id,'shelf_A_big',x,z,{collision:true});
const desk=(id,x,z)=>O(id,'desk',x,z,{collision:true});
const counter=(id,x,z,key)=>O(id,'counter',x,z,{collision:true,roles:['inspectable'],serviceKey:key});
const guard=(id,x,z)=>O(id,'guard',x,z,{type:'actor',roles:['npc','guard'],controller:'ai',collision:true});
const table=(id,x,z)=>O(id,'table_low',x,z,{collision:true});
const tapestry=(id,x,z)=>O(id,'banner',x,z,{collision:false});
const arm=(id,x,z)=>O(id,'armor-stand',x,z,{collision:true});
const rack=(id,x,z)=>O(id,'weapon-rack',x,z,{collision:true});
const hearth=(id,x,z)=>O(id,'fireplace',x,z,{collision:true,roles:['light'],state:{enabled:true}});
const stair=(id,x,z)=>O(id,'stair-marker',x,z,{type:'staircase',collision:false});
const baseHome=()=>[
 R('living',1,'living',[hearth('hearth',-12,-13),table('dining',-10,9),O('chair','chair_A_wood',-7,10),shelf('pantry',12,-12),barrel('supplies',13,8),lamp('south-lamp',-14,14)]),
 R('upstairs',2,'sleep',[bed('main-bed',-11,-8),bed('guest-bed',10,-8),O('wardrobe','cabinet_medium',-11,8,{collision:true}),chest('drawer',11,8),lamp('night-light',-14,11)])
];
export const INTERIOR_SCENES={
 'home-hero':{theme:'hero-family',layouts:[
  R('mother-kitchen',1,'living',[hearth('family-fire',-12,-12),table('family-table',-10,7),O('chair','chair_A_wood',-7,9),barrel('herbs',12,9),shelf('cupboard',12,-12),lamp('warm-lamp',-13,13)],['mother']),
  R('hero-bedroom',2,'sleep',[bed('hero-bed',-10,-8),O('wardrobe','cabinet_medium',11,-8,{collision:true}),chest('hero-drawer',10,9),lamp('hero-light',-14,9)],['mother'])
 ]},
 'home-east':{theme:'citizen-house',layouts:baseHome()},
 'old-house':{theme:'old-citizen',layouts:baseHome()},
 'weapon-shop':{theme:'forge-shop',layouts:[
  R('weapon-sales',1,'shop',[counter('weapons-counter',0,-13,'weapons'),rack('iron-swords',-13,-12),rack('spears',13,-12),arm('mail-display',-13,7),lamp('forge-lamp',13,10)],['weapons-merchant']),
  R('armory-storage',2,'storage',[rack('reserve-arms',-10,-9),shelf('supply-shelf',12,-10),chest('smith-stock',13,8),table('repair-bench',-12,9)])
 ]},
 'armor-shop':{theme:'equipment-shop',layouts:[
  R('armor-sales',1,'shop',[counter('armor-counter',0,-13,'armor'),arm('plate',-12,-10),arm('leather',12,-10),arm('helmet-display',-12,10),shelf('shields',12,9)],['armor-merchant']),
  R('armor-workshop',2,'workshop',[desk('worktable',-12,-9),arm('fitting-model',12,-9),shelf('materials',12,8),barrel('water',-12,10)])
 ]},
 'item-shop':{theme:'supplies-shop',layouts:[
  R('item-sales',1,'shop',[counter('item-counter',0,-12,'items'),shelf('medicine',-13,-12),shelf('travel-goods',13,-12),barrel('food',-13,10),lamp('item-lamp',13,10)],['item-merchant']),
  R('item-storage',2,'storage',[shelf('herbs',-13,-9),shelf('potions',13,-9),chest('reserve-items',12,9),barrel('warehouse',-12,10)])
 ]},
 'workshop':{theme:'blacksmith',layouts:[
  R('forge',1,'workshop',[hearth('forge-fire',-12,-13),desk('anvil-table',12,-11),rack('metal-tools',-11,10),barrel('quench',13,10)],['blacksmith']),
  R('residence',2,'sleep',[bed('worker-bed',-11,-9),shelf('patterns',12,-9),table('meal-table',-12,9)])
 ]},
 'library':{theme:'royal-library',layouts:[
  R('reading-room',1,'library',[shelf('history',-13,-10),shelf('maps',13,-10),desk('reading',-12,8),desk('scribe',12,8)],['scholar']),
  R('archives',2,'library',[shelf('royal-archive',-13,-10),shelf('magic-books',13,-10),chest('archive-chest',11,9,'thief'),desk('catalog',-12,9)])
 ]},
 'tavern':{theme:'luida-style-tavern',layouts:[
  R('tavern-hall',1,'inn',[counter('reception',0,-16,'inn'),table('party-one',-14,1),table('party-two',14,2),barrel('ale',-20,-12),barrel('wine',20,-12),O('piano','piano',-20,13,{collision:true}),lamp('bar-lamp',16,-14)],['innkeeper','recruiter','traveler']),
  R('guest-rooms',2,'sleep',[bed('guest-a',-17,-12),bed('guest-b',17,-12),bed('guest-c',-17,11),bed('guest-d',17,11),shelf('linen',12,1)],['innkeeper'])
 ]},
 'guild':{theme:'adventurer-guild',layouts:[
  R('registration',1,'guild',[counter('guild-desk',0,-16,'dialogue'),desk('register',-17,-8),table('gathering',-13,11),table('gathering-two',13,11),tapestry('guild-banner',0,-19)],['guild-clerk','recruiter']),
  R('training',2,'guild',[rack('training-weapons',-17,-12),arm('training-armor',17,-12),desk('job-registry',-15,11),chest('guild-supply',16,11)],['guild-master'])
 ]},
 'chapel':{theme:'sanctuary',layouts:[
  R('sanctuary',1,'prayer',[O('altar','altar',0,-13,{collision:true,serviceKey:'save'}),O('pew-left','pew',-12,5,{collision:true}),O('pew-right','pew',12,5,{collision:true}),tapestry('holy-banner',0,-16),lamp('candle',-12,-11)],['priest']),
  R('vestry',2,'storage',[shelf('scripture',-12,-10),chest('donation',12,-10),desk('priest-study',-12,10)])
 ]},
 'castle':{theme:'royal-palace',layouts:[
  R('entrance-hall',1,'castle',[tapestry('royal-crest',0,-19),guard('left-guard',-11,-14),guard('right-guard',11,-14),arm('ceremonial-armor',-18,7),arm('ceremonial-armor-east',18,7),lamp('hall-light',-19,-11)],['royal-guard']),
  R('treasury',1,'treasury',[chest('royal-gold',-17,13,'magic'),chest('royal-relic',18,13,'magic'),shelf('treasury-ledgers',18,-12)]),
  R('throne-hall',2,'throne',[O('king-throne','throne',0,-16,{collision:true,roles:['inspectable']}),O('king','king',0,-15,{type:'actor',roles:['npc'],collision:false}),tapestry('left-banner',-15,-16),tapestry('right-banner',15,-16),guard('throne-left',-9,-11),guard('throne-right',9,-11),O('royal-carpet','carpet',0,-4),lamp('royal-light',-16,12)],['king','minister']),
  R('royal-private',2,'sleep',[bed('royal-bed',-17,12),O('royal-cabinet','cabinet_medium',18,12,{collision:true}),chest('royal-drawer',18,5)])
 ]}
};
export function getBuildingLayouts(building){
 const interior=INTERIOR_SCENES[building.id];
 const layouts=interior?.layouts??baseHome();
 return decorateInteriorLayouts(layouts.map(layout=>structuredClone(layout)),{theme:interior?.theme??'default',stair:building.stair??null});
}

export const INTERIOR_NPC_TEMPLATES={
 mother:{name:'母親',line:'旅立つ前に、支度と休息を忘れないでね。'},
 'weapons-merchant':{name:'武器屋の店主',line:'冒険に向けて武器を揃えていきな。'},
 'armor-merchant':{name:'防具屋の店主',line:'身を守る装備も大切だよ。'},
 'item-merchant':{name:'道具屋の店主',line:'薬草と旅の道具を取り揃えているよ。'},
 blacksmith:{name:'鍛冶屋',line:'刃物はこまめに手入れしな。'},
 scholar:{name:'王立資料室の学者',line:'城の歴史を調べているところだ。'},
 innkeeper:{name:'宿屋の主人',line:'旅の疲れを癒していっておくれ。'},
 recruiter:{name:'仲間を募る受付係',line:'旅には心強い仲間が必要でしょう。'},
 traveler:{name:'旅人',line:'王様に会ってから冒険に出るつもりさ。'},
 'guild-clerk':{name:'冒険者ギルド受付',line:'旅の依頼を紹介しましょう。'},
 priest:{name:'司祭',line:'旅に祝福があらんことを。'},
 'royal-guard':{name:'近衛兵',line:'王の間は階段を上がった先にある。'},
 king:{name:'レヴナ王',line:'勇者よ、世界を照らす旅へ向かうのだ。'},
 minister:{name:'王の側近',line:'王より賜る言葉を大切になさい。'}
};
export function getInteriorResidentDefinitions(building){
 const scene=INTERIOR_SCENES[building.id];
 const roles=(scene?.layouts??[]).filter(l=>l.floor===1).flatMap(l=>l.npcRoles??[]);
 const positions={
  'home-hero':[[-8,7]],'weapon-shop':[[0,-8]],'armor-shop':[[0,-8]],
  'item-shop':[[0,-8]],'tavern':[[0,-10],[-13,5],[13,5]],
  'guild':[[0,-10],[-13,7]],'chapel':[[0,-9]],'castle':[[-8,-10]],
  'workshop':[[-8,-8]],'library':[[-8,-8]]
 };
 return roles.map((key,i)=>({
  id:building.id+':resident:'+i,roleKey:key,
  position:[...(positions[building.id]?.[i]??[(i%2?-1:1)*8, -9+Math.floor(i/2)*7])],
  floor:1,
  ...(INTERIOR_NPC_TEMPLATES[key]??{name:'町の住人',line:'ようこそ。'})
 }));
}

/** The interaction script is referenced solely by an object's service key. */
export const INTERIOR_SERVICES={
 weapons:{kind:'shop',category:'weapons',label:'武器を買う'},
 armor:{kind:'shop',category:'armor',label:'防具を買う'},
 items:{kind:'shop',category:'items',label:'道具を買う'},
 inn:{kind:'inn',label:'宿泊する'},
 dialogue:{kind:'dialogue',label:'話しかける'},
 save:{kind:'save',label:'祈りを捧げる'}
};
export function resolveInteriorService(key){return INTERIOR_SERVICES[key]??null;}
export function getLayoutObjectsForFloor(layouts,floor){
 return (layouts??[]).filter(layout=>layout.floor===floor)
  .flatMap(layout=>(layout.objects??[]).map(object=>({...object,layoutId:layout.id})));
}
