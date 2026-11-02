// Single source of truth for the character models used by the motion studio and game.
// Never enable a model in the live game until height, rig and animation tests pass.
export const CHARACTER_MODEL_REGISTRY=Object.freeze({
 male:Object.freeze({id:'Superhero_Male_FullBody',url:'./assets/characters/quaternius-base/Superhero_Male_FullBody.gltf',targetHeight:1.78}),
 female:Object.freeze({id:'Superhero_Female_FullBody',url:'./assets/characters/quaternius-base/Superhero_Female_FullBody.gltf',targetHeight:1.66})
});
export const CHARACTER_MOTION_COMMANDS=Object.freeze({
 idle:'idle',walk:'walk',dash:'run',attack:'attack',guard:'block',hit:'hit',dead:'death',jump:'jump',
 sword:'attack',fist:'attack',bow:'attack',magic:'cast',heal:'cast'
});
export const CHARACTER_RELEASE_RULES=Object.freeze({minMappedJoints:10,maxHeightErrorRatio:0.08,requireMovingClip:true,requireIdleClip:true});
export function validateCharacterForGame({mappedJoints=0,measuredHeight=0,targetHeight=0,clips=[]}={}){
 const names=clips.map(c=>String(c).toLowerCase());
 const errors=[];
 if(mappedJoints<CHARACTER_RELEASE_RULES.minMappedJoints)errors.push('joint-coverage');
 if(!Number.isFinite(measuredHeight)||!Number.isFinite(targetHeight)||targetHeight<=0||Math.abs(measuredHeight-targetHeight)>targetHeight*CHARACTER_RELEASE_RULES.maxHeightErrorRatio)errors.push('world-height');
 if(!names.some(n=>/idle|stand/.test(n)))errors.push('idle-clip');
 if(!names.some(n=>/walk|run|locomotion/.test(n)))errors.push('locomotion-clip');
 return {ready:errors.length===0,errors};
}
