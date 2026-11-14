/**
 * Gothic humanoid monsters: bone-anchored sculptural costume geometry for
 * m031 skeleton, m032 mummy, m033 death knight, m034 vampire, m044 succubus.
 *
 * Existing Quaternius skinned actor is the ONLY visible body. These pieces
 * are accents and tailored outer layers, not a second doll mannequin.
 * Meshes use normals and UVs, the same bone frame and LOD as the actor.
 */
import * as THREE from 'three';

const taper=(x)=>Math.max(0,Math.min(1,x));
const point=(x,y,z)=>new THREE.Vector3(x,y,z);
const mesh=(positions,uvs,indices,metadata)=>{
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 geometry.userData=metadata;
 return geometry;
};
const indexGrid=(rows,cols)=>{
 const indices=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const a=r*(cols+1)+c,b=a+cols+1;
  indices.push(a,b,a+1,a+1,b,b+1);
 }
 return indices;
};
/**
 * Broad, overlapping three-dimensional linen ribbon with a slightly torn
 * edge, as opposed to a coiled thin rope. Local y runs along its host bone.
 */
export function createMummyWrapRibbon({
 y0=-.30,y1=.32,rx=.16,rz=.14,turns=3.7,phase=0,
 width=.057,detail='high',
}={}){
 const rows=detail==='low'?30:110,columns=3;
 const vertices=[],uv=[];
 for(let row=0;row<=rows;row++){
  const t=row/rows,a=turns*2*Math.PI*t+phase;
  const wav=.004*Math.sin(t*67+phase*3)+.002*Math.sin(t*129);
  const fray=.16*Math.sin(t*51+phase)+.11*Math.sin(t*133+phase*2);
  const radius=1+.03*Math.cos(t*42+phase);
  for(let j=0;j<=columns;j++){
   const u=j/columns-0.5;
   const dy=width*u*(1+(j===0||j===columns?fray:0));
   vertices.push(
    Math.cos(a)*(rx*radius+wav+.004*Math.cos(j*Math.PI)),
    y0+(y1-y0)*t+dy,
    Math.sin(a)*(rz*radius+wav+.003*Math.sin(j*Math.PI))
   );
   uv.push(t*(detail==='low'?3:6),j/columns);
  }
 }
 return mesh(vertices,uv,indexGrid(rows,columns),
  {kind:'mummy-wrapped-linen-ribbon',detail});
}
/**
 * Velvet/linen mantle: one continuous pleated sheet following torso
 * rather than 3 disconnected cones. Top partly sinks into the collar.
 */
export function createGothicMantle({
 side=1,width=.34,drop=.92,back=.23,detail='high',ripped=false
}={}){
 const rows=detail==='low'?6:18,columns=detail==='low'?5:12;
 const pos=[],uv=[];
 for(let r=0;r<=rows;r++){
  const t=r/rows;
  for(let c=0;c<=columns;c++){
   const u=c/columns,span=(u*2-1);
   const flare=width*(.66+.48*t);
   const edge=side*span*flare;
   const hem=ripped&&r===rows?(.028*Math.sin(u*32+side*7)+.022*Math.sin(u*77)):0;
   const fold=Math.sin(u*11*Math.PI+side*.5)*(.005+.018*t);
   pos.push(edge, .29-drop*t+hem,
     back+.11*t*t+fold+Math.abs(edge)*.07);
   uv.push(u*2,t*2);
  }
 }
 return mesh(pos,uv,indexGrid(rows,columns),
  {kind:ripped?'damaged-gothic-mantle':'tailored-velvet-mantle',detail});
}
/**
 * Layered breastplate with contoured centre ridge and rolled cut edges.
 * The silhouette follows the SAME character torso and has no flat panels
 * passing through the existing skin.
 */
