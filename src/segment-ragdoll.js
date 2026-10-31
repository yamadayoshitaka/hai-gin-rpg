export const SEGMENTS={torso:30,head:5,pelvis:11,upperArm:2.2,forearm:1.3,hand:.5,thigh:7,shin:3.5,foot:1};
export function createRagdoll(){
 const parts=new Map();
 const add=(id,m,x,y,r)=>parts.set(id,{id,m,r,p:[x,y],prev:[x,y]});
 add('pelvis',11,0,1,.2);add('torso',30,0,1.4,.25);add('head',5,0,1.8,.15);
 for(const side of [-1,1]){
  const k=side<0?'L':'R';
  add('upperArm'+k,2.2,side*.35,1.4,.12);add('forearm'+k,1.3,side*.52,1.13,.10);add('hand'+k,.5,side*.65,.9,.07);
  add('thigh'+k,7,side*.16,.73,.15);add('shin'+k,3.5,side*.16,.4,.12);add('foot'+k,1,side*.16,.15,.1);
 }
 const edges=[['pelvis','torso'],['torso','head']];
 for(const k of ['L','R'])edges.push(['torso','upperArm'+k],['upperArm'+k,'forearm'+k],['forearm'+k,'hand'+k],['pelvis','thigh'+k],['thigh'+k,'shin'+k],['shin'+k,'foot'+k]);
 const links=edges.map(([a,b])=>({a,b,d:Math.hypot(parts.get(a).p[0]-parts.get(b).p[0],parts.get(a).p[1]-parts.get(b).p[1])}));
 let elapsed=0;
 function step(dt){
  elapsed+=Math.max(0,Math.min(.05,dt));let steps=0;
  while(elapsed>=1/120&&steps++<6){
   elapsed-=1/120;
   for(const p of parts.values()){const [x,y]=p.p,[px,py]=p.prev;p.prev=[x,y];p.p=[x+(x-px)*.995,y+(y-py)*.995-9.81/14400];}
   for(let n=0;n<12;n++){
    for(const e of links){
     const a=parts.get(e.a),b=parts.get(e.b),dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],d=Math.hypot(dx,dy)||1;
     const w1=1/a.m,w2=1/b.m,c=(d-e.d)/(d*(w1+w2));
     a.p[0]+=dx*c*w1;a.p[1]+=dy*c*w1;b.p[0]-=dx*c*w2;b.p[1]-=dy*c*w2;
    }
    for(const p of parts.values())if(p.p[1]<p.r){p.p[1]=p.r;p.prev[0]=p.p[0]-(p.p[0]-p.prev[0])*.7;}
   }
  }
 }
 return {parts,links,step};
}
