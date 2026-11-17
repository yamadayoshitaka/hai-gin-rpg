/**
 * Reusable cat-family source sculpt. m007 is the slender feline reference:
 * other cats are subtractive/proportional morphs + independent anatomy
 * (lion mane, leopard profile, tiger temples, saber teeth), never wolf hair
 * applied to a cat skeleton. m006 is an intentionally protected original.
 *
 * All lengths are in the head/torso local coordinate systems used by
 * monster-geometry.js. No new draw calls are required in low crowd LOD.
 */
const master=Object.freeze({
  id:'m007',
  archetype:'slender-felid-master',
  torsoWidth:.350,torsoLength:.815,torsoHeight:1.275,
  headWidth:.83,headDepth:.89,cheekTaper:.82,
  eyeX:.190,eyeZ:.192,
  muzzleFront:.232,noseWidth:.074,
  earHeight:.235,earWidth:.130,
  pawWidth:.88,legWidth:.88,
  guardHair:.052,underHair:.025,
  maneLength:0,saberToothLength:.190,
  stripeCount:0,
});
const variants=Object.freeze({
  m007:Object.freeze({archetype:'slender-sabertooth',saberToothLength:.190}),
  m008:Object.freeze({archetype:'lion-regal',
    torsoWidth:.415,torsoLength:.860,headWidth:1.02,headDepth:1.00,
    cheekTaper:.98,eyeX:.226,eyeZ:.206,
    muzzleFront:.278,noseWidth:.097,earWidth:.144,
    legWidth:.98,pawWidth:1.04,
    guardHair:.100,underHair:.042,maneLength:.245,
    saberToothLength:.055}),
  m009:Object.freeze({archetype:'slender-leopard',
    torsoWidth:.330,torsoLength:.856,headWidth:.795,headDepth:.855,
    cheekTaper:.76,eyeX:.180,eyeZ:.182,
    muzzleFront:.208,noseWidth:.068,earHeight:.205,
    legWidth:.82,pawWidth:.84,
    guardHair:.036,underHair:.018,saberToothLength:.050}),
  m010:Object.freeze({archetype:'athletic-tiger',
    torsoWidth:.377,torsoLength:.835,headWidth:.89,headDepth:.915,
    cheekTaper:.88,eyeX:.201,eyeZ:.197,
    muzzleFront:.240,noseWidth:.079,
    legWidth:.93,pawWidth:.92,guardHair:.062,underHair:.031,
    saberToothLength:.085,stripeCount:7})
});
export const FELINE_SOURCE_MODEL='m007-slender-felid-master-v1';
export const FELINE_QUALITY_WAVE_IDS=Object.freeze(Object.keys(variants));
export const felineMasterVariant=id=>{
 const variant=variants[id];
 return variant?Object.freeze({...master,...variant,id,source:FELINE_SOURCE_MODEL}):null;
};
export function felineAnatomicalSections(profile){
 if(!profile)throw Error('Feline profile required');
 // Full breast muscle over the scapula, slim waist and pelvic haunches.
 const w=profile.torsoWidth,l=profile.torsoLength,y=profile.torsoHeight;
 return [
  {z:l*.98,y:y-.080,rx:w*.26,ry:.116},
  {z:l*.77,y:y-.065,rx:w*.94,ry:.294},
  {z:l*.48,y:y-.040,rx:w*1.10,ry:.340},
  {z:l*.14,y:y-.016,rx:w*.95,ry:.305},
  {z:-l*.25,y:y-.020,rx:w*.76,ry:.258},
  {z:-l*.60,y:y-.015,rx:w*.71,ry:.263},
  {z:-l*.87,y:y+.004,rx:w*.61,ry:.225},
  {z:-l*1.02,y:y+.014,rx:w*.26,ry:.108}
 ];
}
export function felineFaceRings(profile,baseRings){
 if(!profile||!Array.isArray(baseRings))throw Error('Feline loft required');
 return baseRings.map((ring)=>{
  // Anterior cheeks and jaw narrow toward the nose; preserve enlarged
  // zygomatic arches around the eye socket and true cat brow.
  const lower=ring.y<-.085;
  const upper=ring.y>.20;
  const taper=lower?profile.cheekTaper:upper?.92:1;
  return {...ring,rx:ring.rx*profile.headWidth*taper,
    rz:ring.rz*profile.headDepth,
    cz:ring.cz+.002};
 });
}
export function felineNasalRings(profile){
 const z=profile.muzzleFront;
 const w=profile.noseWidth;
 // Two rounded nasal lobes flank a shallow central philtrum; each ring
 // narrows in 3D instead of using a floating black sphere.
 return [
  {z:z+.148,y:-.161,rx:w*.18,ry:.014},
  {z:z+.138,y:-.159,rx:w*.62,ry:.033},
  {z:z+.127,y:-.162,rx:w,ry:.046},
  {z:z+.103,y:-.165,rx:w*.92,ry:.039},
  {z:z+.068,y:-.164,rx:w*.51,ry:.023}
 ];
}
export function felineMuzzleRings(profile){
 const z=profile.muzzleFront;
 return [
  {z:z+.090,y:-.151,rx:.038,ry:.031},
  {z:z+.054,y:-.140,rx:.094,ry:.057},
  {z:z-.012,y:-.119,rx:.123,ry:.082},
  {z:z-.105,y:-.078,rx:.157,ry:.115},
  {z:z-.205,y:-.026,rx:.182,ry:.132}
 ].map(p=>({...p,rx:p.rx*profile.cheekTaper}));
}

/** Surface fit is shared by the iris, eyelid and both canthi.
 * The previous hard-coded z=.19 was buried INSIDE the rounded cranial
 * shell, leaving tiny visible black dots instead of expressive cat eyes. */
export function felineEyeSurface(profile,baseRings,{
 x=profile?.eyeX,y=.10,clearance=.017
}={}){
 if(!profile||!Array.isArray(baseRings)||baseRings.length<2)
  throw Error('Feline cranial surface stations required');
 let a=baseRings[0],b=baseRings[baseRings.length-1];
 for(let i=1;i<baseRings.length;i++)
  if(baseRings[i].y>=y){a=baseRings[i-1];b=baseRings[i];break;}
 const t=Math.max(0,Math.min(1,(y-a.y)/Math.max(.00001,b.y-a.y)));
 const rx=(a.rx+(b.rx-a.rx)*t)*profile.headWidth*
   (y<-.085?profile.cheekTaper:1);
 const rz=(a.rz+(b.rz-a.rz)*t)*profile.headDepth;
 const cz=a.cz+(b.cz-a.cz)*t+.002;
 const xx=Math.abs(x),ellipse=Math.max(.045,1-(xx/rx)**2);
 return Object.freeze({x,y,z:cz+rz*Math.sqrt(ellipse)+clearance,
   surfaceZ:cz+rz*Math.sqrt(ellipse),rx,rz});
}

/** Actual source torso top at longitudinal coordinate z.
 * Used by keratin roots, no separate floating generic spike axis. */
export function felineDorsalSurface(profile,z){
 const rings=felineAnatomicalSections(profile);
 let a=rings[0],b=rings[rings.length-1];
 for(let i=1;i<rings.length;i++)
  if(rings[i].z<=z){a=rings[i-1];b=rings[i];break;}
 const t=Math.max(0,Math.min(1,
   (a.z-z)/Math.max(.00001,a.z-b.z)));
 const y=a.y+(b.y-a.y)*t;
 const ry=a.ry+(b.ry-a.ry)*t;
 return y+ry;
}
