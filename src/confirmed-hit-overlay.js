/**
 * Screen-space, camera-accurate confirmation of actual HP loss.
 * The combat simulation is authoritative: never create a marker from an
 * attack animation, only from a unitHit event.  One Canvas2D layer provides
 * bounded overhead even for 1000 vs 1000, with no added GPU draw calls.
 */
import * as THREE from 'three';
import {damageNumberStyle} from './damage-number-style.js?v=4.6.35';

const MAX_VISIBLE=16;
const LIFE=1.0;
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
  this.drawElapsed=0;this.painted=false;
  const canvas=document.createElement('canvas');
  canvas.id='confirmedHitOverlay';
  canvas.setAttribute('aria-hidden','true');
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;touch-action:none';
  host.appendChild(canvas);
  this.canvas=canvas;this.context=canvas.getContext('2d',{alpha:true});
 }
 add({target,targetId,team=-1,damage=0,remainingHp=null,maxHp=null}={}){
  if(!target||!Number.isFinite(target.x+target.y+target.z)||!(damage>0))return false;
  const point=projectCombatPoint(target,this.camera,
    this.host.clientWidth||1,this.host.clientHeight||1);
  if(!point)return false;
  const key=targetId==null?null:String(targetId);
  const existing=key==null?null:this.hits.find(h=>h.key===key);
  const hit={
   key,target:{x:target.x,y:target.y,z:target.z},
   team,damage:Math.round(damage),
   remainingHp:Number.isFinite(remainingHp)?Math.max(0,Math.round(remainingHp)):null,
   maxHp:Number.isFinite(maxHp)&&maxHp>0?Math.round(maxHp):null,age:0
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
  const elapsed=Math.max(0,dt||0);
  if(!paused)for(const hit of this.hits)hit.age+=elapsed;
  this.hits=this.hits.filter(h=>h.age<LIFE);
  // Transparent overlay remains completely dormant when combat is quiet.
  if(!this.hits.length&&!this.painted)return;
  // Limit Canvas2D text drawing to 24fps on mobile. World/rig animation
  // continues at full frame rate; no extra 3D impostors or draw calls.
  this.drawElapsed+=elapsed;
  if(this.hits.length&&this.drawElapsed<1/24)return;
  this.drawElapsed=0;
  const width=this.host.clientWidth||1,height=this.host.clientHeight||1;
  const dpr=1;
  if(width!==this.width||height!==this.height||dpr!==this.dpr){
   this.width=width;this.height=height;this.dpr=dpr;
   this.canvas.width=Math.round(width*dpr);
   this.canvas.height=Math.round(height*dpr);
  }
  const ctx=this.context;if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);
  this.painted=this.hits.length>0;
  for(const hit of this.hits){
   const to=projectCombatPoint(hit.target,this.camera,width,height);
   if(!to)continue;
   const progress=hit.age/LIFE;
   ctx.save();ctx.globalAlpha=Math.min(1,(1-progress)*2.5);
   // No blue/red target circles: keep the battlefield unobstructed.
   // A modest upward float separates simultaneous hits from HP labels.
   const style=damageNumberStyle(hit.damage,hit.remainingHp);
   const rise=10+progress*20;
   ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.lineJoin='round';ctx.strokeStyle='#091321';ctx.lineWidth=3.5;
   ctx.font='900 '+style.size+'px system-ui,sans-serif';
   const text='−'+hit.damage;
   ctx.strokeText(text,to.x,to.y-rise);
   ctx.fillStyle=style.color;ctx.fillText(text,to.x,to.y-rise);
   if(hit.remainingHp!==null){
    ctx.font='700 11px system-ui,sans-serif';
    const hp='HP '+hit.remainingHp+(hit.maxHp!==null?'/'+hit.maxHp:'');
    const y=to.y+11-progress*13;
    ctx.lineWidth=2.8;ctx.strokeText(hp,to.x,y);
    ctx.fillStyle=hit.team===0?'#9cecff':'#ffc3cf';
    ctx.fillText(hp,to.x,y);
   }
   ctx.restore();
  }
 }
 get activeCount(){return this.hits.length;}
 dispose(){this.hits.length=0;this.canvas.remove();}
}
