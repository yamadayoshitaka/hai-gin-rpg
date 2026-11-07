/**
 * Screen-space, camera-accurate confirmation of actual HP loss.
 * The combat simulation is authoritative: never create a marker from an
 * attack animation, only from a unitHit event.  One Canvas2D layer provides
 * bounded overhead even for 1000 vs 1000, with no added GPU draw calls.
 */
import * as THREE from 'three';

const MAX_VISIBLE=24;
const LIFE=1.12;
const SCRATCH=new THREE.Vector3();

export function projectCombatPoint(point,camera,width,height){
 if(!point||!camera||!Number.isFinite(point.x+point.y+point.z))return null;
 SCRATCH.set(point.x,point.y,point.z).project(camera);
 if(!Number.isFinite(SCRATCH.x+SCRATCH.y+SCRATCH.z)||
   SCRATCH.z<=-1||SCRATCH.z>=1||
   Math.abs(SCRATCH.x)>1.10||Math.abs(SCRATCH.y)>1.10)return null;
 return {x:(SCRATCH.x+1)*.5*width,y:(1-SCRATCH.y)*.5*height,
   centerDistance:Math.hypot(SCRATCH.x,SCRATCH.y)};
}

export function selectConfirmedHitEvents(events,camera,worldAt,limit=20){
 if(!Array.isArray(events)||!camera||typeof worldAt!=='function')return [];
 const candidates=[];
 for(const event of events){
  if(event?.type!=='unitHit'||!(event.damage>0))continue;
  const at=worldAt(event);
  const pixel=projectCombatPoint(at,camera,2,2);
  if(!pixel)continue;
  // First serve the center of the current view. Large effects may occur
  // everywhere, but an off-screen hit must never steal a visible marker.
  const score=pixel.centerDistance-Math.min(60,event.damage)*.005;
  candidates.push({event,score});
 }
 candidates.sort((a,b)=>a.score-b.score);
 const selected=[],seen=new Set();
 for(const {event} of candidates){
  const key=String(event.targetId);
  if(seen.has(key))continue;
  seen.add(key);selected.push(event);
  if(selected.length>=limit)break;
 }
 return selected;
}

