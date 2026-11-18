/** Free automatic quality-evolution parameters.
 * These values are CONSUMED by actual face / wig / outfit generators.
 * They are not image scores, model approvals, or Android FPS metrics.
 * Only a separately verified evolution run may commit a new profile.
 */
export const EVOLUTION_PROFILE=Object.freeze({
 face:Object.freeze({eyeInsetRatio:0.031}),
 hair:Object.freeze({fringeRootScale:1}),
 outfit:Object.freeze({fabricBumpScale:1})
});
export const EVOLUTION_LIMITS=Object.freeze({
 face:Object.freeze({eyeInsetRatio:Object.freeze([.018,.04])}),
 hair:Object.freeze({fringeRootScale:Object.freeze([1,1.16])}),
 outfit:Object.freeze({fabricBumpScale:Object.freeze([.90,1.10])})
});
export function validateEvolutionProfile(profile=EVOLUTION_PROFILE){
 for(const [group,keys] of Object.entries(EVOLUTION_LIMITS)){
  for(const [param,[min,max]] of Object.entries(keys)){
   const v=profile?.[group]?.[param];
   if(!Number.isFinite(v)||v<min||v>max)
    throw Error('Unsafe model tuning: '+group+'.'+param+'='+String(v));
  }
 }
 return true;
}
validateEvolutionProfile();
