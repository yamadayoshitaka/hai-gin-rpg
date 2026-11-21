/**
 * 2026-11-21 human-shaped bestiary: original 2D concept -> physical 3D finish.
 * Applies to 16 pre-existing monster IDs; never touches the playable hero rig.
 * Decorations attach to canonical skinned BONE frames and share its LOD.
 * This is an implementation pass, not a visual/FPS approval.
 */
export const HUMANLIKE_CONCEPT_REVISION='humanoid-concept-sculpt-v1-20261121';
const rows=[
 // id, art direction, surface, silhouette, expression / signature
 ['m015','黒羽の鴉天狗','feather','winged-samurai','鋭い鳥面・羽根胸当て'],
 ['m031','骸骨剣士','bone','skeleton-knight','眼窩・露出骨・欠けた鎧'],
 ['m032','古墓のミイラ','linen','wrapped-mummy','巻布・裂け目・乾いた繊維'],
 ['m033','青炎の死霊騎士','steel','spectral-knight','青炎・層状装甲・刻印'],
 ['m034','血月ヴァンパイア','velvet','gothic-noble','蒼白な顔・貴族服・赤宝石'],
 ['m035','霜冥のリッチ','frost','ritual-lich','髑髏・氷晶・呪文陣'],
 ['m036','石壁ゴーレム','stone','moss-stone-giant','重い岩石・石目地・苔'],
 ['m037','青銅の守護像','bronze','bronze-guardian','金属継ぎ目・古代装飾'],
 ['m038','紫晶クリスタル巨兵','crystal','crystal-colossus','結晶稜線・胸部核'],
 ['m039','熔鉄の溶岩巨人','lava','molten-colossus','割れ目・溶岩核・火花'],
 ['m040','聖光の白銀巨像','silver','silver-colossus','白銀彫金・金色の光輪'],
 ['m041','小鬼インプ','imp','small-winged-imp','角根元・節骨・小さな牙'],
 ['m042','獄門のガーゴイル','stonewing','winged-gargoyle','石の眉弓・爪・裂けた翼'],
 ['m043','紅蓮デーモン','inferno','horned-demon','太い角・熱い胸郭・炎の脈'],
 ['m044','深紫サキュバス','amethyst','gothic-succubus','曲角・紫宝石・軽い翼'],
 ['m045','魔王の黒騎兵','blacksteel','dark-lancer','黒金属鎧・槍・血色の紋']
];
export const HUMANLIKE_2D_CONCEPTS=Object.freeze(Object.fromEntries(
 rows.map(([id,name,surface,silhouette,facialMotif])=>[id,Object.freeze({
  id,name,surface,silhouette,facialMotif,
  basis:'human-shaped-monster-original-2d-sheet-20261121',
  visualApproved:false,mobileFpsVerified:false
 })])
));
export const HUMANLIKE_CONCEPT_IDS=Object.freeze(rows.map(row=>row[0]));
const armored=new Set(['steel','bronze','silver','blacksteel']);
const elemental=new Set(['frost','crystal','lava','inferno']);
const constructed=new Set(['stone','bronze','crystal','lava','silver']);
const bounded=(d,src,hi,mid,lo)=>d==='source'?src:d==='high'?hi:d==='medium'?mid:lo;
/** All components are attached to the existing anatomical frames. */
export function applyHumanlikeConceptFinish({THREE,profile,detail='high',frames,attach,tube}){
 const concept=HUMANLIKE_2D_CONCEPTS[profile?.id];
 if(!concept)return null;
 const kind=concept.surface;
 const near=detail==='source'||detail==='high';
 const medium=detail==='medium';
 const divisions=bounded(detail,22,18,12,8);
 let count=0;
 const add=(frame,g,role,name,pos=[0,0,0],rot=[0,0,0])=>{
  if(!frame)return null;
  const mesh=attach(frame,g,role,'concept-'+name,pos,rot);
  count++;
  mesh.userData.original2dConcept=profile.id;
  mesh.userData.skeletalAttachment=true;
  return mesh;
 };
 const stroke=(frame,role,name,points,radius=.009)=>{
  if(!frame)return;
  tube(frame,role,'concept-'+name,points,radius);
  count++;
 };
 const ring=(frame,role,name,x,y,z,radius,tubeRadius=.009)=>{
  add(frame,new THREE.TorusGeometry(radius,tubeRadius,
   bounded(detail,7,6,5,4),divisions),role,name,[x,y,z]);
 };
 const gem=(frame,role,name,x,y,z,rad=.049)=>{
  add(frame,new THREE.IcosahedronGeometry(rad,near?2:medium?1:0),
   role,name,[x,y,z]);
 };
 const ridge=(frame,role,name,offset,side=1)=>{
  stroke(frame,role,name,[
   [side*(offset+.012),.12,-.194],
   [side*(offset+.037),.03,-.214],
   [side*(offset+.012),-.12,-.202]
  ],near?.011:.014);
 };
 // Every 2D design gets a true contoured metal/cloth relief at the chest:
 // one physical surface, not a flat decal or texture-only placeholder.
 const reliefRole=constructed.has(kind)?'metal':armored.has(kind)?'metal':
  kind==='linen'?'linen':kind==='bone'?'bone':
  kind==='feather'?'cloth':kind==='velvet'||kind==='amethyst'?'gold':'rune';
 const chest=frames.chest;
 ring(chest,reliefRole,'sternum-rim',0,.045,-.215,.091,.011);
 for(const side of [-1,1])ridge(chest,reliefRole,
  'sternum-relief-'+side,.065,side);
 const coreRole=kind==='bone'?'bone':kind==='linen'?'bandage':
  kind==='frost'?'crystal':kind==='stone'?'metal':
  kind==='bronze'?'gold':kind==='silver'?'gold':
  kind==='velvet'||kind==='amethyst'?'gold':
  elemental.has(kind)||kind==='imp'?'rune':'accent';
 gem(chest,coreRole,'identity-core',0,.045,-.235,
  constructed.has(kind)?.075:.046);
 if(near){
  ring(chest,reliefRole,'embedded-core-bezel',0,.045,-.227,.056,.005);
  for(const side of [-1,1])stroke(chest,coreRole,
   'embroidered-chest-trim-'+side,[
    [side*.10,.19,-.18],[side*.16,.04,-.205],
    [side*.12,-.22,-.19]
   ],.007);
 }
 if(armored.has(kind)||constructed.has(kind)){
  // Separate from the arm joints: metalwork follows the same 3D donor bones.
  for(let side=0;side<2;side++){
   const frame=frames.arms?.[side];
   if(!frame)continue;
   const sx=side===0?-1:1;
   add(frame,new THREE.SphereGeometry(.110,divisions,7,0,
    Math.PI*2,0,Math.PI*.46),'metal','anatomical-overlap-pauldron-'+side,
    [sx*.01,.02,-.015],[0,0,sx*.12]);
   if(near){
    for(let j=0;j<3;j++)gem(frame,kind==='silver'?'gold':coreRole,
     'pauldron-rivet-'+side+'-'+j,sx*(.024+j*.035),
     .057,-.075,.010);
   }
  }
 }
 if(kind==='feather'){
  // M015 retains its independent animated wings: only the feather cuirass
  // is added here; do not replace or freeze the flying canonical skeleton.
  for(const side of [-1,1])for(let i=0;i<(near?4:2);i++){
   const feather=new THREE.ConeGeometry(.027,.15,7,2);
   add(chest,feather,i%2?'metal':'cloth',
    'overlapping-tengu-breast-feather-'+side+'-'+i,
    [side*(.09+i*.039),.17-i*.09,-.195],[0,0,side*.30]);
  }
 }else if(kind==='bone'){
  for(const side of [-1,1]){
   stroke(frames.head,'bone','skull-temporal-suture-'+side,
    [[side*.105,.115,-.064],[side*.122,.06,-.095],
     [side*.106,-.014,-.090]],.008);
   if(near)gem(frames.head,'bone','skull-cheek-ridge-'+side,
    side*.087,-.048,-.122,.018);
  }
 }else if(kind==='linen'){
  // Ragged textile stitches: individually wrapped forearms still bend.
  for(let side=0;side<2;side++)for(let i=0;i<(near?4:2);i++)
   stroke(frames.forearms?.[side],'linen',
    'handwrapped-stitch-'+side+'-'+i,[
     [-.10,-.05-i*.055,-.025],[-.025,-.043-i*.055,-.089],
     [.095,-.07-i*.055,-.02]],.0055);
 }else if(kind==='frost'){
  for(let side of [-1,1])gem(frames.head,'crystal',
   'lich-ice-temple-'+side,side*.12,.09,-.040,.048);
  ring(frames.head,'rune','lich-orbit-crest',0,.19,-.035,.125,.009);
 }else if(kind==='velvet'||kind==='amethyst'){
  for(const side of [-1,1]){
   gem(frames.head,kind==='amethyst'?'crystal':'rune',
    'gothic-temple-gem-'+side,side*.105,.13,-.05,.026);
  }
  if(near)ring(frames.head,'gold','noble-forehead-tiara',
   0,.155,-.09,.085,.005);
 }else if(kind==='stone'||kind==='stonewing'){
  // Cracks follow the chest bone instead of staying in world space.
  for(const side of [-1,1])stroke(chest,'edge',
   'chiseled-stone-fissure-'+side,[
    [side*.23,.23,-.15],[side*.15,.14,-.19],
    [side*.21,.03,-.17],[side*.12,-.10,-.21]],.013);
 }else if(kind==='bronze'){
  for(const side of [-1,1])stroke(chest,'gold',
   'patinated-bronze-engravings-'+side,[
    [side*.19,.23,-.17],[side*.15,.13,-.19],
    [side*.18,-.11,-.18]],.012);
 }else if(kind==='crystal'){
  for(const side of [-1,1]){
   gem(frames.arms?.[side<0?0:1],'crystal',
    'shoulder-crystal-outcrop-'+side,side*.06,.13,-.08,.10);
   gem(chest,'crystal','sternum-fractal-'+side,side*.13,.03,-.226,.058);
  }
 }else if(kind==='lava'||kind==='inferno'){
  for(const side of [-1,1])for(let i=0;i<(near?3:2);i++){
   stroke(chest,'rune','molten-crack-'+side+'-'+i,[
    [side*(.045+i*.055),.27,-.19],
    [side*(.071+i*.055),.13,-.215],
    [side*(.043+i*.055),.02,-.24],
    [side*(.08+i*.045),-.22,-.20]],.009);
  }
 }else if(kind==='silver'){
  ring(frames.head,'gold','guardian-sanctified-halo',
   0,.21,.08,.135,.014);
 }else if(kind==='imp'){
  for(const side of [-1,1])
   ring(frames.head,kind==='imp'?'rune':'metal',
    'demonic-horn-collar-'+side,side*.085,.16,-.03,.029,.008);
 }else if(kind==='blacksteel'){
  for(const side of [-1,1])stroke(chest,'rune',
   'black-knight-heraldry-'+side,[
    [side*.10,.22,-.175],[side*.09,-.04,-.22],
    [0,-.24,-.20]],.011);
 }
 if(kind==='stonewing')for(const side of [-1,1])
  ring(frames.head,'metal','gargoyle-rooted-horn-ring-'+side,
   side*.095,.16,-.028,.035,.008);
 // A signature may be generic in the low crowd LOD, but no decorative mesh
 // changes the rig, source material, attack timings, or species stats.
 return Object.freeze({id:profile.id,revision:HUMANLIKE_CONCEPT_REVISION,
  original2d:concept.basis,featureMeshes:count,
  skeletonAnchored:true,visualApproved:false});
}
