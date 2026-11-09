/**
 * Subtle source-preserving feminine head polish for heroine 01.
 *
 * Works in the original real 3D face's LOCAL coordinate frame, after
 * standard facial morphs. This is deliberately not the full-strength
 * 2D silhouette warp: all displacements are smoothly feathered into the
 * human cheek, jaw, nose and lip surfaces and leave the rear scalp alone.
 * It must remain reversible and must NOT change the CC0 master GLB.
 */
const bell=(x,c,w)=>Math.exp(-.5*Math.pow((x-c)/w,2));
const smooth=(a,b,x)=>{
 const t=Math.min(1,Math.max(0,(x-a)/(b-a)));
 return t*t*(3-2*t);
};

export const HEROINE_FACE_POLISH_VERSION='round-cheek-natural-features-v2';

export function polishHeroineFacePoint(x,y,z,box,{strength=1}={}){
 const sx=box.max.x-box.min.x,sy=box.max.y-box.min.y,sz=box.max.z-box.min.z;
 if(!(sx>.01&&sy>.01&&sz>.01)||![x,y,z,strength].every(Number.isFinite))
  throw Error('Real face bounds and finite source vertices required');
 const cx=(box.min.x+box.max.x)*.5;
 const xn=(x-cx)/(sx*.5);
 const ax=Math.abs(xn);
 const yn=(y-box.min.y)/sy,zn=(z-box.min.z)/sz;
 // Do not adjust the back skull, ear tips, eyelids or eyes.
 const front=smooth(.31,.69,zn)*(1-smooth(.88,1.01,yn));
 const w=Math.min(1,Math.max(0,strength))*front;
 if(w<=0)return {x,y,z};

 // Round the lateral transition from cheekbone to lower jaw. Instead of
 // pulling the chin to a point, fill the hollow below the malar area with
 // a smooth Gaussian volume; gently knock down the isolated cheekbone peak.
 const lowerCheek=bell(ax,.67,.24)*bell(yn,.44,.155);
 const jawBlend=bell(ax,.63,.22)*bell(yn,.31,.115);
 const cheekSpike=bell(ax,.85,.18)*bell(yn,.60,.087);
 const midCheek=bell(ax,.51,.26)*bell(yn,.53,.14);
 const lateral=sx*(.025*lowerCheek+.010*jawBlend-.009*cheekSpike);
 const cheekDepth=sz*(.027*lowerCheek+.015*midCheek-.008*cheekSpike);

 // Anatomical nasal subregions have separate subtle offsets: soft bridge,
 // rounded nasal tip and recessed nostril wings rather than a triangular nose.
 const bridge=bell(ax,.10,.17)*bell(yn,.66,.115);
 const tip=bell(ax,.08,.175)*bell(yn,.536,.056);
 const wing=bell(ax,.23,.11)*bell(yn,.515,.040);
 const noseDepth=sz*(.008*bridge+.015*tip-.009*wing);

 // Upper and lower vermilion get individual small three-dimensional ridges.
 // This enhances the real lip mesh without pasting fake mouth cards.
 const cupid=bell(ax,.16,.14)*bell(yn,.405,.023);
 const lowerLip=bell(ax,.16,.21)*bell(yn,.363,.028);
 const corner=bell(ax,.39,.10)*bell(yn,.392,.034);
 const lipDepth=sz*(.015*cupid+.018*lowerLip-.004*corner);

 return {
  x:x+Math.sign(xn)*lateral*w,
  y:y,
  z:z+(cheekDepth+noseDepth+lipDepth)*w
 };
}
