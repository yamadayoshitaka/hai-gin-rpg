/** Structural entry-door geometry shared by lock levels 1-5.
 * Decorative details retain realistic material separation and support geometry.
 * The existing interaction/lock contract is owned by object-catalog.js.
 */
export function constructGradedEntryDoor(THREE,root,{level,cellSize=2.2,wood,iron,ornament}={}){
 if(!Number.isInteger(level)||level<1||level>5)throw new RangeError('Entry door lock level 1-5 required');
 if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError('positive cellSize required');
 if(!root?.add||!wood||!iron||!ornament)throw new TypeError('Entry door materials and root required');
 const c=cellSize,w=(level===5?2.5:1.65)*c,h=(level===5?2.8:2.05)*c;
 const namePart=(geometry,material,name,x,y,z)=>{
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=name;mesh.position.set(x,y,z);
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  return mesh;
 };
 const box=(w0,h0,d0,x,y,z,material,name)=>namePart(
  new THREE.BoxGeometry(w0,h0,d0),material,name,x,y,z);
 // The leaf is made of individual vertical joined staves with nonzero depth.
 // Their controlled gaps and thickness make the grain/edge structure legible.
 const plankCount=level>=4?10:8,joinGap=.005*c;
 for(let i=0;i<plankCount;i++){
  const plankWidth=w/plankCount-joinGap;
  const x=-w/2+(i+.5)*w/plankCount;
  const depth=(.17+(i%3)*.003)*c;
  box(plankWidth,h,depth,x,h/2,0,wood,'door_vertical_timber_stave_'+i);
 }
 // Timber jambs support the leaf. Outer iron jackets are only thin cladding.
 for(const sign of [-1,1]){
  const x=sign*(w/2+.115*c);
  box(.23*c,h+.28*c,.34*c,x,(h+.28*c)/2,0,wood,'door_loadbearing_jamb');
  if(level>=4)box(.058*c,h+.24*c,.38*c,x,(h+.24*c)/2,.02*c,iron,'door_jamb_iron_guard');
 }
 box(w+.50*c,.27*c,.38*c,0,h+.135*c,0,wood,'door_loadbearing_lintel');
 box(w+.45*c,.11*c,.42*c,0,.055*c,0,level>=3?iron:wood,'door_sill');
 // Hinged straps are fastened to individual staves and held by rivets.
 const bandCount=level>=4?3:2;
 for(let row=0;row<bandCount;row++){
  const y=h*(row+1)/(bandCount+1);
  box(w*.91,.082*c,.032*c,-.018*c,y,.11*c,iron,'door_horizontal_reinforcement_'+row);
  const hingeX=-w/2+.06*c;
  const knuckle=namePart(new THREE.CylinderGeometry(.055*c,.055*c,.18*c,12),
   iron,'door_hinge_knuckle_'+row,hingeX,y,.18*c);
  for(const xi of [-.38,-.18,.18,.38]){
   const rivet=namePart(new THREE.SphereGeometry(.027*c,10,8),
    iron,'door_strap_rivet_'+row,xi*w,y,.136*c);
   rivet.scale.set(1,.75,.45);
  }
 }
 // Diagonal braces are located behind the leaf (no floating front ornaments).
 for(const sign of [-1,1]){
  if(level<3)break;
  const x=sign*w*.19,y=h*.49;
  const diagonal=box(.068*c,h*.52,.045*c,x,y,-.115*c,iron,
   'door_rear_diagonal_brace');
  diagonal.rotation.z=sign*.36;
 }
 const lockX=w*.26,front=.15*c;
 box(.29*c,.48*c,.055*c,lockX,h*.46,front,iron,'door_lock_plate');
 const keyBlack=new THREE.MeshStandardMaterial({color:0x121315,roughness:.94,metalness:0});
 const escutcheon=namePart(new THREE.CylinderGeometry(.037*c,.037*c,.015*c,16),
  keyBlack,'door_keyhole_oval',lockX,h*.40,front+.035*c);
 escutcheon.rotation.x=Math.PI/2;
 box(.022*c,.065*c,.012*c,lockX,h*.37,front+.043*c,keyBlack,'door_keyhole_slot');
 const ring=namePart(new THREE.TorusGeometry(.115*c,.023*c,8,24),ornament,
  'door_functional_ring_handle',lockX,h*.58,front+.055*c);
 const peg=namePart(new THREE.CylinderGeometry(.04*c,.04*c,.065*c,12),
  iron,'door_ring_spindle',lockX,h*.68,front+.02*c);
 peg.rotation.x=Math.PI/2;
 // Higher ranks have stronger fastenings and appropriately restrained trim.
 if(level>=3){
  for(const sign of [-1,1]){
   box(.11*c,.18*c,.035*c,sign*(w/2-.12*c),h*.92,front,
    ornament,'door_upper_corner_boss');
   box(.11*c,.18*c,.035*c,sign*(w/2-.12*c),h*.08,front,
    ornament,'door_lower_corner_boss');
  }
 }
 if(level>=5){
  for(const sign of [-1,1]){
   box(.045*c,h*.72,.028*c,sign*w*.40,h*.51,front+.01*c,
    ornament,'door_castle_edge_fillet');
  }
  box(w*.36,.10*c,.055*c,0,h*.91,front+.035*c,ornament,'door_highgrade_crest_band');
 }
 root.userData.doorPhysicalConstruction={
  level,plankCount,bandCount,hinges:bandCount,
  loadBearingFrame:true,realThickness:true,metalFasteners:true,units:'m'
 };
 return root;
}
