/**
 * Four 2D-reference beetles realized as actual game meshes (not illustrations).
 * m021 steel fortress, m022 lacquered crimson, m025 divine gilded,
 * m024 toxic purple. The donor still owns the six leg and wing pivots.
 */
export const BEETLE_CONCEPT_REVISION='beetle-four-reference-sculpt-v1-20261121';
export const BEETLE_CONCEPT_SPECIES=Object.freeze(['m021','m022','m024','m025']);

const LR=[-1,1];
const sideName=side=>side<0?'L':'R';
const v=(side,x,y,z)=>[side*x,y,z];
function plate(g,parent,id,name,xyz,radii,shade,finish,rotation=0){
 const mesh=g.sphere(parent,shade,xyz,radii,{
  name:id+'-concept-'+name,surface:'chitin',finish,
  rough:.33,metal:.42
 });
 if(mesh&&rotation)mesh.rotation.z=rotation;
 return mesh;
}
function stud(g,parent,id,name,xyz,size,shade,finish){
 return g.sphere(parent,shade,xyz,[size,size*.80,size],{
  name:id+'-concept-'+name,surface:'chitin',finish,rough:.26
 });
}
function horn(g,parent,id,name,root,bend,tip,radius,shade,finish){
 return g.curvedHorn(parent,shade,root,bend,tip,radius,{
  name:id+'-concept-'+name,capRoot:true,surface:'chitin',
  finish,heroKeratin:true
 });
}
function trace(g,parent,id,name,points,width,shade,finish){
 return g.tube(parent,shade,points,width,{
  name:id+'-concept-'+name,
  surface:finish==='toxicGlass'?'crystal':'chitin',
  finish,rough:.27,
  tubularSegments:12,radialSegments:6
 });
}
function ivoryAndLegs(g,id,finish){
 // The joint guards are mounted on the animated femur/patella pivots,
 // so the metal engravings move when the creature walks.
 for(const side of LR)for(let i=0;i<3;i++){
  const n='leg'+sideName(side)+i;
  const thigh=g.pivots[n+'Femur'],joint=g.pivots[n+'Patella'];
  if(!thigh||!joint)throw Error('Missing walking beetle joint '+n);
  plate(g,thigh,id,'thigh-armor-'+sideName(side)+'-'+i,
   v(side,.36,.11,.01),[.195,.137,.17],
   id==='m021'?'#85878b':'#e7c579',finish,side*.21);
  plate(g,joint,id,'knee-armor-'+sideName(side)+'-'+i,
   [0,.09,0],[.139,.105,.146],
   id==='m021'?'#5e6064':'#f0d89b',finish);
  if(id==='m025'&&g.root.userData.detail!=='low')
   g.sphere(joint,'#9b263a',[0,.15,.025],[.052,.032,.051],{
    name:id+'-concept-leg-ruby-'+sideName(side)+'-'+i,
    surface:'crystal',finish:'rubyGem'
   });
 }
}
function ironFortress(g,spec){
 const id=spec.id,low=g.root.userData.detail==='low',finish='ironPlate';
 const torso=g.pivots.torso,head=g.pivots.head;
 // Broad fortress-like interlocking armor, not an enlarged smooth sphere.
 plate(g,torso,id,'central-steel-keel',[0,1.79,-.43],
  [.48,.13,.64],'#76767b',finish);
 for(const side of LR){
  const n=sideName(side),elytron=g.pivots['elytron'+n];
  if(!elytron)throw Error('Missing wing-cover pivot: '+n);
  for(let i=0;i<(low?3:5);i++){
   const z=.33-i*.225;
   plate(g,elytron,id,'iron-elytra-'+n+'-'+i,
    v(side,.11,.25,z),[.265,.105,.175],
    i%2?'#62666d':'#86878c',finish,side*.19);
   for(const flank of [-1,1]){
    stud(g,elytron,id,'rivet-'+n+'-'+i+'-'+(flank<0?'A':'B'),
     [side*.11+flank*.14,.335,z],low?.022:.033,
     '#d1b99d',finish);
   }
  }
  plate(g,head,id,'forehead-steel-'+n,
   v(side,.23,.20,.07),[.24,.092,.23],'#77767c',finish,side*.15);
 }
 ivoryAndLegs(g,id,finish);
 g.root.userData.beetleConceptArmor='riveted-iron-fortress';
}
function fireCrimson(g,spec){
 const id=spec.id,low=g.root.userData.detail==='low';
 const head=g.pivots.head,torso=g.pivots.torso;
 // The largest chitin plates stay mirror-glossy burgundy, while subtle
 // amber inlays echo the glowing orange wing veins.
 for(const side of LR){
  const n=sideName(side),elytron=g.pivots['elytron'+n];
  plate(g,elytron,id,'burgundy-overlap-'+n,
   v(side,.11,.22,-.17),[.275,.096,.49],'#6b1726','crimsonLacquer',side*.08);
  plate(g,head,id,'red-cheek-'+n,
   v(side,.23,.08,.18),[.16,.085,.18],'#922a2d','crimsonLacquer',side*.12);
  if(!low){
   trace(g,elytron,id,'amber-seam-'+n,[
    v(side,.28,.255,.34),v(side,.34,.29,.06),
    v(side,.34,.25,-.28),v(side,.28,.22,-.55)
   ],.012,'#d5824c','divineGold');
  }
 }
 plate(g,torso,id,'red-dorsal-shell',[0,1.77,-.65],
  [.36,.13,.40],'#881d2a','crimsonLacquer');
 g.root.userData.beetleConceptArmor='polished-crimson-carapace';
}
function divineGold(g,spec){
 const id=spec.id,low=g.root.userData.detail==='low',finish='divineGold';
 const head=g.pivots.head,torso=g.pivots.torso;
 for(const side of LR){
  const n=sideName(side),elytron=g.pivots['elytron'+n];
  // Gilded leaf caps with red lacquer visibly exposed between plates.
  for(let i=0;i<(low?3:5);i++){
   const z=.34-i*.23;
   plate(g,elytron,id,'gilded-plate-'+n+'-'+i,
    v(side,.105,.26,z),[.25,.065,.17],
    i%2?'#e4b747':'#f5d984',finish,side*.15);
  }
  plate(g,head,id,'gold-crown-'+n,
   v(side,.20,.20,.18),[.22,.067,.18],
   '#f2d67b',finish,side*.22);
  // Several genuine 3D embossed lines on the elytra, not painted art.
  const tracks=low?1:3;
  for(let i=0;i<tracks;i++){
   const x=.13+i*.066;
   trace(g,elytron,id,'filigree-'+n+'-'+i,[
    v(side,x,.333,.31),v(side,x+.05,.345,.09),
    v(side,x-.04,.342,-.16),v(side,x+.06,.33,-.44)
   ],.011,'#ffe7a8',finish);
  }
  // Golden leaf/feather ornament rises beside the central forehead horn.
  for(let i=0;i<(low?2:4);i++){
   const z=-.08-i*.145;
   horn(g,torso,id,'winged-gold-crest-'+n+'-'+i,
    v(side,.32,1.75,z),v(side,.42,1.98,z-.09),
    v(side,.63+(i*.055),2.30-i*.11,z-.24),
    .084-i*.008,'#f2d27c',finish);
  }
 }
 plate(g,torso,id,'golden-keel',[0,1.77,-.45],
  [.34,.11,.62],'#e3c166',finish);
 stud(g,head,id,'royal-ruby',[0,.265,.315],.076,'#f0b25b',finish);
 g.sphere(head,'#a81932',[0,.295,.345],[.068,.067,.049],{
  name:id+'-concept-crown-ruby',surface:'crystal',finish:'rubyGem'
 });
 // Trace thin decorative gold lines along the central chitin horn,
 // following its curved height while leaving the one-horn silhouette.
 for(const side of LR){
  const n=sideName(side);
  trace(g,head,id,'horn-engraving-'+n,[
   v(side,.10,.37,.37),v(side,.145,.64,.35),
   v(side,.12,.92,.18),v(side,.07,1.21,-.035)
  ],.011,'#ffe19a',finish);
 }
 ivoryAndLegs(g,id,finish);
 g.root.userData.beetleConceptArmor='royal-gold-filigree';
}
function poisonScarab(g,spec){
 const id=spec.id,low=g.root.userData.detail==='low';
 const torso=g.pivots.torso,head=g.pivots.head;
 // The same central rhinoceros horn as the family; venom patterns and
 // translucent sacs distinguish this dark-purple species.
 const primary=horn(g,head,id,'central-toxic-rhinoceros-horn',
  [0,.20,.24],[0,.68,.49],[0,1.27,.48],.203,
  '#572349','toxicHorn');
 for(const side of LR){
  const n=sideName(side),elytron=g.pivots['elytron'+n];
  horn(g,head,id,'toxic-horn-tip-'+n,[0,1.05,.47],
   v(side,.08,1.23,.49),v(side,.23,1.39,.51),
   .067,'#70295b','toxicHorn');
  const pods=low?2:4;
  for(let i=0;i<pods;i++){
   const z=.25-i*.23;
   const pos=v(side,.07,.30,z);
   const pod=g.sphere(elytron,'#98ff40',pos,
    [low?.115:.135,.101,low?.125:.139],{
     name:id+'-concept-poison-pod-'+n+'-'+i,
     surface:'crystal',finish:'toxicGlass'
    });
   pod.rotation.z=side*.17;
   // Root collar makes each glowing sac sit in the shell rather than float.
   plate(g,elytron,id,'poison-rim-'+n+'-'+i,
    v(side,.07,.253,z),[.15,.055,.15],
    '#542044','toxicLacquer');
  }
  plate(g,head,id,'poison-cheek-'+n,
   v(side,.24,.17,.12),[.18,.105,.185],
   '#632348','toxicLacquer',side*.12);
  // Fine bioluminescent fissures laid directly over the frontal shell.
  trace(g,head,id,'horn-vein-'+n,[
   v(side,.12,.22,.39),v(side,.17,.47,.47),
   v(side,.12,.77,.54),v(side,.09,1.08,.50)
  ],.014,'#b8ee43','toxicGlass');
 }
 plate(g,torso,id,'poison-dorsal-ridge',[0,1.77,-.48],
  [.28,.11,.57],'#5e234c','toxicLacquer');
 g.root.userData.beetleConceptArmor='glowing-poison-sacs';
 g.root.userData.beetleConceptCentralHorn=primary.name;
}

/** Construct actual geometry under existing moving pivots for each species. */
export function sculptBeetleConceptDetails(g,spec){
 if(!BEETLE_CONCEPT_SPECIES.includes(spec.id)||spec.family!=='insect')
  throw Error('Beetle concept only applies to four beetle species');
 if(spec.id==='m021')ironFortress(g,spec);
 else if(spec.id==='m022')fireCrimson(g,spec);
 else if(spec.id==='m025')divineGold(g,spec);
 else poisonScarab(g,spec);
 g.root.userData.beetleConceptRevision=BEETLE_CONCEPT_REVISION;
 g.root.userData.beetleConceptReference='four-species-20261121-user-approved-2d';
}
