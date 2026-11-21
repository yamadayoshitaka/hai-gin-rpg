/**
 * m031 骸骨剣士: anatomical bone-only actor, attached to the existing
 * canonical humanoid animation bones. NO donor skin, beard, costume, hair,
 * living head or opaque dark breastplate is visible after adoption.
 *
 * Both the bestiary and battle's canonical character adapter use this sculpt.
 * The originating GLB and its animations are never modified.
 */
import * as THREE from 'three';
export const M031_SKELETON_ANATOMY_REVISION='m031-real-skeleton-bone-only-v1-20261121';

export function buildM031SkeletonAnatomy({profile,detail='high',frames,attach,tube}={}){
 if(profile?.id!=='m031'||profile?.costume!=='skeleton')return null;
 const high=detail==='source'||detail==='high';
 const divisions=detail==='source'?30:detail==='high'?22:detail==='medium'?14:9;
 const counts={skull:0,sockets:0,ribs:0,spine:0,longBones:0,
  pelvis:0,fingers:0};
 const shape=(frame,name,position,radii,role='bone',type='sphere')=>{
  if(!frame)return null;
  const g=type==='faceted'?new THREE.IcosahedronGeometry(1,high?2:1):
    new THREE.SphereGeometry(1,divisions,Math.max(8,Math.floor(divisions*.7)));
  g.scale(...radii);
  const m=attach(frame,g,role,'m031-'+name,position);
  m.userData.m031AnatomicalBone=true;
  return m;
 };
 const arc=(frame,name,points,width=.011,role='bone')=>{
  if(!frame)return null;
  const mesh=tube(frame,role,'m031-'+name,points,width);
  if(mesh)mesh.userData.m031AnatomicalBone=true;
  return mesh;
 };
 const longBone=(frame,name,points,width,role='bone')=>{
  if(!frame)return;
  arc(frame,name+'-shaft',points,width,role);
  shape(frame,name+'-proximal',points[0],
   [width*1.3,width*1.25,width*1.35],role);
  shape(frame,name+'-distal',points.at(-1),
   [width*1.12,width*1.30,width*1.15],role);
  counts.longBones++;
 };

 // Fully opaque bony cranium: the legacy human donor skin and enormous
 // square cheek plates must NEVER show through these overlapping bones.
 shape(frames.head,'cranium',[0,.048,-.005],[.146,.176,.151]);
 shape(frames.head,'occipital',[0,.060,.081],[.130,.141,.080]);
 shape(frames.head,'mandible',[0,-.115,-.083],[.105,.046,.085]);
 shape(frames.head,'maxilla',[0,-.073,-.117],[.119,.053,.053]);
 shape(frames.head,'nasal-cavity',[0,-.040,-.159],
  [.028,.043,.012],'black');
 counts.skull=4;
 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  // Hollow *black* orbital sockets, not the earlier living brown eyebrows
  // or cartoon ivory rectangles hanging beside the mouth.
  shape(frames.head,'orbit-'+suffix,[side*.069,.046,-.145],
   [.046,.050,.026],'black');
  arc(frames.head,'zygomatic-'+suffix,[
   [side*.032,-.042,-.148],
   [side*.096,-.063,-.145],
   [side*.123,-.027,-.096]],high?.014:.018);
  arc(frames.head,'orbital-ridge-'+suffix,[
   [side*.022,.092,-.145],[side*.076,.102,-.144],
   [side*.112,.060,-.113]],high?.012:.016);
  counts.sockets++;
 }
 for(let i=0;i<8;i++){
  const x=(i-3.5)*.025;
  shape(frames.head,'upper-tooth-'+i,[x,-.089,-.166],
   [.010,.017,.010],'ivory');
  shape(frames.head,'lower-tooth-'+i,[x,-.126,-.160],
   [.009,.013,.009],'ivory');
 }

 // Visible complete cage: sternum, 5 pairs of curved ribs, spine vertebrae,
 // scapular attachments, clavicles and iliac/pelvic bones.
 const chest=frames.chest;
 longBone(chest,'sternum',[
  [0,.265,-.232],[0,.075,-.234],[0,-.240,-.204]],.024);
 for(let i=0;i<5;i++){
  const y=.220-i*.101,w=.202-i*.008;
  for(const side of [-1,1]){
   arc(chest,'rib-'+i+'-'+(side<0?'L':'R'),[
    [0,y,-.218],[side*w*.50,y+.028,-.202],
    [side*w,y-.017,-.116],[side*w*.86,y-.047,.030],
    [side*w*.40,y-.057,.106]],
    high?.014:.020);
   counts.ribs++;
  }
 }
 for(let i=0;i<(high?9:5);i++){
  const y=.34-i*(high?.087:.145);
  shape(chest,'vertebra-'+i,[0,y,.115],[.045,.036,.051],
   'bone','faceted');
  counts.spine++;
 }
 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  longBone(chest,'clavicle-'+suffix,[
   [0,.27,-.216],[side*.14,.29,-.18],[side*.30,.22,-.108]],.017);
  // Local y-down long bones inherit their correct source Bone pivots.
  const index=side<0?0:1;
  longBone(frames.arms[index],'humerus-'+suffix,
   [[0,.04,0],[side*.026,-.175,-.016],[side*.025,-.350,-.008]],.036);
  longBone(frames.forearms[index],'ulna-'+suffix,
   [[side*.028,.035,0],[side*.041,-.158,-.026],[side*.041,-.314,-.020]],.022);
  longBone(frames.forearms[index],'radius-'+suffix,
   [[-side*.028,.035,0],[-side*.016,-.150,-.032],
    [-side*.012,-.320,-.019]],.018);
  const hand=frames.hands?.[index]??frames.forearms[index];
  shape(hand,'wrist-'+suffix,[0,-.010,0],[.078,.035,.052]);
  for(let finger=0;finger<4;finger++){
   const x=side*(finger-1.5)*.025;
   arc(hand,'finger-'+suffix+'-'+finger,
    [[x,-.045,-.011],[x*1.15,-.11,-.016],
     [x*1.25,-.15,-.018]],.0075);
   counts.fingers++;
  }
  longBone(frames.legs[index],'femur-'+suffix,
   [[0,.055,0],[side*.026,-.205,.015],[side*.028,-.425,.022]],.044);
  longBone(frames.calves[index],'tibia-'+suffix,
   [[side*.025,.047,.013],[side*.020,-.200,.023],
    [side*.009,-.411,.041]],.034);
  longBone(frames.calves[index],'fibula-'+suffix,
   [[-side*.032,.030,.022],[-side*.038,-.185,.029],
    [-side*.030,-.408,.04]],.018);
  const foot=frames.feet?.[index]??frames.calves[index];
  shape(foot,'heel-'+suffix,[0,-.026,.01],[.080,.054,.110]);
  for(let toe=0;toe<4;toe++){
   const x=(toe-1.5)*.033;
   arc(foot,'toe-'+suffix+'-'+toe,
    [[x,-.050,.05],[x,-.061,.147],[x,-.050,.203]],.008);
  }
  arc(frames.pelvis,'iliac-crest-'+suffix,[
   [side*.075,-.012,-.048],[side*.16,-.042,-.078],
   [side*.195,-.16,-.026],[side*.065,-.27,-.090]],.026);
  shape(frames.pelvis,'hip-socket-'+suffix,
   [side*.116,-.135,-.010],[.071,.083,.081]);
  counts.pelvis++;
 }
 // Painted dark cloth, medallions and sleeves are intentionally omitted.
 return Object.freeze({revision:M031_SKELETON_ANATOMY_REVISION,
  ...counts,visibleDonorSkin:false,opaqueCoat:false,
  boneAnchored:true,lowLod:!high});
}
