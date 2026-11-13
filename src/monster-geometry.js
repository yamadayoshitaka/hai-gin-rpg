/**
 * Ten reusable anatomical families, fifty distinct sculptures. Beyond colour,
 * variants change horns, crests, armour, wings, limb lengths, weapons and fins.
 * Each specimen is real 3D geometry, never an image billboard.
 */
import {createSculpture,disposeMonsterSculpture} from './monster-shape-kit.js?v=4.5.03';
import {attachMonsterFaceControls} from './facial-feature-runtime.js?v=1';
import {generateCanineFurGuides} from './canine-fur-guides.js?v=4.4.92';
import {monsterEvidenceFor} from './monster-anatomy-reference.js';
import {MORTAL_HEAD_RINGS,MORTAL_TORSO_RINGS} from './monster-realistic-loft.js';
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
function feet(g,pivot,x,y,z,clawed=true,scale=1){
 g.sphere(pivot,'skin',[0,-.28,0],[.14*scale,.30*scale,.15*scale]);
 g.sphere(pivot,'shadow',[0,-.53,.13],[.13*scale,.08*scale,.22*scale]);
 if(clawed)g.claws(pivot,[0,-.56,.22],1,3,.78*scale);
}
function quadruped(g,s,{feline=false,reptile=false}={}){
 const v=s.variant,k=s.size;
 const canine=!feline&&!reptile;
 const coatDetail=g.root.userData.detail;
 const addFur=(parent,guides)=>{
   // Material groups are batched: three draw calls instead of hundreds of
   // individual cones. The original fur photo/normal maps remain intact.
   for(const shade of ['skin','light','shadow']){
     const strands=guides.filter(a=>a.shade===shade);
     if(strands.length)g.fur(parent,shade,strands);
   }
 };
 const torso=g.group('torso');
 if(s.id==='m004'){
   // Grey wolf gallop: independent lumbar and pelvic segments allow hind
   // limbs and tail to flex with the axial spine. Keep only this animal's
   // hind limbs parented to the pelvis; all other species retain old rigs.
   const lumbar=g.group('lumbar',[0,1.30,-.36],torso);
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
       [side*.33,1.42,.36],torso);
     g.bridge(shoulder,'skin',[0,-.165,-.13],
       [side*.035,.160,.10],.144,.079);
     g.sphere(shoulder,'light',[0,.025,-.025],
       [.113,.184,.173],{name:'m004-scapular-shoulder'});
   }
   const neck=g.group('neckCollar',[0,1.43,.49],torso);
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
       [side*.332,1.46,.30],torso);
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
       [side*.21,1.55,.50],torso);
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
       [side*.335,1.43,.25],torso);
     g.bridge(scapula,'skin',[0,-.14,-.13],
       [side*.027,.155,.19],.126,.075);
     g.sphere(scapula,'light',[side*.018,.066,-.010],
       [.072,.145,.165],{name:'m002-scapular-muscle'});
   }
 }
 g.sphere(torso,'skin',[0,1.30,0],[.43+(v%2)*.06,.43,.72+v*.06]);
 g.sphere(torso,'light',[0,1.48,.22],[.31,.25,.45]);
 // Continuous neck transitions from the shoulder mass into the skull,
 // avoiding the visible "two spheres glued together" silhouette.
 g.bridge(torso,'skin',[0,1.35,.32],[0,1.57,.76+v*.055],.325,.215);
 const head=g.group('head',[0,1.56,.70+v*.06]);
 // Rigid reptilian wedge instead of the same spherical skull as a cat.
 const skullWidth=reptile?.905:feline?.95:1;
 const skullDepth=reptile?1.065:feline?.965:1;
 g.anatomicalLoft(head,'skin',
   QUADRUPED_CRANIUM_RINGS.map(r=>({
     ...r,rx:r.rx*skullWidth,rz:r.rz*skullDepth,
   })),{name:'organic-cranium-'+s.id,kind:'face',
     asymmetry:reptile?.10:.04});
 if(reptile){
   g.bridge(head,'skin',[0,.045,-.19],[0,-.085,.55],.257,.128);
 }else if(feline){
   g.bridge(head,'skin',[0,-.028,.10],[0,-.12,.36],.209,.131);
 }
 if(canine){
   // Muzzle grows out of the cranium as a continuous tapered nasal bridge,
   // not a second round sphere pasted onto the face.
   g.bridge(head,'skin',[0,-.02,.13],[0,-.10,.54],.245,.125);
 }
 const muzzle=reptile?.57:feline?.32:.43;
 if(reptile){
   g.bridge(head,'skin',[0,-.115,.245],[0,-.152,.82],.203,.116);
   g.sphere(head,'light',[0,-.162,.684],[.145,.064,.226]);
 }else g.sphere(head,'light',[0,-.13,muzzle],
   feline?[.204,.126,.259]:[.23,.15,.31]);
 g.sphere(head,'shadow',[0,-.17,muzzle+.19],[.18,.057,.12],{name:'nose'});
 if(canine){
   // Small almond eyes set INTO the bone, heavy brows, wet nose and
   // divided nostrils. Oversized glowing button eyes looked like toys.
   for(const side of [-1,1]){
     g.sphere(head,'shadow',[side*.300,.110,.30],[.023,.037,.078]);
     g.sphere(head,'eye',[side*.320,.112,.31],[.013,.018,.041],{rough:.17});
     g.sphere(head,'skin',[side*.297,.167,.29],[.047,.041,.096]);
     g.sphere(head,'shadow',[side*.083,-.164,muzzle+.288],[.027,.019,.011]);
     g.tube(head,'shadow',[[side*.08,-.23,.53],[side*.13,-.235,.58],
       [side*.16,-.213,.62]],.009);
   }
   // Philtrum separates the lip pads and links them naturally to the nose.
   g.tube(head,'shadow',[[0,-.195,muzzle+.285],[0,-.235,muzzle+.275],
      [0,-.26,muzzle+.22]],.009);
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
 }else if(feline){
   // Cats need their own front-facing oval orbital cavities and vertical
   // pupils. The generic round eye guide previously looked pasted on.
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
     if(s.id==='m004'){
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
   g.spike(head,'bone',[side*.13,-.20,muzzle+.08],[side*.13,-.31,muzzle+.22],.046);
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
   g.sphere(head,'shadow',[0,-.164,muzzle+.294],
     [.145,.045,.088],{name:'m002-rhinarium'});
 }
 if(s.id==='m001'){
   // Species m001 cranial remesh: cheek musculature, brow, nasal cartilage.
   // These intersect the existing skull to avoid disconnected sphere seams.
   g.bridge(head,'skin',[0,.062,-.18],[0,-.03,.38],.188,.113);
   for(const side of [-1,1]){
     g.sphere(head,'skin',[side*.220,-.065,.111],[.125,.135,.207]);
     g.sphere(head,'shadow',[side*.308,.092,.277],[.023,.017,.090],{rough:.78});
     g.tube(head,'skin',[[side*.23,.12,-.055],[side*.30,.13,.105],
        [side*.325,.099,.205]],.029);
     for(let j=0;j<3;j++)
       g.sphere(head,'shadow',[side*(.149+j*.025),-.191,muzzle+.12+j*.035],
         [.006,.006,.008],{rough:.82});
   }
   g.sphere(head,'shadow',[0,-.171,muzzle+.295],[.155,.048,.09],
     {name:'wolf-nasal-cartilage'});
 }
 const jaw=g.group('jaw',[0,1.42,.96]);
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
 g.sphere(jaw,'shadow',[0,-.03,.12],[.24,.045,.29]);
 if(canine)g.sphere(jaw,'skin',[0,-.054,.155],[.22,.060,.27]);
 // Actual mouth split: upper lip belongs to the cranium, lower labial
 // margin and a recessed oral cavity follow the opening jaw pivot.
 // Keep both surfaces slightly overlapping in the idle pose.
 const jawOffsetZ=.26-v*.06;
 for(const side of [-1,1]){
   g.tube(head,'shadow',[
     [side*.205,-.192,.135],
     [side*.204,-.200,muzzle+.025],
     [side*.155,-.214,muzzle+.263]],.012);
   g.tube(jaw,'shadow',[
     [side*.200,-.052,.135-jawOffsetZ],
     [side*.198,-.061,muzzle+.025-jawOffsetZ],
     [side*.153,-.065,muzzle+.263-jawOffsetZ]],.013);
 }
 g.sphere(jaw,'shadow',[0,-.035,muzzle-.18+v*.06],
   [.136,.018,.145],{name:'quadruped-oral-cavity'});
 g.sphere(jaw,'light',[0,-.044,muzzle-.12+v*.06],
   [.084,.014,.098],{name:'quadruped-tongue'});
 for(let i=0;i<4;i++)g.spike(jaw,'bone',[(i-1.5)*.12,.01,.27],[(i-1.5)*.12,-.10,.29],.025);
 for(const side of [-1,1])for(const fore of [-1,1]){
   const name=(fore===1?'front':'rear')+(side<0?'L':'R');
   // Former limb pivot at y=1.13 kept all four feet half a metre above
   // terrain. Plant the soles near ground zero and embed hips in the torso.
   // Only the thunder wolf's rear legs follow the lumbar/pelvic hinge.
   // Local coordinates preserve the original hip world-space placement.
   const pelvisMounted=s.id==='m004'&&fore<0;
   const leg=g.group('leg'+name,
     pelvisMounted?[side*.29,-.57,.03]:[side*.29,.67,fore*.49],
     pelvisMounted?g.pivots.pelvis:g.root);
   // Distal motion is independent from shoulder/hip rotation, retaining
   // the original limb and ground-contact positions.
   g.sphere(leg,'skin',[0,.17,0],
     [reptile?.18:.21,.40,reptile?.18:.21]);
   const distal=g.group('lower'+name,[0,-.065,.015],leg);
   g.sphere(distal,'skin',[0,-.16,0],[reptile?.13:.15,.27,reptile?.13:.15]);
   g.sphere(distal,'shadow',[0,0,0],[.144,.125,.14],{name:'joint-'+name});
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
   g.sphere(leg,'skin',[0,-.04,.015],[.18,.18,.18]);
   if(canine&&coatDetail!=='low'){
     // Each fur region belongs to its own anatomical joint. Previously
     // all three patches lived on 'leg', so the shank and paw coat detached
     // from the moving lower/hock/toe joints during a trot or gallop.
     const source=coatDetail==='source',near=fore===1;
     const upper=generateCanineFurGuides({
       center:[0,.17,0],radii:[.215,.395,.215],
       rows:source?29:18,around:source?30:21,
       length:near?.083:.101,width:.014,seed:v*19+side*5+fore*7+31,
       minVertical:-.85,axis:'y',gravity:.20,
     });
     const lower=generateCanineFurGuides({
       center:[0,-.28,0],radii:[.145,.29,.156],
       rows:source?24:15,around:source?26:18,
       length:.064,width:.011,seed:v*13+side*7+fore*11+43,
       minVertical:-.72,axis:'y',gravity:.21,
     });
     const toeParent=(s.id==='m003'||s.id==='m004')?
       g.pivots['toe'+name]:distal;
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
       {joint:leg,region:'upper',guides:upper},
       {joint:distal,region:'lower',guides:lower},
       {joint:toeParent,region:'paw',guides:paw},
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
   const flank=generateCanineFurGuides({
     center:[0,1.30,0],radii:[.44+(v%2)*.06,.43,.71+v*.06],
     rows:source?40:27,around:source?50:38,
     length:.104,width:.023,seed:v*3+1,
     minVertical:-.99,maxVertical:.98,
   });
   const chest=generateCanineFurGuides({
     center:[0,1.43,.39],radii:[.32,.29,.36],
     rows:source?23:14,around:source?32:23,
     length:.15,width:.024,seed:v*11+19,
     minVertical:-.94,maxVertical:.79,gravity:.28,
   });
   addFur(torso,[...flank,...chest]);
   // Merge the long ruff with short skull and cheek hairs, preserving
   // the original three material batches and keeping eyes unobstructed.
   const faceGuides=[
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
   addFur(head,faceGuides);
 }
 // Drive the thunder wolf tail from its living pelvis; for other species
 // preserve the original root-space animation and coordinates exactly.
 const tail=g.group('tail',
   s.id==='m004'?[0,.11,-.03]:[0,1.35,-.55],
   s.id==='m004'?g.pivots.pelvis:g.root);
 g.tube(tail,'skin',[[0,0,.05],[0,.17,-.34],[0,.08,-.50]],reptile?.14:.085);
 const tailMid=g.group('tailMid',[0,.08,-.50],tail);
 g.tube(tailMid,'skin',[[0,0,0],[0,.01,-.25-v*.05],[.09,-.11,-.49-v*.10]],reptile?.13:.078);
 const tailTip=g.group('tailTip',[.09,-.11,-.49-v*.10],tailMid);
 g.sphere(tailTip,'skin',[0,0,-.025],[.044,.047,.085]);
 // Felines need short sleek directional fur instead of reusing a wolf
 // winter coat. Only the lion grows a deep mane, anchored to its head
 // so it follows jaw anticipation and neck pitch without floating.
 if(feline&&coatDetail!=='low'){
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
 if(canine&&coatDetail!=='low')addFur(tail,generateCanineFurGuides({
   center:[.015,.065,-.55-v*.055],radii:[.108,.124,.38+v*.04],
   rows:coatDetail==='source'?15:9,
   around:coatDetail==='source'?24:16,
   length:.15,width:.025,seed:v+21,minVertical:-.85,
 }));
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
 g.sphere(torso,'skin',[0,1.0,.35],[.39,.36,.77],{rough:.48});
 g.bridge(torso,'skin',[0,1.05,-.12],[0,1.0,.63],.37,.25);
 const spine=g.group('spineRear',[0,1.02,-.28],torso);
 g.tube(spine,'skin',[[0,0,0],[0,.07,-.32],[0,-.06,-.75]],.27);
 const tail=g.group('tail',[0,-.06,-.73],spine);
 g.tube(tail,'skin',[[0,0,0],[0,.04,-.28],[0,-.08,-.63]],.195);
 const mid=g.group('tailMid',[0,-.08,-.63],tail);
 g.tube(mid,'skin',[[0,0,0],[0,.04,-.25],[0,-.10,-.52]],.125);
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
 g.root.userData.speciesId=spec.id;
 g.root.userData.pivots=g.pivots;
 g.root.userData.homeScale=g.root.scale.x;
 g.root.userData.surfaceFamily=spec.family;
 g.root.userData.anatomyEvidence=monsterEvidenceFor(spec);
 attachMonsterFaceControls(g.root,{id:spec.id});
 return g.root;
}
export {disposeMonsterSculpture};
// All renderer metrics share this module's exact shape/material instance.
// Never independently import a differently versioned shape-kit into the UI.
export {MONSTER_DETAIL_LEVELS,monsterSculptCacheStats} from './monster-shape-kit.js?v=4.5.03';
export {monsterPhotoCacheStats} from './monster-photo-pbr.js?v=4.4.81';
