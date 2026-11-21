/**
 * 2026-11-21 concept-sheet replacements: purple armored spider, crystal-core
 * slime, and luminous abyssal octopus. Real jointed meshes for all LODs.
 * Keep the original ID, element, skill and gameplay data unchanged.
 */
export const CONCEPT_TRIO_REVISION='concept-trio-spider-slime-octopus-v1-20261121';
export const CONCEPT_TRIO_IDS=Object.freeze([
 'm026','m027','m028','m029','m030','m046','m047','m049'
]);
const spiderIds=new Set(CONCEPT_TRIO_IDS.slice(0,5));
const octopusIds=new Set(['m047','m049']);
const circle=Math.PI*2;
const detailRank=g=>g.root.userData.detail;
const density=(g,source,high,medium,low)=>{
 const d=detailRank(g);
 return d==='source'?source:d==='high'?high:d==='medium'?medium:low;
};
const eye=(g,parent,x,y,z,r,shade='accent')=>{
 g.sphere(parent,'shadow',[x,y,z-.018],[r*1.36,r*1.28,r*.62],
  {name:'recessed-eye-socket',rough:.65});
 g.sphere(parent,shade,[x,y,z],[r*.88,r*.86,r*.36],
  {name:'inset-faceted-eye',rough:.16,glow:true});
 g.sphere(parent,'bone',[x-r*.20,y+r*.19,z+r*.29],
  [r*.13,r*.12,r*.09],{name:'eye-specular',rough:.22});
};
function sculptArmoredSpider(g,s){
 const queen=s.id==='m030',factor=queen?1.17:1;
 const style=(s.id==='m028'?'frost':s.id==='m029'?'ember':
   s.id==='m027'||queen?'venom':'cave');
 const torso=g.group('torso');
 g.sphere(torso,'shadow',[0,1.16,-.05],[.47,.32,.53],
  {name:'thorax-underbody',rough:.62});
 g.axialLoft(torso,'skin',[
  {z:.53,y:1.22,rx:.13,ry:.12},
  {z:.38,y:1.24,rx:.35,ry:.26},
  {z:.00,y:1.23,rx:.46,ry:.33},
  {z:-.45,y:1.22,rx:.35,ry:.25},
  {z:-.62,y:1.20,rx:.14,ry:.12}
 ],{name:'armored-cephalothorax',rough:.38,ribbing:.02});
 const abdomen=g.group('abdomen',[0,1.30,-.67]);
 const size=queen?1.13:1;
 g.sphere(abdomen,'skin',[0,0,-.22],
  [.63*size,.51*size,.70*size],
  {name:'segmented-bulbous-abdomen',rough:.41,metal:.10});
 g.sphere(abdomen,'shadow',[0,-.20,-.21],
  [.55*size,.28*size,.59*size],
  {name:'abdomen-underside',rough:.68});
 // Overlapping dorsal plates make a layered carapace rather than a blank ball.
 const dorsalCount=density(g,11,9,7,5);
 for(let i=0;i<dorsalCount;i++){
  const t=i/(dorsalCount-1),z=.32-t*1.07;
  const rise=.34+.16*Math.sin(Math.PI*t);
  g.sphere(abdomen,i%3===0?'accent':'light',[0,rise,z],
   [.40*size*Math.sin(Math.PI*(.13+.72*t)),.052,.115],
   {name:'layered-abdomen-scutum',metal:.32,rough:.35});
  for(const side of [-1,1]){
   g.spike(abdomen,'skin',[side*.27,.36,z],
    [side*(.34+.04*(i%2)),.45+(i%3)*.025,z-.07],.046);
  }
 }
 // Elemental veins are actual shallow luminous surfaces, never a flat image.
 for(const side of [-1,1])for(let strip=0;strip<3;strip++){
  const x=side*(.21+strip*.11);
  g.tube(abdomen,style==='cave'?'light':'accent',[
   [x*.7,.36,-.71],[x,.42,-.42],[x*1.12,.48,-.15],
   [x*.8,.43,.16]],.009+(queen?.004:0),
   {name:'organic-energy-fissure',glow:style!=='cave',rough:.4});
 }
 const head=g.group('head',[0,1.23,.47]);
 g.sphere(head,'skin',[0,0,.17],[.37,.30,.37],
  {name:'armored-spider-face',metal:.28,rough:.40});
 g.sphere(head,'light',[0,.24,.16],[.34,.075,.37],
  {name:'overlapping-crown-plate',rough:.37,metal:.23});
 const count=density(g,8,8,8,8);
 for(let i=0;i<count;i++){
  const row=i<4?0:1,col=i%4;
  eye(g,head,(col-1.5)*(row?.105:.145),row?.18:.09,
      .47-(row?.11:0),row?.038:.048);
 }
 const jaws=g.group('jaw',[0,1.08,.82]);
 for(const side of [-1,1]){
  g.sphere(jaws,'skin',[side*.18,.05,.02],[.13,.15,.15],
   {name:'fang-root-gum',rough:.64});
  g.tube(jaws,'bone',[
   [side*.18,.06,.08],[side*.20,-.07,.30],
   [side*.15,-.25,.41],[side*.075,-.33,.36]
  ],.067,{name:'curved-venom-fang',taper:.10,capEnds:true,rough:.27});
  g.spike(jaws,'accent',[side*.19,-.13,.17],
   [side*.13,-.22,.30],.026);
 }
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const tag='leg'+(side<0?'L':'R')+i;
  const baseZ=.37-i*.30;
  const leg=g.group(tag,[side*.36,1.14,baseZ]);
  const knee=[side*(.65+i*.12),.29+(i%2)*.065,
      (1.45-i)*.21];
  const femur=g.group(tag+'Femur',[0,0,0],leg);
  g.tube(femur,'skin',[[0,0,0],
   [side*(.20+i*.04),.13,knee[2]*.43],knee],
    .105+(queen?.016:0),{name:'spider-coxa-femur',
      taper:.78,capEnds:true,rough:.38});
  g.sphere(femur,'light',[side*.08,.04,0],[.15,.11,.15],
    {name:'buried-coxa-hip',metal:.30,rough:.42});
  const patella=g.group(tag+'Patella',knee,femur);
  g.sphere(patella,'accent',[0,0,0],[.112,.112,.116],
    {name:'armored-knee-cap',metal:.28});
  const foot=[side*(.98+i*.16),-1.10,(1.5-i)*.28];
  const distal=[foot[0]-knee[0],foot[1]-knee[1],foot[2]-knee[2]];
  const tibia=g.group(tag+'Tibia',[0,0,0],patella);
  g.tube(tibia,'shadow',[[0,0,0],
     [distal[0]*.45,distal[1]*.38,distal[2]*.45],distal],
      .078,{name:'barbed-spider-tibia',taper:.46,capEnds:true,rough:.46});
  const tarsus=g.group(tag+'Tarsus',distal,tibia);
  g.sphere(tarsus,'shadow',[0,0,0],[.054,.059,.06],
      {name:'articulated-foot'});
  g.spike(tarsus,'bone',[0,0,0],[side*.035,-.15,.10],.044);
  const thorns=density(g,5,4,3,1);
  for(let j=1;j<=thorns;j++){
   const t=j/(thorns+1);
   const center=[distal[0]*t,distal[1]*t,distal[2]*t];
   g.spike(tibia,i%2?'accent':'light',center,
    [center[0]+side*.13,center[1]+.10,center[2]-.07],.030);
  }
 }
 g.root.scale.setScalar(s.size*.94*factor);
 g.root.userData.conceptArchetype='armored-spider';
 g.root.userData.anatomicalLegCount=8;
 g.root.userData.conceptElementStyle=style;
}
function sculptCrystalSlime(g,s){
 const torso=g.group('torso');
 const head=g.group('head',[0,.88,.16]);
 // Distinct gel layers, a deep light core and flattened skirt.
 g.sphere(torso,'skin',[0,.62,0],[.65,.59,.57],
  {name:'translucent-main-gel',rough:.12,translucent:true});
 g.sphere(torso,'light',[0,.27,.03],[.82,.19,.72],
  {name:'flowing-puddle-skirt',rough:.10,translucent:true});
 for(const side of [-1,1]){
  g.sphere(torso,'skin',[side*.39,.31,.16],[.30,.23,.36],
   {name:'fluid-side-lobe',rough:.10,translucent:true});
  g.tube(head,'light',[
   [side*.35,.15,.02],[side*.43,.40,0],
   [side*.50,.67,-.02],[side*.59,.82,.01]
  ],.15,{name:'transparent-gel-horn',taper:.09,capEnds:true,
   rough:.10});
  g.sphere(head,'shadow',[side*.19,.02,.44],[.155,.083,.054],
   {name:'gel-eyebrow-socket',rough:.18,translucent:true});
  g.sphere(head,'accent',[side*.19,.04,.48],[.092,.062,.022],
   {name:'slime-luminous-eye',rough:.11,glow:true});
 }
 // A nested core adds visible volume from every camera angle.
 g.sphere(torso,'accent',[0,.64,.12],[.24,.23,.22],
  {name:'slime-internal-core',glow:true,rough:.19});
 g.sphere(torso,'light',[0,.64,.19],[.14,.15,.11],
  {name:'slime-inner-vortex',glow:true,rough:.10});
 for(let i=0;i<density(g,16,12,9,5);i++){
  const a=i*2.39996,y=.36+(i%4)*.20,r=.32+(i%3)*.085;
  g.sphere(torso,i%4===0?'accent':'light',
   [Math.cos(a)*r,y,Math.sin(a)*r],
   [.028+(i%3)*.008,.03+(i%3)*.005,.027],
   {name:'suspended-internal-bubble',translucent:true,
    glow:i%4===0,rough:.13});
 }
 // Gemstone silhouette remains readable even when alpha sorting changes.
 for(const side of [-1,1])for(let j=0;j<2;j++){
  const x=side*(.43+j*.13),z=.31-j*.35;
  g.rock(torso,'accent',[x,.30+j*.20,z],
    [.115,.18,.095],{name:'gel-embedded-crystal',rough:.16,metal:.14});
 }
 g.root.scale.setScalar(s.size*.84);
 g.root.userData.conceptArchetype='translucent-core-slime';
 g.root.userData.anatomicalLegCount=0;
}
function sucker(g,parent,x,y,z,scale){
 g.sphere(parent,'light',[x,y,z],[.060*scale,.026*scale,.055*scale],
  {name:'sucker-fleshy-rim',rough:.31});
 g.sphere(parent,'shadow',[x,y-.012,z],[.030*scale,.015*scale,.029*scale],
  {name:'recessed-sucker-cavity',rough:.49});
}
function sculptAbyssalOctopus(g,s){
 const kraken=s.id==='m049';
 const factor=kraken?1.22:1;
 const torso=g.group('torso');
 g.sphere(torso,'shadow',[0,1.18,0],[.40,.29,.40],
  {name:'continuous-tentacle-crown',rough:.55});
 const head=g.group('head',[0,1.27,.12]);
 g.sphere(head,'skin',[0,.24,-.05],[.48,.49,.49],
  {name:'cephalopod-head',rough:.27});
 const mantle=g.group('mantle',[0,.50,-.18],head);
 g.sphere(mantle,'skin',[0,.15,-.19],[.57,.53,.68],
  {name:'bulbous-octopus-mantle',rough:.26,metal:.10});
 g.sphere(mantle,'light',[0,.48,-.22],[.40,.15,.47],
  {name:'overlapping-dorsal-mantle-armor',metal:.28,rough:.30});
 // Crown plating and bioluminescent filaments curve with the head rig.
 for(let side of [-1,1])for(let j=0;j<4;j++){
  const z=.17-j*.21;
  g.sphere(mantle,'skin',[side*(.26+j*.03),.41,z],
   [.15,.07,.19],{name:'sculpted-cephalic-plate',metal:.23,rough:.38});
  g.tube(mantle,'accent',[
   [side*.17,.60,z+.07],[side*.32,.54,z],
   [side*.44,.37,z-.11]],.012,
   {name:'bioluminescent-mantle-line',glow:true,rough:.22});
 }
 for(const side of [-1,1]){
  g.sphere(head,'shadow',[side*.29,.30,.32],[.18,.16,.11],
   {name:'deep-eye-orbit',rough:.47});
  g.sphere(head,'#edbe6f',[side*.30,.30,.41],[.105,.092,.057],
   {name:'predatory-golden-eye',glow:true,rough:.18});
  g.sphere(head,'shadow',[side*.30,.31,.459],[.026,.081,.017],
   {name:'vertical-cephalopod-pupil',rough:.25});
  g.sphere(head,'light',[side*.30,.43,.32],[.19,.042,.12],
   {name:'heavy-octopus-eye-brow'});
 }
 const jaw=g.group('jaw',[0,1.18,.39]);
 g.spike(jaw,'bone',[0,.04,.02],[0,-.21,.22],.16);
 g.spike(jaw,'shadow',[0,-.04,.12],[0,.12,.29],.13);
 const suckersPerStage=density(g,5,4,3,2);
 for(let i=0;i<8;i++){
  const a=(i+.50)/8*circle;
  const x=Math.sin(a),z=Math.cos(a),tag='tentacle'+i;
  const base=g.group(tag,[x*.26,1.13,z*.28]);
  const radius=(kraken?.155:.133)*(i%2===0?1.05:.95);
  g.sphere(base,'skin',[0,0,0],[radius*1.20,radius*1.12,radius*1.2],
   {name:'continuous-octopus-arm-root',rough:.27});
  const a1=[x*.42,-.25,z*.45];
  const mid=g.group(tag+'Mid',a1,base);
  const a2=[x*.49,-.23,z*.51];
  const tip=g.group(tag+'Tip',a2,mid);
  const a3=[x*.51,.14+(i%3)*.16,z*.53];
  const parts=[
   [base,a1,radius,.80],
   [mid,a2,radius*.80,.75],
   [tip,a3,radius*.60,.07]
  ];
  for(let k=0;k<parts.length;k++){
   const [pivot,end,width,taper]=parts[k];
   g.tube(pivot,'skin',[
    [0,0,0],[end[0]*.50,end[1]*.50+.05,end[2]*.50],end
   ],width,{name:'tapered-muscular-arm-'+i+'-'+k,
     taper,capEnds:true,rough:.26,metal:.05});
   if(k<2)g.sphere(pivot,'light',end,[width*.92,width*.90,width*.92],
    {name:'soft-arm-joint-cover',rough:.24});
   for(let j=0;j<suckersPerStage;j++){
    const t=(j+.55)/(suckersPerStage+.45);
    sucker(g,pivot,end[0]*t,-.04+end[1]*t,
      end[2]*t,width/.135*(1-t*.34));
   }
   if(detailRank(g)!=='low'){
    g.tube(pivot,'accent',[
      [0,width*.52,0],
      [end[0]*.52,end[1]*.52+width*.65,end[2]*.52],
      [end[0],end[1]+width*.22,end[2]]
    ],.012,{name:'organic-arm-bioluminescence',glow:true,rough:.28});
   }
  }
 }
 g.root.scale.setScalar(s.size*.80*factor);
 g.root.userData.conceptArchetype='bioluminescent-octopus';
 g.root.userData.anatomicalTentacleCount=8;
}
export function sculptConceptTrio(g,s){
 if(spiderIds.has(s.id))sculptArmoredSpider(g,s);
 else if(s.id==='m046')sculptCrystalSlime(g,s);
 else if(octopusIds.has(s.id))sculptAbyssalOctopus(g,s);
 else return false;
 g.root.userData.gameModelRevision=CONCEPT_TRIO_REVISION;
 g.root.userData.referenceArtworkDate='2026-11-21';
 return true;
}
