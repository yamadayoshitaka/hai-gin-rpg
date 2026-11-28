// Original authored motion v2.0. No external animation or legacy motion data.
export const ACTIONS=Object.freeze({idle:'待機',walk:'歩行',run:'走行',jump:'ジャンプ',sit:'座る',crouch:'しゃがむ',bow:'お辞儀',wave:'手を振る',punch:'パンチ',grasp:'物を握る',pickup:'拾う・持ち上げる',point:'指差し',openclose:'手を開閉'});
export const AGING=Object.freeze({under10:[1.12,.90,0],teens:[1.04,.97,0],twenties:[1,1,0],thirties:[.98,.98,1],forties:[.94,.94,2],fifties:[.88,.89,3],sixties:[.79,.81,5],seventies:[.68,.72,8],eightyPlus:[.55,.61,12]});
const R=Math.PI/180;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
// Pose channels: hips L/R, knees L/R, shoulders L/R, elbows L/R,
// trunk pitch, pelvis rise (fraction of height), torso yaw, wrist, hand curl.
const K=(t,h=[0,0],k=[6,6],a=[4,4],e=[10,10],b=0,y=0,tw=0,w=0,g=0)=>({t,h,k,a,e,b,y,tw,w,g});
const N=t=>K(t);
const symmetric=(t,h,k,a,e,b,y,tw=0,w=0,g=0)=>K(t,[h,h],[k,k],[a,a],[e,e],b,y,tw,w,g);
export const CLIPS=Object.freeze({
 idle:{duration:3.6,loop:true,keys:[N(0),K(.3,[1,-1],[7,5],[5,3],[12,9],1,.002,1),K(.7,[-1,1],[5,7],[3,5],[9,12],0,-.001,-1),N(1)]},
 jump:{duration:1.8,loop:false,keys:[N(0),symmetric(.18,35,65,-28,25,19,-.10),symmetric(.30,-7,4,60,18,-3,.03),symmetric(.48,22,43,100,28,4,.22),symmetric(.63,12,22,65,25,5,.13),symmetric(.75,28,55,-5,30,17,-.07),N(1)]},
 sit:{duration:1.9,loop:false,keys:[N(0),symmetric(.22,28,35,14,27,22,-.06),symmetric(.62,75,87,25,45,18,-.24),symmetric(1,88,95,7,55,7,-.25)]},
 crouch:{duration:2.3,loop:false,keys:[N(0),symmetric(.22,35,45,35,25,25,-.10),symmetric(.52,83,115,48,38,41,-.25),symmetric(.75,83,115,48,38,41,-.25),N(1)]},
 bow:{duration:2.0,loop:false,keys:[N(0),symmetric(.23,4,8,4,10,20,-.005),symmetric(.43,8,10,3,10,39,-.012),symmetric(.66,8,10,3,10,39,-.012),N(1)]},
 wave:{duration:2.8,loop:false,keys:[N(0),K(.18,[0,0],[6,6],[75,75],[85,85],0,0,0,-16),K(.34,[0,0],[6,6],[83,83],[93,93],0,0,0,25),K(.48,[0,0],[6,6],[83,83],[90,90],0,0,0,-22),K(.62,[0,0],[6,6],[83,83],[95,95],0,0,0,25),K(.76,[0,0],[6,6],[75,75],[85,85],0,0,0,-15),N(1)]},
 punch:{duration:1.3,loop:false,keys:[N(0),K(.19,[15,-12],[17,23],[38,38],[88,88],8,-.018,-16,0,.88),K(.38,[18,-15],[20,27],[18,18],[105,105],9,-.024,-24,0,.95),K(.57,[22,-10],[24,17],[83,83],[9,9],8,-.012,23,0,1),K(.73,[12,-10],[17,18],[42,42],[84,84],5,-.01,0,0,.92),N(1)]},
 grasp:{duration:2.1,loop:false,keys:[N(0),symmetric(.22,3,8,38,45,4,0),symmetric(.44,3,8,64,38,5,0),symmetric(.58,3,8,64,38,5,0,0,0,.88),symmetric(1,0,6,35,78,0,0,0,0,.88)],attach:.58,reach:[.20,.58]},
 pickup:{duration:3.0,loop:false,keys:[N(0),symmetric(.16,27,43,20,15,24,-.07),symmetric(.38,75,112,35,16,42,-.24),symmetric(.49,80,115,38,18,43,-.26,0,0,.88),symmetric(.69,35,48,42,40,21,-.11,0,0,.88),symmetric(1,0,6,35,78,0,0,0,0,.88)],attach:.49,reach:[.17,.49]},
 point:{duration:2.0,loop:false,keys:[N(0),symmetric(.24,0,6,35,45,0,0,0,0,.65),symmetric(.48,0,6,85,12,0,0,0,0,.9),symmetric(.83,0,6,85,12,0,0,0,0,.9),N(1)]},
 openclose:{duration:2.4,loop:true,keys:[N(0),symmetric(.18,0,6,50,72,0,0),symmetric(.42,0,6,50,72,0,0,0,0,1),symmetric(.64,0,6,50,72,0,0,0,0,1),symmetric(.85,0,6,50,72,0,0),N(1)]}
});
// Authored leg cycle: hip, knee, shoulder, elbow, ankle pitch, support flag.
// Contact and aerial phases are intentionally different for run vs walk.
const gait={
 walk:{duration:1.18,keys:[[0,26,7,-22,16,10,1],[.12,15,17,-10,20,-3,1],[.30,-9,9,8,17,0,1],[.50,-24,13,23,22,-17,1],[.62,-9,52,13,28,-14,0],[.76,15,63,-8,24,8,0],[.90,29,25,-25,19,13,0],[1,26,7,-22,16,10,1]]},
 run:{duration:.78,keys:[[0,43,26,-42,76,11,1],[.15,4,46,-4,82,-4,1],[.31,-39,23,40,75,-24,1],[.38,-34,42,43,72,-18,0],[.53,-12,91,17,89,4,0],[.68,35,104,-28,92,18,0],[.86,53,55,-44,79,13,0],[1,43,26,-42,76,11,1]]}
};
function interval(keys,t,get=x=>x.t){for(let i=1;i<keys.length;i++)if(t<=get(keys[i])){const a=keys[i-1],b=keys[i];return [a,b,smooth(clamp((t-get(a))/(get(b)-get(a)),0,1))]}return [keys.at(-1),keys.at(-1),0]}
function gaitLeg(c,u){const [a,b,f]=interval(c.keys,u,x=>x[0]);return {h:mix(a[1],b[1],f),k:mix(a[2],b[2],f),a:mix(a[3],b[3],f),e:mix(a[4],b[4],f),ankle:mix(a[5],b[5],f),contact:u<(c===gait.walk?.56:.35)}}
function sampleGait(action,time){const c=gait[action],u=((time/c.duration)%1+1)%1,l=gaitLeg(c,u),r=gaitLeg(c,(u+.5)%1),air=!l.contact&&!r.contact;const float=action==='run'&&air?.035*Math.sin(Math.PI*clamp((u% .5-.35)/.15,0,1)):0;return {h:[l.h,r.h],k:[l.k,r.k],a:[l.a,r.a],e:[l.e,r.e],ankle:[l.ankle,r.ankle],contact:[l.contact,r.contact],b:action==='run'?11:3,y:float,tw:Math.sin(u*2*Math.PI)*(action==='run'?9:5),w:0,g:action==='run'?.23:.08,u,attach:false,reach:0}}
export function sampleOriginal(action,time,{age='twenties',build='normal',side='r'}={}){
 const [tempo,amp,stoop]=AGING[age]||AGING.twenties;const heavy=build==='fat'?.87:1;let p;
 if(gait[action])p=sampleGait(action,time*tempo*heavy);
 else{const c=CLIPS[action]||CLIPS.idle,u=c.loop?((time*tempo*heavy/c.duration)%1+1)%1:clamp(time*tempo*heavy/c.duration,0,1);const [a,b,f]=interval(c.keys,u);p={u,ankle:[0,0],contact:action==='jump'&&u>.30&&u<.70?[false,false]:[true,true]};for(const name of ['h','k','a','e'])p[name]=a[name].map((n,i)=>mix(n,b[name][i],f));for(const name of ['b','y','tw','w','g'])p[name]=mix(a[name],b[name],f);p.attach=c.attach!==undefined&&u>=c.attach;p.reach=c.reach?u<c.reach[0]?0:u>=c.reach[1]?1:smooth((u-c.reach[0])/(c.reach[1]-c.reach[0])):0}
 const selected=['l','r'].map(s=>side==='both'||side===s);
 if(['wave','punch','grasp','pickup','point','openclose'].includes(action))for(let i=0;i<2;i++)if(!selected[i]){p.a[i]=4;p.e[i]=10}
 // Do not reduce the angle needed to sit/grasp merely because of age.
 const scale=['walk','run','jump','punch','wave'].includes(action)?amp*heavy:1;
 const limit=(n,lo,hi)=>clamp(n,lo,hi)*R;
 return {...p,selected,h:p.h.map(n=>limit(n*scale,-50,100)),k:p.k.map(n=>limit(n*scale,0,135)),a:p.a.map(n=>limit(n*scale,-65,120)),e:p.e.map(n=>limit(n,4,140)),ankle:p.ankle.map(n=>limit(n,-30,30)),b:limit(p.b+stoop,0,65),tw:limit(p.tw,-35,35),w:limit(p.w,-35,35),y:p.y*amp,spread:build==='fat'?.19:.12};
}
