/**
 * Ten reusable anatomical families, fifty distinct sculptures. Beyond colour,
 * variants change horns, crests, armour, wings, limb lengths, weapons and fins.
 * Each specimen is real 3D geometry, never an image billboard.
 */
import * as THREE from 'three';
import {createSculpture,disposeMonsterSculpture} from './monster-shape-kit.js?v=m001-crown-motion-v17-20261117';
import {attachMonsterFaceControls} from './facial-feature-runtime.js?v=1';
import {generateCanineFurGuides,generateCanineAxialFurGuides} from './canine-fur-guides.js?v=beast-coat-20261116';
import {monsterEvidenceFor} from './monster-anatomy-reference.js';
import {felineMasterVariant,felineFaceRings,felineMuzzleRings,
 felineNasalRings,felineAnatomicalSections,felineEyeSurface,
 felineDorsalSurface,FELINE_SOURCE_MODEL}
 from './feline-master-variants.js?v=felid-source-20261117-v1';
import {MORTAL_HEAD_RINGS,MORTAL_TORSO_RINGS} from './monster-realistic-loft.js';
import {BEAST_REFERENCE_QUALITY_REVISION,REFERENCE_CROWN_QUALITY,
 referenceBeastTorsoStations,referenceDoubleCoat,referenceBeastFlow}
 from './beast-reference-quality.js?v=m001-donor-v1-20261117';
import {sculptBloodMoonVampire,sculptVampireHand} from './monster-vampire-sculpt.js';
/** Organic cranium sections shared by wolves, cats and reptiles.
 * The muzzle, eyelids and the animated jaw remain their existing species
 * parts. This skull is one continuous shaded volume instead of a sphere.
 */
