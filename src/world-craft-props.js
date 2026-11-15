/** Real-scale craft geometry for catalog-only props.
 * Authored in metres relative to cellSize. These are real renderable meshes,
 * not reference images or a material-only visual override.
 */
function barrelProfile(t,cellSize){
 const c=cellSize,shoulder=.435,belly=.100;
 return {y:1.15*c*t,r:(shoulder+belly*Math.sin(Math.PI*t)**2)*c};
}
/** Closed, curved wooden staves, including thickness and longitudinal seams. */
export function createBarrelStaveGeometry(THREE,{cellSize=2.2,staves=18,segments=8}={}){
 if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError('cellSize must be positive');
 if(!Number.isInteger(staves)||staves<8||staves>64)throw new RangeError('Invalid stave count');
 const pos=[],uv=[],gap=.012,thickness=.035*cellSize;
 const point=(angle,t,inner=false)=>{
  const {y,r}=barrelProfile(t,cellSize);
  const radius=r+(inner? -thickness:.007*cellSize);
  return [Math.cos(angle)*radius,y,Math.sin(angle)*radius];
 };
 const quad=(p0,p1,p2,p3,uvs=[[0,0],[0,1],[1,0],[1,1]])=>{
  for(const index of [0,1,2,2,1,3]){
   const p=[p0,p1,p2,p3][index],t=uvs[index];pos.push(...p);uv.push(...t);
  }
 };
 for(let i=0;i<staves;i++){
  const a0=2*Math.PI*(i+gap)/staves,a1=2*Math.PI*(i+1-gap)/staves;
  for(let j=0;j<segments;j++){
   const lo=j/segments,hi=(j+1)/segments;
   const A=(a,t,inside)=>point(a,t,inside);
   // Exterior and interior retain real radial thickness, not a flat card.
   quad(A(a0,lo,false),A(a0,hi,false),A(a1,lo,false),A(a1,hi,false),
    [[lo,0],[hi,0],[lo,1],[hi,1]]);
   quad(A(a1,lo,true),A(a1,hi,true),A(a0,lo,true),A(a0,hi,true),
    [[lo,0],[hi,0],[lo,1],[hi,1]]);
   quad(A(a0,lo,false),A(a0,lo,true),A(a0,hi,false),A(a0,hi,true));
   quad(A(a1,lo,true),A(a1,lo,false),A(a1,hi,true),A(a1,hi,false));
  }
  quad(point(a0,0,true),point(a0,0,false),point(a1,0,true),point(a1,0,false));
  quad(point(a1,1,true),point(a1,1,false),point(a0,1,true),point(a0,1,false));
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.computeVertexNormals();
 geometry.userData={staves,segments,closedThicknessMetres:thickness,craftType:'hooped_barrel'};
 return geometry;
}
function mesh(THREE,root,geometry,material,name,x=0,y=0,z=0){
 const m=new THREE.Mesh(geometry,material);
 m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;
 root.add(m);return m;
}
export function addRealisticWoodBarrel(THREE,root,{cellSize=2.2,wood,dark,metal}={}){
 if(!root?.add||!wood||!dark||!metal)throw new TypeError('Barrel requires a root, timber and metal materials');
 const c=cellSize;
 // The dark structural lining occupies seam gaps without z-fighting.
 const profile=[];
 for(let i=0;i<=12;i++){
  const t=i/12,{r,y}=barrelProfile(t,c);
  profile.push(new THREE.Vector2(r-.038*c,y));
 }
 mesh(THREE,root,new THREE.LatheGeometry(profile,48),dark,'barrel_inner_lining');
 mesh(THREE,root,createBarrelStaveGeometry(THREE,{cellSize:c}),wood,'barrel_18_closed_wood_staves');
 for(const [name,y,r] of [['lower',.17,.462],['belly',.575,.535],['upper',.98,.466]]){
  // Sheet-iron hoops have visible band width, rather than floating torus wires.
  mesh(THREE,root,new THREE.CylinderGeometry((r+.016)*c,(r+.016)*c,.072*c,48,1,true),
   metal,'barrel_iron_hoop_'+name,0,y*c,0);
 }
 const top=mesh(THREE,root,new THREE.CircleGeometry(.417*c,48),dark,
  'barrel_solid_recessed_head',0,1.135*c,0);
 top.rotation.x=-Math.PI/2;
 const base=mesh(THREE,root,new THREE.CircleGeometry(.417*c,48),dark,
  'barrel_structural_bottom',0,.016*c,0);
 base.rotation.x=Math.PI/2;
 const bung=mesh(THREE,root,new THREE.CylinderGeometry(.072*c,.074*c,.034*c,16),
  wood,'barrel_head_bung',.17*c,1.155*c,.08*c);
 root.userData.physicalConstruction={
  type:'staved_hooped_wood_vessel',staves:18,hoops:3,
  joinery:'closed_radial_stave_edges',head:'recessed_solid_wood',units:'metres'
 };
 return root;
}
/** Add a physically legible masonry lip, windlass, rope and bucket to an existing well. */
export function addWellConstructionDetails(THREE,root,{cellSize=2.2,stone,wood,iron}={}){
 if(!root?.add||!stone||!wood||!iron)throw new TypeError('Well requires root, stone, timber and iron');
 const c=cellSize;
 const innerStone=stone.clone();innerStone.side=THREE.BackSide;
 mesh(THREE,root,new THREE.CylinderGeometry(1.07*c,1.07*c,.95*c,32,1,true),
  innerStone,'well_inner_masonry_wall',0,.48*c,0);
 const coping=mesh(THREE,root,new THREE.RingGeometry(1.055*c,1.255*c,48),
  stone,'well_structural_thick_coping',0,.97*c,0);
 coping.rotation.x=-Math.PI/2;
 for(const t of [.20,.52,.82]){
  const course=mesh(THREE,root,new THREE.TorusGeometry(1.205*c,.025*c,6,48),
   iron,'well_masonry_course_joint',0,t*c,0);
  course.rotation.x=Math.PI/2;
 }
 // Axle spans the two real posts; the drum is braced by two metal collars.
 const axle=mesh(THREE,root,new THREE.CylinderGeometry(.17*c,.17*c,2.18*c,20),
  wood,'well_windlass_axle',0,1.60*c,0);
 axle.rotation.z=Math.PI/2;
 const spool=mesh(THREE,root,new THREE.CylinderGeometry(.23*c,.23*c,.38*c,24),
  wood,'well_windlass_rope_drum',0,1.60*c,0);
 spool.rotation.z=Math.PI/2;
 for(const x of [-.22,.22]){
  const collar=mesh(THREE,root,new THREE.CylinderGeometry(.29*c,.29*c,.045*c,24),
   iron,'well_drum_iron_flange',x*c,1.60*c,0);
  collar.rotation.z=Math.PI/2;
 }
 // Crank is outside the right post; all three parts share the axle line.
 const crank=mesh(THREE,root,new THREE.CylinderGeometry(.034*c,.034*c,.44*c,10),
  iron,'well_windlass_crank',1.23*c,1.40*c,0);
 const grip=mesh(THREE,root,new THREE.CylinderGeometry(.065*c,.065*c,.25*c,12),
  wood,'well_windlass_handle',1.23*c,1.18*c,0);
 grip.rotation.z=Math.PI/2;
 const bucket=mesh(THREE,root,new THREE.CylinderGeometry(.21*c,.16*c,.39*c,20,1,true),
  wood,'well_tapered_wood_bucket',0,.85*c,0);
 const bucketBase=mesh(THREE,root,new THREE.CircleGeometry(.16*c,20),
  wood,'well_bucket_solid_base',0,.655*c,0);
 bucketBase.rotation.x=Math.PI/2;
 const bucketBand=mesh(THREE,root,new THREE.TorusGeometry(.21*c,.021*c,6,32),
  iron,'well_bucket_iron_rim',0,1.045*c,0);
 bucketBand.rotation.x=Math.PI/2;
 const handle=mesh(THREE,root,new THREE.TorusGeometry(.205*c,.020*c,6,24,Math.PI),
  iron,'well_bucket_swing_handle',0,1.07*c,0);
 const rope=mesh(THREE,root,new THREE.CylinderGeometry(.019*c,.019*c,.20*c,10),
  wood,'well_taut_windlass_rope',0,1.37*c,0);
 // Mark the mechanism independently; the existing well remains one gameplay object.
 root.userData.physicalConstruction={
  type:'masonry_well_with_hand_windlass',hollowWall:true,realCoping:true,
  winch:true,bucket:true,rope:true,units:'metres'
 };
 return root;
}