export function createRibbedBreastplate({
 side=1,detail='high',width=.26,height=.58
}={}){
 const rows=detail==='low'?5:12,cols=detail==='low'?5:12;
 const vertices=[],uv=[];
 for(let r=0;r<=rows;r++){
  const t=r/rows,y=.22-t*height,gy=Math.sin(t*Math.PI);
  for(let c=0;c<=cols;c++){
   const u=c/cols,xx=(u-.5)*2;
   const edge=xx*width;
   const ridge=Math.pow(1-Math.abs(xx),2)*.049;
   const edgeRoll=Math.pow(Math.abs(xx),8)*.019;
   vertices.push(side*edge,y,-.205-ridge*gy+edgeRoll+.014*t);
   uv.push(u,t);
  }
 }
 return mesh(vertices,uv,indexGrid(rows,cols),
  {kind:'tailored-metal-breastplate',detail});
}
/** Curved, tapered horn. The root is sunk behind the hairline. */
export function createGothicHorn({
 side=1,len=.24,radius=.048,detail='high',curve=.30
}={}){
 const rows=detail==='low'?8:21,around=detail==='low'?7:12;
 const verts=[],uv=[];
 for(let i=0;i<=rows;i++){
  const t=i/rows,base=point(side*(curve*t*t),len*t,
    -.05+.09*t*t);
  const tangent=point(side*(curve*2*t),len,.18*t).normalize();
  const axis=point(1,0,0).addScaledVector(tangent,-tangent.x).normalize();
  const binormal=new THREE.Vector3().crossVectors(tangent,axis).normalize();
  const size=radius*Math.pow(1-t,1.04);
  for(let a=0;a<=around;a++){
   const angle=a/around*Math.PI*2;
   const grain=1+.035*Math.cos(angle*8+t*28);
   const p=base.clone().addScaledVector(axis,Math.cos(angle)*size*grain)
    .addScaledVector(binormal,Math.sin(angle)*size*grain);
   verts.push(...p.toArray());uv.push(a/around,t);
  }
 }
 return mesh(verts,uv,indexGrid(rows,around),
  {kind:'grown-anatomical-horn',detail});
}
/**
 * Real membrane and fingered leading spars with scalloped trailing edge.
 * This is a contiguous, shaded bat wing, not two black triangles.
 */
export function createGothicBatWing({
 side=1,detail='high',width=1.16,height=.88,
}={}){
 const rows=detail==='low'?6:17,columns=detail==='low'?12:30;
 const verts=[],uv=[];
 for(let row=0;row<=rows;row++){
  const t=row/rows;
  for(let col=0;col<=columns;col++){
   const u=col/columns,dist=u*width;
   const upper=.13+.53*Math.sin(Math.PI*.93*u)+.18*u;
   const lower=-.36+.13*u+
      .11*Math.cos(u*Math.PI*7)*Math.pow(u,.65);
   const xx=side*(.14+dist);
   const y=.16+lower+(upper-lower)*t;
   const z=.18+.43*u*u+.018*Math.sin(u*18)*Math.sin(t*Math.PI);
   verts.push(xx,y,z);uv.push(u,t);
  }
 }
 return mesh(verts,uv,indexGrid(rows,columns),
  {kind:'scalloped-bat-wing-membrane',detail});
}
/** Sculpted skeletal face, not the old opaque sphere replacing the actor. */
export function createKnightSkullBrow({
 detail='high',side=1
}={}){
 const rows=detail==='low'?5:12,cols=detail==='low'?5:10;
 const vertices=[],uv=[];
 for(let r=0;r<=rows;r++){
  const t=r/rows;
  for(let c=0;c<=cols;c++){
   const u=c/cols,xx=.023+u*.105;
   const y=.11-t*.205;
   const cheek=.011*Math.sin(t*Math.PI)*Math.sin(u*Math.PI);
   vertices.push(side*xx,y,-.135-cheek-.027*Math.sin(u*Math.PI)*Math.sin(t*Math.PI));
   uv.push(u,t);
  }
 }
 return mesh(vertices,uv,indexGrid(rows,cols),
  {kind:'anatomical-cheek-arch',detail});
}
/**
 * One batched upper-lash fan per eye. The imported skinned GLB retains its
 * native sclera, cornea and iris: no opaque eyeball overlays are generated.
 * The small three-dimensional wedge roots are placed along the upper lid.
 */
