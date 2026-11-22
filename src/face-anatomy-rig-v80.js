/**
 * Continuous, donor-owned facial muscle fields inspired by FACS.
 * An Action Unit is a motion channel, not a floating crease or mesh card.
 * Normalised face coordinates: ax = half-independent |x-center|/width;
 * ny = (y-minY)/height, and z-facing mask is front in [0,1].
 */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number(x)||0));
const fall=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);

export const FACS_CHANNELS_V80=Object.freeze([
 'au01','au02','au04','au05','au06','au07','au09','au10',
 'au12','au15','au17','au20','au24','au26'
]);

export function deriveFacialActionUnits(expression={}){
 const brow=Number(expression.brow)||0,smile=Number(expression.smile)||0;
 const cheek=Number(expression.cheek)||0,squint=Number(expression.squint)||0;
 const open=Number(expression.open)||0,tilt=Number(expression.tilt)||0;
 const natural={
  au01:clamp(Math.max(0,brow+tilt*.3)),
  au02:clamp(Math.max(0,brow-tilt*.3)),
  au04:clamp(-brow*2),
  au05:clamp(Math.max(0,-squint*.65)+Math.max(0,brow)*.25),
  au06:clamp(Math.max(0,cheek,smile*.70)),
  au07:clamp(squint),
  au09:clamp(Math.max(0,-brow)*.55),
  au10:clamp(Math.max(0,open)*.35+Math.max(0,cheek)*.12),
  au12:clamp(smile),
  au15:clamp(-smile),
  au17:clamp(Math.max(0,-smile)*.40),
  au20:clamp(Math.abs(smile)*.16),
  au24:clamp(Math.max(0,-open)*.4),
  au26:clamp(open)
 };
 for(const key of FACS_CHANNELS_V80){
  const override=expression[key];
  if(override!==undefined&&Number.isFinite(Number(override)))
   natural[key]=clamp(override);
 }
 return natural;
}

export function v80FaceMuscleDelta({ax=0,ny=.5,front=1,
 mouthY=.509,ageStrength=0,expression={},actionUnits=null}={}){
 const a=actionUnits||deriveFacialActionUnits(expression);
 const f=clamp(front),age=clamp(ageStrength);
 const eyeY=.684,browY=.744;
 const corner=fall(ax,.078,.038)*fall(ny,mouthY,.048)*f;
 const lowerLip=fall(ax,.068,.063)*fall(ny,mouthY-.021,.034)*f;
 const jaw=fall(ax,.10,.17)*fall(ny,mouthY-.095,.12)*f;
 const medialForehead=fall(ax,.085,.07)*fall(ny,browY+.045,.083)*f;
 const lateralForehead=fall(ax,.22,.10)*fall(ny,browY+.035,.081)*f;
 const corrugator=fall(ax,.075,.068)*fall(ny,browY,.047)*f;
 const eyelid=fall(ax,.12,.075)*fall(ny,eyeY,.046)*f;
 const cheek=fall(ax,.23,.10)*fall(ny,mouthY+.084,.078)*f;
 const alar=fall(ax,.105,.042)*fall(ny,mouthY+.064,.057)*f;
 // The nasolabial groove follows the nose-to-oral-commissure oblique arc.
 // Shared oral corner-to-nasal alar route; no offset drawn-on creases.
  const foldX=.09+.045*clamp((ny-mouthY)/.16);
 const groove=fall(ax,foldX,.028)*fall(ny,mouthY+.070,.088)*f;
 const foldMound=fall(ax,foldX+.042,.050)*fall(ny,mouthY+.078,.084)*f;
 const canthus=fall(ax,.207,.047)*fall(ny,eyeY,.043)*f;
 const underEye=fall(ax,.14,.079)*fall(ny,eyeY-.059,.038)*f;
 const dy=
  .0075*a.au01*medialForehead+.007*a.au02*lateralForehead-
  .006*a.au04*corrugator+.003*a.au05*eyelid+
  .012*a.au06*cheek+.009*a.au12*corner-
  .008*a.au15*corner+.005*a.au10*alar-
  .006*a.au17*lowerLip-.028*a.au26*jaw;
 const dz=
  .008*a.au06*cheek+.002*a.au05*eyelid-
  .005*a.au07*eyelid+.005*a.au09*alar-
  (.004+.006*age)*(a.au06*.62+a.au12*.70)*groove+
  (.004+.003*age)*a.au06*foldMound+
  (.003+.003*age)*(a.au06+a.au07)*canthus-
  .003*a.au26*lowerLip+
  .0018*age*(a.au06+a.au07)*underEye;
 const dxOut=(.011*a.au12+.005*a.au20-.007*a.au15)*corner+
  .002*a.au06*cheek;
 return {dxOut,dy,dz,actionUnits:a,grooveWeight:groove,
  lowerEyeWeight:underEye};
}
