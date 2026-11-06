// Data-only stage catalog shared by the selector, management screen and game.
// All stages reuse the established 232x232 world geometry and catalog assets;
// the royal castle is the single full-size map.
export const STAGE_WORLD_SIZE = 232;
export const STAGE_LIBRARY_KEY = 'hai-gin-stage-library-v2';
export const STAGE_ACTIVE_KEY = 'hai-gin-stage-active-v2';
export const DEFAULT_STAGE_ID = 'royal-castle';
export const STAGE_BIOMES = ['temperate','forest','highland','village','marsh','snow','desert','ruins','coast'];
export const STAGE_BIOME_LABELS = {
  temperate:'城下町',forest:'森林',highland:'岩山',village:'村落',
  marsh:'湿地',snow:'雪原',desert:'砂漠',ruins:'古戦場',coast:'海岸',
};
export const STAGE_BUILDING_MODES = ['capital','fort','town','village','ruins','wild'];
export const STAGE_BUILDING_LABELS = {
  capital:'王城・城下町',fort:'砦・守備集落',town:'宿場町',village:'農村',
  ruins:'遺構・散在集落',wild:'無人地帯',
};
// Scenery is intentionally data driven. Landmarks use the same object BOM
// as the existing town, so their collision and rendering paths stay shared.
export const STAGE_IDENTITIES = Object.freeze({
 temperate:{feature:'三階建て王城・二つの城下町・二つの大橋',tactics:'城壁と建物の高低差を利用した総力戦',sky:0x091322,fog:0,
  landmarks:[]},
 highland:{feature:'尾根の石砦・監視塔・岩の関門',tactics:'斜面と狭い通路を守り、迂回を封じる',sky:0x243448,fog:.0013,
  landmarks:[['wooden_watchtower_001',45,86],['wooden_watchtower_001',83,87],['stone_archway_001',62,109],['stone_column_001',51,129],['stone_column_001',72,129]]},
 forest:{feature:'樹海の獣道・古い石門・巨木の群落',tactics:'樹木で視線を遮り、森の小道から奇襲',sky:0x102b24,fog:.0022,
  landmarks:[['stone_archway_001',53,108],['stone_column_001',48,104],['stone_column_001',60,104],['town_well_001',67,149]]},
 village:{feature:'畑の区画・農家・大河に架かる橋',tactics:'集落を守りながら橋を確保する',sky:0x253d48,fog:.0006,
  landmarks:[['town_well_001',53,142],['haystack_001',184,71],['haystack_001',198,83],['town_handcart_001',162,147]]},
 marsh:{feature:'泥の小島・浅い池・半ば沈んだ遺構',tactics:'池に足を取られない経路を選ぶ',sky:0x21353c,fog:.0030,
  landmarks:[['stone_archway_001',53,103],['stone_column_001',48,113],['stone_column_001',59,113],['wooden_watchtower_001',179,140]]},
 snow:{feature:'雪の峠道・岩壁・吹雪の関門',tactics:'唯一の峠道と高所を押さえる',sky:0x465968,fog:.0022,
  landmarks:[['stone_archway_001',67,109],['wooden_watchtower_001',52,87],['wooden_watchtower_001',184,87],['stone_column_001',186,155]]},
 desert:{feature:'砂丘・乾いたオアシス・埋没した石柱',tactics:'遮蔽物の少ない砂丘で射線を確保',sky:0x644b36,fog:.0011,
  landmarks:[['stone_column_001',50,90],['stone_column_001',59,90],['stone_column_001',69,90],['stone_archway_001',60,99],['town_well_001',180,151]]},
 ruins:{feature:'焼けた街路・崩れた門・廃墟の広場',tactics:'残った石柱と廃屋を盾に包囲',sky:0x322d38,fog:.0019,
  landmarks:[['stone_archway_001',60,110],['stone_column_001',50,137],['stone_column_001',60,137],['stone_column_001',70,137],['stone_archway_001',175,157]]},
 coast:{feature:'入り江・波打ち際・港の見張り台',tactics:'海岸線と防波地形を使い、陸路で展開',sky:0x24516a,fog:.0010,
  landmarks:[['wooden_watchtower_001',57,84],['wooden_watchtower_001',54,181],['town_well_001',178,133],['stone_archway_001',181,178]]},
});
export const stageIdentity=stage=>STAGE_IDENTITIES[stage?.biome]||STAGE_IDENTITIES.temperate;
export function stageLandmarks(stage){
 if(stage?.id===DEFAULT_STAGE_ID)return [];
 return stageIdentity(stage).landmarks.filter(([,x,z])=>insideStage(stage,x,z,8));
}