export function createGothicUpperLashFanGeometry({side=1,detail='high'}={}){
 if(side!==-1&&side!==1)throw Error('Lash side must be -1 or +1');
 if(!['low','high','source'].includes(detail))throw Error('Invalid lash LOD');
 const strands=detail==='low'?3:detail==='source'?8:6;
 const positions=[],uv=[],indices=[];
 for(let i=0;i<strands;i++){
  const u=(i+.65)/(strands+.25),x=side*(.027+.079*u);
  const y=.078+.010*Math.sin(Math.PI*u);
  const z=-.145+.034*u*u;
  const length=(.010+.009*u)*(1-(u-.74)*(u-.74)*.40);
  const start=positions.length/3;
  const points=[
   [x-side*.003,y,z],[x+side*.003,y,z-.002],
   [x+side*.006,y+length*.55,z-.004],
   [x+side*(.009+.003*u),y+length,z-.002],
   [x+side*.006,y+length*.55,z+.0005],[x,y+.002,z+.001]
  ];
  for(let j=0;j<points.length;j++){positions.push(...points[j]);uv.push(u,j/5);}
  for(const [a,b,c] of [
   [0,1,2],[1,3,2],[1,4,3],[4,5,3],
   [5,0,2],[5,2,3],[0,5,4],[0,4,1]
  ])indices.push(start+a,start+b,start+c);
 }
 return mesh(positions,uv,indices,{
  kind:'gothic-canonical-upper-lash-fan',
  detail,rootedTo:'native-upper-eyelid',strands
 });
}
function createGothicPieces({profile,detail='high',frames,attach,tube}){
 const kind=profile.costume,isHigh=detail!=='low',add=(frame,g,role,name,p=[0,0,0],r=[0,0,0])=>
  attach(frame,g,role,name,p,r);
 const ball=(frame,role,name,p,scale)=>{
  const g=new THREE.SphereGeometry(1,isHigh?18:9,isHigh?12:7);
  g.scale(...scale);return add(frame,g,role,name,p);
 };
 const line=(frame,role,name,pts,rad=.01)=>tube(frame,role,name,pts,rad);
 const ring=(frame,role,name,p,rx,ry,zScale=.015)=>{
  const g=new THREE.TorusGeometry(1,zScale,isHigh?9:5,isHigh?36:15);
  g.scale(rx,ry,1);return add(frame,g,role,name,p);
 };
 const fold=(frame,role,name,y,width=.20)=>{
  const g=new THREE.CylinderGeometry(width*.87,width, .054,
   isHigh?24:10,3,true);
  // A hollow standing collar with clipped sides instead of a loose torus
  g.scale(1,.72,.70);return add(frame,g,role,name,[0,y,0]);
 };
 const armor=(name)=>{
  for(const side of [-1,1]){
   const idx=side<0?0:1;
   const pad=new THREE.SphereGeometry(.17,isHigh?18:9, isHigh?10:7,
     0,Math.PI*2,0,Math.PI*.61);
   add(frames.arms[idx],pad,'metal',name+'-shoulder-'+idx,
    [side*.01,.015,-.02],[.1,0,side*.2]);
   add(frames.chest,createRibbedBreastplate({side,detail}),
    'metal',name+'-breastplate-'+idx);
   line(frames.chest,'edge',name+'-chest-filigree-'+idx,[
    [side*.19,.17,-.225],[side*.205,-.06,-.22],
    [side*.14,-.20,-.24],[side*.06,-.28,-.21]],.009);
   const cuff=new THREE.CylinderGeometry(.09,.078,.14,isHigh?16:9,3,true);
   add(frames.forearms[idx],cuff,'metal',name+'-gauntlet-'+idx,[0,-.18,0]);
  }
 };
 if(kind==='vampire'){
  // A noble old-world coat with layered velvet, pointed collar, red lining,
  // necklace, and tiny canines embedded inside the lip line.
  add(frames.chest,createGothicMantle({detail,width:.40,drop:1.04}),
    'velvet','vampire-blackcoat-back');
  add(frames.chest,createGothicMantle({detail,width:.35,drop:.95,back:.215,ripped:true}),
    'lining','vampire-worn-burgundy-lining',[0,0,.01]);
  fold(frames.chest,'velvet','vampire-high-collar',.25,.215);
  for(const side of [-1,1]){
   line(frames.chest,'edge','vampire-double-lapel-'+side,[
    [side*.22,.26,-.145],[side*.09,.13,-.24],
    [side*.19,-.12,-.227],[side*.15,-.34,-.21]],.016);
   const f=add(frames.head,createGothicHorn({side,len:.043,radius:.012,curve:.018,detail}),
    'ivory','vampire-recessed-canine-'+side,
    [side*.041,-.082,-.135],[Math.PI,0,0]);
   ball(frames.head,'skin','vampire-gingival-margin-'+side,
    [side*.042,-.080,-.138],[.018,.012,.012]);
   // Keep the original cornea and pigmented iris. The previous extra
   // black sphere and tiny crimson iris obscured the imported eyeball,
   // producing a bulbous or misaligned look in portrait closeups.
   line(frames.head,'makeup','vampire-upper-lid-crease-'+side,[
    [side*.026,.093,-.133],[side*.057,.100,-.137],
    [side*.102,.090,-.112]],.0035);
   add(frames.head,createGothicUpperLashFanGeometry({side,detail}),
    'makeup','vampire-upper-lashes-'+side);
   line(frames.head,'stain','vampire-withered-tear-'+side,[
    [side*.063,.012,-.130],[side*.066,-.029,-.130],
    [side*.077,-.074,-.119]],.0038);
   line(frames.chest,'edge','vampire-waist-sash-'+side,[
    [side*.16,-.28,-.19],[side*.25,-.39,-.12],[side*.18,-.55,-.11]],.013);
  }
  ball(frames.chest,'accent','vampire-ruby-brooch',[0,.19,-.236],[.036,.048,.017]);
  ring(frames.chest,'edge','vampire-brooch-rim',[0,.19,-.234],.041,.056,.012);
 }
 if(kind==='mummy'){
  // Genuine broad overlapping wrapped cloth on the same head, chest,
  // forearm and shin bones as the original skinned character.
  const wraps=[
   [frames.head,'mummy-head-linen',-.13,.17,.12,.14,3.35,.045,.4],
   [frames.chest,'mummy-chest-linen',-.33,.30,.245,.181,4.9,.070,1.7],
   [frames.chest,'mummy-lower-torso',-.41,-.13,.22,.15,2.4,.052,3.1],
  ];
  for(let j=0;j<2;j++){
   wraps.push([frames.forearms[j],'mummy-forearm-'+j,-.31,.07,.088,.080,3.0,.045,j*.8]);
   wraps.push([frames.calves[j],'mummy-shin-'+j,-.31,.08,.112,.104,3.0,.049,j*.83+1]);
  }
  for(const [frame,name,y0,y1,rx,rz,turns,width,phase] of wraps)
   add(frame,createMummyWrapRibbon({y0,y1,rx,rz,turns,width,phase,detail}),
    'linen',name);
  for(const side of [-1,1]){
   // Burnt-dark socket and sunken cheek: keep underlying face proportions.
   ball(frames.head,'black','mummy-sunken-eye-'+side,
    [side*.049,.035,-.137],[.038,.030,.011]);
   ball(frames.head,'iris','mummy-amber-iris-'+side,
    [side*.049,.033,-.150],[.010,.011,.005]);
   line(frames.head,'linen','mummy-face-torn-lip-'+side,[
    [side*.10,-.065,-.125],[side*.069,-.105,-.145],
    [side*.032,-.095,-.151]],.007);
  }
  // Uneven discoloured gingival line makes the bandaged figure appear
  // desiccated rather than a clean mannequin wearing a scarf.
  ball(frames.head,'black','mummy-decayed-mouth',
   [0,-.094,-.139],[.066,.023,.013]);
  for(let i=0;i<5;i++)ball(frames.head,'ivory','mummy-broken-tooth-'+i,
   [(i-2)*.023,-.095-(i%2)*.006,-.150],[.008,.014-(i%3)*.002,.008]);
  for(let i=0;i<3;i++)line(frames.chest,'stain','mummy-chest-seam-'+i,[
   [-.15+i*.12,.18,-.206],[-.09+i*.14,-.05,-.218],
   [-.16+i*.09,-.25,-.187]],.004);
 }
 if(kind==='skeleton'||kind==='death_knight'||kind==='dark_knight'){
  armor(kind);
  // Realistic skull plate and tooth arches follow canonical head bone.
  // Layered cheek arch and sunken sockets preserve the living head scale.
  for(const side of [-1,1]){
   add(frames.head,createKnightSkullBrow({detail,side}),'ivory',
    kind+'-skull-zygomatic-'+side);
   ball(frames.head,'black',kind+'-deep-orbit-'+side,
    [side*.052,.032,-.130],[.036,.035,.012]);
   ball(frames.head,'iris',kind+'-glowing-pupil-'+side,
    [side*.052,.031,-.144],[.013,.014,.006]);
   line(frames.head,'ivory',kind+'-brow-ridge-'+side,[
    [side*.016,.072,-.119],[side*.055,.086,-.129],
    [side*.11,.070,-.106]],.019);
  }
  line(frames.head,'ivory',kind+'-nasal-bridge',[
   [0,.054,-.148],[0,-.019,-.163],[0,-.052,-.157]],.016);
  for(let tooth=0;tooth<8;tooth++){
   const x=(tooth-3.5)*.018;
   ball(frames.head,'ivory',kind+'-lower-tooth-'+tooth,
    [x,-.103,-.140],[.008,.016,.008]);
  }
  add(frames.chest,createGothicMantle({detail,ripped:true,width:.38,drop:.95}),
   'velvet',kind+'-battle-torn-cloak');
  for(const side of [-1,1]){
   line(frames.chest,'edge',kind+'-collar-gothic-'+side,[
    [side*.15,.28,-.14],[side*.23,.17,-.15],
    [side*.21,.07,-.22]],.019);
  }
  ball(frames.chest,'accent',kind+'-cursed-breast-sigil',
   [0,-.045,-.276],[.058,.073,.020]);
  if(kind==='death_knight'){
   for(const side of [-1,1])add(frames.head,
    createGothicHorn({side,len:.20,radius:.040,detail,curve:.10}),
    'metal',kind+'-crown-spike-'+side,[side*.13,.15,-.045]);
  }
 }
 if(kind==='succubus'){
  // Dark plate over canonical female body, not a second explicit torso.
  for(const side of [-1,1]){
   add(frames.head,createGothicHorn({side,len:.29,radius:.058,detail,curve:.23}),
    'horn', 'succubus-swept-horn-'+side,[side*.09,.10,-.012]);
   ball(frames.head,'skin','succubus-horn-root-'+side,
    [side*.09,.104,-.014],[.059,.028,.061]);
   add(frames.chest,createGothicBatWing({side,detail}),
    'membrane','succubus-wing-membrane-'+side);
   for(let n=0;n<3;n++){
    const len=1.05-n*.19;
    line(frames.chest,'horn','succubus-wing-vein-'+side+'-'+n,[
     [side*.15,.16,.18],[side*(.48+n*.14),.43-n*.19,.35],
     [side*len,.21-n*.18,.56]],.017-n*.003);
   }
   line(frames.chest,'metal','succubus-corset-edge-'+side,[
    [side*.19,.22,-.17],[side*.25,-.07,-.20],
    [side*.13,-.41,-.18]],.014);
   // Demon cosmetics already draws eyeliner. Layer only individual lashes;
   // never occlude the Quaternius native pupil with a second sphere.
   add(frames.head,createGothicUpperLashFanGeometry({side,detail}),
    'makeup','succubus-upper-lashes-'+side);
   // Long nails grow from the hand-side of the articulated forearms.
   const index=side<0?0:1;
   for(let nail=0;nail<3;nail++){
    add(frames.forearms[index],createGothicHorn({
      side,len:.093,radius:.011,detail,curve:.012
    }),'horn','succubus-claw-'+side+'-'+nail,
    [side*(.042+(nail-1)*.025),-.286,-.065],
    [Math.PI,0,0]);
   }
  }
  add(frames.chest,createGothicMantle({detail,width:.26,drop:.70,ripped:true}),
   'velvet','succubus-torn-skirt');
  ball(frames.chest,'accent','succubus-chest-stone',
   [0,-.11,-.21],[.032,.046,.014]);
 }
 return true;
}
export const GOTHIC_MONSTER_KINDS=Object.freeze([
 'vampire','mummy','skeleton','death_knight','dark_knight','succubus'
]);
export const hasGothicMonsterSculpt=(costume)=>GOTHIC_MONSTER_KINDS.includes(costume);
export function addGothicMonsterSculpt(args){
 if(!hasGothicMonsterSculpt(args?.profile?.costume))return false;
 return createGothicPieces(args);
}
