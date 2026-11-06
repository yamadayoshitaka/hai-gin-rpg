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

const presets = [
  {id:'royal-castle',name:'灰銀の本城と城下町',description:'最大規模の王城。三本の橋と城下町、農村、三階建ての城を収めた基準ステージ。',biome:'temperate',size:232,buildingMode:'capital',buildingLimit:200,treeRate:1,season:'summer',difficulty:3,huts:true,farmland:true,seed:11},
  {id:'border-fort',name:'国境の石砦',description:'丘陵の守備砦と狭い橋。陣地防衛と遠距離攻撃が主役。',biome:'highland',size:208,buildingMode:'fort',buildingLimit:14,treeRate:.3,season:'autumn',difficulty:4,huts:true,farmland:false,seed:23},
  {id:'deep-forest',name:'木霊の深森',description:'深い森と湿った獣道。木陰の待ち伏せ、迂回を意識する戦場。',biome:'forest',size:200,buildingMode:'wild',buildingLimit:0,treeRate:1.3,season:'summer',difficulty:2,huts:false,farmland:false,seed:37},
  {id:'river-village',name:'大河沿いの農村',description:'田畑と民家が続く川沿いの村。橋の取り合いが鍵になる。',biome:'village',size:192,buildingMode:'village',buildingLimit:21,treeRate:.68,season:'spring',difficulty:2,huts:true,farmland:true,seed:51},
  {id:'mist-marsh',name:'霧沈む沼沢',description:'ぬかるみの多い水辺。水場を避ける進軍が重要。',biome:'marsh',size:188,buildingMode:'wild',buildingLimit:0,treeRate:.42,season:'autumn',difficulty:4,huts:false,farmland:false,seed:67},
  {id:'white-pass',name:'白銀の峠',description:'雪と岩壁に覆われた山道。高低差のある冬の戦場。',biome:'snow',size:196,buildingMode:'fort',buildingLimit:8,treeRate:.31,season:'winter',difficulty:5,huts:true,farmland:false,seed:79},
  {id:'sunscar-desert',name:'灼陽の砂漠',description:'乾いた砂地と風化した道。遮蔽物が少ない見通しの良い戦場。',biome:'desert',size:188,buildingMode:'ruins',buildingLimit:5,treeRate:.08,season:'summer',difficulty:3,huts:false,farmland:false,seed:83},
  {id:'fallen-ruins',name:'忘却の廃都',description:'古い石畳と崩れた集落の跡。廃墟を利用した包囲戦。',biome:'ruins',size:184,buildingMode:'ruins',buildingLimit:9,treeRate:.24,season:'autumn',difficulty:4,huts:true,farmland:false,seed:97},
  {id:'tide-coast',name:'潮騒の海岸道',description:'砂浜と漁村、海に注ぐ大河。開けた地形と橋が交わる。',biome:'coast',size:200,buildingMode:'town',buildingLimit:18,treeRate:.35,season:'summer',difficulty:3,huts:true,farmland:false,seed:109},
];
export const STAGE_PRESETS = Object.freeze(presets.map(p=>Object.freeze({...p})));
export function stageForTerrain(terrain){
 const mapping={城塞:'border-fort',山岳:'white-pass',森林:'deep-forest',湿地:'mist-marsh',河川:'tide-coast',平地:'river-village',市街:'fallen-ruins',丘陵:'border-fort'};
 return mapping[terrain]||DEFAULT_STAGE_ID;
}

const integer = (v,min,max,fallback) => Number.isInteger(Number(v)) ? Math.max(min,Math.min(max,Number(v))) : fallback;
const validId = id => typeof id==='string' && /^[a-z0-9-]{1,60}$/.test(id);
export function normalizeCustomStage(input){
 if(!input||!validId(input.id)||!input.id.startsWith('custom-'))throw Error('カスタムステージIDが不正です。');
 if(typeof input.name!=='string'||!input.name.trim())throw Error('ステージ名を入力してください。');
 const biome=STAGE_BIOMES.includes(input.biome)?input.biome:'temperate';
 const buildingMode=STAGE_BUILDING_MODES.includes(input.buildingMode)&&input.buildingMode!=='capital'?input.buildingMode:'town';
 return {
  id:input.id,name:input.name.trim().slice(0,36),
  description:String(input.description||'オリジナルの戦場').trim().slice(0,170),
  biome,size:integer(input.size,184,216,200),buildingMode,
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
// Keep the existing river/bridge path and real collision topology; only change
// terrain material and the outer battlefield footprint for secondary stages.
export function applyStageTerrain(data,stage){
 if(stage.id===DEFAULT_STAGE_ID)return data;
 const {width,height,tiles,heights}=data;
 if(width!==STAGE_WORLD_SIZE||height!==STAGE_WORLD_SIZE||tiles.length!==STAGE_WORLD_SIZE**2||heights.length!==tiles.length)throw Error('ステージの地形サイズが不正です。');
 const {biome,seed}=stage;
 data.season=stage.season;
 for(let z=0;z<height;z++)for(let x=0;x<width;x++){
  const i=z*width+x,noise=hash(x,z,seed);
  if(!insideStage(stage,x,z)){tiles[i]='cliff';heights[i]=7;continue}
  if(tiles[i]==='river'||tiles[i]==='water')continue;
  const nearCrossing=Math.abs(x-(116+Math.round(5*Math.sin(z*.055))))<10&&[55,116,177].some(row=>Math.abs(z-row)<8);
  if(nearCrossing)continue;
  switch(biome){
   case 'forest': tiles[i]=noise<.38?'moss':noise<.67?'leaf':noise<.86?'grass':'dirt';break;
   case 'highland':tiles[i]=noise<.42?'rock':noise<.72?'gravel':noise<.9?'grass':'cliff';break;
   case 'village':tiles[i]=noise<.65?'grass':noise<.86?'dirt':'flower';break;
   case 'marsh':tiles[i]=noise<.44?'mud':noise<.72?'moss':noise<.91?'grass':'gravel';break;
   case 'snow':tiles[i]=noise<.68?'snow':noise<.84?'ice':'rock';break;
   case 'desert':tiles[i]=noise<.74?'sand':noise<.9?'crack':'gravel';break;
   case 'ruins':tiles[i]=noise<.34?'stone':noise<.58?'cobble':noise<.79?'crack':'ash';break;
   case 'coast':tiles[i]=noise<.48?'sand':noise<.72?'grass':noise<.9?'gravel':'rock';break;
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
 const scored=candidates.map(b=>({b,score:hash(b.x,b.z,stage.seed)+
  (mode==='village'&&b.kind==='house'?-1:0)+
  (mode==='fort'&&b.kind.startsWith('manor')?-.6:0)+
  (mode==='ruins'&&b.kind.startsWith('manor')?-.4:0)}));
 scored.sort((a,b)=>a.score-b.score);
 const selected=scored.slice(0,stage.buildingLimit).map(e=>({...e.b}));
 if(mode==='fort'&&insideStage(stage,56,56,14))selected.unshift({kind:'manor_noble',x:56,z:56,w:17,d:15});
 return selected;
}
export function selectStageObjects(objects,stage){
 if(stage.id===DEFAULT_STAGE_ID)return objects;
 return objects.filter(o=>{
  if(!insideStage(stage,o.x,o.z,3))return false;
  if(o.id==='wood_fence'&&stage.buildingMode==='wild')return false;
  if(!o.id.includes('tree'))return true;
  return hash(o.x,o.z,stage.seed+7)<Math.min(1,stage.treeRate);
 });
}
