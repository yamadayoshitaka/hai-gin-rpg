/**
 * Cinematic raster story images: 20 immutable cast portraits and 20 chapter
 * backdrops, composed by the current panel's canonical speaker IDs.
 * No screenshot text, external URL, generated-on-every-tap AI calls or
 * impact on live 3D actors. Preserve the SVG as an offline/error fallback.
 */
import {STORY_KEY_PEOPLE} from './story-cinematic.js';
import {STORY_NEUTRAL_PANEL_IDS} from './story-panel-neutral-ids.js';
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
const GENDER_NEUTRAL_PANELS=new Set(STORY_NEUTRAL_PANEL_IDS); // reviewed hero-free scenes only
export function individualStoryPanelAsset(panel){
 const id=String(panel?.id||'');
 if(!/^c\d{2}-s\d{2}-m(?:[1-9]|1[0-9]|20)$/.test(id))return null;
 const base='./assets/story/panels/'+id.replace(/-m(\d{1,2})$/,(_,n)=>'-m'+String(n).padStart(2,'0'));
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

/**
 * Safe raster fallback for a heroine or an as-yet-unspecified protagonist.
 * Chapter collage backgrounds were cut from concept sheets, and some depict
 * a male lead. Never mix those into female scenes. Instead draw a hero-free
 * atmospheric setting and overlay ONLY the canonical NPC portrait IDs.
 * This is a reusable fallback, NOT a completed hand-painted panel.
 */
export const storyBackdropPolicy=panel=>
 panel?.protagonistGender==='female'||panel?.protagonistGender==='unspecified'
  ?'npc-portrait-neutral-scene':'chapter-composite';

function paintNeutralStoryBackdrop(ctx,panel){
 const w=960,h=540,seed=((panel.number||1)*97+(panel.index||0)*41)%997;
 const scene=panel.scenery||'wilds';
 const colors={
  'royal-town':['#16283e','#617e97','#a88766','#283d51'],
  wilds:['#122f34','#4c7367','#8c9879','#234e48'],
  frontier:['#242b42','#6e786f','#a99674','#36485b'],
  refuge:['#263446','#81917c','#b6a28b','#41594e'],
  fortress:['#1c283d','#66748b','#b3a094','#353d50'],
  starbell:['#1b173c','#585487','#9685ae','#35355c']
 }[scene]||['#182b40','#6e8996','#b2a28b','#334e59'];
 const sky=ctx.createLinearGradient(0,0,0,h);
 sky.addColorStop(0,colors[0]);sky.addColorStop(.63,colors[1]);sky.addColorStop(1,colors[2]);
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 const lightX=615+(seed%230),lightY=110+(seed%75);
 const halo=ctx.createRadialGradient(lightX,lightY,0,lightX,lightY,300);
 halo.addColorStop(0,'#fff0d38c');halo.addColorStop(.48,'#e5daae21');halo.addColorStop(1,'#e1d6aa00');
 ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=colors[3];
 ctx.beginPath();ctx.moveTo(0,360);
 for(let x=0;x<=w;x+=80){
  const ridge=270+Math.sin(x*.007+seed)*38+Math.cos(x*.012+seed*.3)*33;
  ctx.lineTo(x,ridge);
 }
 ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
 const shot=(panel.index||0),offset=(seed%65)-32;
 if(scene==='royal-town'||scene==='fortress'){
  for(let i=0;i<7;i++){
   const x=i*153+offset-50,y=220+(i*19+seed)%100,wallH=h-y;
   ctx.fillStyle=i%2?'#243347':'#36455a';
   ctx.fillRect(x,y,125,wallH);
   ctx.fillStyle='#b4a9a022';
   for(let yy=y+35;yy<h;yy+=48)ctx.fillRect(x+19,yy,15,27);
   ctx.beginPath();ctx.moveTo(x-12,y);ctx.lineTo(x+61,y-64);ctx.lineTo(x+138,y);ctx.fillStyle='#313a4d';ctx.fill();
  }
 }else if(scene==='wilds'||scene==='refuge'){
  for(let i=0;i<11;i++){
   const x=i*112-90+offset,y=270+(i*17+seed)%75;
   ctx.strokeStyle='#263c3c';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(x,h);ctx.lineTo(x,y);ctx.stroke();
   for(let j=0;j<3;j++){
    ctx.beginPath();ctx.ellipse(x+(j-1)*16,y-13-j*24,35+j*5,53,0,0,Math.PI*2);
    ctx.fillStyle=j%2?'#315a50b8':'#537660a5';ctx.fill();
   }
  }
 }else if(scene==='starbell'){
  ctx.strokeStyle='#e2d5f288';ctx.lineWidth=9;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(w*.60,h*.39,82+i*30,0,Math.PI*2);ctx.stroke();}
  ctx.strokeStyle='#efedff66';ctx.lineWidth=2;
  for(let i=0;i<11;i++){
   const a=i*Math.PI*2/11;
   ctx.beginPath();ctx.moveTo(w*.60,h*.39);
   ctx.lineTo(w*.60+190*Math.cos(a),h*.39+190*Math.sin(a));ctx.stroke();
  }
 }else{
  ctx.strokeStyle='#a3aaa077';ctx.lineWidth=5;
  for(let i=0;i<8;i++){
   ctx.beginPath();ctx.moveTo(i*145-90,345+(i%2)*23);
   ctx.lineTo(i*145+95,290+(i%3)*25);ctx.stroke();
  }
 }
 const content=String(panel.text||'');
 if(/橋|川|湖/.test(content)){
  ctx.fillStyle='#a0c5d055';ctx.fillRect(0,455,w,85);
  ctx.strokeStyle='#b8ad98';ctx.lineWidth=12;
  ctx.beginPath();ctx.moveTo(0,410);ctx.quadraticCurveTo(480,360,w,410);ctx.stroke();
 }
 if(/教会|礼拝堂|鐘/.test(content)){
  ctx.strokeStyle='#d3c5a677';ctx.lineWidth=7;
  ctx.beginPath();ctx.moveTo(795,188);ctx.lineTo(795,81);ctx.moveTo(755,120);ctx.lineTo(835,120);ctx.stroke();
 }
 if(/記録|帳簿|王印|書状/.test(content)){
  ctx.save();ctx.translate(700,370+shot*5);ctx.rotate(-.09);
  ctx.fillStyle='#cbbb9670';ctx.fillRect(-112,-47,225,112);
  ctx.strokeStyle='#684b4270';ctx.strokeRect(-112,-47,225,112);
  for(let j=0;j<5;j++){ctx.fillRect(-85,-22+j*17,130+(j%3)*15,2);}
  ctx.restore();
 }
 const dark=ctx.createLinearGradient(0,0,w,0);
 dark.addColorStop(0,'#081527aa');dark.addColorStop(.50,'#0d203f21');dark.addColorStop(1,'#0816297a');
 ctx.fillStyle=dark;ctx.fillRect(0,0,w,h);
}

