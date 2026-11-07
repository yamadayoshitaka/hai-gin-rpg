/**
 * Ten reusable anatomical families, fifty distinct sculptures. Beyond colour,
 * variants change horns, crests, armour, wings, limb lengths, weapons and fins.
 * Each specimen is real 3D geometry, never an image billboard.
 */
import {createSculpture,disposeMonsterSculpture} from './monster-shape-kit.js';
function feet(g,pivot,x,y,z,clawed=true,scale=1){
 g.sphere(pivot,'skin',[0,-.28,0],[.14*scale,.30*scale,.15*scale]);
 g.sphere(pivot,'shadow',[0,-.53,.13],[.13*scale,.08*scale,.22*scale]);
 if(clawed)g.claws(pivot,[0,-.56,.22],1,3,.78*scale);
}
function quadruped(g,s,{feline=false,reptile=false}={}){
 const v=s.variant,k=s.size;
 const torso=g.group('torso');
 g.sphere(torso,'skin',[0,1.30,0],[.43+(v%2)*.06,.43,.72+v*.06]);
 g.sphere(torso,'light',[0,1.48,.22],[.31,.25,.45]);
 // Continuous neck transitions from the shoulder mass into the skull,
 // avoiding the visible "two spheres glued together" silhouette.
 g.bridge(torso,'skin',[0,1.35,.32],[0,1.57,.76+v*.055],.325,.215);
 const head=g.group('head',[0,1.56,.70+v*.06]);
 g.sphere(head,'skin',[0,.03,.06],[.33,.28,.36]);
 const muzzle=reptile?.57:feline?.32:.43;
 g.sphere(head,'light',[0,-.13,muzzle],[.23,.15,.31]);
 g.sphere(head,'shadow',[0,-.17,muzzle+.19],[.18,.057,.12]);
 g.eyes(head,.35,.11,.20,.055);
 for(const side of [-1,1]){
   const horn=v===2||reptile? .28:.12;
   if(reptile||v>=2)g.spike(head,v===2?'accent':'bone',[side*.21,.24,.0],[side*(.38+v*.045),.47+horn,-.13],.085);
   else g.sphere(head,'skin',[side*.24,.24,-.09],[.10,.19,.07]);
   g.spike(head,'bone',[side*.13,-.20,muzzle+.08],[side*.13,-.31,muzzle+.22],.046);
 }
 const jaw=g.group('jaw',[0,1.42,.96]);g.sphere(jaw,'shadow',[0,-.03,.12],[.24,.045,.29]);
 for(let i=0;i<4;i++)g.spike(jaw,'bone',[(i-1.5)*.12,.01,.27],[(i-1.5)*.12,-.10,.29],.025);
 for(const side of [-1,1])for(const fore of [-1,1]){
   const name=(fore===1?'front':'rear')+(side<0?'L':'R');
   // Former limb pivot at y=1.13 kept all four feet half a metre above
   // terrain. Plant the soles near ground zero and embed hips in the torso.
   const leg=g.group('leg'+name,[side*.29,.67,fore*.49]);
   g.sphere(leg,'skin',[0,.17,0],
     [reptile?.18:.21,.40,reptile?.18:.21]);
   feet(g,leg,0,0,0,true,reptile?.75:1);
 }
 const tail=g.group('tail',[0,1.35,-.55]);
 g.tube(tail,'skin',[[0,0,.05],[0,.17,-.34],[0,.08,-.76-v*.1],[.09,-.03,-.98-v*.1]],reptile?.14:.085);
 if(!reptile){
   for(let i=0;i<8+v*3;i++){
     const z=-.25+i*.085,y=1.70+.05*Math.sin(i);
     g.spike(torso,i%3===0?'accent':'light',[0,y,z-.72],[0,y+.10+(v===2?.20:.07),z-.78],.028);
   }
   if(feline){for(let i=0;i<5;i++)for(const side of [-1,1]){
     g.spike(head,'light',[side*.24,.12-i*.06,.1],[side*(.36+i*.02),.02-i*.06,.22],.027);
   }}
 }else{
   for(let i=0;i<12+v*3;i++){
     const z=-.65+i*.12;
     const h=Math.sin(i/(12+v*3)*Math.PI);
     g.spike(torso,i%3===0?'accent':'light',[0,1.62,z],[0,1.64+.26*h+(v===2?.15:0),z-.13],.07*h+.02);
   }
   for(const side of [-1,1])for(let i=0;i<7;i++)
     g.sphere(torso,i%2?'light':'skin',[side*.39,1.30+(i%3)*.12,-.45+i*.16],[.045,.055,.07]);
   if(v===2)for(const side of [-1,1]){
     g.tube(torso,'skin',[[side*.27,1.54,.2],[side*.56,1.87,.65],[side*.48,2.08,.98]],.14);
     g.sphere(torso,'skin',[side*.48,2.09,1.02],[.22,.19,.29]);
     g.spike(torso,'bone',[side*.46,2.23,1.0],[side*.55,2.53,.78],.07);
   }
 }
 g.root.scale.setScalar(k*.86);
}
function bird(g,s){
 const v=s.variant;
 const torso=g.group('torso');
 g.sphere(torso,'skin',[0,1.44,0],[.36,.55,.44]);
 g.sphere(torso,'light',[0,1.26,.31],[.27,.26,.26]);
 g.bridge(torso,'skin',[0,1.58,.18],[0,2.04,.30],.24,.18);
 const head=g.group('head',[0,2.00,.31]);
 g.sphere(head,'skin',[0,.03,0],[.25,.29,.28]);
 g.spike(head,'accent',[0,-.07,.20],[0,-.20,.61],.13);
 g.eyes(head,.22,.08,.18,.046);
 for(let i=0;i<7+v*2;i++){
   const x=(i-(6+v*2)/2)*.054;
   g.spike(head,i%3?'light':'accent',[x,.23,-.12],[x*.9,.45+v*.045,-.20],.029);
 }
 for(const side of [-1,1]){
   const wing=g.group(side<0?'wingL':'wingR',[side*.30,1.77,-.06]);
   g.tube(wing,'skin',[[0,0,0],[side*.55,.25,-.05],[side*1.18,.36,-.29],[side*1.56,.18,-.53]],.085);
   for(let i=0;i<15+v*4;i++){
     const t=i/(14+v*4);
     const x=side*(.22+1.31*t);
     g.fin(wing,i%3?'light':'accent',[x,.12,-.10-t*.32],[x+side*(.20+.35*t),-.40-t*.47,-.20-t*.34],.07+Math.sin(t*Math.PI)*.09);
     // Overlapping secondary coverts hide the skeletal spar and create a
     // continuous plumage transition rather than exposed triangular slits.
     g.fin(wing,'skin',[x,.17,-.08-t*.23],
       [x+side*(.14+.18*t),-.13-t*.18,-.17-t*.26],.058);
   }
   const leg=g.group('leg'+(side<0?'L':'R'),[side*.17,1.09,.10]);
   g.bone(leg,'skin',[0,0,0],[0,-.93,.12],.075);
   g.sphere(leg,'shadow',[0,-.93,.16],[.10,.08,.16]);
   g.claws(leg,[0,-.95,.24],1,3,1.3);
 }
 const tail=g.group('tail',[0,1.25,-.40]);
 for(let i=-3;i<=3;i++)g.fin(tail,i%2?'accent':'light',[i*.055,0,0],[i*.12,-.18,-.84-v*.10],.10);
 g.root.scale.setScalar(s.size*.80);
}
function insect(g,s,{spider=false}={}){
 const v=s.variant;
 const torso=g.group('torso');
 g.sphere(torso,'shadow',[0,1.03,-.16],[.50,.38,.63],{metal:.38,rough:.49});
 g.sphere(torso,'skin',[0,1.34,-.23],[.52,.31,.65],{metal:.45,rough:.38});
 g.sphere(torso,'light',[0,1.53,-.35],[.39,.15,.50],{metal:.42,rough:.40});
 for(let i=0;i<7+v;i++)g.ring(torso,i%3?'accent':'shadow',[0,1.38,-.37+i*.13],.12+(i%2)*.035,.020);
 const head=g.group('head',[0,1.31,.64]);
 g.sphere(head,'skin',[0,0,0],[.35,.30,.35],{metal:.32});
 g.bridge(torso,'skin',[0,1.23,.39],[0,1.30,.67],.28,.21);
 g.eyes(head,.28,.09,.20,.06);
 for(const side of [-1,1]){
   g.tube(head,'accent',[[side*.13,.20,.16],[side*.25,.53,.33],[side*.37,.61,.38]],.025);
   g.spike(head,'bone',[side*.16,-.13,.31],[side*.27,-.30,.60],.09);
 }
 const jaws=g.group('jaw',[0,1.20,.82]);
 for(const side of [-1,1])g.spike(jaws,'bone',[side*.16,0,0],[side*.11,-.10,.35],.075);
 const count=spider?4:3;
 for(const side of [-1,1])for(let i=0;i<count;i++){
   const z=.46-i*.36;const name='leg'+(side<0?'L':'R')+i;
   const leg=g.group(name,[side*.35,1.12,z]);
   const bend=[side*(.45+(i===0?.12:0)),i===3?.02:.22,(i-1)*.16];
   const foot=[side*(.72+i*.05),-.94,(i-1.5)*.23];
   g.bone(leg,'skin',[0,0,0],bend,.085,{tipRadius:.055,metal:.4});
   g.sphere(leg,'accent',bend,[.092,.09,.092],{metal:.4});
   g.bone(leg,'shadow',bend,foot,.070,{tipRadius:.024,metal:.4});
   g.spike(leg,'bone',foot,[foot[0]+side*.11,foot[1]-.08,foot[2]],.04);
 }
 if(!spider){
   const hornCount=v%2?2:1;
   for(let i=0;i<hornCount;i++)g.spike(head,'accent',[(i-(hornCount-1)/2)*.13,.20,.06],
     [(i-(hornCount-1)/2)*.22,.73+v*.07,.20],.105);
   for(let i=0;i<6+v*2;i++){
     const z=-.7+i*.18;
     g.spike(torso,'accent',[0,1.58,z],[0,1.74+(i%3)*.09,z-.09],.045);
   }
   if(v>=2){
     for(const side of [-1,1]){const wing=g.group(side<0?'wingL':'wingR',[side*.30,1.58,-.25]);
       g.fin(wing,'light',[0,0,0],[side*1.13,.35,-.48],.52,{translucent:true});
     }
   }
 }else{
   const abdomen=g.group('abdomen',[0,1.25,-.57]);
   g.sphere(abdomen,'skin',[0,0,-.25],[.54,.47,.60],{metal:.12,rough:.56});
   g.sphere(abdomen,'light',[0,.28,-.24],[.40,.11,.44]);
   for(const side of [-1,1])for(let i=0;i<4;i++)
     g.sphere(head,'eye',[side*(.07+i*.072),.12+(i%2)*.06,.30],[.025,.028,.012],{glow:true});
   if(v>=2)for(let i=0;i<6;i++)g.spike(abdomen,'accent',[(i%2?1:-1)*.28,.28,-.42+(i/6)*.60],
     [(i%2?1:-1)*.35,.50+(i%3)*.07,-.42+(i/6)*.60],.05);
 }
 g.root.scale.setScalar(s.size*.83);
}
function upright(g,s,{rock=false,undead=false,demon=false}={}){
 const v=s.variant;
 const torso=g.group('torso');
 const bodyColor=rock?'shadow':'skin';
 if(rock)g.rock(torso,bodyColor,[0,1.35,0],[.55,.65,.33]);
 else {
   g.sphere(torso,bodyColor,[0,1.34,0],[.40,.61,.28]);
   g.sphere(torso,'light',[0,1.70,.10],[.32,.25,.24]);
 }
 g.bridge(torso,rock?'skin':'light',[0,1.80,.03],
   [0,2.12,.08],rock?.23:.17,rock?.185:.135);
 const head=g.group('head',[0,2.17,.08]);
 if(rock)g.rock(head,'skin',[0,0,0],[.30,.33,.30]);
 else g.sphere(head,undead?'bone':'skin',[0,0,0],[.26,.32,.27]);
 g.eyes(head,.248,.025,.16,undead?.063:.048);
 if(undead){
   for(const side of [-1,1])g.spike(head,'shadow',[side*.10,-.13,.23],[side*.12,-.26,.29],.045);
   for(let i=0;i<5;i++)g.bone(torso,'bone',[-.26,1.85-i*.16,.29],[.26,1.85-i*.16,.29],.028);
 }
 if(rock){
   g.sphere(torso,'accent',[0,1.38,.35],[.16,.20,.08],{glow:true,metal:.5});
   for(let i=0;i<7+v*2;i++){const a=i/(7+v*2)*Math.PI*2;
     g.spike(torso,i%2?'light':'skin',[.33*Math.cos(a),1.85,.2*Math.sin(a)],
       [.45*Math.cos(a),2.18+v*.025,.39*Math.sin(a)],.10);
   }
 }
 for(const side of [-1,1]){
   const arm=g.group('arm'+(side<0?'L':'R'),[side*.46,1.84,0]);
   if(rock){
     g.rock(arm,'skin',[side*.12,-.26,0],[.25,.36,.25]);
     g.rock(arm,'light',[side*.17,-.56,.17],[.19,.21,.22]);
   }else{
     g.bone(arm,'skin',[0,0,0],[side*.17,-.56,.16],.16,{tipRadius:.11});
     g.sphere(arm,'shadow',[side*.17,-.58,.18],[.15,.15,.15]);
   }
   g.claws(arm,[side*.17,-.70,.26],1,rock?4:3,rock?1.35:1.1);
   const leg=g.group('leg'+(side<0?'L':'R'),[side*.19,.96,0]);
   if(rock)g.rock(leg,'skin',[0,-.35,0],[.24,.45,.24]);
   else g.bone(leg,'skin',[0,0,0],[0,-.74,.07],.17,{tipRadius:.12});
   g.sphere(leg,'shadow',[0,-.80,.15],[.21,.14,.27]);
 }
 if(demon){
   for(const side of [-1,1]){
     g.spike(head,'shadow',[side*.20,.23,-.05],[side*.45,.65+v*.07,-.17],.12);
     const wing=g.group(side<0?'wingL':'wingR',[side*.36,1.67,-.2]);
     g.tube(wing,'skin',[[0,0,0],[side*.52,.54,-.12],[side*1.21,.73,-.4]],.07);
     for(let i=0;i<6+v*2;i++){const t=i/(6+v*2);
       g.fin(wing,'skin',[side*(.19+t*.95),.22+t*.25,-.25],
         [side*(.20+t*1.52),-.35-t*.22,-.30],.13);
     }
   }
   const tail=g.group('tail',[0,1.06,-.18]);g.tube(tail,'skin',[[0,0,0],[0,.1,-.45],[.30,.03,-.84]],.08);
   g.spike(tail,'accent',[.30,.03,-.84],[.48,.13,-1.05],.13);
 }else if(undead){
   g.sphere(torso,'shadow',[0,1.36,-.18],[.43,.56,.11],{rough:.85});
   if(v>=2)g.spike(head,'accent',[0,.29,-.02],[0,.52,.1],.09);
 }else if(rock){
   for(let i=0;i<8+v*2;i++){
     const side=i%2?-1:1,y=1.14+(i%5)*.14;
     g.rock(torso,i%3?'skin':'light',[side*.43,y,-.1+(i%3)*.11],[.19,.14,.15]);
   }
 }
 const jaw=g.group('jaw',[0,1.99,.18]);g.sphere(jaw,rock?'shadow':'skin',[0,-.02,.02],[.20,.09,.20]);
 g.root.scale.setScalar(s.size*(rock?.85:.87));
}
function aquatic(g,s){
 const v=s.variant;
 if(v===0){
   const torso=g.group('torso');
   g.sphere(torso,'skin',[0,.70,0],[.55,.62,.53],{rough:.19,translucent:true});
   g.sphere(torso,'light',[0,1.02,.22],[.41,.31,.34],{rough:.20,translucent:true});
   const head=g.group('head',[0,.87,.29]);g.eyes(head,.22,.12,.18,.065);
   for(let i=0;i<18;i++){
     const angle=i/18*Math.PI*2,theta=.65+(i%4)*.18;
     g.sphere(torso,i%3===0?'accent':'light',
       [Math.cos(angle)*(.34+theta*.13),.66+(i%4)*.21,
        Math.sin(angle)*(.31+theta*.13)],
       [.035+(i%3)*.012,.045+(i%3)*.009,.030],{glow:i%3===0,translucent:true});
   }
 }else if(v===1||v===3){
   const torso=g.group('torso');g.sphere(torso,'skin',[0,1.44,0],[.50,.48,.55]);
   const head=g.group('head',[0,1.48,.44]);
   g.sphere(head,'skin',[0,.16,.12],[.44,.41,.41]);
   g.eyes(head,.49,.14,.30,.063);
   for(let i=0;i<8;i++){
     const angle=i/8*Math.PI*2;
     const tentacle=g.group('tentacle'+i,[Math.cos(angle)*.3,1.16,Math.sin(angle)*.28]);
     const x=Math.cos(angle),z=Math.sin(angle);
     g.tube(tentacle,i%2?'light':'skin',[[0,0,0],[x*.32,-.31,z*.25],[x*.64,-.60,z*.51],
       [x*(.85+v*.05),-.52+(i%3)*.11,z*(.81+v*.04)]],.085+(v===3?.038:0));
     for(let j=0;j<5;j++)g.sphere(tentacle,'accent',[x*(.15+j*.09),-.22-j*.067,z*(.12+j*.08)],
       [.04,.025,.04]);
   }
   for(let i=0;i<7;i++)g.spike(head,'accent',[(i-3)*.10,.40,.0],[(i-3)*.13,.62+(i%3)*.10,-.06],.045);
 }else{
   quadruped(g,s,{reptile:true});
   const torso=g.pivots.torso;
   for(const side of [-1,1])for(let i=0;i<5;i++)
     g.fin(torso,'accent',[side*.34,1.35,-.48+i*.24],
       [side*(.43+i*.07),1.45,-.35+i*.29],.16);
   return g.root;
 }
 g.root.scale.setScalar(s.size*.86);
}
export function createMonsterModel(spec,{detail='high'}={}){
 if(!spec||!spec.family)throw Error('Invalid monster definition');
 const g=createSculpture(spec,detail);
 switch(spec.family){
   case 'beast':quadruped(g,spec);break;
   case 'feline':quadruped(g,spec,{feline:true});break;
   case 'reptile':quadruped(g,spec,{reptile:true});break;
   case 'avian':bird(g,spec);break;
   case 'insect':insect(g,spec);break;
   case 'arachnid':insect(g,spec,{spider:true});break;
   case 'undead':upright(g,spec,{undead:true});break;
   case 'golem':upright(g,spec,{rock:true});break;
   case 'fiend':upright(g,spec,{demon:true});break;
   case 'aquatic':aquatic(g,spec);break;
   default:throw Error('Unknown anatomy: '+spec.family);
 }
 g.root.userData.speciesId=spec.id;
 g.root.userData.pivots=g.pivots;
 g.root.userData.homeScale=g.root.scale.x;
 g.root.userData.surfaceFamily=spec.family;
 return g.root;
}
export {disposeMonsterSculpture};
