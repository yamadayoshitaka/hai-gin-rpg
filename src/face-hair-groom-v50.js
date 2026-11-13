/** v50 catalog-to-geometry hair grooming profiles.
 * All entries change actual head-local guide vertices; names and labels
 * alone are NOT sufficient to count as a finished haircut.
 * x/y/z units below are fractions of the donor 3D head dimensions.
 */
const A=Object.freeze;
export const CATALOG_GROOM_V50=A({
 'male-natural-mash':A({mode:'round-mash',fringeLift:.045,templeFloor:.63,backFloor:.59,sweep:.038,crown:.019,round:.020}),
 'male-two-block':A({mode:'undercut-long-top',fringeLift:.025,templeFloor:.70,backFloor:.71,sweep:.087,crown:.025,round:.01}),
 'male-short-wolf':A({mode:'short-wolf-nape',fringeLift:.025,templeFloor:.57,backFloor:.43,sweep:.078,crown:.028,spike:.021}),
 'male-textured-short':A({mode:'textured-short',fringeLift:.07,templeFloor:.70,backFloor:.70,sweep:.075,crown:.033,spike:.041}),
 'male-long-bangs':A({mode:'prince-side-bangs',fringeLift:.019,templeFloor:.50,backFloor:.52,sweep:.115,crown:.022,comma:.023}),
 'male-shag-medium':A({mode:'shag-medium',fringeLift:.046,templeFloor:.43,backFloor:.37,sweep:.063,crown:.018,wave:.029}),
 'male-medium-layers':A({mode:'clean-medium',fringeLift:.062,templeFloor:.48,backFloor:.50,sweep:.047,crown:.017}),
 'male-wave-perm':A({mode:'soft-perm',fringeLift:.064,templeFloor:.48,backFloor:.49,sweep:.055,crown:.031,wave:.059}),
 'male-side-sweep':A({mode:'side-swept',fringeLift:.052,templeFloor:.53,backFloor:.55,sweep:.137,crown:.014}),
 'male-shoulder-wolf':A({mode:'shoulder-wolf',fringeLift:.037,templeFloor:.19,backFloor:.13,sweep:.060,crown:.015,wave:.048}),
 'male-slick-back':A({mode:'slicked-back',fringeLift:.11,templeFloor:.66,backFloor:.68,sweep:.044,crown:.020,backward:.23}),
 'male-crew-cut':A({mode:'crew',fringeLift:.11,templeFloor:.78,backFloor:.78,sweep:.012,crown:.018,spike:.026}),
 'male-short-spiky':A({mode:'spiky',fringeLift:.12,templeFloor:.75,backFloor:.74,sweep:.035,crown:.065,spike:.075}),
 'male-undercut':A({mode:'undercut',fringeLift:.045,templeFloor:.75,backFloor:.74,sweep:.095,crown:.021}),
 'male-curly-crop':A({mode:'curly-crop',fringeLift:.078,templeFloor:.62,backFloor:.67,sweep:.023,crown:.042,wave:.083}),
 'male-comma':A({mode:'comma-fringe',fringeLift:.058,templeFloor:.59,backFloor:.61,sweep:.123,crown:.035,comma:.085}),
 'male-long-tied':A({mode:'tied-long',fringeLift:.092,templeFloor:.39,backFloor:.21,sweep:.095,crown:.015,backward:.085}),
 'male-senior-sidepart':A({mode:'classic-sidepart',fringeLift:.078,templeFloor:.62,backFloor:.64,sweep:.125,crown:.015}),
 'female-pixie':A({mode:'pixie',fringeLift:.06,templeFloor:.67,backFloor:.68,sweep:.061,crown:.046,spike:.026}),
 'female-short-wolf':A({mode:'female-wolf',fringeLift:.039,templeFloor:.46,backFloor:.40,sweep:.074,crown:.024,wave:.036}),
 'female-hime-cut':A({mode:'hime-straight',fringeLift:.003,templeFloor:.29,backFloor:.09,sweep:.004,crown:.005}),
 'female-twin-braids':A({mode:'braided-up',fringeLift:.064,templeFloor:.59,backFloor:.64,sweep:.050,crown:.014,backward:.055}),
 'female-low-bun':A({mode:'low-bun-up',fringeLift:.082,templeFloor:.65,backFloor:.72,sweep:.068,crown:.015,backward:.115}),
 'female-half-up':A({mode:'half-up',fringeLift:.063,templeFloor:.24,backFloor:.10,sweep:.066,crown:.014,backward:.045}),
 'female-curly-bob':A({mode:'curly-bob',fringeLift:.061,templeFloor:.49,backFloor:.49,sweep:.035,crown:.041,wave:.079}),
 'female-side-ponytail':A({mode:'side-ponytail',fringeLift:.07,templeFloor:.65,backFloor:.68,sweep:.075,crown:.016,backward:.102})
});
const DEFAULT=A({mode:'classic-layered',fringeLift:0,templeFloor:0,
 backFloor:0,sweep:0,crown:0});
export function catalogHairGroom(styleId){
 return CATALOG_GROOM_V50[styleId]||DEFAULT;
}
/** Pure deterministic offset, sampled from every existing scalp guide.
 * Root is never moved, so the opaque same-colour cap stays continuous.
 */
export function groomGuideOffset(profile,{t,zone,partSide,front=false,rootIndex=0}={}){
 const weight=Math.max(0,Math.min(1,Number(t)||0));
 if(weight===0)return {x:0,y:0,z:0};
 const forward=front||zone?.startsWith('fringe');
 const back=zone?.startsWith('back')||zone?.startsWith('nape');
 const side=zone?.startsWith('temple');
 const tip=Math.pow(weight,1.35);
 const sway=forward?1:(side? .20:(back? .10:.36));
 let x=(profile.sweep||0)*tip*sway;
 let y=(profile.crown||0)*Math.sin(Math.PI*weight)*
  (forward||zone==='crown'?1:side?.38:0);
 let z=0;
 if(profile.backward&&(forward||zone==='crown')){
  z-=profile.backward*tip*.72;
  y+=profile.backward*.29*Math.sin(Math.PI*weight);
 }
 if(profile.comma&&forward){
  x+=profile.comma*Math.sin(Math.PI*weight)*Math.sin(Math.PI*weight);
  z-=profile.comma*.15*Math.sin(Math.PI*weight);
 }
 if(profile.spike&&(zone==='crown'||forward)){
  y+=profile.spike*weight*(1-.27*weight);
  x+=profile.spike*.15*partSide*tip;
 }
 if(profile.round&&(forward||side)){
  z+=profile.round*Math.sin(Math.PI*weight);
  y+=profile.round*.21*Math.sin(Math.PI*weight);
 }
 if(profile.wave){
  const phase=weight*Math.PI*5+rootIndex*.73;
  const amplitude=profile.wave*Math.pow(weight,.65);
  x+=amplitude*Math.sin(phase);
  z+=amplitude*.58*Math.cos(phase);
 }
 return {x,y,z};
}
