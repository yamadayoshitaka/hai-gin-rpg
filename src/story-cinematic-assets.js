/**
 * Cinematic raster story images: 20 immutable cast portraits and 20 chapter
 * backdrops, composed by the current panel's canonical speaker IDs.
 * No screenshot text, external URL, generated-on-every-tap AI calls or
 * impact on live 3D actors. Preserve the SVG as an offline/error fallback.
 */
import {STORY_KEY_PEOPLE} from './story-cinematic.js';
const assetRoot='./assets/story-cinema/';
export const CINEMATIC_CAST_ASSETS=Object.freeze(Object.fromEntries(
 STORY_KEY_PEOPLE.map(person=>[person.id,assetRoot+'cast/'+person.id+'.webp'])
));
export const CINEMATIC_CHAPTER_ASSETS=Object.freeze(Array.from(
 {length:20},(_,i)=>assetRoot+'chapters/'+String(i+1).padStart(2,'0')+'.webp'
));
export const CINEMATIC_TITLE_ASSET=assetRoot+'title.webp';
// Optional full-bleed, one-piece illustration for EACH story panel.
// A scene-specific picture takes precedence; cast/chapter composites remain
// as lossless compatibility fallbacks until the individual art is delivered.
// Scenes depicting a player-controlled strategist are gender-sensitive.
// A female player must never be shown the male protagonist's panel art.
const GENDER_NEUTRAL_PANELS=new Set(['c01-s01-m5']); // seal/document, no visible hero
export function individualStoryPanelAsset(panel){
 const id=String(panel?.id||'');
 if(!/^c\d{2}-s\d{2}-m[1-7]$/.test(id))return null;
 const base='./assets/story/panels/'+id.replace(/-m([1-7])$/,(_,n)=>'-m'+String(n).padStart(2,'0'));
 if(panel?.protagonistGender==='female'&&!GENDER_NEUTRAL_PANELS.has(id))return base+'-female.webp';
 if(panel?.protagonistGender==='unspecified'&&!GENDER_NEUTRAL_PANELS.has(id))return null;
 return base+'.webp';
}
const cache=new Map();
function getPicture(url){
 if(!url)return Promise.resolve(null);
 if(!cache.has(url)){
  cache.set(url,new Promise(resolve=>{
   const image=new Image();
   image.onload=()=>resolve(image);
   image.onerror=()=>resolve(null);
   image.decoding='async';image.src=url;
  }));
 }
 return cache.get(url);
}
const c=(v,a,b)=>Math.max(a,Math.min(b,v));
function portraitOverlay(ctx,image,x,y,width,height,opacity){
 if(!image)return;
 const temp=document.createElement('canvas');temp.width=Math.round(width);temp.height=Math.round(height);
 const g=temp.getContext('2d');if(!g)return;
 g.drawImage(image,0,0,temp.width,temp.height);
 g.globalCompositeOperation='destination-in';
 const radial=g.createRadialGradient(temp.width*.48,temp.height*.44,temp.width*.09,
   temp.width*.5,temp.height*.49,temp.width*.71);
 radial.addColorStop(0,'#000');radial.addColorStop(.63,'#000');
 radial.addColorStop(1,'#0000');
 g.fillStyle=radial;g.fillRect(0,0,temp.width,temp.height);
 ctx.globalAlpha=opacity;
 ctx.drawImage(temp,x,y,width,height);
 ctx.globalAlpha=1;
}
function paintScene(ctx,background,panel){
 const W=960,H=540,i=panel.index|0,seed=(panel.number||1)*17+i*29;
 const zoom=1.05+(seed%4)*.018,cropW=W/zoom,cropH=H/zoom;
 const left=(W-cropW)*(seed%9)/8,top=(H-cropH)*(seed%7)/6;
 ctx.drawImage(background,left,top,cropW,cropH,0,0,W,H);
 // Atmospheric cinematic shading, not picture-book framing.
 const shade=ctx.createLinearGradient(0,0,960,0);
 shade.addColorStop(0,i%2?'#061021ad':'#060d1999');
 shade.addColorStop(.5,'#10223a23');shade.addColorStop(1,'#071527b0');
 ctx.fillStyle=shade;ctx.fillRect(0,0,960,540);
 const bottom=ctx.createLinearGradient(0,225,0,540);
 bottom.addColorStop(0,'#040a1700');bottom.addColorStop(1,'#020711bb');
 ctx.fillStyle=bottom;ctx.fillRect(0,225,960,315);
}
export async function cinematicPanelImage(panel){
 if(!panel||!Number.isInteger(panel.chapter)||panel.chapter<1||panel.chapter>20)return null;
 const primary=CINEMATIC_CAST_ASSETS[panel.characterId]||null;
 const secondary=CINEMATIC_CAST_ASSETS[panel.secondaryId]||null;
 const [background,main,other]=await Promise.all([
  getPicture(CINEMATIC_CHAPTER_ASSETS[panel.chapter-1]),
  getPicture(primary),getPicture(secondary)
 ]);
 if(!background)return null;
 const cv=document.createElement('canvas');cv.width=960;cv.height=540;
 const ctx=cv.getContext('2d',{alpha:false});if(!ctx)return null;
 paintScene(ctx,background,panel);
 const i=panel.index|0;
 if(main){
  if(other&&(i===3||i===4||i===5||i===6)){
   portraitOverlay(ctx,other,460,36,460,555,.79);
   portraitOverlay(ctx,main,30,-12,440,590,.97);
  }else{
   portraitOverlay(ctx,main,i%2===0?95:440,-14,490,600,.96);
   if(other)portraitOverlay(ctx,other,i%2===0?575:75,88,310,420,.58);
  }
 }else if(other){
  portraitOverlay(ctx,other,515,30,380,500,.81);
 }
 const sheen=ctx.createLinearGradient(0,0,960,540);
 sheen.addColorStop(0,'#93a7b514');sheen.addColorStop(.48,'#ffffff00');sheen.addColorStop(1,'#ad9d7b17');
 ctx.fillStyle=sheen;ctx.fillRect(0,0,960,540);
 try{return cv.toDataURL('image/webp',.87);}catch{return null;}
}
export function applyCinematicImage(node,panel,{background=false}={}){
 if(!node||!panel)return;
 const key=(panel.id||panel.stageId+'-'+panel.index)+':'+(panel.protagonistGender||'unspecified');
 node.dataset.cinematicKey=key;
 const dedicated=individualStoryPanelAsset(panel);
 void (async()=>{
  if(dedicated&&await getPicture(dedicated+'?panelrev=gender-v1'))return dedicated+'?panelrev=gender-v1';
  // Keep the pre-rendered canonical character-only SVG already displayed
  // until a real female-specific illustration exists for this panel.
  // The male panel and male-biased chapter composite must not bleed through.
  if(panel.protagonistGender==='female'||panel.protagonistGender==='unspecified')return null;
  return cinematicPanelImage(panel);
 })().then(url=>{
  if(!url||node.dataset.cinematicKey!==key||!node.isConnected)return;
  if(background)node.style.backgroundImage='url("'+url+'")';
  else node.src=url;
 }).catch(()=>{}); // Original chapter/cast art and SVG remain visible as fallbacks.
}