const presets = [
  {id:'royal-castle',name:'灰銀の本城と城下町',description:'最大規模の王城。二本の大橋と城下町、農村、三階建ての城を収めた基準ステージ。',biome:'temperate',size:232,waterway:'river',bridgeCount:2,buildingMode:'capital',buildingLimit:200,treeRate:1,season:'summer',difficulty:3,huts:true,farmland:true,seed:11},
  {id:'border-fort',name:'国境の石砦',description:'丘陵の守備砦と岩の関門。陣地防衛と遠距離攻撃が主役。',biome:'highland',size:208,waterway:'none',bridgeCount:0,buildingMode:'fort',buildingLimit:14,treeRate:.3,season:'autumn',difficulty:4,huts:true,farmland:false,seed:23},
  {id:'deep-forest',name:'木霊の深森',description:'深い森と湿った獣道。木陰の待ち伏せ、迂回を意識する戦場。',biome:'forest',size:200,waterway:'none',bridgeCount:0,buildingMode:'wild',buildingLimit:0,treeRate:1.3,season:'summer',difficulty:2,huts:false,farmland:false,seed:37},
  {id:'river-village',name:'大河沿いの農村',description:'田畑と民家が続く川沿いの村。一本の橋の取り合いが鍵になる。',biome:'village',size:192,waterway:'river',bridgeCount:1,buildingMode:'village',buildingLimit:21,treeRate:.68,season:'spring',difficulty:2,huts:true,farmland:true,seed:51},
  {id:'mist-marsh',name:'霧沈む沼沢',description:'ぬかるみと池の点在する湿原。橋ではなく小島を縫って進軍する。',biome:'marsh',size:188,waterway:'none',bridgeCount:0,buildingMode:'wild',buildingLimit:0,treeRate:.42,season:'autumn',difficulty:4,huts:false,farmland:false,seed:67},
  {id:'white-pass',name:'白銀の峠',description:'雪と岩壁に覆われた山道。高低差のある冬の戦場。',biome:'snow',size:196,waterway:'none',bridgeCount:0,buildingMode:'fort',buildingLimit:8,treeRate:.31,season:'winter',difficulty:5,huts:true,farmland:false,seed:79},
  {id:'sunscar-desert',name:'灼陽の砂漠',description:'乾いた砂地と風化した道。遮蔽物が少ない見通しの良い戦場。',biome:'desert',size:188,waterway:'none',bridgeCount:0,buildingMode:'ruins',buildingLimit:5,treeRate:.08,season:'summer',difficulty:3,huts:false,farmland:false,seed:83},
  {id:'fallen-ruins',name:'忘却の廃都',description:'古い石畳と崩れた集落の跡。廃墟を利用した包囲戦。',biome:'ruins',size:184,waterway:'none',bridgeCount:0,buildingMode:'ruins',buildingLimit:9,treeRate:.24,season:'autumn',difficulty:4,huts:true,farmland:false,seed:97},
  {id:'tide-coast',name:'潮騒の海岸道',description:'砂浜と漁村、入り江が広がる戦場。陸地の起伏を使って進軍する。',biome:'coast',size:200,waterway:'none',bridgeCount:0,buildingMode:'town',buildingLimit:18,treeRate:.35,season:'summer',difficulty:3,huts:true,farmland:false,seed:109},
];
export const STAGE_PRESETS = Object.freeze(presets.map(p=>Object.freeze({...p})));
export function stageForTerrain(terrain){
 const mapping={城塞:'border-fort',山岳:'white-pass',森林:'deep-forest',湿地:'mist-marsh',河川:'tide-coast',平地:'river-village',市街:'fallen-ruins',丘陵:'border-fort'};
 return mapping[terrain]||DEFAULT_STAGE_ID;
}

const integer = (v,min,max,fallback) => Number.isInteger(Number(v)) ? Math.max(min,Math.min(max,Number(v))) : fallback;
const validId = id => typeof id==='string' && /^[a-z0-9-]{1,60}$/.test(id);
export const stageWaterway=stage=>stage?.waterway==='river'||stage?.waterway==='none'?stage.waterway:
 (stage?.id===DEFAULT_STAGE_ID||stage?.biome==='village'?'river':'none');
export const stageBridgeRows=stage=>stageWaterway(stage)==='river'?
 [116,177].slice(0,integer(stage?.bridgeCount,1,2,stage?.id===DEFAULT_STAGE_ID?2:1)):[];
