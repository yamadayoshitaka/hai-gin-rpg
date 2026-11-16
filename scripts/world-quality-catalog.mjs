#!/usr/bin/env node
/** Stable full-game quality inventory. No actual art or 3D-quality claims. */
import fs from 'node:fs';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
const src=fs.readFileSync(new URL('../src/object-catalog.js',import.meta.url),'utf8');
const objects=[...src.matchAll(/^[ \t]+([a-z][\w]*):\{id:'([^']+)',name:'([^']+)',category:'([^']+)',kind:'([^']+)'/gm)]
 .map(([,key,id,name,category,kind])=>({key:'object:'+id,id,name,category,kind,type:'object'}));
if(objects.length<60||new Set(objects.map(x=>x.id)).size!==objects.length)
 throw Error('Object catalog changed; adjust parser instead of silently losing objects.');
if(CAMPAIGN_STAGES.length!==200||new Set(CAMPAIGN_STAGES.map(x=>x.id)).size!==200)
 throw Error('Campaign catalog is not 20x10 stages.');
const stages=CAMPAIGN_STAGES.map(s=>({
 key:'stage:'+s.id,id:s.id,name:s.name,type:'stage',category:'第'+s.chapter+'章',kind:s.kind,
 biome:s.biome,scenePreset:s.scenePreset,storyBeat:s.storyBeat,chapter:s.chapter
}));
export const qualityInventory=Object.freeze([...objects,...stages]);
export const objectCount=objects.length;
export const stageCount=stages.length;
export const byId=new Map(qualityInventory.map(x=>[x.key,x]));
export function referencePrompt(target){
 const common='ABSOLUTE: one isolated cinematic 3D realistic environment asset reference, precise physically based materials (PBR), micro-detail, rich geometry, believable thickness, occlusion, realistic diffuse lighting and natural shadow, 16:9 framing, no people, no monsters, no words, no symbols, no labels, no HUD, no border, no logos, no watermarks. This is a 2D DESIGN REFERENCE ONLY; NOT actual game geometry or a claimed 3D repair.';
 if(target.type==='object'){
  const details={
   bridge:'wood grain, real joinery, structural support beams, weathered fasteners, and plausible load-bearing geometry',
   town_building:'detailed roof tiles, stone and wood joints, windows and doors, weathering at realistic scale',
   building:'solid weathered stone courses, mortar, fitted wood doors and windows, realistic roof',
   mountain:'natural stratified exposed rock, erosion and small plants',
   swamp:'layered wetland soil, shallow reflections, reeds and muddy banks',
   town_prop:'craft-grade wood, aged metal and authentic surface wear',
   furniture:'joinery, worn timber and precisely fitted materials',
   building_component:'anatomically plausible stone/wood architectural joinery',
   hill:'natural grass-covered slopes, exposed rock, erosion patterns'
  };
  return 'PHOTOREAL ASSET MASTER. '+target.name+' ('+target.id+'), medieval fantasy, object category '+target.category+'. '+(details[target.kind]||'believable real materials and accurate engineering')+'. Three-quarter isometric studio camera, neutral background, full object visible, shadow on neutral ground. '+common;
 }
 return 'PHOTOREAL ENVIRONMENT MASTER. '+target.name+' ('+target.id+'), biome '+target.biome+', stage beat '+target.storyBeat+', geography and terrain match a medieval fantasy game battle map. Broad elevated 45-degree establishing view, realistic ground surfaces, integrated objects, navigation and meaningful combat cover, no character models. '+common;
}
export function readProgress(filename){
 try{
  const source=JSON.parse(fs.readFileSync(filename,'utf8'));
  if(source.schemaVersion!==1||!source.assets)throw Error('Invalid queue');
  return source;
 }catch(e){
  if(e.code!=='ENOENT')throw e;
  return {schemaVersion:1,kind:'PHOTOREAL_WORLD_QUALITY_REVIEW_NOT_PRODUCTION',assets:{},runs:[]};
 }
}
export function nextPending(progress,{type='all'}={}){
 const eligible=qualityInventory.filter(x=>type==='all'||x.type===type);
 return eligible.find(x=>!progress.assets[x.key]?.referenceSha256&&!progress.assets[x.key]?.providerBlocked);
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 console.log(JSON.stringify({objects:objectCount,stages:stageCount,total:qualityInventory.length,
  next:qualityInventory.slice(0,4),firstPrompt:referencePrompt(objects[0])},null,2));
}