const QUADRUPED_CRANIUM_RINGS=Object.freeze([
 {y:-.244,rx:.093,rz:.149,cz:.070},
 {y:-.187,rx:.215,rz:.287,cz:.058},
 {y:-.106,rx:.304,rz:.336,cz:.058},
 {y:.014,rx:.334,rz:.362,cz:.049},
 {y:.105,rx:.320,rz:.342,cz:.044},
 {y:.199,rx:.249,rz:.281,cz:.035},
 {y:.271,rx:.142,rz:.175,cz:.028},
 {y:.310,rx:.039,rz:.068,cz:.015},
]);
// m001's facial outline is the source of truth for both the physical skull
// and its hair follicles. Do not generate a disconnected spherical hair cap.
const M001_CRANIUM_RINGS=Object.freeze([
 {z:.355,y:-.160,rx:.026,ry:.030},
 {z:.335,y:-.140,rx:.057,ry:.051},
 {z:.310,y:-.113,rx:.094,ry:.073},
 {z:.270,y:-.040,rx:.171,ry:.121},
 {z:.215,y:-.009,rx:.205,ry:.145},
 {z:.155,y:.022,rx:.233,ry:.168},
 {z:.060,y:.051,rx:.268,ry:.190},
 {z:-.120,y:.056,rx:.289,ry:.199},
 {z:-.335,y:.025,rx:.243,ry:.176},
 {z:-.520,y:-.016,rx:.174,ry:.126},
 {z:-.635,y:-.032,rx:.050,ry:.062}
]);
const clamp01=v=>Math.max(0,Math.min(1,v));
const m001CheekContourX=(x,y,z)=>{
 const under=clamp01((.045-y)/.225);
 const forward=clamp01((z+.12)/.34);
 return x*(1-.315*under*forward);
};
function m001RingAtZ(z){
 for(let i=1;i<M001_CRANIUM_RINGS.length;i++){
  const a=M001_CRANIUM_RINGS[i-1],b=M001_CRANIUM_RINGS[i];
  if(z>=b.z||i===M001_CRANIUM_RINGS.length-1){
   const t=clamp01((a.z-z)/(a.z-b.z));
   return {z,y:a.y+(b.y-a.y)*t,
     rx:a.rx+(b.rx-a.rx)*t,ry:a.ry+(b.ry-a.ry)*t};
  }
 }
 return M001_CRANIUM_RINGS[0];
}
// Root every hair at the SAME tapered cranium surface used by the sculpt.
// Coordinates are converted from the small face pivot into the moving full
// head pivot, so the fur never hovers above the scalp when the face narrows.
function m001FittedFacialMane(faceCore,source){
 const guides=[];
 const add=(root,tip,normal,width,shade,crown)=>{
  // Midline has an S-shaped lift and cross-flow rather than a rigid
  // straight blade. Roots are always kept exactly on the skin surface.
  const ripple=Math.sin(root[0]*41+root[2]*29)*.008;
  const mid=root.map((v,k)=>v+(tip[k]-v)*(k===1?.44:.52)+
    (k===0?ripple:k===1?crown?.029:.010:.011));
  guides.push({root,mid,tip,normal,width,shade,
    m001ContourGuide:true,m001ContourCrown:!!crown});
 };
 const longitudinal=source?30:21,around=source?11:8;
 for(const side of [-1,1]){
  for(let i=0;i<longitudinal;i++){
   const z=.065+.168*(i+.5)/longitudinal;
   const ring=m001RingAtZ(z);
   for(let j=0;j<around;j++){
    const vertical=-.67+1.21*(j+.35)/around;
    const y=ring.y+ring.ry*vertical;
    const radius=Math.sqrt(1-vertical*vertical);
    const x=m001CheekContourX(side*ring.rx*radius,y,z);
    const headX=x*faceCore.scale.x;
    const headY=faceCore.position.y+y*faceCore.scale.y;
    const headZ=faceCore.position.z+z*faceCore.scale.z;
    // No roots or growing tips inside the recessed eye, nasal ridge or lips.
    // Double-coat offsets later shift follicles by up to 0.01 m.
    // Filter BEFORE doubling, with a padded no-follicle mask so not
    // even the edge of a strand roots over the eyes/nose/lips.
    if(headY>.073&&headY<.157&&headZ>.160&&
       Math.abs(headX)<.143)continue;
    if(headZ>.185&&headY>-.153&&headY<.175&&
       Math.abs(headX)<.126)continue;
    if(Math.abs(headX)<.102)continue;
    const root=[headX+side*.006,headY,headZ+.005];
    const longHair=vertical<-.12;
    const length=(longHair?.192:.115)*(1+.10*((i*7+j*3)%5)/5);
    const eyeBand=headY>.066&&headY<.158;
    const tipX=side*Math.max(eyeBand?.139:.111,
      Math.abs(root[0])-(eyeBand?.004:.019));
    const tip=[tipX,root[1]-length*(longHair?.76:.47),
      root[2]+length*.34];
    add(root,tip,[side*.92,vertical*.20,.32],
      longHair?.009:.007,
      (i+j)%9===0?'light':(i+j)%7===0?'shadow':'skin',false);
   }
  }
 }
 // Slicked-back (オールバック) natural coat: densely fill the ENTIRE
 // cranial crown with short undercoat and long, rearward-combed guard
 // hairs. Source sculpt gets a third intermediate row-offset layer;
 // playable high still uses only two layers in the SAME three batches.
 // Roots share the real skull loft (no unsupported floating wig cap).
 const crownRows=source?72:53,crownCols=source?20:17;
 const crownLayers=source?3:2;
 for(let layer=0;layer<crownLayers;layer++)for(let i=0;i<crownRows;i++){
  const z=-.405+.590*(i+.40+layer*.27)/crownRows;
  const ring=m001RingAtZ(z);
  const front=clamp01((z+.045)/.23);
  for(let j=0;j<crownCols;j++){
   const u=-.94+1.88*(j+.46+(i%2)*.19+layer*.24)/crownCols;
   if(Math.abs(u)>.96)continue;
   const originalX=ring.rx*u;
   const originalY=ring.y+ring.ry*Math.sqrt(1-u*u);
   const root=[
     originalX*faceCore.scale.x,
     faceCore.position.y+originalY*faceCore.scale.y+.004+layer*.002,
     faceCore.position.z+z*faceCore.scale.z+.004
   ];
   // Eye and nasal bridge remain bare, including the doubled-ribbon
   // tangent offset. Adjacent crown hair flows over the brow, never
   // roots directly on the cornea or muzzle.
   if(root[2]>.182&&Math.abs(root[0])<.139&&root[1]<.182)
     continue;
   const undercoat=layer===0;
   const len=(undercoat?.148:layer===2?.207:.242)+
     (1-front)*(undercoat?.015:.026)+
     .009*Math.sin(i*.91+j*1.3);
   // Negative Z is toward the occiput: even forehead fibres sweep BACK,
   // not across the eyes. Short fibres seal the scalp, long ones provide
   // a layered flowing silhouette. Crown midpoints lift off the skin
   // before tips settle toward the rear, not straight vertical spikes.
   const sweptZ=-len*(undercoat?.52:.79);
   const tip=[
     root[0]+Math.sign(u)*(.003+.014*(1-front)),
     root[1]+(undercoat?.035:.066)*len-(1-front)*len*.12,
     root[2]+sweptZ
   ];
   add(root,tip,[u,.90,-.24],undercoat?.0075:.0105,
     (i+j+layer)%11===0?'light':
       (i+j+layer)%7===0?'shadow':'skin',true);
  }
 }
 return guides;
}
// Quality rollout wave 1: m002 flame wolf, m003 ice Fenrir and m004
// thunder wolf. Roots follow the SAME upper skull elliptical sections
// as the existing non-m001 anatomical loft. Never reuse a lion mane or
// m001's tiny face scale for these species. Low LOD stays untouched.
const CANINE_GROOM_WAVE_ONE=Object.freeze(['m002','m003','m004']);
function fittedWolfFamilyCrown(spec,source){
 if(!CANINE_GROOM_WAVE_ONE.includes(spec.id))return [];
 const guides=[],winter=spec.id==='m003';
 const rows=source?35:24,around=source?46:32;
 for(let layer=0;layer<2;layer++){
  for(let i=0;i<rows;i++){
   const y=.195+.099*(i+.30+layer*.28)/rows;
   let a=QUADRUPED_CRANIUM_RINGS[0],b=QUADRUPED_CRANIUM_RINGS.at(-1);
   for(let k=1;k<QUADRUPED_CRANIUM_RINGS.length;k++){
    if(QUADRUPED_CRANIUM_RINGS[k].y>=y){
     a=QUADRUPED_CRANIUM_RINGS[k-1];
     b=QUADRUPED_CRANIUM_RINGS[k];break;
    }
   }
   const t=clamp01((y-a.y)/Math.max(.0001,b.y-a.y));
   const rx=a.rx+(b.rx-a.rx)*t;
   const rz=a.rz+(b.rz-a.rz)*t;
   const centerZ=a.cz+(b.cz-a.cz)*t;
   for(let j=0;j<around;j++){
    const theta=Math.PI*2*(j+.36+(i%2)*.41+layer*.24)/around;
    const x=rx*Math.cos(theta),z=centerZ+rz*Math.sin(theta);
    // Leave the front orbital aperture exposed; this new crown
    // begins ABOVE the eyes and follows the occipital hair stream.
    if(z>.19&&y<.227&&Math.abs(x)<.171)continue;
    const length=(layer===0?.078:winter?.190:.141)*
      (1+.10*Math.sin(i*.59+j*.47));
    const root=[x*.997,y,z*.997+centerZ*.003];
    const tip=[x+Math.sign(x)*.012,y+length*.11,
      z-length*(layer===0?.55:.80)];
    const mid=[
      root[0]+(tip[0]-root[0])*.49+
        .007*Math.sin(i*.7+j*.9),
      y+length*.12,
      z+(tip[2]-z)*.45
    ];
    guides.push({root,mid,tip,
      normal:[Math.cos(theta),.62,Math.sin(theta)],
      width:layer===0?.008:.011,
      shade:(i+j+layer)%11===0?'light':
        (i+j+layer)%7===0?'shadow':'skin',
      qualityWave:'m001-cranium-anchored-groom',
      speciesId:spec.id});
   }
  }
 }
 return guides;
}
// Cat undercoat and guard hair grow from the actual feline skull loft.
// m007, m008, m009 and m010 share the same base surface and diverge
// through proportional morphs rather than wolf-mane copy/paste.
function fittedFelineMasterHair(profile,source){
 // m001's 53x17x2 / 72x20x3 coat LOD is the source of truth.
 // Only CAT morphology is subtracted: short sleek hair for leopard/tiger,
 // thick attached ruff for lion, and jaw/eye/muzzle clearance masks.
 const quality=REFERENCE_CROWN_QUALITY[source?'source':'high'];
 const out=[],rows=quality.rows,around=quality.columns;
 for(let layer=0;layer<quality.layers;layer++)
  for(let i=0;i<rows;i++){
   const y=-.202+.492*(i+.42+layer*.19)/rows;
   const rings=QUADRUPED_CRANIUM_RINGS;
   let a=rings[0],b=rings[rings.length-1];
   for(let k=1;k<rings.length;k++)if(rings[k].y>=y){
     a=rings[k-1];b=rings[k];break;
   }
   const t=clamp01((y-a.y)/Math.max(1e-4,b.y-a.y));
   const rx=(a.rx+(b.rx-a.rx)*t)*profile.headWidth*
     (y<-.085?profile.cheekTaper:1);
   const rz=(a.rz+(b.rz-a.rz)*t)*profile.headDepth;
   const cz=a.cz+(b.cz-a.cz)*t+.002;
   for(let j=0;j<around;j++){
     const angle=2*Math.PI*(j+.30+(i%2)*.4+layer*.27)/around;
     const ux=Math.cos(angle),uz=Math.sin(angle);
     const x=rx*ux,z=cz+rz*uz;
     // Protective open space around eye and nasal bridge.
     const eyeRegion=y>.050&&y<.165&&z>.16&&
       Math.abs(Math.abs(x)-profile.eyeX)<.062;
     if(eyeRegion||(z>.12&&Math.abs(x)<.205&&y<.17))
       continue;
     const lion=profile.maneLength>0,cheek=z>-.12&&y<.06;
     const undercoat=layer===0;
     const baseLength=lion?
       (cheek?profile.maneLength:profile.guardHair):
       (cheek?profile.guardHair*.90:
         Math.max(profile.underHair,.032));
     const length=(undercoat?baseLength*.67:baseLength*1.28)*
       (.90+.12*Math.sin(i*.51+j*.83));
     const root=[x,y,z],back=lion&&cheek?.19:.79;
     const tip=[x+Math.sign(x)*length*.07,
       y-length*(lion&&cheek?.68:.14),
       z-length*back];
     const mid=[
       x+(tip[0]-x)*.47+.004*Math.sin(i+j+layer),
       y+(tip[1]-y)*.40+(lion?.019:.011),
       z+(tip[2]-z)*.46
     ];
     out.push({root,mid,tip,normal:[ux,.20,uz],
       width:lion?(undercoat?.0075:.012):.0068,
       shade:(i+j+layer)%13===0?'light':
         (i+j+layer)%9===0?'shadow':'skin',
       catMaster:FELINE_SOURCE_MODEL,
       m001QualityCoat:true,
       m001ReferenceLayer:layer});
   }
 }
 return out;
}
function feet(g,pivot,x,y,z,clawed=true,scale=1){
 g.sphere(pivot,'skin',[0,-.28,0],[.14*scale,.30*scale,.15*scale]);
 g.sphere(pivot,'shadow',[0,-.53,.13],[.13*scale,.08*scale,.22*scale]);
 if(clawed)g.claws(pivot,[0,-.56,.22],1,3,.78*scale);
}
function quadruped(g,s,{feline=false,reptile=false}={}){
 const v=s.variant,k=s.size;
 const canine=!feline&&!reptile;
 const felineMaster=feline?felineMasterVariant(s.id):null;
 const beastRemesh=canine&&s.id!=='m005'; // PR #345 protected

 const coatDetail=g.root.userData.detail;
 // This is the SAME two-layer offset/midpoint hair authoring used on m001.
 // Cats and wolves inherit the reference fidelity, not the wolf's face
 // proportions. Low-LOD crowds bypass the extra geometry entirely.
 const wolfKingDoubleCoat=s.id==='m001'&&coatDetail!=='low';
 const referenceDualCoat=coatDetail!=='low'&&
   (wolfKingDoubleCoat||!!felineMaster||
    CANINE_GROOM_WAVE_ONE.includes(s.id));
 const doubleFurGuides=guides=>
   referenceDualCoat?referenceDoubleCoat(guides):guides;
 if(wolfKingDoubleCoat)g.root.userData.wolfKingFurDensityMultiplier=2;
 if(felineMaster&&coatDetail!=='low'){
   g.root.userData.felineReferenceFurDensityMultiplier=2;
   g.root.userData.felineQualityInheritedFrom='m001';
   g.root.userData.referenceQualityRevision=BEAST_REFERENCE_QUALITY_REVISION;
 }
 const m001Flow=guides=>
   (s.id==='m001'||felineMaster)?
     referenceBeastFlow(guides):guides;
 const addFur=(parent,guides)=>{
   // Material groups are batched: three draw calls instead of hundreds of
   // individual cones. The original fur photo/normal maps remain intact.
   for(const shade of ['skin','light','shadow']){
     const strands=guides.filter(a=>a.shade===shade);
     if(strands.length)g.fur(parent,shade,doubleFurGuides(strands));
   }
 };
 const torso=g.group('torso');
 if(s.id==='m004'){
   // Grey wolf gallop: independent lumbar and pelvic segments allow hind
   // limbs and tail to flex with the axial spine. Keep only this animal's
   // hind limbs parented to the pelvis; all other species retain old rigs.
   const lumbar=g.group('lumbar',[0,1.15,-.36],torso);
   g.bridge(lumbar,'skin',[0,.020,.30],[0,-.020,-.29],.295,.245);
   for(const side of [-1,1]){
     g.sphere(lumbar,'skin',[side*.235,.038,-.03],
       [.088,.155,.271],{name:'m004-erector-spinae'});
     g.tube(lumbar,'light',[[side*.14,.172,.22],
       [side*.18,.183,-.05],[side*.14,.115,-.25]],.023);
   }
   const pelvis=g.group('pelvis',[0,-.06,-.16],lumbar);
   g.sphere(pelvis,'skin',[0,0,-.005],[.31,.285,.318],
     {name:'m004-pelvis-croup'});
   // Forequarter fascia moves independently of the spine as the leading
   // forelimb braces and the neck counterbalances the moving hips.
   for(const side of [-1,1]){
     const shoulder=g.group('scapula'+(side<0?'L':'R'),
       [side*.33,1.29,.36],torso);
     g.bridge(shoulder,'skin',[0,-.165,-.13],
       [side*.035,.160,.10],.144,.079);
     g.sphere(shoulder,'light',[0,.025,-.025],
       [.113,.184,.173],{name:'m004-scapular-shoulder'});
   }
   const neck=g.group('neckCollar',[0,1.30,.49],torso);
   for(const side of [-1,1]){
     g.bridge(neck,'skin',[side*.197,-.075,-.11],
       [side*.165,.125,.24],.099,.065);
     g.sphere(neck,'light',[side*.181,.019,.092],
       [.090,.137,.222],{name:'m004-cervical-muscle'});
   }
 }
 if(s.id==='m003'){
   // Ice Fenrir: independently moving shoulder mantle; thick winter neck
   // guard hair is a solid layered silhouette even at distant LOD.
   for(const side of [-1,1]){
     const scapula=g.group('scapula'+(side<0?'L':'R'),
       [side*.332,1.33,.30],torso);
     g.bridge(scapula,'skin',[0,-.12,-.17],
       [side*.045,.17,.13],.145,.098);
     g.sphere(scapula,'light',[side*.023,.055,-.015],
       [.103,.177,.191],{name:'m003-scapular-mantle'});
     for(let i=0;i<4;i++)
       g.spike(scapula,i%2?'light':'skin',
         [side*(.065+i*.016),.106-i*.065,-.11],
         [side*(.13+i*.018),.07-i*.088,-.25],.047);
   }
   for(const side of [-1,1]){
     const ruff=g.group('ruff'+(side<0?'L':'R'),
       [side*.21,1.42,.50],torso);
     g.bridge(ruff,'skin',[0,-.05,-.10],
       [side*.05,-.19,.26],.145,.105);
     for(let i=0;i<7;i++)
       g.spike(ruff,i%2?'light':'skin',
         [side*(.07+i*.007),.07-i*.035,-.10+i*.045],
         [side*(.12+i*.014),-.12-i*.046,-.17+i*.040],.035);
   }
 }
 if(s.id==='m002'){
   // Flame wolf: the shoulder blade bulge rides a real separate pivot with
   // the proximal forelimb, rather than a stationary textured oval.
   for(const side of [-1,1]){
     const scapula=g.group('scapula'+(side<0?'L':'R'),
       [side*.335,1.30,.25],torso);
     g.bridge(scapula,'skin',[0,-.14,-.13],
       [side*.027,.155,.19],.126,.075);
     g.sphere(scapula,'light',[side*.018,.066,-.010],
       [.072,.145,.165],{name:'m002-scapular-muscle'});
   }
 }
 // Individual shoulder, ribcage and pelvis stations replace a rescaled ball.
 // The moving limb pivots and species-specific head/coat are unchanged.
 const bodyWidth=felineMaster?felineMaster.torsoWidth:.43+(v%2)*.06;
 const bodyLength=felineMaster?felineMaster.torsoLength:.72+v*.06;
 // Nose is +Z. Reference-matched wolf: broad dropped forequarter,
 // narrow lifted waist and tapered croup instead of a cylindrical trunk.
 // Both torso source geometry and the coat below use these SAME sections.
 const bodyStations=felineMaster?felineAnatomicalSections(felineMaster):
  beastRemesh?referenceBeastTorsoStations({
   width:bodyWidth,length:bodyLength,centerY:1.15,shape:'wolf'
  }):[
  {z:bodyLength*.96,y:1.34,rx:.12,ry:.17},
  {z:bodyLength*.71,y:1.32,rx:bodyWidth*.84,ry:.365},
  {z:bodyLength*.25,y:1.30,rx:bodyWidth*1.04,ry:.430},
  {z:-bodyLength*.36,y:1.29,rx:bodyWidth*.94,ry:.400},
  {z:-bodyLength*.83,y:1.28,rx:bodyWidth*.52,ry:.29},
  {z:-bodyLength*1.03,y:1.27,rx:.10,ry:.13}
 ];
 if(s.id==='m005'||s.id==='m006')
  g.sphere(torso,'skin',[0,1.30,0],[bodyWidth,.43,bodyLength]);
 else g.axialLoft(torso,'skin',bodyStations,
  {name:'species-shoulder-rib-pelvis-'+s.id,
   rough:reptile?.64:.85,ribbing:reptile?.025:.012});
 if(beastRemesh){
  g.bridge(torso,'skin',[0,1.152,.23],[0,1.305,.69],.304,.173);
  for(const side of [-1,1])
   g.bridge(torso,'skin',[side*.24,1.158,.18],[side*.175,1.302,.56],.116,.069);
  if(s.id==='m001'&&coatDetail!=='low'){
    // Buried scapular musculature joins the wolf king's thick forelimbs
    // to its chest; no exposed shoulder button or distant-LOD draw call.
    for(const side of [-1,1]){
      const blade=g.bridge(torso,'skin',
        [side*.343,1.058,.329],[side*.270,1.334,.518],.154,.093);
      blade.name='m001-scapular-muscle-'+(side<0?'L':'R');
      blade.userData.buriedScapula=true;
      // The coxal-to-thigh fascia belongs to the torso/pelvis, not to
      // the swinging leg. It overlaps the femoral head under the fur
      // throughout walking, so no empty wedge opens at the hip.
      const hip=g.bridge(torso,'skin',
        [side*.267,1.151,-.355],[side*.313,.968,-.526],.160,.125);
      hip.name='m001-hip-fascia-'+(side<0?'L':'R');
      hip.userData.hipSocketSeal=true;
    }
  }
 }else if(felineMaster){
   // m001 buries the scapula/hip fascia beneath its anatomical torso.
   // Transfer that join construction, with the feline bone proportions:
   // remove the previous oversized "one-ball" shoulder altogether.
   if(coatDetail!=='low')for(const side of [-1,1]){
    const x=side*felineMaster.torsoWidth*.86;
    const scapula=g.bridge(torso,'skin',
      [x,1.13,.30],[x*.84,1.36,.49],.125,.073);
    scapula.name='feline-reference-scapula-'+(side<0?'L':'R');
    scapula.userData.m001ReferenceSeam=true;
    const hip=g.bridge(torso,'skin',
      [x*.82,1.18,-.35],[x,1.02,-.56],.121,.090);
    hip.name='feline-reference-hip-fascia-'+(side<0?'L':'R');
    hip.userData.m001ReferenceSeam=true;
   }
 }else g.sphere(torso,'light',[0,1.48,.22],[.31,.25,.45]);
 // Preserve the original m001 neck seam and subtract its thick wolf
 // throat for cats, instead of welding a spherical lion muzzle on top.
 if(beastRemesh)
  g.bridge(torso,'skin',[0,1.152,.33],[0,1.307,.77+v*.055],.295,.181);
 else if(felineMaster)
  g.bridge(torso,'skin',[0,1.29,.32],[0,1.55,.74+v*.055],.246,.158);
 else g.bridge(torso,'skin',[0,1.35,.32],[0,1.57,.76+v*.055],.325,.215);
 const head=g.group('head',[0,beastRemesh?1.300:1.56,.70+v*.06+(beastRemesh?.086:0)]);
 // The earlier 1/3-scale inner "ball face" floated in front of the muzzle.
 // The new compact anatomical skull is a surface loft with directly fitted
 // eye sockets. Nose, jaw and the moving mane retain independent pivots.
 const faceCore=s.id==='m001'?
   g.group('m001-face-core',[0,.025,.055],head):head;
 if(s.id==='m001'){
   // Keep the skull, nose and jaw on the same forward centerline, but
   // gather the exposed facial mask between the inward-draping cheek ruffs.
   // Only lateral width contracts: existing orbit depth/jaw articulation
   // and the full-size nose are unchanged.
   // The reference has a narrow, centered wolf mask nested *inside*
   // the dense mane: scale facial bone/eyes together but NOT the
   // separately articulated jaw, lips, and nose.
   faceCore.scale.set(.64,.79,.82);
   faceCore.userData.anatomicalFaceScale=.79;
   faceCore.userData.m001CenteredFaceWidthScale=.64;
   g.root.userData.wolfKingExposedFaceScale=.64;
   g.root.userData.wolfKingManeLengthMultiplier=1.2;
   g.root.userData.m001CrownSweepDirection='backward';
   g.root.userData.m001CrownLongHairBase=.242;
   g.root.userData.m001NoseWidthScale=.80;
   g.root.userData.wolfKingReferenceRemesh=true;
 }
 // Rigid reptilian wedge instead of the same spherical skull as a cat.
 const skullWidth=reptile?.905:feline?.95:1;
 const skullDepth=reptile?1.065:feline?.965:1;
 const cranium=s.id==='m001'?
   g.axialLoft(faceCore,'skin',M001_CRANIUM_RINGS,
     {name:'organic-cranium-m001',rough:.91,ribbing:.003,faceSculpt:true}):
   g.anatomicalLoft(faceCore,'skin',
     felineMaster?felineFaceRings(felineMaster,QUADRUPED_CRANIUM_RINGS):
     QUADRUPED_CRANIUM_RINGS.map(r=>({
       ...r,rx:r.rx*skullWidth,rz:r.rz*skullDepth,
     })),{name:'organic-cranium-'+s.id,kind:'face',
       asymmetry:reptile?.10:.04});
 if(s.id==='m001'){
   cranium.userData.anatomyLoft=true;
   cranium.userData.continuousWolfSkull=true;
   // Shape the exposed lower cheeks into a wolf's inverted triangle.
   // Keep upper orbital width but narrow the lower, forward cheek surface;
   // the mane will fill this negative space without another face sphere.
   const faceVertices=cranium.geometry.getAttribute('position');
   for(let i=0;i<faceVertices.count;i++){
     const x=faceVertices.getX(i),y=faceVertices.getY(i),
       z=faceVertices.getZ(i);
     faceVertices.setX(i,m001CheekContourX(x,y,z));
   }
   faceVertices.needsUpdate=true;
   cranium.geometry.computeVertexNormals();
   cranium.geometry.computeBoundingSphere();
   cranium.userData.invertedTriangleWolfMask=true;
   g.recessCanineEyeSockets(cranium,{centerX:.128});
 }
 if(s.id==='m001'&&coatDetail==='low'){
   // In massive battles use one coarse sculpted ruff silhouette instead of
   // tens of thousands of guard hairs. It frames the same tiny face with
   // zero expensive coat blades or additional skinned draw calls.
   g.axialLoft(head,'skin',[
     {z:.27,y:.12,rx:.160,ry:.181},
     {z:.08,y:.035,rx:.342,ry:.355},
     {z:-.22,y:-.092,rx:.423,ry:.459},
     {z:-.55,y:-.168,rx:.309,ry:.367},
     {z:-.78,y:-.215,rx:.115,ry:.135},
   ],{name:'m001-low-mane-silhouette',rough:.97,ribbing:.036});
 }
 if(reptile){
   g.bridge(head,'skin',[0,.045,-.19],[0,-.085,.55],.257,.128);
 }else if(felineMaster){
   g.bridge(head,'skin',[0,-.035,.082],
     [0,-.114,felineMaster.muzzleFront+.015],
     .151*felineMaster.cheekTaper,.091);
 }else if(feline){
   g.bridge(head,'skin',[0,-.028,.10],[0,-.12,.36],.209,.131);
 }
 if(canine&&!beastRemesh){
   // Legacy protected m005: preserve its original muzzle topology.
   g.bridge(head,'skin',[0,-.02,.13],[0,-.10,.54],.245,.125);
 }
 const muzzle=s.id==='m001'?.16:beastRemesh?.34:reptile?.57:
   felineMaster?felineMaster.muzzleFront:feline?.32:.43;
 if(reptile){
   g.bridge(head,'skin',[0,-.115,.245],[0,-.152,.82],.203,.116);
   g.sphere(head,'light',[0,-.162,.684],[.145,.064,.226]);
 }else if(beastRemesh){
   // Skull -> brow -> bridge -> nose is one authored continuous axial shell,
   // not two intersecting cylindrical tubes and a separate muzzle oval.
   const muzzleRings=s.id==='m001'?[
     // The original protrusion (.597) is reduced to a short bridge (.382).
     // The rear section overlaps the sculpted face, without a white tube.
     // The bridge's visible end must tuck BEHIND the wet nose rather than
     // appearing as a separate grey circular button above the nostrils.
     {z:.315,y:-.133,rx:.014,ry:.015},
     {z:.300,y:-.130,rx:.039,ry:.033},
     {z:.281,y:-.120,rx:.057,ry:.049},
     {z:.255,y:-.101,rx:.073,ry:.060},
     {z:.215,y:-.075,rx:.089,ry:.073},
     {z:.165,y:-.032,rx:.107,ry:.091},
     {z:.115,y:-.019,rx:.127,ry:.110}
   ]:[
     {z:.664,y:-.134,rx:.078,ry:.069},
     {z:.635,y:-.125,rx:.154,ry:.092},
     {z:.532,y:-.110,rx:.172,ry:.112},
     {z:.406,y:-.078,rx:.196,ry:.128},
     {z:.283,y:-.045,rx:.232,ry:.152},
     {z:.125,y:-.024,rx:.237,ry:.183}
   ];
   g.axialLoft(head,'light',muzzleRings,
     {name:'beast-continuous-nasal-bridge-'+s.id,rough:.72,ribbing:.002});
 }else if(felineMaster){
   g.axialLoft(head,'light',felineMuzzleRings(felineMaster),
     {name:'feline-master-short-muzzle-'+s.id,rough:.77,ribbing:.002});
 }else g.sphere(head,'light',[0,-.13,muzzle],
   feline?[.204,.126,.259]:[.23,.15,.31]);
 if(beastRemesh){
   // Anatomically tapered rhinarium; alae overlap the bridge and have
   // distinct cut-in nostrils, rather than an inflated black nose sphere.
   const noseRings=s.id==='m001'?[
     // All rhinarium rings share the short muzzle's vertical midline.
     // Overlap the grey bridge tip so a detached lower black button
     // cannot render beneath an exposed circular grey end-cap.
     // Compact wet nose on the existing narrow nasal bridge:
     // 18–20% less lateral volume, ~10% less vertical bulge and a
     // shorter rear projection, without exposing the grey bridge tip.
     {z:.366,y:-.131,rx:.011,ry:.013},
     {z:.358,y:-.130,rx:.034,ry:.031},
     {z:.347,y:-.130,rx:.045,ry:.038},
     {z:.324,y:-.131,rx:.044,ry:.036},
     {z:.298,y:-.131,rx:.030,ry:.025}
   ]:[
     {z:.706,y:-.161,rx:.027,ry:.029},
     {z:.685,y:-.158,rx:.104,ry:.060},
     {z:.657,y:-.165,rx:.145,ry:.074},
     {z:.594,y:-.156,rx:.139,ry:.067},
     {z:.551,y:-.147,rx:.090,ry:.046}
   ];
   g.axialLoft(head,'shadow',noseRings,
     {name:s.id==='m001'?'wolf-nasal-cartilage':
       s.id==='m002'?'m002-rhinarium':'beast-rhinarium-'+s.id,
      rough:.31,ribbing:0});
   for(const side of [-1,1]){
     const tight=s.id==='m001';
     g.bridge(head,'shadow',
       [side*(tight?.030:.094),tight?-.130:-.143,tight?.301:.605],
       [side*(tight?.035:.110),tight?-.139:-.166,tight?.351:.662],
       tight?.009:.028,tight?.007:.015);
     g.sphere(head,'shadow',
       [side*(tight?.035:.108),tight?-.137:-.182,tight?.358:.681],
       tight?[.0058,.0045,.0035]:[.014,.010,.008],
       {name:'beast-nostril-'+(side<0?'L':'R'),rough:.21});
   }
 }else if(felineMaster){
   g.axialLoft(head,'shadow',felineNasalRings(felineMaster),
     {name:'feline-master-rhinarium-'+s.id,rough:.31,ribbing:0});
   for(const side of [-1,1]){
     const x=side*felineMaster.noseWidth*.45;
     g.sphere(head,'shadow',[x,-.162,muzzle+.129],
       [.008,.006,.009],{name:'feline-master-nostril-'+(side<0?'L':'R')});
   }
 }else g.sphere(head,'shadow',[0,-.17,muzzle+.19],[.18,.057,.12],{name:'nose'});
 if(canine){
   // Small almond eyes set INTO the bone, heavy brows, wet nose and
   // divided nostrils. Oversized glowing button eyes looked like toys.
   for(const side of [-1,1]){
     if(s.id==='m001'&&beastRemesh){
      // Apply the generator's key idea: a sunken socket and optical almond
      // fitted BEHIND the upper eyelid. This is a mesh aperture rather than
      // spherical eyes mounted on the forehead/cheeks.
      g.recessedCanineAlmondEye(faceCore,{side,name:'wolf-king',centerX:.128});
      // Keep only a shallow, fitted skin crease. The former elevated
      // brow tube projected past both canthi like a thick eyeliner wing.
      const brow=g.tube(faceCore,'skin',[
        [side*.073,.137,.160],[side*.113,.145,.182],
        [side*.157,.133,.166]],.0035);
      brow.name='m001-eyebrow-ridge-'+(side<0?'L':'R');
      brow.userData.orbitalBrow=true;
     }else if(beastRemesh){
      // Real amber iris and a distinct black pupil, partially under the lids.
      // Larger visible limbus replaces the former pin-sized "eye dot".
      g.sphere(head,'shadow',[side*.288,.112,.266],[.032,.046,.074],
       {name:'beast-orbit'});
      g.sphere(head,'eye',[side*.319,.113,.278],[.0185,.047,.052],
       {name:'eye',rough:.17});
      g.sphere(head,'shadow',[side*.334,.110,.291],[.005,.023,.021],
       {name:'beast-pupil'});
      g.sphere(head,'bone',[side*.339,.130,.307],[.0019,.0045,.006],
       {name:'beast-corneal-glint',rough:.10});
      // Flattened upper lid and continuous lower lid contour the eyeball
      // without covering the iris or projecting a button-like eyeball.
      g.tube(head,'skin',[[side*.264,.153,.212],[side*.301,.162,.273],
        [side*.319,.151,.343]],.015);
      g.tube(head,'shadow',[[side*.266,.073,.214],[side*.315,.073,.280],
        [side*.320,.098,.345]],.010);
     }else{
      g.sphere(head,'shadow',[side*.300,.110,.30],[.023,.037,.078]);
      g.sphere(head,'eye',[side*.320,.112,.31],[.013,.018,.041],{rough:.17});
      g.sphere(head,'skin',[side*.297,.167,.29],[.047,.041,.096]);
     }
     if(!beastRemesh)g.sphere(head,'shadow',
       [side*.083,-.164,muzzle+.288],[.027,.019,.011]);
     if(s.id!=='m001')g.tube(head,'shadow',
       [[side*.08,-.23,.53],[side*.13,-.235,.58],
        [side*.16,-.213,.62]],.009);
   }
   // Compact philtrum following the small rhinarium instead of a black seam.
   g.tube(head,'shadow',s.id==='m001'?
      [[0,-.148,.325],[0,-.163,.308],[0,-.178,.284]]:
      [[0,-.195,muzzle+.285],[0,-.235,muzzle+.275],
       [0,-.26,muzzle+.22]],s.id==='m001'?.005:.009);
 }else if(reptile){
   // Narrow slit eyes, partially recessed into the cranium. The eyelids
   // are anatomical pivots for the original blink and death regressions.
   for(const side of [-1,1]){
     const suffix=side<0?'L':'R';
     g.sphere(head,'shadow',[side*.279,.095,.246],[.030,.033,.081],
       {name:'reptile-orbital-socket'});
     g.sphere(head,'eye',[side*.292,.098,.249],[.012,.020,.052],
       {rough:.38,name:'reptile-recessed-eye'});
     g.sphere(head,'skin',[side*.275,.151,.235],[.066,.025,.096],
       {name:'reptile-supraorbital-ridge'});
     g.sphere(head,'shadow',[side*.118,-.154,.819],[.025,.014,.028],
       {name:'reptile-nostril'});
     const lid=g.group('eyelid'+suffix,[side*.291,.172,.262],head);
     lid.userData.restY=lid.position.y;
     lid.userData.blinkTravel=.075;
     g.sphere(lid,'skin',[0,0,0],[.050,.024,.068],
       {name:'nictitating-membrane',rough:.87});
   }
 }else if(felineMaster){
   // The old m007-m010 irises were buried inside the actual elliptical
   // skull (z≈.19 while front skull surface is ≈.26). Follow the real
   // head loft, then angle the outer canthus up for a predatory cat gaze.
   // All three eye layers stay together for blink/action regression.
   for(const side of [-1,1]){
     const suffix=side<0?'L':'R',x=side*felineMaster.eyeX;
     const eyes=felineEyeSurface(felineMaster,QUADRUPED_CRANIUM_RINGS,
       {x,y:.104,clearance:.023});
     const z=eyes.z,halfWidth=.057;
     const inner=x-side*halfWidth,outer=x+side*halfWidth;
     const innerEdge=felineEyeSurface(felineMaster,QUADRUPED_CRANIUM_RINGS,
       {x:inner,y:.091,clearance:.021});
     const outerEdge=felineEyeSurface(felineMaster,QUADRUPED_CRANIUM_RINGS,
       {x:outer,y:.125,clearance:.021});
     // A rotated black almond opening, with narrow vertical exposed
     // sclera and tapered brow corners, not a round animal eye button.
     const aperture=g.sphere(head,'shadow',[x,.105,z],
       [.062,.023,.014],{name:'feline-master-orbit-'+suffix});
     aperture.rotation.z=side*.27;
     const iris=g.sphere(head,'eye',[x,.103,z+.014],
       [.021,.025,.011],{rough:.21,name:'feline-iris-'+suffix});
     iris.rotation.z=side*.21;
     const pupil=g.sphere(head,'shadow',[x,.103,z+.025],
       [.0058,.022,.006],{name:'feline-slit-pupil-'+suffix});
     pupil.rotation.z=side*.13;
     const brow=g.tube(head,'shadow',[
       [inner,.091,innerEdge.z],[x,.130,z+.018],
       [outer,.125,outerEdge.z]],.0075);
     brow.name='feline-sharp-upper-canthus-'+suffix;
     const lower=g.tube(head,'skin',[
       [inner,.087,innerEdge.z-.003],[x,.081,z+.017],
       [outer,.124,outerEdge.z-.002]],.008);
     lower.name='feline-tight-lower-lid-'+suffix;
     const lid=g.group('eyelid'+suffix,[x,.133,z+.013],head);
     lid.userData.restY=lid.position.y;
     lid.userData.blinkTravel=.039;
     const skin=g.sphere(lid,'skin',[0,0,0],
       [.058,.011,.017],{name:'feline-upper-eyelid-'+suffix});
     skin.rotation.z=side*.24;
     lid.userData.felineEyeSurfaceZ=eyes.surfaceZ;
     lid.userData.felineEyeApertureZ=z;
   }
 }else if(feline){
   // Preserve protected m006's original eye material/position.
   for(const side of [-1,1]){
     const suffix=side<0?'L':'R';
     g.sphere(head,'shadow',[side*.279,.103,.230],
       [.047,.042,.054],{name:'feline-orbital-rim-'+suffix});
     g.sphere(head,'eye',[side*.290,.103,.237],
       [.017,.029,.033],{rough:.31,name:'feline-iris-'+suffix});
     g.sphere(head,'shadow',[side*.306,.102,.247],
       [.005,.022,.008],{name:'feline-slit-pupil-'+suffix});
     g.sphere(head,'skin',[side*.274,.150,.213],
       [.067,.023,.088],{name:'feline-upper-eyelid-'+suffix});
   }
 }else{
   g.eyes(head,.335,.10,.195,.040);
 }
 for(const side of [-1,1]){
   const horn=v===2||reptile? .28:.12;
   if(canine){
     if(beastRemesh){
       const suffix=side<0?'L':'R';
       const ear=g.group('ear'+suffix,
         s.id==='m001'?[side*.223,.172,-.087]:[side*.215,.208,-.075],head);
       // m001's former long hollow fox pinnae read as thin horns.
       // Shorter broad cartilage makes a seated, real-wolf ear silhouette.
       g.foxPinna(ear,{
         side,height:s.id==='m001'?.342:s.id==='m003'?.465:.435,
         width:s.id==='m001'?.145:s.id==='m003'?.120:.112,
         spread:s.id==='m001'?.056:.090,
         name:'beast-fox-pinna-'+s.id+'-'+suffix
       });
       // Preserve dedicated cartilage identity used by species QA, but
       // eliminate their previous double cone silhouettes.
       if(s.id==='m004')
         g.sphere(ear,'light',[0,.027,.010],[.074,.047,.055],
           {name:'m004-ear-cartilage'});
       else if(s.id==='m003')
         g.sphere(ear,'light',[0,.024,.012],[.073,.044,.058],
           {name:'m003-pinna-cartilage'});
       else if(s.id==='m002')
         g.sphere(ear,'skin',[0,.021,.012],[.088,.051,.070],
           {name:'m002-ear-cartilage-base'});
       else if(s.id==='m001')g.sphere(ear,'skin',
         [0,.019,.012],[.093,.060,.068],
         {name:'m001-pinna-root-cartilage'});
       else g.sphere(ear,'light',[0,.024,.024],[.066,.039,.050]);
     }else if(s.id==='m004'){
       const ear=g.group('ear'+(side<0?'L':'R'),
         [side*.215,.208,-.075],head);
       g.spike(ear,'skin',[0,0,0],
         [side*.082,.36,-.035],.095);
       g.spike(ear,'shadow',[side*.018,.054,.064],
         [side*.064,.294,.032],.053);
       g.sphere(ear,'light',[0,.025,.050],[.074,.053,.060],
         {name:'m004-ear-cartilage'});
     }else if(s.id==='m003'){
       const ear=g.group('ear'+(side<0?'L':'R'),
         [side*.22,.21,-.075],head);
       g.spike(ear,'skin',[0,0,0],
         [side*.095,.405,-.034],.107);
       g.spike(ear,'shadow',[side*.019,.046,.061],
         [side*.082,.35,.027],.063);
       g.sphere(ear,'light',[0,.018,.037],[.080,.053,.066],
         {name:'m003-pinna-cartilage'});
     }else if(s.id==='m002'){
       // Independent, cartilage-supported ears: paired pinnae now follow
       // sound, lunge anticipation and rearward flattening independently.
       const ear=g.group('ear'+(side<0?'L':'R'),
         [side*.218,.213,-.076],head);
       g.spike(ear,'skin',[0,0,0],
         [side*.079,.359,-.025],.100);
       g.spike(ear,'shadow',[side*.018,.052,.056],
         [side*.069,.310,.014],.054);
       g.tube(ear,'light',[[side*.022,.018,.062],
         [side*.055,.147,.058],[side*.067,.262,.025]],.015);
       g.sphere(ear,'skin',[0,.023,.014],[.105,.065,.087],
         {name:'m002-ear-cartilage-base'});
     }else if(s.id==='m001'){
       // Real pinna is not rigidly welded to the skull.
       const ear=g.group('ear'+(side<0?'L':'R'),[side*.22,.21,-.075],head);
       g.spike(ear,'skin',[0,0,0],[side*.085,.36,-.020],.10);
       g.spike(ear,'shadow',[side*.019,.058,.061],[side*.079,.30,.021],.056);
       g.sphere(ear,'light',[0,.028,.058],[.069,.045,.054]);
     }else{
       g.spike(head,'skin',[side*.22,.21,-.075],
         [side*(.29+v*.01),.57+v*.025,-.095],.105);
       g.spike(head,'shadow',[side*.241,.27,-.018],
         [side*(.295+v*.008),.52+v*.025,-.055],.059);
       g.sphere(head,'light',[side*.217,.228,-.015],[.071,.045,.052]);
     }
   }else if(felineMaster){
     // No generic variant-2 horns or rigid ear spheres on the lion.
     // Rounded short feline ear cartilage is part of the head rig.
     const suffix=side<0?'L':'R';
     const ear=g.group('ear'+suffix,
       [side*(felineMaster.headWidth*.226),.204,-.076],head);
     g.foxPinna(ear,{
       side,height:felineMaster.earHeight,
       width:felineMaster.earWidth,spread:.038,
       name:'feline-master-pinna-'+s.id+'-'+suffix
     });
     g.sphere(ear,'skin',[0,.016,.008],
       [.096,.051,.083],{name:'feline-master-ear-root-'+suffix});
     g.sphere(ear,'shadow',[side*.007,.057,.055],
       [.060,.079,.022],{name:'feline-master-ear-interior-'+suffix});
   }else if(reptile||v>=2){
     // Horns grow from an embedded keratin socket, travel through a
     // tapered curved base and end in a sharp cap. No floating cone root.
     const root=[side*.21,.24,0];
     const elbow=[side*(.30+v*.026),.39+horn*.29,-.072];
     const tip=[side*(.38+v*.045),.47+horn,-.13];
     g.sphere(head,'skin',[side*.212,.235,-.012],[.115,.103,.132],
       {name:'horn-root-socket'});
     g.bridge(head,v===2?'accent':'bone',root,elbow,.102,.059);
     g.spike(head,v===2?'accent':'bone',elbow,tip,.059);
   }else g.sphere(head,'skin',[side*.24,.24,-.09],[.10,.19,.07]);
   if(beastRemesh&&s.id==='m001'){
     // The fang roots disappear into the labial tissue, curving backward
     // instead of two oversized ivory cones hanging below a flat face.
     const fang=g.curvedHorn(head,'bone',
       [side*.115,-.172,.214],[side*.130,-.224,.249],
       [side*.101,-.293,.227],.034,{name:'beast-upper-fang'});
     fang.userData.wolfGumEmbedded=true;
     if(coatDetail!=='low'){
       // The labial fold overlaps the keratin root and disappears into
       // the lip tissue, rather than producing two detached ivory tusks.
       const lip=g.bridge(head,'skin',
         [side*.126,-.148,.169],[side*.114,-.182,.242],
         .041,.023);
       lip.name='m001-upper-labial-fold-'+(side<0?'L':'R');
       lip.userData.fangRootCover=true;
     }
   }else if(beastRemesh)g.curvedHorn(head,'bone',
      [side*.13,-.17,muzzle+.05],[side*.146,-.265,muzzle+.14],
      [side*.115,-.335,muzzle+.23],.046,{name:'beast-upper-fang'});
   else if(felineMaster){
     const saber=s.id==='m007',length=felineMaster.saberToothLength;
     const root=[side*.100,-.176,muzzle+.021];
     const fang=g.curvedHorn(head,'bone',root,
       [side*.107,-.176-length*.54,muzzle+.082],
       [side*.073,-.176-length,muzzle+.094],
       saber?.030:.020,
       {name:'feline-master-upper-canine-'+s.id+'-'+(side<0?'L':'R')});
     fang.userData.felineDentalRoot=true;
   }else g.spike(head,'bone',[side*.13,-.20,muzzle+.08],[side*.13,-.31,muzzle+.22],.046);
 }
 if(s.id==='m004'){
   // Enlarged temporalis and tear-duct ridges give the fast hunter a
   // lean canid skull rather than relying on a differently tinted sphere.
   g.bridge(head,'skin',[0,.063,-.13],[0,-.055,.445],.171,.118);
   for(const side of [-1,1]){
     g.bridge(head,'skin',[side*.220,-.032,-.105],
       [side*.268,-.096,.232],.121,.077);
     g.sphere(head,'skin',[side*.222,.038,.013],
       [.107,.142,.178],{name:'m004-temporalis'});
     g.tube(head,'light',[[side*.195,.14,-.09],
       [side*.285,.146,.062],[side*.305,.096,.220]],.027);
     g.sphere(head,'shadow',[side*.085,-.16,muzzle+.282],
       [.025,.017,.012],{name:'m004-nostril'});
     for(let n=0;n<4;n++){
       g.sphere(head,'shadow',
         [side*(.145+n*.017),-.202,muzzle+.055+n*.043],
         [.005,.006,.009],{name:'m004-vibrissa-follicle'});
     }
   }
 }
 if(s.id==='m003'){
   // Broad wolf temporalis bundles are volumetric, not face paint.
   // Cheek fur and nasal cartilage preserve the sharp lupine silhouette.
   g.bridge(head,'skin',[0,.075,-.16],[0,-.066,.455],.192,.109);
   for(const side of [-1,1]){
     g.sphere(head,'skin',[side*.227,.037,-.028],
       [.127,.196,.209],{name:'m003-temporalis'});
     g.bridge(head,'skin',[side*.226,-.077,.010],
       [side*.241,-.141,.255],.125,.075);
     g.sphere(head,'shadow',[side*.084,-.166,muzzle+.29],
       [.027,.016,.013],{name:'m003-nostril'});
     for(let i=0;i<5;i++)
       g.spike(head,i%2?'light':'skin',
         [side*.235,-.095-i*.027,.010+i*.034],
         [side*(.33+i*.011),-.16-i*.041,-.10+i*.042],.025);
   }
 }
 if(s.id==='m002'){
   // Cranial surface references: wolf sagittal crest, zygomatic arch and
   // molar/masseter space. Shape stays in head-local coordinates, so the
   // whole snout remains attached during head turns and attack lunges.
   g.bridge(head,'skin',[0,.083,-.18],[0,-.051,.446],.187,.113);
   g.tube(head,'light',[[0,.267,-.20],[0,.292,.01],
     [0,.212,.19]],.034);
   for(const side of [-1,1]){
     // Masseter cheek volume and the bone arch are three-dimensional.
     g.bridge(head,'skin',[side*.216,-.048,-.043],
       [side*.281,-.102,.226],.132,.088);
     g.tube(head,'light',[[side*.185,.104,-.102],
       [side*.322,.064,.070],[side*.325,-.015,.267]],.030);
     g.sphere(head,'skin',[side*.236,-.096,.080],
       [.123,.135,.194],{name:'m002-masseter'});
     g.sphere(head,'shadow',[side*.085,-.169,muzzle+.288],
       [.027,.014,.013],{name:'m002-nostril'});
     // Under-eye tissue overlaps the orbital socket without bulging eyes.
     g.tube(head,'skin',[[side*.262,.104,.158],
       [side*.306,.117,.255],[side*.273,.099,.342]],.028);
     for(let i=0;i<4;i++){
       const z=muzzle+.09+i*.036;
       g.sphere(head,'shadow',[side*(.137+i*.010),-.195,z],
         [.006,.006,.007],{rough:.85,name:'m002-vibrissa-root'});
     }
   }
   if(!beastRemesh)g.sphere(head,'shadow',[0,-.164,muzzle+.294],
     [.145,.045,.088],{name:'m002-rhinarium'});
 }
 if(s.id==='m001'){
   // Skull, cheeks and forehead are now ONE sculpted axial shell above.
   // The only supplemental mass is the *rear* throat/mane anchor, hidden
   // beneath the fur. No extra face sphere or tubular cheek shell.
   g.axialLoft(head,'skin',[
     {z:.13,y:-.115,rx:.126,ry:.112},
     {z:-.08,y:-.158,rx:.233,ry:.184},
     {z:-.27,y:-.214,rx:.277,ry:.246},
     {z:-.49,y:-.252,rx:.214,ry:.189},
     {z:-.63,y:-.266,rx:.081,ry:.089}
   ],{name:'m001-ruff-root-tissue',rough:.97,ribbing:.012});
 }
 // The old m001 lower jaw was a sibling of its turning head: head pitch
 // opened an ugly physical seam even when the mouth was CLOSED. Nest the
 // animated mandible under the skull and express its original world-space
 // rest position in head-local coordinates (head 1.300 / .786).
 const jaw=s.id==='m001'?
   g.group('jaw',[0,-.140,.129],head):
   felineMaster?
   g.group('jaw',[0,-.140,.26-v*.06],head):
   g.group('jaw',[0,beastRemesh?1.160:1.42,
     beastRemesh?1.046:.96]);
 if(felineMaster)jaw.userData.felineMasterConnectedJaw=true;
 if(s.id==='m001')jaw.userData.skullMountedMandible=true;
 if(s.id==='m002'){
   // An independently opening lower mandible, with the canine teeth
   // mounted on the same jaw pivot (not left floating in the skull).
   g.bridge(jaw,'skin',[0,-.023,.008],[0,-.065,.367],.173,.100);
   for(const side of [-1,1]){
     g.tube(jaw,'light',[[side*.155,-.014,.006],
       [side*.149,-.068,.18],[side*.118,-.082,.355]],.029);
     g.spike(jaw,'bone',[side*.133,-.035,.309],
       [side*.127,.094,.347],.041);
   }
 }
 if(beastRemesh){
   // Continuous lower mandible with chin narrowing, not two stacked spheres.
   g.axialLoft(jaw,'skin',s.id==='m001'?[
     // Real short muzzle: moving lower jaw matches the compact nose.
     {z:.212,y:-.061,rx:.037,ry:.026},
     {z:.173,y:-.053,rx:.082,ry:.041},
     {z:.117,y:-.044,rx:.115,ry:.057},
     {z:.036,y:-.031,rx:.132,ry:.070},
     {z:-.108,y:-.012,rx:.083,ry:.066}
   ]:[
     {z:.335,y:-.066,rx:.077,ry:.042},
     {z:.279,y:-.057,rx:.148,ry:.057},
     {z:.186,y:-.045,rx:.184,ry:.065},
     {z:.071,y:-.030,rx:.177,ry:.072},
     {z:-.108,y:-.012,rx:.092,ry:.065}
   ],{name:'beast-integrated-mandible-'+s.id,rough:.81,ribbing:.002});
 }else if(felineMaster){
   // The separate jaw follows the head turn, with a tapered jaw body
   // instead of a broad black floating elliptical mouth plate.
   g.axialLoft(jaw,'skin',[
     {z:.205,y:-.054,rx:.032,ry:.022},
     {z:.156,y:-.047,rx:.082,ry:.042},
     {z:.075,y:-.029,rx:.120,ry:.058},
     {z:-.025,y:-.014,rx:.132,ry:.064},
     {z:-.112,y:.003,rx:.069,ry:.052}
   ].map(p=>({...p,rx:p.rx*felineMaster.cheekTaper})),
   {name:'feline-master-mandible-'+s.id,rough:.82,ribbing:.003});
 }else{
   g.sphere(jaw,'shadow',[0,-.03,.12],[.24,.045,.29]);
   if(canine)g.sphere(jaw,'skin',[0,-.054,.155],[.22,.060,.27]);
 }
 // Actual mouth split: upper lip belongs to the cranium, lower labial
 // margin and a recessed oral cavity follow the opening jaw pivot.
 // Keep both surfaces slightly overlapping in the idle pose.
 const jawOffsetZ=.26-v*.06;
 for(const side of [-1,1]){
   g.tube(head,'shadow',s.id==='m001'?[
     [side*.112,-.149,.11],
     [side*.106,-.176,.260],
     [side*.068,-.184,.329]
   ]:felineMaster?[
     [side*.117,-.163,.072],
     [side*.108,-.182,muzzle-.022],
     [side*.061,-.189,muzzle+.114]
   ]:[
     [side*.205,-.192,.135],
     [side*.204,-.200,muzzle+.025],
     [side*.155,-.214,muzzle+.263]
   ],s.id==='m001'?.007:felineMaster?.007:.012);
   g.tube(jaw,'shadow',s.id==='m001'?[
     [side*.108,-.028,-.069],
     [side*.102,-.055,.057],
     [side*.062,-.061,.202]
   ]:felineMaster?[
     [side*.107,-.025,-.072],
     [side*.097,-.049,.032],
     [side*.051,-.060,.166]
   ]:[
     [side*.200,-.052,.135-jawOffsetZ],
     [side*.198,-.061,muzzle+.025-jawOffsetZ],
     [side*.153,-.065,muzzle+.263-jawOffsetZ]
   ],s.id==='m001'?.007:felineMaster?.008:.013);
 }
 if(s.id==='m001'){
   // Replace the exposed black mouth button with a shallow tapered oral
   // opening that is entirely inside the opening lower mandible.
   const mouthSlit=g.axialLoft(jaw,'shadow',[
     {z:.160,y:-.050,rx:.020,ry:.005},
     {z:.085,y:-.043,rx:.081,ry:.012},
     {z:-.015,y:-.036,rx:.092,ry:.011},
     {z:-.090,y:-.026,rx:.030,ry:.006}
   ],{name:'quadruped-oral-cavity',rough:.93,ribbing:0});
   mouthSlit.userData.m001RecessedOralSlit=true;
 }else g.sphere(jaw,'shadow',[0,-.035,muzzle-.18+v*.06],
   [.136,.018,.145],{name:'quadruped-oral-cavity'});
 g.sphere(jaw,'light',[0,-.044,muzzle-.12+v*.06],
   s.id==='m001'?[.060,.010,.058]:[.084,.014,.098],
   {name:'quadruped-tongue'});
 if(s.id==='m001'){
   // Small lower incisors erupt UP from the gumline; the previous four
   // downward spikes made the jaw look like disconnected hanging pieces.
   for(let i=0;i<6;i++){
     const x=(i-2.5)*.029;
     const tooth=g.rootedSpike(jaw,'bone','skin',
       [x,-.047,.148],[x*1.04,-.012,.169],.009,
       {name:'m001-lower-incisor-'+i});
     tooth.tooth.userData.m001DentalArch='mandible';
   }
   // Opposing upper incisors stay fixed to the upper muzzle and reveal
   // their crowns naturally when the mandible opens.
   for(let i=0;i<6;i++){
     const x=(i-2.5)*.026;
     const tooth=g.rootedSpike(head,'bone','skin',
       [x,-.176,.285],[x*1.02,-.202,.297],.0085,
       {name:'m001-upper-incisor-'+i});
     tooth.tooth.userData.m001DentalArch='maxilla';
   }
 }else for(let i=0;i<4;i++)g.spike(jaw,'bone',
   [(i-1.5)*.12,.01,.27],
   [(i-1.5)*.12,-.10,.29],.025);
 for(const side of [-1,1])for(const fore of [-1,1]){
   const name=(fore===1?'front':'rear')+(side<0?'L':'R');
   // Former limb pivot at y=1.13 kept all four feet half a metre above
   // terrain. Plant the soles near ground zero and embed hips in the torso.
   // Only the thunder wolf's rear legs follow the lumbar/pelvic hinge.
   // Local coordinates preserve the original hip world-space placement.
   const pelvisMounted=s.id==='m004'&&fore<0;
   // Wolf king: shoulder limbs originate laterally from the scapula, not
   // under the midline of the chest; hips follow the narrower rear flanks.
   // Both toe and hock stay on the SAME lateral axis, no toe-out rotation.
   const lateralX=s.id==='m001'?
     (fore>0?.402:.317):
     felineMaster?(fore>0?felineMaster.torsoWidth*.87:
       felineMaster.torsoWidth*.83):.29;
   const leg=g.group('leg'+name,
     pelvisMounted?
       [side*lateralX,beastRemesh?-.540:-.42,.03]:
       [side*lateralX,beastRemesh?.550:.67,fore*.49],
     pelvisMounted?g.pivots.pelvis:
       (s.id==='m001'||felineMaster?torso:g.root));
   if(felineMaster){
     leg.scale.x=felineMaster.legWidth;
     leg.scale.z=felineMaster.legWidth;
     leg.userData.felineProximalJoint=fore>0?'scapula':'femur';
   }
   // Anatomical limb shortening keeps paw clearance at the ground by
   // lowering its hip pivot by the same amount. Distal pivots remain real
   // joints and are not replaced with stretched mesh tubes.
   if(beastRemesh){
     leg.userData.restLengthScale=.88;
     leg.scale.y=leg.userData.restLengthScale;
   }
   // Distal motion is independent from shoulder/hip rotation, retaining
   // the original limb and ground-contact positions.
   if(s.id==='m001'){
     leg.userData.proximalSocket=fore>0?'shoulder':'hip';
     // A small overlapped moving proximal sleeve follows the limb's
     // rotation and disappears beneath its torso-mounted fascia.
     // Only the near/source mesh needs it; low LOD remains unchanged.
     if(coatDetail!=='low'){
       const sleeve=g.bridge(leg,'skin',
         [0,.34,fore>0?-.018:-.054],
         [0,.575,fore>0?-.020:-.050],
         fore>0?.146:.138,fore>0?.168:.151);
       sleeve.name='m001-proximal-sleeve-'+name;
       sleeve.userData.jointSeamSleeve=true;
     }
   }
   if(beastRemesh||felineMaster)g.limbLoft(leg,'skin',(fore>0?[
     // Forelimb: scapula -> humerus -> elbow. Elbow lies BEHIND the wrist.
     {x:0,y:.55,z:.025,rx:.133,rz:.154},
     {x:0,y:.34,z:.042,rx:.193,rz:.213},
     {x:0,y:.16,z:-.065,rx:.176,rz:.169},
     {x:0,y:-.085,z:-.120,rx:.116,rz:.118},
     {x:0,y:-.25,z:-.097,rx:.103,rz:.111}
   ]:[
     // Hindlimb: iliac crest -> thigh -> projected stifle. No vertical column.
     {x:0,y:.55,z:s.id==='m001'?-.038:-.208,rx:.137,rz:.178},
     {x:0,y:.32,z:s.id==='m001'?-.083:-.138,rx:.221,rz:.238},
     {x:0,y:.14,z:.050,rx:.189,rz:.174},
     {x:0,y:-.080,z:.177,rx:.125,rz:.119},
     {x:0,y:-.25,z:.166,rx:.105,rz:.112}
   ]).map(p=>s.id==='m001'?{...p,rx:p.rx*.84,rz:p.rz*.86}:
      felineMaster?{...p,rx:p.rx*.81,rz:p.rz*.79}:p),
   {name:'beast-upper-limb-'+name});
   else g.sphere(leg,'skin',[0,.17,0],
     [reptile?.18:.21,.40,reptile?.18:.21]);
   // m001 hind "lower" is the true stifle/knee pivot, not a hinge
   // beneath the whole thigh. Preserve the initial foot position by
   // offsetting shin vertices and hock bind coordinates equally.
   const photoWolfStifle=s.id==='m001'&&fore<0;
   // Natural canine elbow and stifle pivot BELOW the shoulder/hip.
   // Counter-translate hock so the planted paw bind height is unchanged.
   const distal=g.group('lower'+name,
     s.id==='m001'?[0,fore>0?-.180:-.200,fore>0?-.038:.065]:
       [0,-.065,.015],leg);
   if(s.id==='m001')distal.userData.anatomicalJoint=
     fore>0?'elbow':'stifle';
   if(beastRemesh||felineMaster){
    g.limbLoft(distal,'skin',(s.id==='m001'?(fore>0?[
      // Forearm starts over elbow and tapers into elevated carpus.
      {x:0,y:.135,z:-.075,rx:.130,rz:.128},
      {x:0,y:.045,z:-.090,rx:.137,rz:.141},
      {x:0,y:-.095,z:-.050,rx:.113,rz:.111},
      {x:0,y:-.235,z:.023,rx:.094,rz:.105},
      {x:0,y:-.325,z:.052,rx:.102,rz:.109}
    ]:[
      // Rear tibia tracks forward stifle -> back hock in a true dog S.
      {x:0,y:.145,z:.105,rx:.138,rz:.145},
      {x:0,y:.055,z:.121,rx:.140,rz:.144},
      {x:0,y:-.095,z:-.025,rx:.111,rz:.118},
      {x:0,y:-.225,z:-.140,rx:.088,rz:.092},
      {x:0,y:-.310,z:-.168,rx:.092,rz:.091}
    ]):(fore>0?[
      {x:0,y:.15,z:-.091,rx:.130,rz:.129},
      {x:0,y:.04,z:-.103,rx:.138,rz:.142},
      {x:0,y:-.15,z:-.046,rx:.114,rz:.112},
      {x:0,y:-.31,z:.027,rx:.093,rz:.106},
      {x:0,y:-.41,z:.054,rx:.107,rz:.118}
    ]:[
      {x:0,y:.15,z:.161,rx:.136,rz:.147},
      {x:0,y:.02,z:.139,rx:.146,rz:.144},
      {x:0,y:-.14,z:-.015,rx:.112,rz:.118},
      {x:0,y:-.28,z:-.159,rx:.086,rz:.090},
      {x:0,y:-.38,z:-.172,rx:.091,rz:.091}
    ])).map(p=>s.id==='m001'?{
      ...p,rx:p.rx*.83,rz:p.rz*.84
    }:felineMaster?{
      ...p,rx:p.rx*.81,rz:p.rz*.80
    }:p),{name:'beast-shin-'+name});
    if(s.id==='m001'&&coatDetail!=='low'){
      // A small overlapping fascia above/below the actual hinge keeps
      // the silhouette continuous while two joint rotations stay free.
      const rear=fore<0;
      const upperFold=g.bridge(leg,'skin',
        rear?[0,-.090,.106]:[0,-.070,-.090],
        rear?[0,-.235,.140]:[0,-.225,-.102],
        rear?.136:.130,rear?.122:.113);
      upperFold.name='m001-upper-knee-fascia-'+name;
      upperFold.userData.kneeUpperCover=true;
      const lowerFold=g.bridge(distal,'skin',
        rear?[0,.090,.100]:[0,.110,-.091],
        rear?[0,-.125,.124]:[0,-.130,-.047],
        rear?.120:.115,rear?.111:.107);
      lowerFold.name='m001-lower-knee-fascia-'+name;
      lowerFold.userData.kneeLowerCover=true;
    }
   }else{
    g.sphere(distal,'skin',[0,-.16,0],[reptile?.13:.15,.27,reptile?.13:.15]);
    g.sphere(distal,'shadow',[0,0,0],[.144,.125,.14],{name:'joint-'+name});
   }
   if(s.id==='m004'){
     // The wolf's digitigrade tarsus and four toes are geometry attached
     // to two separate rotating joints, not duplicate static feet.
     const hock=g.group('hock'+name,[0,-.19,.017],distal);
     g.bridge(hock,'skin',[0,.052,-.03],[0,-.24,.07],.106,.080);
     g.sphere(hock,'shadow',[0,0,0],[.108,.095,.117],
       {name:'m004-tarsal-joint'});
     const toe=g.group('toe'+name,[0,-.29,.14],hock);
     g.sphere(toe,'skin',[0,-.039,.035],[.153,.075,.167],
       {name:'m004-metacarpal-pad'});
     for(let digit=0;digit<4;digit++){
       const x=(digit-1.5)*.072;
       g.sphere(toe,'skin',[x,-.085,.137],[.040,.046,.078],
         {name:'m004-digit'});
       g.rootedSpike(toe,'bone','skin',[x,-.054,.192],
         [x,-.090,.262],.021,{name:'rooted-claw-m004-'+digit});
     }
   }else if(beastRemesh&&(s.id==='m001'||s.id==='m002')){
     // The raised hind hock / front wrist and toes are separate animated
     // groups. Keeping the ankle away from the ground creates digitigrade
     // silhouette even in the idle bind pose.
     const ankle=g.group('beastHock'+name,
       [0,s.id==='m001'?(fore>0?-.285:-.205):
         (fore>0?-.40:-.34),fore>0?.050:-.168],distal);
     g.bridge(ankle,'skin',[0,.06,0],
       [0,-.142,fore>0?.053:.173],fore>0?.103:.092,.083);
     // m001 has a separately movable metacarpal/metatarsal pad joint.
     // Splitting the former ankle->toe offset preserves bind placement:
     // pastern + toe equals old [-.125/.115, -.205/.213].
     const pastern=s.id==='m001'?g.group('beastPastern'+name,
       [0,fore>0?-.075:-.120,fore>0?.065:.130],ankle):null;
     if(pastern)pastern.userData.anatomicalJoint=
       fore>0?'metacarpal':'metatarsal';
     const paw=g.group('beastToe'+name,
       s.id==='m001'?[0,fore>0?-.050:-.085,fore>0?.050:.083]:
         [0,fore>0?-.125:-.205,fore>0?.115:.213],
       pastern||ankle);
     g.bridge(paw,'skin',[0,.045,-.071],[0,-.018,.058],.136,.115);
     for(let digit=0;digit<4;digit++){
      const x=(digit-1.5)*.070;
      g.sphere(paw,'skin',[x,-.020,.088],[.039,.037,.078],{name:'beast-toe-'+digit});
      g.rootedSpike(paw,'bone','skin',
        [x,-.016,.146],[x*1.11,-.058,.251],.019,
        {name:'rooted-claw-beast-'+digit});
     }
   }else if(felineMaster&&coatDetail==='low'){
     // 1000v1000 crowd uses a single silhouette paw, not four separately
     // allocated toe groups and claw roots per leg.
     feet(g,distal,0,0,0,true,.81*felineMaster.pawWidth);
   }else if(felineMaster){
     // Four articulated pads on a true cat toe pivot; none of the
     // cylindrical canine feet or claws are reused on m007-m010.
     const toe=g.group('toe'+name,[0,-.436,.144],distal);
     toe.userData.felinePad=true;
     g.sphere(toe,'skin',[0,-.033,.018],
       [.133*felineMaster.pawWidth,.055,.145],
       {name:'feline-master-metacarpal-pad'});
     for(let digit=0;digit<4;digit++){
       const x=(digit-1.5)*.056*felineMaster.pawWidth;
       g.sphere(toe,'skin',[x,-.051,.112],[.033,.043,.079],
         {name:'feline-master-digit-'+digit});
       g.rootedSpike(toe,'bone','skin',[x,-.032,.158],
         [x*1.08,-.077,.213],.016,
         {name:'feline-master-retractile-claw-'+digit});
     }
   }else if(s.id!=='m003'){
     // Fenrir owns a separate articulated toe assembly below. Rendering
     // the legacy fixed paw as well made duplicate feet and floating claws.
     feet(g,distal,0,0,0,true,reptile?.75:1);
   }
   if(s.id==='m003'){
     // Four articulated digit pads and their curved keratin claws follow
     // an independent metacarpophalangeal/toe flexion group on each paw.
     const toe=g.group('toe'+name,[0,-.49,.16],distal);
     g.sphere(toe,'shadow',[0,-.046,.040],
       [.151,.066,.142],{name:'m003-metapodial-pad'});
     for(let digit=0;digit<4;digit++){
       const x=(digit-1.5)*.067;
       g.sphere(toe,'skin',[x,-.037,.112],
         [.043,.046,.092],{name:'m003-digit-pad'});
       g.rootedSpike(toe,'bone','skin',[x,-.025,.177],
         [x,-.073,.262],.024,{name:'rooted-claw-m003-'+digit});
     }
   }
   if(!beastRemesh)g.sphere(leg,'skin',[0,-.04,.015],[.18,.18,.18]);
   if(canine&&coatDetail!=='low'){
     // Each fur region belongs to its own anatomical joint. Previously
     // all three patches lived on 'leg', so the shank and paw coat detached
     // from the moving lower/hock/toe joints during a trot or gallop.
     const source=coatDetail==='source',near=fore===1;
     const upper=generateCanineFurGuides({
       center:[0,.17,0],radii:s.id==='m001'?[.169,.395,.178]:[.215,.395,.215],
       rows:source?29:18,around:source?30:21,
       length:s.id==='m001'?(near?.102:.110):(near?.083:.101),
       width:.014,seed:v*19+side*5+fore*7+31,
       minVertical:-.85,axis:'y',gravity:.20,
     });
     // Hair-covered shoulder socket follows the proximal bone while
     // trunk-owned guard hair covers the same seam from the other side.
     // The two coat layers overlap, but require NO additional limb mesh.
     const shoulderOverlap=s.id==='m001'?generateCanineFurGuides({
       center:[0,.456,fore>0?.002:-.061],
       radii:[.151,.118,.158],
       rows:source?19:12,around:source?27:20,
       length:.119,width:.011,seed:v*31+side*13+fore*17+773,
       axis:'y',minVertical:-.70,maxVertical:.90,gravity:.29,
     }).filter(h=>h.root[1]>.355&&h.root[1]<.565)
       .map(h=>({...h,mid:[h.mid[0],h.mid[1]-.009,h.mid[2]-.012]})):[];
     const lower=generateCanineFurGuides({
       center:[0,s.id==='m001'?-.115:-.28,0],
       radii:s.id==='m001'?[.123,.242,.130]:[.145,.29,.156],
       rows:source?24:15,around:source?26:18,
       length:.064,width:.011,seed:v*13+side*7+fore*11+43,
       minVertical:-.72,axis:'y',gravity:.21,
     });
     const toeParent=(s.id==='m003'||s.id==='m004')?
       g.pivots['toe'+name]:(beastRemesh?g.pivots['beastToe'+name]:distal);
     const paw=generateCanineFurGuides({
       center:[0,-.53,.125],radii:[.136,.083,.195],
       rows:source?12:8,around:source?20:14,
       length:.028,width:.009,seed:v*17+side*5+fore*7+57,
       minVertical:-.15,maxVertical:.86,gravity:.20,
     });
     // Three joint influences are blended inside ONE skinned mesh per
     // moving limb: stable four draw calls across all legs, GPU deformation,
     // and no coat detachment at the elbow/hock/toe joint.
     g.skinnedFur(leg,'skin',[
       {joint:leg,region:'upper',
         guides:doubleFurGuides(m001Flow([...upper,...shoulderOverlap]))},
       {joint:distal,region:'lower',guides:doubleFurGuides(lower)},
       {joint:toeParent,region:'paw',guides:doubleFurGuides(paw)},
     ],{name:'canine-coat-leg'+name});
   }
 }
 // Dense near-LOD hair follows the real body/cheek anatomy and does not
 // intersect the muzzle or eyes. Low LOD keeps the base fur photograph.
 if(canine&&coatDetail!=='low'){
   const source=coatDetail==='source';
   // Side/flank/belly coverage used to stop at minVertical=-.28:
   // that left an exposed, smooth underbody. Grow the coat all the way
   // around, keeping hair under the paws short but the chest fuller.
   const flank=beastRemesh?generateCanineAxialFurGuides({
     stations:bodyStations,rows:source?43:29,around:source?52:38,
     lengthProfile:s.id==='m001'?[
       {z:bodyLength*1.01,length:.065},
       {z:bodyLength*.77,length:.175},
       {z:bodyLength*.46,length:.208},
       {z:bodyLength*.13,length:.176},
       {z:-bodyLength*.24,length:.139},
       {z:-bodyLength*.56,length:.122},
       {z:-bodyLength*1.03,length:.085}
     ]:[
       {z:bodyLength*1.01,length:.060},
       {z:bodyLength*.77,length:.139},
       {z:bodyLength*.46,length:.155},
       {z:bodyLength*.13,length:.099},
       {z:-bodyLength*.24,length:.080},
       {z:-bodyLength*.56,length:.066},
       {z:-bodyLength*1.03,length:.047}
     ],
     width:.019,seed:v*3+1,minVertical:-.99,maxVertical:.98,gravity:.19,
   }):generateCanineFurGuides({
     center:[0,1.30,0],radii:[.44+(v%2)*.06,.43,.71+v*.06],
     rows:source?40:27,around:source?50:38,
     length:.104,width:.023,seed:v*3+1,
     minVertical:-.99,maxVertical:.98,
   });
   const chest=beastRemesh?generateCanineAxialFurGuides({
     // The former circular chest coat made the model look like an egg.
     // Guard hairs now begin ON the existing front-chest loft surface.
     stations:bodyStations,rows:source?30:21,around:source?42:30,
     lengthProfile:s.id==='m001'?[
       {z:bodyLength*1.01,length:.126},
       {z:bodyLength*.77,length:.198},
       {z:bodyLength*.46,length:.216},
       {z:bodyLength*.13,length:.139},
       {z:-bodyLength*.24,length:.087},
       {z:-bodyLength*1.03,length:.048}
     ]:[
       {z:bodyLength*1.01,length:.13},
       {z:bodyLength*.77,length:.185},
       {z:bodyLength*.46,length:.167},
       {z:bodyLength*.13,length:.083},
       {z:-bodyLength*.24,length:.058},
       {z:-bodyLength*1.03,length:.038}
     ],
     width:.023,seed:v*11+19,
     minVertical:-.97,maxVertical:.40,gravity:.32,
   }).filter(h=>h.root[2]>bodyLength*.18):generateCanineFurGuides({
     center:[0,1.43,.39],radii:[.32,.29,.36],
     rows:source?23:14,around:source?32:23,
     length:.15,width:.024,seed:v*11+19,
     minVertical:-.94,maxVertical:.79,gravity:.28,
   });
   // A second layer is rooted on the actual torso loft directly over the
   // shoulder seam. Root positions align with the torso instead of
   // hovering on a generic ellipsoid. The leg sleeve is feathered into it.
   const shoulderMantle=s.id==='m001'?generateCanineAxialFurGuides({
     stations:bodyStations,rows:source?24:15,around:source?42:30,
     lengthProfile:[
       {z:bodyLength*1.01,length:.085},
       {z:bodyLength*.77,length:.172},
       {z:bodyLength*.46,length:.193},
       {z:bodyLength*.13,length:.136},
       {z:-bodyLength*.24,length:.069},
       {z:-bodyLength*1.03,length:.036}
     ],
     width:.013,seed:v*71+761,minVertical:-.95,maxVertical:.96,
     gravity:.38,
   }).filter(h=>Math.abs(h.root[0])>.292&&
     h.root[2]>.18&&h.root[2]<.65&&
     h.root[1]>.97&&h.root[1]<1.48):[];
   addFur(torso,m001Flow([...flank,...chest,...shoulderMantle]));
   // Merge the long ruff with short skull and cheek hairs, preserving
   // the original three material batches and keeping eyes unobstructed.
   const faceGuides=s.id==='m001'?[]:[
     ...generateCanineFurGuides({
       center:[0,.035,-.095],radii:[.31,.255,.232],
       rows:source?19:13,around:source?36:25,
       length:.105,width:.021,seed:v*7+2,minVertical:-.68,gravity:.32,
     }),
     ...generateCanineFurGuides({
       center:[0,.067,.123],radii:[.305,.246,.264],
       rows:source?24:17,around:source?40:30,
       length:.034,width:.008,seed:v*7+127,
       minVertical:.30,maxVertical:1,gravity:.12,
     }).filter(hair=>hair.root[1]>.105),
     ...[-1,1].flatMap(side=>generateCanineFurGuides({
       center:[side*.202,-.071,.16],radii:[.128,.145,.193],
       rows:source?20:14,around:source?30:22,
       length:.049,width:.009,seed:v*9+137+side,
       minVertical:-.9,maxVertical:.65,gravity:.22,
     }).filter(hair=>side*hair.root[0]>.205 &&
       hair.root[1]<.042 && hair.root[2]<.36)),
   ];
   // Grown facial hair: short nose/eye, medium cheeks and long throat ruff.
   const groomed=beastRemesh&&s.id!=='m001'?[
    ...generateCanineFurGuides({center:[0,-.13,.39],radii:[.174,.087,.22],
      rows:source?21:14,around:source?33:22,length:.019,width:.005,
      seed:v*13+203,gravity:.11,minVertical:-.6,maxVertical:.5
    }).filter(h=>Math.abs(h.root[0])<.175&&h.root[2]>.26),
    ...[-1,1].flatMap(side=>generateCanineFurGuides({
      center:[side*.223,-.116,.092],radii:[.105,.145,.185],
      rows:source?24:16,around:source?36:25,length:.085,width:.014,
      seed:v*29+219+side,gravity:.36,minVertical:-.93,maxVertical:.31
    }).filter(h=>side*h.root[0]>.22&&h.root[1]<.018)),
    ...generateCanineFurGuides({center:[0,-.035,-.15],radii:[.305,.275,.255],
      rows:source?29:18,around:source?42:30,length:.164,width:.026,
      seed:v*33+241,gravity:.42,minVertical:-.84,maxVertical:.22
    }).filter(h=>h.root[2]<.02)
   ]:[];
   // The compact skull has an exposed face window, framed by shorter
   // cheek foliage rather than long spikes growing from the nasal bridge.
   const wolfKingFaceCoat=s.id==='m001'?generateCanineFurGuides({
      // Short face underfur seated close to the compact cranial shell,
      // not an oversized fuzzy halo hanging off its sides.
      center:[0,.101,.091],radii:[.237,.186,.230],
      rows:source?42:29,around:source?56:40,
      length:.052,width:.009,seed:v*71+509,
      minVertical:-.94,maxVertical:1,gravity:.27,
   }).filter(h=>{
      const x=Math.abs(h.root[0]),y=h.root[1],z=h.root[2];
      // The face window is bounded by the mane: NO follicles on the
      // actual small eyes, nose bridge, lips or front muzzle.
      // Fur guide doubling adds a ~0.01 tangential offset. Leave an
      // additional safety margin so no shifted strand enters the bare mask.
      if(z>.078&&x<.222&&y>-.223&&y<.293)return false;
      // No pale root tufts above the recessed orbital line.
      if(z>.105&&y>.075&&x<.315)return false;
      return !(z>.248&&x<.255&&y>-.209&&y<.287);
   }):[];
   // Groomed layers follow the reference coat: short underfur, medium
   // body guard hairs and a fuller lion-like but compact cheek/throat ruff.
   // Capping the real 3D length fixes 5x horizontal hair curtains.
   const referenceLayeredMane=guides=>guides.map((h,i)=>{
     const base=h.tip.map((v,k)=>v-h.root[k]);
     const len=Math.hypot(...base)||.001;
     const tier=.88+.20*((i*17%19)/18);
     const target=Math.min(.348,Math.max(.085,len*1.13*tier));
     if(h.m001ContourGuide)return {...h,
       wolfKingManeLengthMultiplier:1.2,
       originalHairLength:Math.hypot(...h.tip.map((v,k)=>v-h.root[k]))};
     const faceCurtain=!!h.m001FaceCurtain;
     const faceUnderfur=!!h.m001ScalpUnderfur;
     const forelock=!!h.m001Forelock;
     const throat=h.root[1]<-.19;
     // Shear broad side fans toward the shoulder; throat guard hair
     // falls under the mandible rather than forming rigid hanging blades.
     const crown=h.root[1]>.19&&h.root[2]<-.04;
     const temple=!crown&&Math.abs(h.root[0])>.18&&
       h.root[1]>-.06;
     // Forehead fringe drops toward the brow; anterior cheek curtains
     // travel FORWARD and INWARD, framing the facial mask rather than
     // forming an outward porcupine halo behind the skull.
     const wind=faceUnderfur?
       [-Math.sign(h.root[0])*len*.48,-len*.58,len*.47]:
       faceCurtain?
       [-Math.sign(h.root[0])*len*.72,-len*.89,len*.57]:
       forelock?
       [-Math.sign(h.root[0])*len*.19,-len*.64,len*.53]:
       crown?
       [base[0]*.55,Math.abs(base[1])*.76+len*.14,
         base[2]*.33-len*.36]:
       temple?
       [base[0]*.42,base[1]*.36-len*.31,
         base[2]*.26+len*.11]:
       [base[0]*(throat?.27:.32),
         -Math.abs(base[1])*(throat?.90:.48)-len*(throat?.42:.22),
         base[2]*.46-len*(throat?.23:.39)];
     const n=Math.hypot(...wind)||1;
     const delta=wind.map(v=>v*target/n);
     const tip=h.root.map((v,k)=>v+delta[k]);
     if(faceCurtain||faceUnderfur){
       // Lock the final fibres along the inward cheek boundary, with a
       // slightly wider clearance at eye height. Fangs and nose stay open.
       const side=Math.sign(h.root[0]);
       const eyeHeight=h.root[1]>.045&&h.root[1]<.177;
       const minX=eyeHeight?.165:faceUnderfur?.126:.143;
       tip[0]=side*Math.max(minX,Math.abs(tip[0]));
       tip[2]=Math.max(h.root[2]+(faceUnderfur?.023:.038),tip[2]);
     }
     if(forelock){
       tip[1]=Math.max(.181,tip[1]);
       tip[2]=Math.max(h.root[2]+.024,tip[2]);
     }
     const mid=h.root.map((v,k)=>v+(tip[k]-v)*(.44+(k===2?.02:0))+
       h.normal[k]*len*.072);
     return {...h,mid,tip,
       wolfKingManeLengthMultiplier:1.2,originalHairLength:len};
   });
   // m001 has a lion-like, layered throat/cheek ruff: the bone remains a
   // wolf skull and the mane is entirely groomed on the moving head.
   // Ear / eyebrow / eye clearances are cut out of the hair root mask.
   const wolfKingMane=s.id==='m001'?[
     // The first layer follows the actual narrow cranium loft, not an
     // ellipsoid displaced from the skull. This connects cheek and crown
     // hair continuously to the newly slimmed facial outline.
     ...m001FittedFacialMane(faceCore,source),
     // Skin-hugging short fibres grow at the *facial* cheek line, not
     // just at the outer nape. Long guard hairs overlay these roots.
     // Both are merged into the ORIGINAL three head material batches.
     ...[-1,1].flatMap(side=>generateCanineFurGuides({
       center:[side*.158,-.013,.193],radii:[.070,.162,.105],
       rows:source?40:29,around:source?47:36,
       length:.133,width:.0075,seed:v*113+967+side,
       minVertical:-.96,maxVertical:.93,gravity:.38
     }).filter(h=>side*h.root[0]>.130&&side*h.root[0]<.217&&
       h.root[2]>.134&&h.root[2]<.270&&
       h.root[1]>-.166&&h.root[1]<.181&&
       !(h.root[1]>.042&&h.root[1]<.179&&
         side*h.root[0]<.151))
       .map(h=>({...h,m001ScalpUnderfur:true}))),
     ...[-1,1].flatMap(side=>generateCanineFurGuides({
       center:[side*.197,.036,.139],radii:[.091,.189,.132],
       rows:source?40:28,around:source?52:38,
       length:.302,width:.0105,seed:v*109+941+side,
       minVertical:-.95,maxVertical:.93,gravity:.54
     }).filter(h=>side*h.root[0]>.153&&side*h.root[0]<.288&&
       h.root[2]>.092&&h.root[2]<.245&&
       h.root[1]>-.163&&h.root[1]<.185)
       .map(h=>({...h,m001FaceCurtain:true}))),
     // Brow fringe starts just above the face rather than behind the ears.
     // Crown strands above now use the same sculpted skull rings;
     // the previous free-floating forehead ellipsoid has been removed.
     // Upper crown and both side-manes approach the throat-ruff volume
     // while the bare face stays open; retain three material batches.
     ...generateCanineFurGuides({
       center:[0,.260,-.240],radii:[.247,.119,.194],
       rows:source?38:25,around:source?50:35,
       length:.242,width:.012,seed:v*103+881,
       minVertical:-.80,maxVertical:.98,gravity:.24
     }).filter(h=>h.root[1]>.211&&h.root[2]<-.055),
     ...[-1,1].flatMap(side=>generateCanineFurGuides({
       center:[side*.224,.112,-.176],radii:[.165,.178,.189],
       rows:source?43:29,around:source?56:38,
       length:.249,width:.013,seed:v*107+907+side,
       minVertical:-.98,maxVertical:.96,gravity:.42
     }).filter(h=>side*h.root[0]>.191&&h.root[2]<.092&&
       h.root[1]>-.132)),
     // A tapered facial mask is framed by a single continuous ruff over
     // the temples, cheeks and throat; the eye/muzzle window stays bare.
     ...[-1,1].flatMap(side=>generateCanineFurGuides({
       center:[side*.196,.015,-.132],radii:[.125,.157,.189],
       rows:source?31:22,around:source?44:31,
       length:.183,width:.012,seed:v*79+611+side,
       minVertical:-.99,maxVertical:.72,gravity:.58
     }).filter(h=>side*h.root[0]>.169&&h.root[2]<.135&&
       h.root[1]<.158)),
     ...generateCanineFurGuides({
       center:[0,.155,-.215],radii:[.270,.118,.179],
       rows:source?24:16,around:source?37:26,
       length:.134,width:.010,seed:v*89+733,
       minVertical:-.90,maxVertical:.72,gravity:.35
     }).filter(h=>h.root[2]<-.095&&h.root[1]>.113),
     ...[-1,1].flatMap(side=>generateCanineFurGuides({
       center:[side*.176,-.148,-.082],radii:[.138,.195,.203],
       rows:source?37:25,around:source?50:34,
       length:.176,width:.012,seed:v*37+281+side,
       minVertical:-.99,maxVertical:.29,gravity:.51
     }).filter(h=>side*h.root[0]>.145&&h.root[1]<.023&&h.root[2]<.15)),
     ...generateCanineFurGuides({
       center:[0,-.260,-.158],radii:[.229,.158,.195],
       rows:source?39:27,around:source?52:36,
       length:.264,width:.014,seed:v*41+317,
       minVertical:-.99,maxVertical:-.02,gravity:.67
     }).filter(h=>h.root[1]<-.232&&h.root[2]<.08),
     ...generateCanineFurGuides({
       center:[0,-.128,-.245],radii:[.255,.186,.194],
       rows:source?30:20,around:source?44:30,
       length:.205,width:.014,seed:v*47+379,
       minVertical:-.99,maxVertical:.28,gravity:.55
     }).filter(h=>h.root[1]<-.05&&h.root[2]<-.085)
   ]:[];
   // The user wants silver-white eyebrows made of the SAME kind of fine
   // wolf-mane strands, not the previous chunky white spikes. Root hairs
   // in the skin above each eye; sweep out/back and keep iris clearance.
   const browHairs=s.id==='m001'?[-1,1].flatMap(side=>
     generateCanineFurGuides({
       center:[side*.133,.172,.211],radii:[.063,.023,.049],
       rows:source?19:12,around:source?33:24,
       length:.065,width:.007,seed:v*97+821+side,
       minVertical:-.20,maxVertical:.96,gravity:.12
     }).filter(h=>side*h.root[0]>.105&&side*h.root[0]<.207&&
       h.root[1]>.170&&h.root[2]>.165&&h.root[2]<.273)
       .map(h=>{
         const root=h.root,tip=[
           h.tip[0]+side*.021,
           Math.max(root[1]+.018,h.tip[1]+.012),
           h.tip[2]-.025
         ];
         const mid=root.map((v,k)=>v+(tip[k]-v)*.49);
         return {...h,tip,mid,shade:'light',m001SilverBrow:true};
       })
   ):[];

   const headGuides=beastRemesh?[...faceGuides,...groomed,
     ...wolfKingFaceCoat,...browHairs].filter(h=>{
       if(h.m001SilverBrow)return true; // separately groomed above the lids
       // Avoid cheeks/temples from spreading across the eyes.
       if(Math.abs(h.root[0])>.258&&h.root[1]>.077&&
          h.root[2]>.166&&h.root[2]<.38)return false;
       if(s.id==='m001'&&h.root[1]>.073&&h.root[2]>.090&&
          Math.abs(h.root[0])<.325)return false;
       // Keep only the small frontal face patch bare; fur surrounds it.
       if(s.id==='m001'&&h.root[2]>.078&&
          Math.abs(h.root[0])<.224&&h.root[1]>-.223&&
          h.root[1]<.293)return false;
       return true;
     }):faceGuides;
   // Both the short face-frame coat and the long mane share the same
   // THREE material batches. Three head fur meshes, never six: this holds
   // the hard 14-draw-call / 1000-vs-1000 near-LOD batching contract.
   const maneStart=head.children.length;
   const mantle=s.id==='m001'?wolfKingMane.filter(h=>{
     // The old generic bare-face mask deleted all roots within x=.186,
     // which is precisely why the mane began too far from the face.
     // Anterior scalp guides have their own eye/nose clearance masks.
     if(h.m001ContourGuide||h.m001ScalpUnderfur||
        h.m001FaceCurtain||h.m001Forelock)
       return true;
     return !(h.root[2]>.078&&Math.abs(h.root[0])<.186&&
       h.root[1]>-.223&&h.root[1]<.293);
   }):[];
   const waveOneCrown=fittedWolfFamilyCrown(s,source);
   const fullHeadCoat=s.id==='m001'?
     [...headGuides,...referenceLayeredMane(mantle)]:
     [...headGuides,...waveOneCrown];
   if(waveOneCrown.length)
     g.root.userData.referenceGroomWave='canine-m002-m004';
   addFur(head,fullHeadCoat);
   if(s.id==='m001'){
     for(const mesh of head.children.slice(maneStart)){
       if(!mesh.isMesh||!mesh.userData.furStrands)continue;
       mesh.name='m001-windswept-mane-'+mesh.name;
       mesh.userData.wolfKingMane=true;
       mesh.userData.maneLengthMultiplier=1.2; // groomed layered coat
       mesh.userData.exposedFaceScale=.67;
       mesh.userData.faceRootedRuff=true;
       mesh.userData.contourAlignedForehead=true;
     }
   }
 }
 // Drive the thunder wolf tail from its living pelvis; for other species
 // preserve the original root-space animation and coordinates exactly.
 const tail=g.group('tail',
   s.id==='m004'?[0,.11,-.03]:[0,beastRemesh?1.176:1.35,beastRemesh?-.68:-.55],
   s.id==='m004'?g.pivots.pelvis:g.root);
 g.tube(tail,'skin',[[0,0,.05],[0,.17,-.34],[0,.08,-.50]],reptile?.14:.085);
 const tailMid=g.group('tailMid',[0,.08,-.50],tail);
 g.tube(tailMid,'skin',[[0,0,0],[0,.01,-.25-v*.05],[.09,-.11,-.49-v*.10]],reptile?.13:.078);
 const tailTip=g.group('tailTip',[.09,-.11,-.49-v*.10],tailMid);
 g.sphere(tailTip,'skin',[0,0,-.025],[.044,.047,.085]);
 // Felines need short sleek directional fur instead of reusing a wolf
 // winter coat. Only the lion grows a deep mane, anchored to its head
 // so it follows jaw anticipation and neck pitch without floating.
 if(felineMaster&&coatDetail!=='low'){
   const source=coatDetail==='source';
   // Both hair surfaces are anchored to the SAME anatomical loft as
   // the skull and the now slender shoulder/rib/waist. No wigs.
   const torsoCat=generateCanineAxialFurGuides({
     stations:bodyStations,rows:source?33:22,around:source?42:30,
     lengthProfile:[
       {z:bodyLength*1.00,length:felineMaster.guardHair*.64},
       {z:bodyLength*.70,length:felineMaster.guardHair},
       {z:bodyLength*.15,length:felineMaster.underHair},
       {z:-bodyLength*.35,length:felineMaster.underHair*.88},
       {z:-bodyLength*1.02,length:felineMaster.underHair*.55}
     ],
     width:.0085,seed:110+v*17,minVertical:-.96,maxVertical:.96,
     gravity:.19
   });
   const skullCat=fittedFelineMasterHair(felineMaster,source);
   addFur(torso,m001Flow(torsoCat));
   addFur(head,m001Flow(skullCat));
   g.root.userData.felineMasterSource=FELINE_SOURCE_MODEL;
   g.root.userData.felineReferenceCrownRows=
     REFERENCE_CROWN_QUALITY[source?'source':'high'].rows;
   g.root.userData.felineReferenceCrownLayers=
     REFERENCE_CROWN_QUALITY[source?'source':'high'].layers;
   g.root.userData.felineReferenceSeamCount=4;
   g.root.userData.felineMasterVariant=felineMaster.archetype;
   g.root.userData.felineFaceWidthRatio=felineMaster.headWidth;
   g.root.userData.felineTorsoWidth=felineMaster.torsoWidth;
   g.root.userData.felineFurGuides=skullCat.length;
 }else if(feline&&coatDetail!=='low'){
   // Keep original protected m006 coat completely unchanged.
   const master=coatDetail==='source',lion=s.id==='m008';
   addFur(torso,generateCanineFurGuides({
     center:[0,1.30,-.025],radii:[.44+(v%2)*.06,.43,.71+v*.06],
     rows:master?32:22,around:master?44:30,
     length:lion?.060:.038,width:lion?.013:.009,
     minVertical:-.88,maxVertical:.92,seed:110+v*17,gravity:.17,
   }));
   const cheek=generateCanineFurGuides({
     center:[0,.035,-.075],radii:[.32,.285,.32],
     rows:master?31:21,around:master?44:32,
     length:lion?.20:.039,width:lion?.031:.009,
     minVertical:-.83,maxVertical:.98,seed:157+v*19,gravity:.30,
   }).filter(strand=>strand.root[2]<(lion?.15:.065));
   addFur(head,cheek);
 }
 if(canine&&coatDetail!=='low'){
   if(beastRemesh){
     // Three lightweight tuft meshes, each attached to the existing
     // animated tail bone. Follicles get progressively longer without
     // a disconnected "ball on a stick" at the root or tip.
     const source=coatDetail==='source';
     const segments=[
       {parent:tail,label:'root',center:[0,.09,-.24],
        radii:[.094,.100,.304],length:.077,width:.013,
        rows:source?17:12,around:source?29:20},
       {parent:tailMid,label:'middle',center:[.035,-.025,-.225],
        radii:[.130,.145,.315],length:.194,width:.028,
        rows:source?24:17,around:source?37:25},
       {parent:tailTip,label:'tip',center:[0,0,-.075],
        radii:[.097,.110,.152],length:.224,width:.026,
        rows:source?18:13,around:source?31:23}
     ];
     for(let i=0;i<segments.length;i++){
       const segment=segments[i];
       const guides=generateCanineFurGuides({
         center:segment.center,radii:segment.radii,
         length:segment.length,width:segment.width,
         rows:segment.rows,around:segment.around,
         minVertical:-.99,maxVertical:1,
         seed:v*31+i*17+21,gravity:.21,
       });
       const coat=g.fur(segment.parent,'skin',doubleFurGuides(guides));
       if(coat){
         coat.name='beast-tail-coat-'+segment.label;
         coat.userData.furRegion='tail';
         coat.userData.furSegment=segment.label;
       }
     }
   }else addFur(tail,generateCanineFurGuides({
     center:[.015,.065,-.55-v*.055],radii:[.108,.124,.38+v*.04],
     rows:coatDetail==='source'?15:9,
     around:coatDetail==='source'?24:16,
     length:.15,width:.025,seed:v+21,minVertical:-.85,
   }));
 }
 if(!reptile){
   if(felineMaster){
    // The old 8-20 generic back spikes were placed at y=1.70 and
    // translated another -.72 along z, floating behind the cat's
    // shoulders. Only the ice sabertooth gets anatomical ice keratin.
    // Embed every root beneath the actual upper torso loft surface;
    // leave lion/leopard/tiger backs smooth and naturally feline.
    if(s.id==='m007'&&coatDetail!=='low'){
     const crystalCount=6;
     for(let i=0;i<crystalCount;i++){
      const z=.51-i*.174;
      const surface=felineDorsalSurface(felineMaster,z);
      const x=(i%2?1:-1)*.022;
      const base=[x,surface-.086,z+.034];
      const elbow=[x*.9,surface+.025,z-.024];
      const tip=[x*1.24,surface+.132+(i%3)*.015,z-.080];
      const ice=g.curvedHorn(torso,i%3===0?'accent':'light',
       base,elbow,tip,.024,
       {name:'feline-anatomical-ice-crest-'+i});
      ice.userData.felineDorsalRooted=true;
      ice.userData.felineDorsalSurface=surface;
      ice.userData.felineDorsalRootY=base[1];
      ice.userData.felineDorsalTipY=tip[1];
     }
    }
    g.root.userData.felineLegacyFloatingSpikesRemoved=true;
   }else if(beastRemesh){
    const count=9+v*2;
    for(let i=0;i<count;i++){
     const t=i/(count-1),z=.48-.99*t;
     const growth=Math.sin(Math.PI*(.12+.83*t)),height=.13+.19*growth;
     const spineY=1.525-.165*t;
     g.curvedHorn(torso,i%4===0?'bone':'light',
       [0,spineY-.04,z],[.014,spineY+.07+height*.49,z-.038],
       [.025,spineY+.095+height,z-.105],.04+.017*growth,
       {name:'beast-dorsal-horn-'+i});
    }
   }else for(let i=0;i<8+v*3;i++){
    const z=-.25+i*.085,y=1.70+.05*Math.sin(i);
    g.spike(torso,i%3===0?'accent':'light',[0,y,z-.72],[0,y+.10+(v===2?.20:.07),z-.78],.028);
   }
   if(feline&&!felineMaster){for(let i=0;i<5;i++)for(const side of [-1,1]){
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
 if(s.id==='m015')g.sphere(torso,'skin',[0,1.44,0],[.36,.55,.44]);
 else g.axialLoft(torso,'skin',[
   {z:.47,y:1.56,rx:.10,ry:.20},
   {z:.33,y:1.47,rx:.29,ry:.46},
   {z:.08,y:1.44,rx:.37,ry:.55},
   {z:-.28,y:1.43,rx:.31,ry:.43},
   {z:-.48,y:1.39,rx:.09,ry:.15}
  ],{name:'avian-keel-rib-cavity-'+s.id,rough:.9,ribbing:.008});
 g.sphere(torso,'light',[0,1.26,.31],[.27,.26,.26]);
 g.bridge(torso,'skin',[0,1.58,.18],[0,2.04,.30],.24,.18);
 const head=g.group('head',[0,2.00,.31]);
 // Birds retain the keratin beak but gain a rounded occiput and a
 // sculpted orbital rim as part of the same skull surface. Do not alter
 // m015 Tengu's protected humanoid proportions.
 if(s.id==='m015')g.sphere(head,'skin',[0,.03,0],[.25,.29,.28]);
 else g.anatomicalLoft(head,'skin',
   QUADRUPED_CRANIUM_RINGS.map(r=>({...r,
     y:r.y*.97,rx:r.rx*.76,rz:r.rz*.77,cz:(r.cz-.05)*.70
   })),{name:'avian-cranium-'+s.id,kind:'face',asymmetry:.03});
 g.spike(head,'accent',[0,-.07,.20],[0,-.20,.61],.13);
 g.eyes(head,.22,.08,.18,.046);
 for(let i=0;i<7+v*2;i++){
   const x=(i-(6+v*2)/2)*.054;
   g.spike(head,i%3?'light':'accent',[x,.23,-.12],[x*.9,.45+v*.045,-.20],.029);
 }
 for(const side of [-1,1]){
   const wing=g.group(side<0?'wingL':'wingR',[side*.30,1.77,-.06]);
   if(s.id==='m015'){
     // Humanoid tengu uses shared humanoid assets: preserve the exact
     // pre-refactor wing/leg geometry and animation contracts.
     g.tube(wing,'skin',[[0,0,0],[side*.55,.25,-.05],[side*1.18,.36,-.29],[side*1.56,.18,-.53]],.085);
     for(let i=0;i<15+v*4;i++){
       const t=i/(14+v*4),x=side*(.22+1.31*t);
       g.fin(wing,i%3?'light':'accent',[x,.12,-.10-t*.32],
         [x+side*(.20+.35*t),-.40-t*.47,-.20-t*.34],.07+Math.sin(t*Math.PI)*.09);
       g.fin(wing,'skin',[x,.17,-.08-t*.23],
         [x+side*(.14+.18*t),-.13-t*.18,-.17-t*.26],.058);
     }
     const leg=g.group('leg'+(side<0?'L':'R'),[side*.17,1.09,.10]);
     g.bone(leg,'skin',[0,0,0],[0,-.93,.12],.075);
     g.sphere(leg,'shadow',[0,-.93,.16],[.10,.08,.16]);
     g.claws(leg,[0,-.95,.24],1,3,1.3);
     continue;
   }
   // Shoulder -> elbow -> wrist: distinct physically movable local joints.
   g.tube(wing,'skin',[[0,0,0],[side*.28,.16,-.04],[side*.55,.25,-.05]],.082);
   const elbow=g.group('wingElbow'+(side<0?'L':'R'),[side*.55,.25,-.05],wing);
   g.tube(elbow,'skin',[[0,0,0],[side*.31,.055,-.11],[side*.63,.11,-.24]],.067);
   const wrist=g.group('wingWrist'+(side<0?'L':'R'),[side*.63,.11,-.24],elbow);
   g.tube(wrist,'skin',[[0,0,0],[side*.18,-.055,-.10],[side*.38,-.18,-.24]],.043);
   for(let i=0;i<15+v*4;i++){
     const t=i/(14+v*4);
     const x=side*(.22+1.31*t);
     const distal=t>.54,feather=distal?wrist:wing;
     const dx=distal?side*1.18:0,dy=distal?.36:0,dz=distal?-.29:0;
     g.fin(feather,i%3?'light':'accent',
       [x-dx,.12-dy,-.10-t*.32-dz],
       [x+side*(.20+.35*t)-dx,-.40-t*.47-dy,-.20-t*.34-dz],
       .07+Math.sin(t*Math.PI)*.09);
     // The secondary coverts follow the same hinged feather segment.
     g.fin(feather,'skin',[x-dx,.17-dy,-.08-t*.23-dz],
       [x+side*(.14+.18*t)-dx,-.13-t*.18-dy,-.17-t*.26-dz],.058);
   }
   const leg=g.group('leg'+(side<0?'L':'R'),[side*.17,1.09,.10]);
   g.bone(leg,'skin',[0,0,0],[0,-.47,.10],.082);
   const ankle=g.group('birdAnkle'+(side<0?'L':'R'),[0,-.47,.10],leg);
   g.bone(ankle,'skin',[0,0,0],[0,-.46,.02],.063);
   g.sphere(ankle,'shadow',[0,-.46,.06],[.10,.08,.16]);
   g.claws(ankle,[0,-.48,.14],1,3,1.3);
 }
 const tail=g.group('tail',[0,1.25,-.40]);
 for(let i=-3;i<=3;i++)g.fin(tail,i%2?'accent':'light',[i*.055,0,0],[i*.12,-.18,-.84-v*.10],.10);
 g.root.scale.setScalar(s.size*.80);
}
function insect(g,s,{spider=false}={}){
 const v=s.variant;
 const torso=g.group('torso');
 g.sphere(torso,'shadow',[0,1.03,-.16],[.50,.38,.63],{metal:.38,rough:.49});
 g.axialLoft(torso,'skin',[
   {z:.46,y:1.35,rx:.10,ry:.12},
   {z:.28,y:1.35,rx:.39,ry:.29},
   {z:-.18,y:1.34,rx:.53,ry:.33},
   {z:-.56,y:1.33,rx:.45,ry:.28},
   {z:-.89,y:1.31,rx:.11,ry:.11}
  ],{name:(spider?'arachnid':'insect')+'-segmented-thorax-'+s.id,
     rough:.46,ribbing:.023});
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
   // Anatomical arthropod chain: coxa/hip -> femur -> patella -> tibia
   // -> tarsus. The distal meshes inherit the proximal joint's rotation.
   // Formerly femur and tibia were welded to the same single leg pivot,
   // so the knee could neither lift nor flex during a step.
   const femur=g.group(name+'Femur',[0,0,0],leg);
   g.bone(femur,'skin',[0,0,0],bend,.085,{tipRadius:.055,metal:.4});
   const patella=g.group(name+'Patella',bend,femur);
   g.sphere(patella,'accent',[0,0,0],[.092,.09,.092],{metal:.4});
   const tibia=g.group(name+'Tibia',[0,0,0],patella);
   const distal=[foot[0]-bend[0],foot[1]-bend[1],foot[2]-bend[2]];
   g.bone(tibia,'shadow',[0,0,0],distal,.070,{tipRadius:.024,metal:.4});
   const tarsus=g.group(name+'Tarsus',distal,tibia);
   g.sphere(tarsus,'shadow',[0,0,0],[.050,.045,.050],{metal:.18});
   g.spike(tarsus,'bone',[0,0,0],[side*.11,-.08,0],.04);
 }
 if(!spider){
   if(s.id==='m023'){
     // Praying mantis: enlarged, folding raptorial forelegs, not a beetle horn.
     for(const side of [-1,1]){
       const claw=g.group('raptorial'+(side<0?'L':'R'),[side*.37,1.32,.52],torso);
       g.bone(claw,'skin',[0,0,0],[side*.25,-.19,.26],.11,{tipRadius:.08});
       const elbow=g.group('raptorialElbow'+(side<0?'L':'R'),[side*.25,-.19,.26],claw);
       g.bone(elbow,'skin',[0,0,0],[side*.17,-.22,.31],.085,{tipRadius:.024});
       for(let j=0;j<5;j++)
         g.spike(elbow,'bone',[side*.11,-.1-j*.023,.13+j*.04],
           [side*.06,-.19-j*.024,.18+j*.04],.019);
     }
   }
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
   // One contoured organic torso instead of two intersecting inflated
   // spheres. Broad shoulders, tapered ribs/waist and asymmetric chest.
   // All undead and fiends share a realistic baseline, never a hero model.
   const thin=s.id==='m032'?.83:s.id==='m031'?.72:s.id==='m035'?.88:1;
   const shoulder=s.id==='m034'?1.02:demon?1.10:1;
   const bodyRings=MORTAL_TORSO_RINGS.map(r=>({
     ...r,rx:r.rx*thin*(r.y>1.45?shoulder:1),
     rz:r.rz*(s.id==='m031'?.78:1),
   }));
   g.anatomicalLoft(torso,undead&&s.id==='m031'?'bone':'skin',
     bodyRings,{name:'monster-realistic-rib-waist',kind:'torso',
       asymmetry:undead?.27:.11});
   if(s.id==='m034'){
     // Tailored velvet shell has a distinct PBR material; the cadaver face
     // and hands below it are skin, not incorrectly textured like linen.
     g.anatomicalLoft(torso,'fabric',bodyRings.map(r=>({
       ...r,rx:r.rx*1.046,rz:r.rz*1.055,cz:(r.cz??0)-.012,
     })),{name:'m034-velvet-coat',kind:'torso'});
   }
 }
 g.bridge(torso,rock?'skin':'light',[0,1.80,.03],
   [0,2.12,.08],rock?.23:.17,rock?.185:.135);
 const head=g.group('head',[0,2.17,.08]);
 if(rock)g.rock(head,'skin',[0,0,0],[.30,.33,.30]);
 else if(s.id==='m032'){
   // Collapsed temples, protruding cheekbones, recessed sockets and an
   // actual nasal bridge are sculpted into continuous face topology.
   g.anatomicalLoft(head,'mortalSkin',MORTAL_HEAD_RINGS.map(r=>({
     ...r,rx:r.rx*.90,rz:r.rz*.95,
   })),{name:'m032-desiccated-cranium',kind:'face',asymmetry:.90});
   g.bridge(head,'bone',[0,-.085,.095],[0,-.19,.20],.151,.093);
   for(const side of [-1,1]){
     g.sphere(head,'shadow',[side*.175,.020,.223],[.078,.068,.027],
       {name:'m032-orbit'});
     g.sphere(head,'bone',[side*.175,.018,.237],[.030,.032,.014],
       {rough:.93,name:'m032-clouded-iris'});
     g.sphere(head,'skin',[side*.181,.086,.199],[.091,.030,.043],
       {name:'m032-brow-ridge'});
     g.bridge(head,'bone',[side*.147,-.102,.157],
       [side*.178,-.184,.160],.051,.031);
   }
 }else if(undead||demon){
   g.anatomicalLoft(head,
     s.id==='m031'?'bone':s.id==='m034'||demon?'mortalSkin':'skin',
     MORTAL_HEAD_RINGS.map(r=>({...r,
       rx:r.rx*(s.id==='m031'?.83:demon?.97:1),
       rz:r.rz*(s.id==='m031'?.91:1),
     })),{name:s.id+'-realistic-face',kind:'face',
       asymmetry:undead?.19:.06});
 }else g.sphere(head,'skin',[0,0,0],[.26,.32,.27]);
 if(s.id!=='m032'&&s.id!=='m034')g.eyes(head,.235,.043,.14,
   undead?.037:.035);
 if(s.id==='m034')sculptBloodMoonVampire(g,head,torso,
   {detail:g.root.userData.detail});
 if(undead&&['m031','m035'].includes(s.id)){
   for(const side of [-1,1])g.spike(head,'shadow',[side*.10,-.13,.23],[side*.12,-.26,.29],.045);
   for(let i=0;i<5;i++)g.bone(torso,'bone',[-.26,1.85-i*.16,.29],[.26,1.85-i*.16,.29],.028);
 }
 if(s.id==='m032'){
   // Volumetric linen wraps: separate body/neck/head ribbons with real UVs.
   // A gap across the eye line exposes both recessed eye sockets.
   g.bandage(torso,'bandage',{name:'m032-torso-wrap',center:[0,0,0],
     radii:[.416,.315],startY:1.05,endY:1.83,
     turns:6.3,width:.090,phase:.2,segments:g.root.userData.detail==='low'?35:110});
   g.bandage(torso,'bandage',{name:'m032-neck-wrap',center:[0,0,.05],
     radii:[.18,.17],startY:1.86,endY:2.09,
     turns:2.8,width:.065,phase:.5,segments:45});
   g.bandage(head,'bandage',{name:'m032-head-crown-wrap',center:[0,0,0],
     radii:[.247,.264],startY:.12,endY:.255,
     turns:2.4,width:.056,phase:.15,segments:48});
   g.bandage(head,'bandage',{name:'m032-head-jaw-wrap',center:[0,0,0],
     radii:[.241,.255],startY:-.265,endY:-.135,
     turns:2.2,width:.060,phase:1.1,segments:48});
   for(let i=0;i<5;i++){
     const x=(i-2)*.11;
     g.fin(torso,i%2?'bone':'light',[x,1.34,.335],
       [x+(i%2?.10:-.08),.91-(i%3)*.06,.35],.06);
   }
 }
 if(rock){
   g.sphere(torso,'accent',[0,1.38,.35],[.16,.20,.08],{glow:true,metal:.5});
   for(let i=0;i<7+v*2;i++){const a=i/(7+v*2)*Math.PI*2;
     g.spike(torso,i%2?'light':'skin',[.33*Math.cos(a),1.85,.2*Math.sin(a)],
       [.45*Math.cos(a),2.18+v*.025,.39*Math.sin(a)],.10);
   }
 }
 for(const side of [-1,1]){
   const suffix=side<0?'L':'R';
   const arm=g.group('arm'+suffix,[side*.46,1.84,0]);
   const elbow=g.group('elbow'+suffix,[side*.13,-.37,.12],arm);
   if(rock){
     g.rock(arm,'skin',[side*.06,-.17,0],[.245,.275,.24]);
     g.rock(elbow,'light',[side*.035,-.15,.045],[.185,.245,.195]);
   }else{
     // Conical skin/fascia sections overlap the joints, unlike single rigid
     // limb cylinders with visible circular cut ends.
     g.sphere(arm,s.id==='m034'?'mortalSkin':'skin',
       [0,-.02,0],[.182,.164,.17],
       {name:'monster-shoulder-volume'});
     g.bridge(arm,s.id==='m034'?'mortalSkin':'skin',
       [0,0,0],[side*.13,-.40,.12],.162,.115);
     g.sphere(arm,'shadow',[side*.13,-.37,.12],[.145,.140,.144],
       {name:'monster-elbow-socket'});
     g.bridge(elbow,s.id==='m034'?'mortalSkin':'skin',
       [0,.012,0],[side*.045,-.31,.045],.117,.077);
     g.sphere(elbow,s.id==='m034'?'mortalSkin':'skin',
       [side*.045,-.31,.045],[.097,.093,.10]);
   }
   // The sleeve must live on the SAME arm pivot that rotates at the elbow.
   // The folded edge buries the skin/armour cut line for each costume type.
   if(['m033','m034','m035','m045'].includes(s.id))
     g.seamHem(arm,s.id==='m033'||s.id==='m045'?'metal':'fabric',{
       center:[side*.123,-.358,.125],
       axis:[side*.24,-1,.12],
       radiusX:.135,radiusZ:.125,width:.055,thickness:.012,
       name:s.id+'-sleeve-cuff-'+suffix
     });
   if(s.id==='m034')sculptVampireHand(g,elbow,side,
     {detail:g.root.userData.detail});
   else g.claws(elbow,[side*.045,-.35,.15],1,
     rock?4:3,rock?1.35:1.1);
   const leg=g.group('leg'+suffix,[side*.19,.96,0]);
   const knee=g.group('knee'+suffix,[0,-.39,.04],leg);
   if(rock){
     g.rock(leg,'skin',[0,-.17,0],[.245,.30,.24]);
     g.rock(knee,'light',[0,-.18,.035],[.185,.27,.19]);
   }else{
     g.bridge(leg,s.id==='m034'?'mortalSkin':'skin',
       [0,.01,0],[0,-.40,.04],.183,.141);
     g.sphere(leg,'shadow',[0,-.39,.04],[.163,.148,.162],
       {name:'monster-knee-socket'});
     g.bridge(knee,s.id==='m034'?'mortalSkin':'skin',
       [0,0,0],[0,-.36,.03],.135,.090);
   }
   const ankle=g.group('ankle'+suffix,[0,-.33,.04],knee);
   g.sphere(knee,'shadow',[0,-.31,.05],[.141,.125,.145],
     {name:'monster-ankle-socket'});
   g.sphere(ankle,s.id==='m034'?'leather':'shadow',
     [0,-.066,.12],[.192,.115,.267],
     {name:s.id==='m034'?'m034-leather-boot':'monster-foot'});
   if(s.id==='m034'){
     // A real turned leather boot lip, attached to the ankle animation
     // hierarchy, prevents the upper from looking like an isolated shoe.
     g.seamHem(ankle,'leather',{center:[0,.023,.105],
       radiusX:.171,radiusZ:.183,width:.056,thickness:.014,
       name:'m034-boot-top-'+suffix});
     g.tube(ankle,'leather',[
       [-.159,-.031,.24],[0,-.025,.31],[.154,-.031,.24]],.012);
   }
   if(s.id==='m032'){
     const upperArm=[side*.05,-.17,.05];
     g.bandage(arm,'bandage',{name:'m032-upper-arm-'+suffix,
       center:upperArm,radii:[.174,.163],startY:-.20,endY:.10,
       turns:2.9,width:.067,phase:side*.17,segments:45});
     g.bandage(elbow,'bandage',{name:'m032-forearm-'+suffix,
       center:[side*.02,-.11,.025],radii:[.132,.127],
       startY:-.18,endY:.09,turns:2.8,width:.057,
       phase:side*.44,segments:40});
     g.bandage(leg,'bandage',{name:'m032-thigh-'+suffix,center:[0,-.16,.016],
       radii:[.188,.164],startY:-.17,endY:.12,
       turns:2.8,width:.067,phase:side*.30,segments:44});
     g.bandage(knee,'bandage',{name:'m032-shin-'+suffix,
       center:[0,-.15,.055],radii:[.146,.130],
       startY:-.20,endY:.10,turns:2.9,width:.056,
       phase:side*.63,segments:42});
   }
 }
 if(demon){
   for(const side of [-1,1]){
     // Skull-connected horn socket: no floating cone at the temporal bone.
     const base=[side*.20,.23,-.05],bend=[side*.34,.43+v*.025,-.12];
     g.sphere(head,'skin',[side*.205,.225,-.045],[.145,.135,.145],
       {name:'demon-horn-root'});
     g.bridge(head,'shadow',base,bend,.119,.078);
     g.spike(head,'shadow',bend,[side*.45,.65+v*.07,-.17],.078);
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
   // Old generic dark sphere obscured vampire tailoring and made every
   // undead look like the same toy silhouette.
   if(['m031','m035'].includes(s.id))
     g.sphere(torso,'shadow',[0,1.36,-.18],[.35,.48,.09],{rough:.91});
   if(s.id==='m033')
     g.spike(head,'metal',[0,.27,-.045],[0,.44,-.08],.066);
 }else if(rock){
   for(let i=0;i<8+v*2;i++){
     const side=i%2?-1:1,y=1.14+(i%5)*.14;
     g.rock(torso,i%3?'skin':'light',[side*.43,y,-.1+(i%3)*.11],[.19,.14,.15]);
   }
 }
 const jaw=g.group('jaw',[0,1.99,.18]);
 g.sphere(jaw,rock?'shadow':s.id==='m034'?'mortalSkin':'skin',
   [0,-.025,.035],s.id==='m034'?[.130,.056,.118]:[.185,.079,.165],
   {name:'monster-anatomical-lower-jaw'});
 g.root.scale.setScalar(s.size*(rock?.85:.87));
}
/** Marine serpent anatomy: axial undulation rather than decorative tiny
 * walking legs. The old quadruped stand-in was misleading for these IDs.
 * Segment joints and dorsal scutes are visible 3D meshes, not a billboard.
 */
function seaSerpent(g,s){
 const v=s.variant,torso=g.group('torso');
 // An eel / sea-dragon axial body: tapered cranial base, branchial swell,
 // abdomen and caudal peduncle. Section dimensions, not subdivision count,
 // now control the original creature silhouette.
 g.axialLoft(torso,'skin',[
   {z:1.05,y:1.06,rx:.12,ry:.12},
   {z:.81,y:1.04,rx:.24,ry:.22},
   {z:.46,y:1.01,rx:.39,ry:.34},
   {z:.04,y:1.00,rx:.43,ry:.35},
   {z:-.35,y:1.02,rx:.34,ry:.29},
   {z:-.63,y:1.02,rx:.25,ry:.22}
  ],{name:'marine-axial-cranial-abdominal-'+s.id,
     rough:.51,ribbing:.031});
 const spine=g.group('spineRear',[0,1.02,-.28],torso);
 g.axialLoft(spine,'skin',[
   {z:.16,y:0,rx:.275,ry:.245},
   {z:-.08,y:.02,rx:.28,ry:.23},
   {z:-.39,y:.065,rx:.235,ry:.197},
   {z:-.77,y:-.055,rx:.195,ry:.157}
  ],{name:'marine-posterior-spine-'+s.id,rough:.51,ribbing:.024});
 const tail=g.group('tail',[0,-.06,-.73],spine);
 g.axialLoft(tail,'skin',[
   {z:.17,y:0,rx:.212,ry:.168},
   {z:-.09,y:.013,rx:.19,ry:.147},
   {z:-.36,y:.038,rx:.155,ry:.112},
   {z:-.67,y:-.08,rx:.119,ry:.092}
  ],{name:'marine-caudal-muscle-'+s.id,rough:.50,ribbing:.019});
 const mid=g.group('tailMid',[0,-.08,-.63],tail);
 g.axialLoft(mid,'skin',[
   {z:.15,y:0,rx:.133,ry:.103},
   {z:-.12,y:.028,rx:.122,ry:.095},
   {z:-.36,y:.012,rx:.096,ry:.079},
   {z:-.59,y:-.105,rx:.057,ry:.045}
  ],{name:'marine-tail-tip-muscle-'+s.id,rough:.50,ribbing:.013});
 const tip=g.group('tailTip',[0,-.10,-.52],mid);
 g.fin(tip,'accent',[0,0,0],[0,.42,-.35],.18);
 const head=g.group('head',[0,1.11,.78]);
 // Leviathan and sea serpent: sculpted organic cranium and deep temporal
 // muscles instead of a flattened scaled sphere. Keep existing jaw pivot.
 g.anatomicalLoft(head,'skin',
   QUADRUPED_CRANIUM_RINGS.map(r=>({...r,
     y:r.y*.91,rx:r.rx*.94,rz:r.rz*1.23,cz:r.cz+.09,
   })),{name:'serpent-cranium-'+s.id,kind:'face',asymmetry:.10});
 g.bridge(head,'skin',[0,-.02,.22],[0,-.11,.67],.25,.13);
 g.sphere(head,'light',[0,-.13,.59],[.205,.105,.25]);
 g.eyes(head,.32,.09,.25,.042);
 for(const side of [-1,1]){
   g.sphere(head,'shadow',[side*.145,-.09,.80],[.030,.020,.025],{rough:.65});
   g.spike(head,'accent',[side*.23,.16,-.09],[side*.34,.34,-.12],.073);
 }
 const jaw=g.group('jaw',[0,1.03,.89]);
 g.sphere(jaw,'shadow',[0,-.07,.35],[.21,.07,.40]);
 // Sea-serpent species m020/m048 do not use the quadruped rig. Give
 // both a physically visible split between their skull and moving jaw.
 for(const side of [-1,1]){
   g.tube(head,'shadow',[
     [side*.239,-.137,.34],[side*.210,-.148,.55],
     [side*.141,-.151,.765]],.013);
   g.tube(jaw,'shadow',[
     [side*.235,-.056,.225],[side*.203,-.073,.435],
     [side*.137,-.074,.650]],.014);
   g.spike(jaw,'bone',[side*.148,-.030,.52],
     [side*.153,.058,.551],.026);
 }
 g.sphere(jaw,'shadow',[0,-.035,.405],[.143,.018,.176],
   {name:'quadruped-oral-cavity'});
 g.sphere(jaw,'light',[0,-.046,.47],[.090,.011,.099],
   {name:'quadruped-tongue'});
 for(let i=0;i<7+v*2;i++){
   const z=.43-i*.18,attach=i<5?torso:spine;
   const localZ=i<5?z:z+.30;
   const height=.16+.08*Math.sin(i*.6);
   g.fin(attach,i%3?'light':'accent',[0,1.30-(i<5?0:1.02),localZ],
     [0,1.30-(i<5?0:1.02)+height,localZ-.085],.11);
 }
 g.root.scale.setScalar(s.size*.87);
}
function aquatic(g,s){
 const v=s.variant;
 if(s.id==='m048'){seaSerpent(g,s);return;}
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
     const mid=g.group('tentacle'+i+'Mid',[x*.32,-.31,z*.25],tentacle);
     const tip=g.group('tentacle'+i+'Tip',[x*.32,-.29,z*.26],mid);
     const radius=.085+(v===3?.038:0);
     // Soft hydrostat: three tapering muscular sections bend independently,
     // unlike a rigid one-piece arm rotating from the mantle only.
     g.tube(tentacle,i%2?'light':'skin',[[0,0,0],[x*.15,-.15,z*.12],[x*.32,-.31,z*.25]],radius);
     g.sphere(tentacle,'skin',[x*.32,-.31,z*.25],[radius*1.03,radius*1.05,radius*1.02]);
     g.tube(mid,i%2?'light':'skin',[[0,0,0],[x*.16,-.18,z*.15],[x*.32,-.29,z*.26]],radius*.78);
     g.sphere(mid,'skin',[x*.32,-.29,z*.26],[radius*.84,radius*.83,radius*.86]);
     g.tube(tip,i%2?'light':'skin',
       [[0,0,0],[x*.16,.03,z*.17],[x*(.53+v*.05),.08+(i%3)*.11,z*(.55+v*.04)]],
       radius*.54);
     // Raised cup-like suckers remain grouped to the moving arm section.
     for(let j=0;j<6;j++){
       const segment=j<2?tentacle:j<4?mid:tip;
       const local=j%2+1,scale=j<2?1:j<4?.8:.57;
       g.sphere(segment,'accent',[x*.075*local,-.11*local,z*.064*local],
         [.05*scale,.018*scale,.045*scale],{rough:.56});
       g.sphere(segment,'shadow',[x*.075*local,-.11*local+.002,z*.064*local],
         [.020*scale,.011*scale,.021*scale],{rough:.59});
     }
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
/**
 * Species-matched regalia for NONHUMAN bosses. Armour is fitted into the
 * existing anatomical torso, follows its motion and keeps paws / wings free.
 * Never dress natural wolves, spiders or the separately protected m005/m006.
 * Outfitting only the relevant mythical/armoured species avoids generic
 * humanoid clothes and preserves all 50 species silhouettes.
 */
export const NONHUMAN_MONSTER_WARDROBE=Object.freeze({
 m008:Object.freeze({name:'lion-king-regalia',role:'fabric',w:.43,y:1.30}),
 m012:Object.freeze({name:'griffin-royal-harness',role:'metal',w:.36,y:1.44}),
 m017:Object.freeze({name:'basilisk-scale-plate',role:'metal',w:.43,y:1.30}),
 m050:Object.freeze({name:'sea-god-raiment',role:'metal',w:.43,y:1.30}),
});
export function addNonhumanMonsterWardrobe(g,s){
 const plan=NONHUMAN_MONSTER_WARDROBE[s.id];
 if(!plan)return false;
 const torso=g.pivots.torso;
 if(!torso)throw Error('Regalia needs original anatomical torso '+s.id);
 const {w,y,name,role}=plan,outer=w*.92;
 for(const side of [-1,1]){
  // Embedded overlapping segments instead of detached spheres. They remain
  // a thin surface on top of the actual skin/scale envelope.
  for(let row=0;row<3;row++){
   const z=-.28+row*.28;
   g.sphere(torso,role,[side*outer,y+.09,z],
    [.076,.238,.205],{
     name:'monster-outfit-'+name+'-flank-'+(side<0?'L':'R')+'-'+row,
     metal:role==='metal'?.70:.1,rough:role==='metal'?.48:.82
    });
  }
  g.tube(torso,'leather',[
   [side*w*.62,y+.35,-.40],[side*outer,y+.34,-.22],
   [side*(outer+.015),y+.32,.12],[side*w*.67,y+.36,.34]
  ],.024);
  g.sphere(torso,'accent',[side*(outer+.024),y+.35,.14],
   [.042,.042,.027],{name:'monster-outfit-'+name+'-clasp-'+side,
     metal:.45,rough:.48});
 }
 g.root.userData.nonhumanOutfit=name;
 return true;
}
export function createMonsterModel(spec,{detail='high'}={}){
 if(!spec||!spec.family)throw Error('Invalid monster definition');
 const g=createSculpture(spec,detail);
 switch(spec.family){
   case 'beast':quadruped(g,spec);break;
   case 'feline':quadruped(g,spec,{feline:true});break;
   case 'reptile':spec.id==='m020'?seaSerpent(g,spec):quadruped(g,spec,{reptile:true});break;
   case 'avian':bird(g,spec);break;
   case 'insect':insect(g,spec);break;
   case 'arachnid':insect(g,spec,{spider:true});break;
   case 'undead':upright(g,spec,{undead:true});break;
   case 'golem':upright(g,spec,{rock:true});break;
   case 'fiend':upright(g,spec,{demon:true});break;
   case 'aquatic':aquatic(g,spec);break;
   default:throw Error('Unknown anatomy: '+spec.family);
 }
 addNonhumanMonsterWardrobe(g,spec);
 // The optional effects are created lazily only when a rendered near-LOD
 // m001 performs an action. Pure timing tests can import monster-animation
 // without importing Three.js or allocating a GPU mesh.
 if(spec.id==='m001')g.root.m001FxThree=THREE;
 g.root.userData.speciesId=spec.id;
 g.root.userData.pivots=g.pivots;
 g.root.userData.homeScale=g.root.scale.x;
 g.root.userData.surfaceFamily=spec.family;
 g.root.userData.anatomyEvidence=monsterEvidenceFor(spec);
 // The identity randomizer used to shift the "eye" iris alone while the
 // pupil, orbital aperture and lids stayed at their sculpted coordinates.
 // Lock m001's eye / jaw profile to the anatomical source instead.
 attachMonsterFaceControls(g.root,{id:spec.id,
   overrides:spec.id==='m001'?{
     eyesType:'almond',eyeSpacing:1,eyeSize:1,
     mouthType:'neutral',mouthWidth:1,mouthFullness:1
   }:{} });
 return g.root;
}
export {disposeMonsterSculpture};
// All renderer metrics share this module's exact shape/material instance.
// Never independently import a differently versioned shape-kit into the UI.
export {MONSTER_DETAIL_LEVELS,monsterSculptCacheStats} from './monster-shape-kit.js?v=m001-crown-motion-v17-20261117';
export {monsterPhotoCacheStats} from './monster-photo-pbr.js?v=4.4.81';
