/**
 * v96 editable-face expression and cosmetics calibration.
 *
 * The old smile expanded real lip edges by 51% while applying a separate
 * steep centre opening. It created V-shaped creases at both commissures.
 * These helpers use a smooth ellipse, explicit upper/lower lips and a
 * cheek-supported smile. They never paint a mask onto a floating overlay.
 */
const finite=(x,f=0)=>Number.isFinite(Number(x))?Number(x):f;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,finite(x)));
const bell=(x,c,w)=>Math.exp(-.5*Math.pow((x-c)/w,2));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

/** A bounded oval, with cheek-assisted corners and independent jaw motion.
 * t is horizontal position within the actual donor's lip boundary [-1,1],
 * sign is +1 for the upper lip, -1 for lower. t=±1 keeps the opening shut.
 */
export function naturalLaughLipDelta({t=0,sign=1,smile=0,open=0,cheek=0,
 width=1,height=1,depth=1,smileWidthScale=1,cornerLiftScale=1}={}){
 const x=clamp(t,-1,1),edge=Math.abs(x),s=clamp(smile),o=clamp(open),
  c=clamp(cheek),top=sign>=0;
 // Zero-slope commissures avoid the pointy V from the former fractional cusp.
  const elliptical=Math.pow(Math.max(0,1-Math.pow(edge,2.6)),1.32);
 // v107 increases natural laugh width on VERIFIED female native oral rigs,
 // while keeping v96's neutral and all male/reference poses identical.
 const mouthSpread=.085*clamp(smileWidthScale,.7,1.65)*s*
  (.22+.78*smooth(.23,.92,edge));
 const dx=x*width*mouthSpread;
 // Corners rise as part of the cheek, rather than forming a pointed V.
 const cornerLift=height*(.009*s+.0025*c)*
  clamp(cornerLiftScale,.8,1.35)*smooth(.45,.97,edge);
 // Central aperture grows as a broad oval; lower lip has more jaw travel.
 // v96's original 4%-of-head-height opening still looked closed in
  // the framebuffer. Give the real lip rim more central jaw travel.
  const opening=height*.078*o*elliptical*(top?.43:.57);
 const dy=cornerLift+(top?opening:-opening);
 const dz=depth*(.0018*c*bell(edge,.62,.22)-
  .0009*o*elliptical);
 return {dx:dx||0,dy:dy||0,dz:dz||0,elliptical,cornerLift:cornerLift||0,
  opening:opening||0,widthSpread:mouthSpread||0,upper:top};
}

/** Skin moves with zygomaticus major, not into a hollow next to the nose.
 * Coordinates are normalized against the entire donor face bounds.
 */
export function naturalSmileCheekDelta({ax=0,ny=.56,front=1,
 smile=0,cheek=0,mouthY=.509,ageWrinkles=0}={}){
 const s=clamp(smile),c=clamp(cheek),f=clamp(front),age=clamp(ageWrinkles);
 const upper=bell(ax,.263,.139)*bell(ny,mouthY+.092,.092)*f;
 const lower=bell(ax,.283,.145)*bell(ny,mouthY+.032,.099)*f;
 const nasolabial=bell(ax,.140,.044)*bell(ny,mouthY+.058,.054)*f;
 const underEye=bell(ax,.170,.060)*bell(ny,mouthY+.162,.040)*f;
 const strength=Math.max(s*.65,c);
 // Lift cheek pad rather than cutting a deep nasolabial groove.
 const dy=.0068*strength*upper+.0028*s*lower;
 const dz=(.0090*strength*upper+.0038*s*lower)*
  (1-.28*age)-.00020*s*nasolabial;
 return {dxOut:.0015*s*lower,dy,dz,
  cheekSupport:upper,nasolabialWeight:nasolabial,
  lowerLidCompress:.0020*strength*underEye};
}

/** Continuous vermilion mask on the original skin triangle vertices.
 * The native lip rim is an ordered edge loop. We use a narrow distance
 * to the actual 3D rim, tapering to both upper and lower lip skin.
 * Even when the donor has only a few rows of lip polygons this anchors
 * lipstick to the DEFORMING head, not to an old projected XY rectangle.
 */
export function nativeVermilionMask({x=0,y=0,z=0,lipCenter=0,
 centerX=0,faceWidth=1,faceHeight=1,faceDepth=1,
 mouthWidth=1,lipstickWidth=1,lipstickHeight=1,
 rim=[],positionAttribute=null}={}){
 if(!positionAttribute||!Array.isArray(rim)||rim.length<24||
  faceHeight<=0||faceWidth<=0||faceDepth<=0)return 0;
 const halfWidth=faceWidth*.082*clamp(mouthWidth,.55,1.5)*
  Math.pow(clamp(lipstickWidth,.5,1.8),.30);
 const ax=Math.abs(x-centerX);
 if(ax>halfWidth*1.12||Math.abs(y-lipCenter)>faceHeight*.041)
  return 0;
 let best=Infinity,nearestZ=-Infinity;
 for(let i=0;i<rim.length;i++){
  const a=rim[i],b=rim[(i+1)%rim.length];
  if(a>=positionAttribute.count||b>=positionAttribute.count)continue;
  const x0=positionAttribute.getX(a),y0=positionAttribute.getY(a),
   x1=positionAttribute.getX(b),y1=positionAttribute.getY(b);
  const dx=x1-x0,dy=y1-y0,length=dx*dx+dy*dy;
  const t=length>1e-12?clamp(((x-x0)*dx+(y-y0)*dy)/length):0;
  const xp=x0+dx*t,yp=y0+dy*t;
  const dist=Math.hypot(x-xp,y-yp);
  if(dist<best){
   best=dist;
   nearestZ=positionAttribute.getZ(a)*(1-t)+positionAttribute.getZ(b)*t;
  }
 }
 if(!Number.isFinite(best))return 0;
 const lateral=1-smooth(halfWidth*.79,halfWidth*1.10,ax);
 const band=faceHeight*.015*clamp(lipstickHeight,.6,1.7);
 const distanceMask=1-smooth(band*.48,band*1.24,best);
 const nearSurface=1-smooth(faceDepth*.025,faceDepth*.095,
  Math.abs(z-nearestZ));
 return clamp(distanceMask*lateral*nearSurface);
}

/** Eyeliner width fades to zero at tear duct and lateral canthus.
 * More tessellation + smooth endcaps prevent stepped rectangular strokes.
 */
export function eyelinerCoverage(u,v,{upper=true}={}){
 const a=clamp(u),b=clamp(v);
 const ends=smooth(0,.095,a)*(1-smooth(.905,1,a));
 const limit=upper?.095:.065;
 return ends*(1-smooth(.0,limit,b));
}
