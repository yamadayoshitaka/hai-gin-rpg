/**
 * BATCH: unified facial volume for bestiary monsters and battle summons.
 *
 * These are THREE-DIMENSIONAL vertex displacements, not painted shadows,
 * separate button eyes or additional spherical "cheek" attachments.
 * Species presets are deliberately bounded to keep eye sockets, jaw hinges,
 * existing silhouettes, instanced parts and low/high LOD stable.
 */
const positive=(n)=>Number.isFinite(n)&&n>=0;
const gaussian=(t,center,width)=>{
 const d=(t-center)/width;
 return Math.exp(-d*d*2.2);
};
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const metricNames=Object.freeze([
 'craniumDepth','browDepth','orbitalDepth','cheekDepth',
 'snoutDepth','jawDepth','occipitalDepth',
]);
const make=(data)=>{
 for(const k of metricNames)if(!positive(data[k])||data[k]>.14)
  throw Error('Invalid creature facial volume '+k);
 return Object.freeze({...data});
};
export const CREATURE_FACE_VOLUME_METRICS=metricNames;

export const CREATURE_FACE_VOLUME_PRESETS=Object.freeze({
 wolf:make({craniumDepth:.032,browDepth:.020,orbitalDepth:.018,cheekDepth:.041,snoutDepth:.037,jawDepth:.026,occipitalDepth:.026}),
 horse:make({craniumDepth:.033,browDepth:.022,orbitalDepth:.019,cheekDepth:.036,snoutDepth:.045,jawDepth:.025,occipitalDepth:.032}),
 wyvern:make({craniumDepth:.042,browDepth:.032,orbitalDepth:.029,cheekDepth:.055,snoutDepth:.044,jawDepth:.036,occipitalDepth:.036}),
 dragon:make({craniumDepth:.052,browDepth:.038,orbitalDepth:.031,cheekDepth:.069,snoutDepth:.045,jawDepth:.040,occipitalDepth:.045}),
 elder_dragon:make({craniumDepth:.056,browDepth:.040,orbitalDepth:.035,cheekDepth:.077,snoutDepth:.050,jawDepth:.045,occipitalDepth:.047}),
 dragon_lord:make({craniumDepth:.061,browDepth:.046,orbitalDepth:.030,cheekDepth:.077,snoutDepth:.052,jawDepth:.043,occipitalDepth:.046}),
 forest_archer:make({craniumDepth:.030,browDepth:.015,orbitalDepth:.017,cheekDepth:.033,snoutDepth:.028,jawDepth:.021,occipitalDepth:.026}),
 seraph_guardian:make({craniumDepth:.033,browDepth:.015,orbitalDepth:.019,cheekDepth:.035,snoutDepth:.029,jawDepth:.022,occipitalDepth:.028}),
 beast:make({craniumDepth:.035,browDepth:.022,orbitalDepth:.018,cheekDepth:.037,snoutDepth:.035,jawDepth:.028,occipitalDepth:.026}),
 feline:make({craniumDepth:.034,browDepth:.021,orbitalDepth:.020,cheekDepth:.047,snoutDepth:.024,jawDepth:.030,occipitalDepth:.030}),
 reptile:make({craniumDepth:.030,browDepth:.028,orbitalDepth:.026,cheekDepth:.043,snoutDepth:.045,jawDepth:.031,occipitalDepth:.026}),
 avian:make({craniumDepth:.024,browDepth:.016,orbitalDepth:.019,cheekDepth:.030,snoutDepth:.031,jawDepth:.016,occipitalDepth:.022}),
 undead:make({craniumDepth:.036,browDepth:.028,orbitalDepth:.036,cheekDepth:.056,snoutDepth:.042,jawDepth:.034,occipitalDepth:.030}),
 fiend:make({craniumDepth:.048,browDepth:.034,orbitalDepth:.031,cheekDepth:.057,snoutDepth:.041,jawDepth:.040,occipitalDepth:.038}),
 aquatic:make({craniumDepth:.031,browDepth:.019,orbitalDepth:.024,cheekDepth:.040,snoutDepth:.033,jawDepth:.023,occipitalDepth:.029}),
});
const overrides=Object.freeze({
 m032:Object.freeze({orbitalDepth:.049,cheekDepth:.060,occipitalDepth:.035}),
 m034:Object.freeze({orbitalDepth:.029,cheekDepth:.044,snoutDepth:.033}),
 m031:Object.freeze({cheekDepth:.061,jawDepth:.036}),
});
export function creatureFaceVolume(id,family=''){
 const base=CREATURE_FACE_VOLUME_PRESETS[id]??
   CREATURE_FACE_VOLUME_PRESETS[family]??CREATURE_FACE_VOLUME_PRESETS.beast;
 const patch=overrides[id];
 return patch?make({...base,...patch}):base;
}
/**
 * A side-to-side quadruped head loft follows +Z from occiput to muzzle.
 * t: back->front. a: around cross section, x=cos(a), y=sin(a).
 */
