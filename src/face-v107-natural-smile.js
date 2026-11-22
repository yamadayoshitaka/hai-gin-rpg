/**
 * v107 anatomical cheeks + natural laughing motion.
 *
 * Pure surface fields: no texture tricks, added overlays, disconnected
 * meshes, changes to donor GLB or mouth boundary vertex IDs.
 * Actual main head receives neutral cheek relief before v106 tessellation.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):0));
const smooth=(a,b,x)=>{const t=clamp((x-a)/Math.max(1e-9,b-a));return t*t*(3-2*t);};
const bell=(x,c,r)=>Math.exp(-.5*((x-c)/r)**2);

/**
 * Coordinates: x in [-1,1] relative to half head width, y/z in [0,1].
 * Measurable forward-only geometry displacement with C1 feathering.
 *
 * The nasal unit (|x| <= .33), lips, ears and eyelids are left untouched.
 * V111 reduces this final rest-state support to prevent cumulative v93/v99/
 * v105 relief becoming a jagged raised island. No negative carving.
 */
export function v107NeutralCheekDepth({
 xn=0,yn=0,zn=0,depth=1,ageStrength=0
}={}){
 const ax=Math.abs(xn),age=clamp(ageStrength);
 if(ax<=.33||ax>=.77||yn<=.415||yn>=.655||zn<=.55||
   !Number.isFinite(depth)||depth<=0)return 0;
 const lateral=smooth(.33,.425,ax)*(1-smooth(.66,.77,ax));
 const vertical=smooth(.415,.460,yn)*(1-smooth(.605,.655,yn));
 const anterior=smooth(.55,.80,zn);
 const central=bell(ax,.495,.18)*bell(yn,.525,.102);
 const lower=bell(ax,.515,.19)*bell(yn,.458,.093);
 const rounded=(.011*central+.006*lower);
 const youngWeight=1-.48*age;
 return depth*youngWeight*lateral*vertical*anterior*rounded;
}

/**
 * Smooth FACS smile expansion shared by the cheek pad, lip commissure
 * and lower orbit. x is normalized by FULL face width in [0, .5];
 * y is normalized from chin to crown. Outputs are dimensionless ratios
 * applied to full face width/height/depth by the expression animator.
 */
export function v107SmileSkinDelta({
 ax=0,ny=.52,front=1,mouthY=.509,
 smile=0,cheek=0,ageStrength=0
}={}){
 const s=clamp(smile),c=clamp(cheek),f=clamp(front);
 if(f<.0001||s+c<.0001)return {dxOut:0,dy:0,dz:0,cornerWeight:0,cheekWeight:0,lowerLidWeight:0};
 const age=clamp(ageStrength),strength=Math.max(s*.76,c);
 const lateral=Math.abs(ax);
 const corner=bell(lateral,.090,.058)*bell(ny,mouthY+.007,.050)*f;
 const zygomatic=bell(lateral,.205,.110)*bell(ny,mouthY+.081,.097)*f;
 const lowerLid=bell(lateral,.175,.080)*bell(ny,mouthY+.147,.043)*f;
 // Horizontal skin flow towards the ear, not a V-shaped upward pinch.
 const dxOut=.0048*s*corner+.0014*s*zygomatic;
 // Middle cheek lifts with mouth and a minor lower-lid squint.
 const dy=.0053*s*corner+.0098*strength*zygomatic+
  .0018*strength*lowerLid;
 // Positive-only soft malar volume: don't carve dark nasolabial trenches.
 const dz=(.0033*s*corner+.0088*strength*zygomatic)*
  (1-.35*age);
 return {dxOut,dy,dz,cornerWeight:corner,cheekWeight:zygomatic,
  lowerLidWeight:lowerLid};
}

/** Small repeatable laughing cadence (jaw pulse, paired cheek movement).
 * Kept above 92% jaw-open baseline: it must stay visibly laughing and
 * never become a silent mouth-closing or a twitching mask.
 */
export function v107LaughPulse(seconds=0){
 const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
 const cycle=.5+.5*Math.sin(t*Math.PI*4.2);
 return {mouth:.92+.08*cycle,smile:.975+.025*cycle,
  cheek:.96+.04*cycle};
}
