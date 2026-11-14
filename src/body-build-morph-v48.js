/** v48: Preview-only proportional abdomen/waist deformation on REAL skinned body.
 * We always copy from original bind-pose geometry; toggling normal/fat/thin
 * can never accumulate distortion and NEVER edits the shared source GLB.
 */
import {resolveBodyType} from './character-demographics-v47.js?v=51';
const ORIGINAL=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gaussian=(x,c,w)=>Math.exp(-Math.pow((x-c)/w,2));
export function applySkinnedBuildMorph(actorRoot,bodyType='normal'){
 const body=resolveBodyType(bodyType);
 if(!actorRoot?.traverse)return Object.freeze({bodyType:body.id,meshes:0,vertices:0});
 let meshes=0,vertices=0;
 actorRoot.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.geometry?.getAttribute('position'))return;
  // Never deform the head/eyes, hair, rigid equipment, or magic effects.
  if(/head|face|eye|lash|hair|helmet|shield|sword|blade|staff|weapon|vfx/i.test(mesh.name))return;
  const position=mesh.geometry.getAttribute('position');
  if(position.count<150)return;
  let source=ORIGINAL.get(mesh);
  if(!source){
   const geometry=mesh.geometry.clone();
   mesh.geometry=geometry;
   geometry.computeBoundingBox();
   source={original:position.array.slice(),box:geometry.boundingBox.clone()};
   ORIGINAL.set(mesh,source);
  }
  const target=mesh.geometry.getAttribute('position');
  const box=source.box;
  const h=Math.max(.000001,box.max.y-box.min.y),
   w=Math.max(.000001,box.max.x-box.min.x),
   depth=Math.max(.000001,box.max.z-box.min.z);
  const cx=(box.max.x+box.min.x)/2,cz=(box.max.z+box.min.z)/2;
  // Taper both real skinned legs about their own centres, never by scaling
  // the entire actor (which pulls the knees together and changes the rig).
  const legMesh=/(?:^|[_-])(?:ranger|peasant)[_-]legs(?:[_-]|$)|(?:^|[_-])(?:legs|thighs|calves)(?:[_-]|$)/i.test(mesh.name);
  const armMesh=/(?:^|[_-])(?:ranger|peasant)[_-]arms(?:[_-]|$)|(?:^|[_-])(?:arms|forearms)(?:[_-]|$)/i.test(mesh.name);
  const legRadius=clamp(body.legRadius??1,.78,1.20);
  const armRadius=clamp(body.armRadius??1,.85,1.15);
  const splitLegs=legMesh&&(box.min.x<cx-w*.18&&box.max.x>cx+w*.18);
  // Body-only morph: broader waist and outward abdominal curvature,
  // not a second visible ball/sphere added on top of the shirt.
  for(let i=0;i<target.count;i++){
   const x=source.original[i*3],y=source.original[i*3+1],z=source.original[i*3+2];
   const ny=clamp((y-box.min.y)/h,0,1);
   const waist=gaussian(ny,.51,.25),belly=gaussian(ny,.45,.19);
   // A real build changes waist, lower torso, upper arm and hip
   // differently. A standard physique has almost no abdomen protrusion.
   const hip=gaussian(ny,.34,.16),shoulder=gaussian(ny,.77,.12);
   const circumference=1+body.abdomen*
    (.24*waist+.11*belly+.12*hip+.035*shoulder);
   const front=Math.max(0,(z-cz)/depth);
   const waistX=cx+(x-cx)*circumference;
   const anchor=splitLegs?cx+Math.sign(x-cx||1)*w*.25:cx;
   const legGain=legMesh?1+(legRadius-1)*(.72+.28*gaussian(ny,.62,.50)):1;
   // Keep arms/forearms consistent with the torso and leg presets; preview
   // geometry is rebuilt from bind-pose vertices on every selection.
   const armGain=armMesh?1+(armRadius-1)*(.68+.32*gaussian(ny,.55,.40)):1;
   target.setXYZ(i,legMesh?anchor+(waistX-anchor)*legGain:
    armMesh?cx+(waistX-cx)*armGain:waistX,y,
    cz+(z-cz)*(1+body.abdomen*(.22*belly+.06*hip))+
     depth*body.abdomen*.105*belly*front);
  }
  target.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  meshes++;vertices+=target.count;
 });
 return Object.freeze({bodyType:body.id,meshes,vertices,
  geometryFromSource:true,accumulative:false,bellyMorph:body.abdomen,
  legRadius:body.legRadius??1,armRadius:body.armRadius??1});
}