export async function cinematicPanelImage(panel,{safeBackdrop=false}={}){
 if(!panel||!Number.isInteger(panel.chapter)||panel.chapter<1||panel.chapter>20)return null;
 const primary=CINEMATIC_CAST_ASSETS[panel.characterId]||null;
 const secondary=CINEMATIC_CAST_ASSETS[panel.secondaryId]||null;
 const [background,main,other]=await Promise.all([
  safeBackdrop?Promise.resolve(null):getPicture(CINEMATIC_CHAPTER_ASSETS[panel.chapter-1]),
  getPicture(primary),getPicture(secondary)
 ]);
 if(!background&&!safeBackdrop)return null;
 const cv=document.createElement('canvas');cv.width=960;cv.height=540;
 const ctx=cv.getContext('2d',{alpha:false});if(!ctx)return null;
 if(safeBackdrop)paintNeutralStoryBackdrop(ctx,panel);
 else paintScene(ctx,background,panel);
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
  if(dedicated&&await getPicture(dedicated+'?panelrev=20261111-levna-arrival-v2'))return dedicated+'?panelrev=20261111-levna-arrival-v2';
  // Incomplete heroine or unknown-sex panels still display the SAME
  // established character portraits over a gender-neutral scene, never an
  // unreviewed male-protagonist chapter collage.
  return cinematicPanelImage(panel,{safeBackdrop:storyBackdropPolicy(panel)==='npc-portrait-neutral-scene'});
 })().then(url=>{
  if(!url||node.dataset.cinematicKey!==key||!node.isConnected)return;
  if(background)node.style.backgroundImage='url("'+url+'")';
  else node.src=url;
 }).catch(()=>{}); // Original chapter/cast art and SVG remain visible as fallbacks.
}
