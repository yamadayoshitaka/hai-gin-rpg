/**
 * Ten reusable anatomical families, fifty distinct sculptures. Beyond colour,
 * variants change horns, crests, armour, wings, limb lengths, weapons and fins.
 * Each specimen is real 3D geometry, never an image billboard.
 */
import {createSculpture,disposeMonsterSculpture} from './monster-shape-kit.js?v=4.4.92';
import {attachMonsterFaceControls} from './facial-feature-runtime.js?v=1';
import {generateCanineFurGuides} from './canine-fur-guides.js?v=4.4.92';
import {monsterEvidenceFor} from './monster-anatomy-reference.js';
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
 g.sphere(head,'skin',[0,.03,.06],[.33,.28,.36]);
 if(canine){
   // Muzzle grows out of the cranium as a continuous tapered nasal bridge,
   // not a second round sphere pasted onto the face.
   g.bridge(head,'skin',[0,-.02,.13],[0,-.10,.54],.245,.125);
 }
 const muzzle=reptile?.57:feline?.32:.43;
 g.sphere(head,'light',[0,-.13,muzzle],[.23,.15,.31]);
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
 }else{
   g.eyes(head,.35,.11,.20,.055);
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
     g.spike(head,v===2?'accent':'bone',[side*.21,.24,.0],
       [side*(.38+v*.045),.47+horn,-.13],.085);
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
       g.spike(toe,'bone',[x,-.054,.192],[x,-.090,.262],.021);
     }
   }else{
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
       g.spike(toe,'bone',[x,-.025,.177],
         [x,-.073,.262],.024);
     }
   }
   g.sphere(leg,'skin',[0,-.04,.015],[.18,.18,.18]);
   if(canine&&coatDetail!=='low'){
     // Attach to the leg pivot so the coat swings with every footstep.
     // The upper shank, lower forearm/hock, and paw use shorter strands
     // than the shoulder and chest. One mesh per leg preserves draw calls.
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
     const paw=generateCanineFurGuides({
       center:[0,-.53,.125],radii:[.136,.083,.195],
       rows:source?12:8,around:source?20:14,
       length:.028,width:.009,seed:v*17+side*5+fore*7+57,
       minVertical:-.15,maxVertical:.86,gravity:.20,
     });
     const legCoat=[...upper,...lower,...paw];
     const furMesh=g.fur(leg,'skin',legCoat);
     furMesh.name='canine-coat-leg'+name;
     furMesh.userData.furRegion='limb';
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
 g.sphere(head,'skin',[0,.03,0],[.25,.29,.28]);
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
 if(!spider)g.eyes(head,.28,.09,.20,.06);
 for(const side of [-1,1]){
   if(!spider){
     g.tube(head,'accent',[[side*.13,.20,.16],[side*.25,.53,.33],[side*.37,.61,.38]],.025);
     g.spike(head,'bone',[side*.16,-.13,.31],[side*.27,-.30,.60],.09);
   }else{
     // Spider pedipalps are short paired sensory appendages, not the
     // long beetle antennae used by the six-legged insect family.
     g.tube(head,'accent',[[side*.17,-.04,.18],[side*.31,-.15,.34],[side*.29,-.20,.48]],.034);
     g.sphere(head,'skin',[side*.29,-.20,.48],[.052,.047,.067],{rough:.68});
   }
 }
 const jaws=g.group('jaw',[0,1.20,.82]);
 for(const side of [-1,1]){
   if(spider){
     // Bulbous chelicerae and downward-curving fangs read as arachnid
     // anatomy even when the camera is low or the face is in shadow.
     g.sphere(jaws,'skin',[side*.135,-.035,.15],[.13,.15,.18],{rough:.61});
     g.tube(jaws,'bone',[[side*.135,-.10,.24],[side*.11,-.24,.36],[side*.045,-.30,.39]],.048);
   }else g.spike(jaws,'bone',[side*.16,0,0],[side*.11,-.10,.35],.075);
 }
 const count=spider?4:3;
 for(const side of [-1,1])for(let i=0;i<count;i++){
   const z=.46-i*.36;const name='leg'+(side<0?'L':'R')+i;
   const leg=g.group(name,[side*.35,1.12,z]);
   const bend=[side*(.45+(i===0?.12:0)),i===3?.02:.22,(i-1)*.16];
   const foot=[side*(.72+i*.05),-.94,(i-1.5)*.23];
   if(spider){
     // Spiders need a raised femur, a distinct patella and a descending
     // tibia/metatarsus. The former two-stick silhouette looked like a
     // six-legged beetle and buried the distal joints in the ground.
     // Keep all segments under the original leg pivot for gait animation.
     const spread=.56+i*.095+v*.018;
     const knee=[side*spread,.32+(i%2)*.075,(1.5-i)*.205];
     const ankle=[side*(.88+i*.065),-.72,(1.5-i)*.255];
     const toe=[side*(.99+i*.07),-1.095,(1.5-i)*.27+.045];
     g.bone(leg,'skin',[0,0,0],knee,.077,{tipRadius:.058,metal:.16});
     g.sphere(leg,'accent',knee,[.093,.092,.093],{metal:.20,rough:.55});
     g.bone(leg,'skin',knee,ankle,.062,{tipRadius:.037,metal:.16});
     g.sphere(leg,'shadow',ankle,[.066,.072,.066],{metal:.12,rough:.63});
     g.bone(leg,'shadow',ankle,toe,.036,{tipRadius:.014,metal:.08});
     // Paired, slightly splayed tarsal claws remain above the floor and
     // make the terminal foot visibly grasp rather than end in one spike.
     for(const clawSide of [-1,1])g.spike(leg,'bone',toe,
       [toe[0]+side*.065,toe[1]-.024,toe[2]+clawSide*.065],.018);
     // Sparse tactile spines follow the upper limb, not a floating torso
     // decoration. Variant spacing keeps the five spider species distinct.
     for(let j=1;j<=3+v%2;j++){
       const t=j/(5+v%2);
       const point=[knee[0]*t,knee[1]*t,knee[2]*t];
       g.spike(leg,'shadow',point,
         [point[0]+side*(.07+v*.005),point[1]+.055,point[2]-.035],.013);
     }
   }else{
     g.bone(leg,'skin',[0,0,0],bend,.085,{tipRadius:.055,metal:.4});
     g.sphere(leg,'accent',bend,[.092,.09,.092],{metal:.4});
     g.bone(leg,'shadow',bend,foot,.070,{tipRadius:.024,metal:.4});
     g.spike(leg,'bone',foot,[foot[0]+side*.11,foot[1]-.08,foot[2]],.04);
   }
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
   // Articulated dorsal plate ridges and paired spinnerets are actual
   // geometry, not a painted decal; the abdomen pivot remains animatable.
   for(let i=0;i<4+v%2;i++){
     const z=-.55+i*.145;
     const width=.24+.075*Math.sin((i+1)*Math.PI/6);
     g.bridge(abdomen,i%2?'accent':'shadow',
       [-width,.315,z],[width,.315,z],.023,.018);
   }
   // Paired lateral abdominal scutes overlap the dorsal shield instead of
   // leaving an unnaturally smooth sphere. Each variant retains its own
   // contour and the abdomen remains on the original animation pivot.
   for(const side of [-1,1])for(let i=0;i<3+v%2;i++){
     const z=-.56+i*.20;
     const x=side*(.38+.035*Math.sin((i+1)*1.2));
     g.sphere(abdomen,i%2?'shadow':'accent',
       [x,.12-i*.028,z],[.075,.15,.135],{metal:.10,rough:.67});
     g.spike(abdomen,'shadow',[x,.16,z-.04],
       [x+side*.07,.20,z-.13],.018);
   }
   // Paired spinnerets emerge from articulated basal sockets, tapering
   // backwards in two sections instead of looking like rigid thorns.
   // Their independent groups preserve the existing abdomen gait pivot.
   for(const side of [-1,1]){
     const spinneret=g.group('spinneret'+(side<0?'L':'R'),
       [side*.115,-.19,-.73]);
     const elbow=[side*.035,-.055,-.115-v*.006];
     const tip=[side*.065,-.09,-.21-v*.014];
     g.sphere(spinneret,'skin',[0,0,0],[.067,.054,.075],
       {metal:.06,rough:.76});
     g.bone(spinneret,'shadow',[0,0,0],elbow,.043,
       {tipRadius:.030,metal:.04});
     g.sphere(spinneret,'accent',elbow,[.037,.036,.038],
       {metal:.06,rough:.75});
     g.bone(spinneret,'shadow',elbow,tip,.029,
       {tipRadius:.012,metal:.04});
   }
   // Each of the four eye pairs sits in a raised socket, reducing the
   // floating-neon-dot appearance without modifying shared face assets.
   for(const side of [-1,1])for(let i=0;i<4;i++){
     const x=side*(.07+i*.072),y=.12+(i%2)*.06;
     // Project each socket onto the ellipsoid face rather than burying
     // the eyes inside its surface (head radii .35/.30/.35).
     const faceZ=.35*Math.sqrt(Math.max(.08,1-(x/.35)**2-(y/.30)**2));
     g.sphere(head,'shadow',[x,y,faceZ+.008],[.036,.039,.024],{rough:.75});
     g.sphere(head,'eye',[x,y,faceZ+.030],[.023,.026,.014],{glow:true});
   }
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
 g.sphere(head,'skin',[0,.03,.13],[.32,.26,.48]);
 g.bridge(head,'skin',[0,-.02,.22],[0,-.11,.67],.25,.13);
 g.sphere(head,'light',[0,-.13,.59],[.205,.105,.25]);
 g.eyes(head,.32,.09,.25,.042);
 for(const side of [-1,1]){
   g.sphere(head,'shadow',[side*.145,-.09,.80],[.030,.020,.025],{rough:.65});
   g.spike(head,'accent',[side*.23,.16,-.09],[side*.34,.34,-.12],.073);
 }
 const jaw=g.group('jaw',[0,1.03,.89]);
 g.sphere(jaw,'shadow',[0,-.07,.35],[.21,.07,.40]);
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
export {MONSTER_DETAIL_LEVELS,monsterSculptCacheStats} from './monster-shape-kit.js?v=4.4.92';
export {monsterPhotoCacheStats} from './monster-photo-pbr.js?v=4.4.81';