export function normalizeCustomStage(input){
 if(!input||!validId(input.id)||!input.id.startsWith('custom-'))throw Error('カスタムステージIDが不正です。');
 if(typeof input.name!=='string'||!input.name.trim())throw Error('ステージ名を入力してください。');
 const biome=STAGE_BIOMES.includes(input.biome)?input.biome:'temperate';
 const buildingMode=STAGE_BUILDING_MODES.includes(input.buildingMode)&&input.buildingMode!=='capital'?input.buildingMode:'town';
 const waterway=['river','none'].includes(input.waterway)?input.waterway:(biome==='village'?'river':'none');
 return {
  id:input.id,name:input.name.trim().slice(0,36),
  description:String(input.description||'オリジナルの戦場').trim().slice(0,170),
  biome,size:integer(input.size,184,216,200),buildingMode,waterway,
  bridgeCount:waterway==='river'?integer(input.bridgeCount,1,2,1):0,
  buildingLimit:integer(input.buildingLimit,0,45,12),
  treeRate:Math.max(0,Math.min(1.5,Number(input.treeRate)||0)),
  season:['spring','summer','autumn','winter'].includes(input.season)?input.season:'summer',
  difficulty:integer(input.difficulty,1,5,3),
  huts:input.huts===true,farmland:input.farmland===true,
  seed:integer(input.seed,0,1000000,43),custom:true,
 };
}
export function readCustomStages(storage){
 try{
  const data=JSON.parse(storage?.getItem(STAGE_LIBRARY_KEY)||'[]');
  if(!Array.isArray(data))return [];
  const unique=new Set(STAGE_PRESETS.map(p=>p.id));const stages=[];
  for(const item of data.slice(0,60)){try{const entry=normalizeCustomStage(item);if(unique.has(entry.id))continue;unique.add(entry.id);stages.push(entry)}catch{}}
  return stages;
 }catch{return []}
}
export function allStages(storage){return [...STAGE_PRESETS,...readCustomStages(storage)]}
export function getStage(storage,id){return allStages(storage).find(p=>p.id===id)||null}
export function activeStage(storage,queryId){
 const id=validId(queryId)?queryId:null;
 const saved=(()=>{try{return storage?.getItem(STAGE_ACTIVE_KEY)}catch{return null}})();
 return getStage(storage,id)||getStage(storage,saved)||STAGE_PRESETS[0];
}
export function selectStage(storage,id){
 const stage=getStage(storage,id);if(!stage)throw Error('ステージが見つかりません。');
 storage.setItem(STAGE_ACTIVE_KEY,id);return stage;
}
export function upsertCustomStage(storage,stage){
 const normalized=normalizeCustomStage(stage),list=readCustomStages(storage);
 const index=list.findIndex(s=>s.id===normalized.id);
 if(index>=0)list[index]=normalized;else list.push(normalized);
 if(list.length>60)throw Error('保存できるカスタムステージは最大60件です。');
 storage.setItem(STAGE_LIBRARY_KEY,JSON.stringify(list));return normalized;
}
export function duplicateStage(storage,id){
 const source=getStage(storage,id);if(!source)throw Error('コピー元のステージが見つかりません。');
 let identifier;do{identifier='custom-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*0xffffff).toString(36)}while(getStage(storage,identifier));
 const stage=upsertCustomStage(storage,{...source,id:identifier,name:source.name+'（コピー）',
  size:Math.min(216,source.size),buildingMode:source.buildingMode==='capital'?'town':source.buildingMode,buildingLimit:Math.min(45,source.buildingLimit),custom:true});
 selectStage(storage,stage.id);return stage;
}
export function deleteCustomStage(storage,id){
 if(!id.startsWith('custom-'))throw Error('初期ステージは削除できません。');
 const wasActive=(()=>{try{return storage.getItem(STAGE_ACTIVE_KEY)===id}catch{return false}})();
 const old=readCustomStages(storage),next=old.filter(s=>s.id!==id);
 if(next.length===old.length)throw Error('ステージが見つかりません。');
 storage.setItem(STAGE_LIBRARY_KEY,JSON.stringify(next));
 if(wasActive)selectStage(storage,DEFAULT_STAGE_ID);
 return next;
}
export function stageBounds(stage){
 const size=Math.max(184,Math.min(STAGE_WORLD_SIZE,Number(stage?.size)||STAGE_WORLD_SIZE));
 const min=Math.floor((STAGE_WORLD_SIZE-size)/2);
 return {minX:min,minZ:min,maxX:min+size-1,maxZ:min+size-1,size};
}
export function insideStage(stage,x,z,pad=0){
 const bounds=stageBounds(stage);
 return x>=bounds.minX+pad&&x<=bounds.maxX-pad&&z>=bounds.minZ+pad&&z<=bounds.maxZ-pad;
}
const hash=(x,z,seed)=>{let n=Math.imul(x+1,374761393)+Math.imul(z+1,668265263)+Math.imul(seed+1,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296};
const clampHeight=h=>Math.max(0,Math.min(7,Math.round(h)));
const isPool=(x,z,cx,cz,rx,rz,phase)=>Math.pow((x-cx)/rx,2)+Math.pow((z-cz)/rz,2)<.82+.18*Math.sin(x*.23+z*.17+phase);
// The capital is immutable; secondary stages alter connected landforms,
// sightlines and natural obstacles, not merely the base tile colors. Preserve
// the crossings of stages which actually have a river; other stages have open land.
export function applyStageTerrain(data,stage){
 if(stage.id===DEFAULT_STAGE_ID)return data;
 const {width,height,tiles,heights}=data;
 if(width!==STAGE_WORLD_SIZE||height!==STAGE_WORLD_SIZE||tiles.length!==STAGE_WORLD_SIZE**2||heights.length!==tiles.length)throw Error('ステージの地形サイズが不正です。');
 const {biome,seed}=stage;
 const hasRiver=stageWaterway(stage)==='river',bridgeRows=stageBridgeRows(stage);
 data.season=stage.season;
 for(let z=0;z<height;z++)for(let x=0;x<width;x++){
  const i=z*width+x,noise=hash(x,z,seed);
  if(!insideStage(stage,x,z)){tiles[i]='cliff';heights[i]=7;continue}
  if(tiles[i]==='water'||(hasRiver&&tiles[i]==='river'))continue;
  // Remove the inherited capital river/banks when this biome has no river.
  if(!hasRiver&&Math.abs(x-(116+Math.round(5*Math.sin(z*.055))))<=6)heights[i]=3;
  if(!hasRiver&&tiles[i]==='river')tiles[i]='grass';
  const nearCrossing=hasRiver&&Math.abs(x-(116+Math.round(5*Math.sin(z*.055))))<19&&bridgeRows.some(row=>Math.abs(z-row)<12);
  if(nearCrossing)continue;
  const smooth=Math.sin(x*.071+seed*.3)*Math.cos(z*.063-seed*.17);
  const pattern=Math.sin(x*.04+Math.cos(z*.05))*Math.sin(z*.052+seed*.1);
  const safeCorridor=Math.abs(x-116)<21||Math.abs(z-116)<9;
  switch(biome){
   case 'forest':{
    const trail=Math.abs(z-(116+18*Math.sin(x*.041+seed*.07)))<3.5||
      Math.abs(z-(58+10*Math.sin(x*.045)))<2.5;
    tiles[i]=trail?'dirt':smooth>.24?'moss':noise<.57?'leaf':'grass';
    if(!safeCorridor)heights[i]=clampHeight(3+smooth*2);
    break;
   }
   case 'highland':{
    const ridge=Math.abs(z-(116+30*Math.sin(x*.027+seed*.04)));
    const blocked=ridge>66&&!safeCorridor&&noise>.20;
    tiles[i]=blocked?'cliff':ridge>43?'rock':noise<.7?'gravel':'grass';
    if(!safeCorridor)heights[i]=clampHeight(2+Math.max(0,ridge-18)/16+smooth);
    break;
   }
   case 'village':{
    const fields=((Math.floor(x/16)+Math.floor(z/18))%3===0)&&!safeCorridor;
    tiles[i]=fields?(noise>.3?'dirt':'flower'):noise<.7?'grass':'path';
    if(!safeCorridor)heights[i]=clampHeight(3+smooth*.65);
    break;
   }
   case 'marsh':{
    const flooded=[[49,68,17,12],[77,169,19,14],[175,78,19,13],[189,170,17,14]]
      .some(([cx,cz,rx,rz],j)=>isPool(x,z,cx,cz,rx,rz,seed+j));
    tiles[i]=flooded&&!safeCorridor?'water':smooth>.33?'moss':noise<.68?'mud':'grass';
    if(!safeCorridor)heights[i]=flooded?1:clampHeight(2+smooth);
    break;
   }
   case 'snow':{
    const pass=Math.abs(z-(115+19*Math.sin(x*.038)));
    const blocked=pass>72&&!safeCorridor&&noise>.1;
    tiles[i]=blocked?'cliff':pass>47?'rock':noise<.82?'snow':'ice';
    if(!safeCorridor)heights[i]=clampHeight(2+Math.max(0,pass-16)/17+smooth*.6);
    break;
   }
   case 'desert':{
    const oasis=isPool(x,z,184,151,12,8,seed);
    const dune=Math.sin(x*.089+Math.sin(z*.023))*Math.cos(z*.065);
    tiles[i]=oasis&&!safeCorridor?'water':dune>.47?'sand':noise<.62?'sand':noise<.83?'crack':'gravel';
    if(!safeCorridor)heights[i]=oasis?1:clampHeight(2+dune*2);
    break;
   }
   case 'ruins':{
    const square=(x>39&&x<93&&z>129&&z<182)||(x>146&&x<199&&z>138&&z<183);
    const collapsed=!safeCorridor&&square&&((x%19===0&&z%7<5)||(z%17===0&&x%11<4));
    tiles[i]=collapsed?'cliff':square?(noise<.75?'cobble':'stone'):pattern>.17?'ash':noise<.65?'crack':'stone';
    if(!safeCorridor)heights[i]=clampHeight(3+smooth);
    break;
   }
   case 'coast':{
    const shoreline=43+7*Math.sin(z*.047+seed*.04);
    const flooded=x<shoreline&&!safeCorridor;
    tiles[i]=flooded?'water':x<shoreline+18?'sand':noise<.5?'grass':noise<.75?'gravel':'rock';
    if(!safeCorridor)heights[i]=flooded?0:clampHeight(2+smooth);
    break;
   }
   default:break;
  }
 }
 return data;
}
export function selectStageBuildings(buildings,stage){
 if(stage.id===DEFAULT_STAGE_ID||stage.buildingMode==='capital')return buildings.slice();
 const bounds=stageBounds(stage),mode=stage.buildingMode;
 const candidates=buildings.filter(b=>b.kind!=='castle'&&
   b.x-b.w/2>=bounds.minX+1&&b.x+b.w/2<=bounds.maxX-1&&
   b.z-b.d/2>=bounds.minZ+1&&b.z+b.d/2<=bounds.maxZ-1);
 if(mode==='wild')return [];
 const anchors={fort:[63,103],village:[183,91],town:[180,143],ruins:[66,159]};
 const anchor=anchors[mode]||[116,116];
 const scored=candidates.map(b=>({b,score:hash(b.x,b.z,stage.seed)*.4+
  Math.hypot(b.x-anchor[0],b.z-anchor[1])*.008+
  (mode==='village'&&b.kind==='house'?-1:0)+
  (mode==='fort'&&b.kind.startsWith('manor')?-.6:0)+
  (mode==='ruins'&&b.kind.startsWith('manor')?-.4:0)}));
 scored.sort((a,b)=>a.score-b.score);
 const selected=scored.slice(0,stage.buildingLimit).map(e=>({...e.b}));
 if(mode==='fort'&&insideStage(stage,56,93,14))selected.unshift({kind:'manor_noble',x:56,z:93,w:17,d:15});
 return selected;
}
export function selectStageObjects(objects,stage,data=null){
 if(stage.id===DEFAULT_STAGE_ID)return objects;
 const passable=(x,z)=>!data||!['water','river','cliff'].includes(data.tiles[z*data.width+x]);
 const filtered=objects.filter(o=>{
  if(!insideStage(stage,o.x,o.z,3))return false;
  if(!passable(o.x,o.z))return false;
  if(o.id==='wood_fence'&&stage.buildingMode==='wild')return false;
  if(!o.id.includes('tree'))return true;
  return hash(o.x,o.z,stage.seed+7)<Math.min(1,stage.treeRate);
 });
 // Dense groves are sampled on a coarse grid to keep the 3D scene budget
 // bounded; avoid the central river and the spawn/deployment lanes.
 if(stage.biome==='forest'&&stage.treeRate>1){
  for(let z=24;z<209;z+=9)for(let x=24;x<209;x+=9){
   if(!insideStage(stage,x,z,4)||!passable(x,z)||Math.abs(x-116)<23||Math.abs(z-116)<9)continue;
   if(hash(x,z,stage.seed+53)>Math.min(.26,(stage.treeRate-1)*.6))continue;
   filtered.push({id:'tree_deciduous_001',x,z});
  }
 }
 return filtered;
}
