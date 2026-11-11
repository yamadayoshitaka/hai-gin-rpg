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

export const HEROINE_FACE_POLISH_VERSION='adult-soft-jaw-muzzle-sculpt-v7';

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
 const lowerCheek=bell(ax,.64,.28)*bell(yn,.435,.175);
 const jawBlend=bell(ax,.62,.25)*bell(yn,.33,.14);
 const cheekSpike=bell(ax,.85,.18)*bell(yn,.60,.105);
 const midCheek=bell(ax,.51,.26)*bell(yn,.53,.14);
 const noseZone=bell(ax,.22,.16)*bell(yn,.52,.07);
 // Do not sculpt round protruding cheeks on an already youthful head.
 const lateral=sx*(-.034*lowerCheek-.018*jawBlend-.031*cheekSpike)*(1-.91*noseZone);
 const cheekDepth=sz*(-.021*lowerCheek+.005*midCheek-.020*cheekSpike);
 // Recess the full philtrum / lower-face muzzle as a continuous skin surface,
 // not a disconnected mouth plate. Fade before the nose and toward the ears.
 const belowNose=1-smooth(.50,.56,yn);
 const muzzle=bell(ax,.11,.36)*bell(yn,.445,.12)*belowNose;
 const chinPad=bell(ax,.09,.40)*bell(yn,.302,.085);
 const philtrumPlane=bell(ax,.14,.30)*bell(yn,.510,.045)*belowNose;
 const lowerFaceRecess=sz*(-.047*muzzle-.025*chinPad-.012*philtrumPlane);

 // Anatomical nasal subregions have separate subtle offsets: soft bridge,
 // rounded nasal tip and recessed nostril wings rather than a triangular nose.
 const bridge=bell(ax,.10,.17)*bell(yn,.66,.115);
 const tip=bell(ax,.08,.175)*bell(yn,.575,.056);
 const wing=bell(ax,.23,.11)*bell(yn,.555,.040);
 const noseDepth=sz*(.006*bridge+.007*tip-.011*wing);
 const noseWidthShift=-Math.sign(xn)*sx*.004*wing;

 // Upper and lower vermilion get individual small three-dimensional ridges.
 // This enhances the real lip mesh without pasting fake mouth cards.
 const cupid=bell(ax,.16,.14)*bell(yn,.495,.023);
 const lowerLip=bell(ax,.16,.21)*bell(yn,.467,.027);
 const corner=bell(ax,.39,.10)*bell(yn,.484,.031);
 const philtrum=bell(ax,.06,.09)*bell(yn,.548,.022);
 const lipDepth=sz*(.007*cupid+.004*lowerLip-.004*corner-.006*philtrum);
 const mouthCornerLift=sy*.0036*corner;

 return {
  x:x+(Math.sign(xn)*lateral+noseWidthShift)*w,
  y:y+mouthCornerLift*w,
  z:z+(cheekDepth+noseDepth+lipDepth+lowerFaceRecess)*w
 };
}