export function sculptAxialFacePoint(x,y,z,t,a,volume){
 const u=clamp(t),side=Math.cos(a),up=Math.sin(a),lateral=Math.abs(side);
 const cheeks=gaussian(u,.51,.16)*gaussian(up,-.33,.41)*Math.pow(lateral,1.1);
 const sockets=gaussian(u,.51,.13)*gaussian(up,.18,.24)*Math.pow(lateral,1.8);
 const brows=gaussian(u,.50,.14)*gaussian(up,.60,.31);
 const brain=gaussian(u,.29,.24);
 const muzzle=gaussian(u,.76,.15)*Math.max(0,.70+.30*up);
 const jaw=gaussian(u,.69,.19)*gaussian(up,-.67,.38);
 const occiput=gaussian(u,.12,.16);
 const sign=Math.sign(side);
 const xx=x+sign*(volume.craniumDepth*.70*brain*lateral+
   volume.cheekDepth*cheeks-volume.orbitalDepth*.68*sockets);
 const yy=y+volume.craniumDepth*.25*brain*up+
   volume.browDepth*brows-volume.jawDepth*jaw;
 const zz=z+volume.snoutDepth*muzzle*(1-.32*lateral)-
   volume.occipitalDepth*occiput+
   volume.cheekDepth*.23*cheeks;
 return [xx,yy,zz];
}
/**
 * Upright humanoid skull loft: t chin->crown, front>0 means +Z.
 * A realistic zygoma/orbit relief is formed in the same skull mesh.
 */
export function sculptVerticalFacePoint(x,y,z,t,side,front,volume){
 const u=clamp(t),frontWeight=Math.max(0,front),lateral=Math.abs(side);
 const temple=gaussian(u,.78,.18);
 const zygoma=gaussian(u,.42,.095)*gaussian(lateral,.69,.23);
 const socket=gaussian(u,.60,.083)*gaussian(lateral,.49,.24);
 const brow=gaussian(u,.73,.064)*gaussian(lateral,.52,.32);
 const bridge=gaussian(u,.42,.085)*gaussian(side,0,.24);
 const jaw=gaussian(u,.20,.095)*gaussian(lateral,.37,.40);
 const occipital=gaussian(u,.78,.20);
 const zOut=z+
   frontWeight*(volume.craniumDepth*.53*temple+
     volume.cheekDepth*zygoma-volume.orbitalDepth*socket+
     volume.browDepth*brow+volume.snoutDepth*bridge+
     volume.jawDepth*.64*jaw)-
   Math.max(0,-front)*volume.occipitalDepth*occipital;
 const xOut=x+Math.sign(side)*(
   volume.cheekDepth*.28*zygoma+volume.craniumDepth*.15*temple-
   volume.orbitalDepth*.16*socket);
 return [xOut,y,zOut];
}