export class ConfirmedHitOverlay{
 constructor(host,camera,{maxVisible=MAX_VISIBLE}={}){
  if(!host||!camera)throw Error('Hit overlay requires viewport and camera');
  this.host=host;this.camera=camera;this.maxVisible=Math.max(2,Math.min(32,maxVisible));
  this.hits=[];this.width=0;this.height=0;this.dpr=1;
  const canvas=document.createElement('canvas');
  canvas.id='confirmedHitOverlay';
  canvas.setAttribute('aria-hidden','true');
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;touch-action:none';
  host.appendChild(canvas);
  this.canvas=canvas;this.context=canvas.getContext('2d',{alpha:true});
 }
 add({target,source=null,targetId,team=-1,damage=0,element='physical'}={}){
  if(!target||!Number.isFinite(target.x+target.y+target.z)||!(damage>0))return false;
  const point=projectCombatPoint(target,this.camera,
    this.host.clientWidth||1,this.host.clientHeight||1);
  if(!point)return false;
  const key=targetId==null?null:String(targetId);
  const existing=key==null?null:this.hits.find(h=>h.key===key);
  const hit={
   key,target:{x:target.x,y:target.y,z:target.z},
   source:source&&Number.isFinite(source.x+source.y+source.z)?
    {x:source.x,y:source.y,z:source.z}:null,
   team,damage:Math.round(damage),element,age:0
  };
  if(existing)Object.assign(existing,hit);
  else{
   if(this.hits.length>=this.maxVisible){
    // In mass battles hundreds of hits can arrive per second. Retain every
    // selected victim for >=420ms rather than replacing its marker instantly.
    const replaceIndex=this.hits.findIndex(entry=>entry.age>=.42);
    if(replaceIndex<0)return false;
    this.hits.splice(replaceIndex,1);
   }
   this.hits.push(hit);
  }
  return true;
 }
 render(dt,{paused=false}={}){
  const width=this.host.clientWidth||1,height=this.host.clientHeight||1;
  const dpr=Math.min(1.5,Math.max(1,window.devicePixelRatio||1));
  if(width!==this.width||height!==this.height||dpr!==this.dpr){
   this.width=width;this.height=height;this.dpr=dpr;
   this.canvas.width=Math.round(width*dpr);
   this.canvas.height=Math.round(height*dpr);
  }
  const ctx=this.context;if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);
  if(!paused)for(const hit of this.hits)hit.age+=Math.max(0,dt||0);
  this.hits=this.hits.filter(h=>h.age<LIFE);
  for(const hit of this.hits){
   const to=projectCombatPoint(hit.target,this.camera,width,height);
   if(!to)continue;
   const from=hit.source?projectCombatPoint(hit.source,this.camera,width,height):null;
   const progress=hit.age/LIFE;
   const alpha=Math.min(1,(1-progress)*2.6);
   const color=hit.team===0?'#68d9ff':'#ff6b82';
   const magic=!['physical','slash'].includes(hit.element);
   const outer=23+Math.sin(progress*Math.PI)*8;
   ctx.save();ctx.globalAlpha=alpha;
   // Reticle always points at the damaged body, not at the attacker's windup.
   ctx.shadowColor=color;ctx.shadowBlur=14;
   ctx.strokeStyle=color;ctx.lineWidth=3.8;
   ctx.beginPath();ctx.arc(to.x,to.y,outer,0,Math.PI*2);ctx.stroke();
   ctx.shadowBlur=0;
   ctx.strokeStyle='#fff7c4';ctx.lineWidth=2.3;
   for(let quadrant=0;quadrant<4;quadrant++){
    const a=quadrant*Math.PI/2+Math.PI/4;
    const inner=outer+5,far=outer+14;
    ctx.beginPath();ctx.moveTo(to.x+Math.cos(a)*inner,to.y+Math.sin(a)*inner);
    ctx.lineTo(to.x+Math.cos(a)*far,to.y+Math.sin(a)*far);ctx.stroke();
   }
   if(from){
    const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy);
    // A bright directional stroke links the attacker and confirmed victim.
    if(len>13){
     const ux=dx/len,uy=dy/len;
     const start=18,finish=Math.min(outer+4,len-5);
     ctx.strokeStyle=magic?'#e9bcff':'#ffe3a5';
     ctx.lineWidth=3;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=8;
     ctx.beginPath();ctx.moveTo(from.x+ux*start,from.y+uy*start);
     ctx.lineTo(to.x-ux*finish,to.y-uy*finish);ctx.stroke();
     ctx.shadowBlur=0;
     ctx.fillStyle=ctx.strokeStyle;
     const x=to.x-ux*finish,y=to.y-uy*finish;
     ctx.beginPath();ctx.moveTo(x,y);
     ctx.lineTo(x-ux*10-uy*6,y-uy*10+ux*6);
     ctx.lineTo(x-ux*10+uy*6,y-uy*10-ux*6);
     ctx.closePath();ctx.fill();
    }
   }
   ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.font='900 22px system-ui,sans-serif';
   ctx.lineJoin='round';ctx.lineWidth=5;ctx.strokeStyle='#071021';
   const text='−'+hit.damage;
   const labelY=to.y-outer-15-progress*15;
   ctx.strokeText(text,to.x,labelY);ctx.fillStyle='#ffffff';
   ctx.fillText(text,to.x,labelY);
   ctx.font='800 11px system-ui,sans-serif';
   ctx.lineWidth=3;ctx.strokeText('HIT',to.x,to.y);
   ctx.fillStyle='#fff2b7';ctx.fillText('HIT',to.x,to.y);
   ctx.restore();
  }
 }
 get activeCount(){return this.hits.length;}
 dispose(){this.hits.length=0;this.canvas.remove();}
}
