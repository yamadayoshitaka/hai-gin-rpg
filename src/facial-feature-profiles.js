/**
 * Shared deterministic facial identity for EVERY job, summon and monster.
 * Pure data; keeps the realistic donor mesh, skin UVs and rig intact.
 *
 * Shape controls describe anatomical variations, not new floating eyes/noses.
 * Render adapters may report unsupported controls for meshes without the
 * required topology. Those are never silently claimed as successful morphs.
 */
export const FACE_SHAPES=Object.freeze({
 eyes:Object.freeze(['almond','round','narrow','hooded']),
 nose:Object.freeze(['straight','aquiline','broad','short']),
 mouth:Object.freeze(['neutral','wide','bow','thin'])
});
export const FACE_NUMERIC=Object.freeze({
 eyeSize:Object.freeze([.72,1.34]),
 eyeSpacing:Object.freeze([.78,1.24]),
 noseWidth:Object.freeze([.72,1.32]),
 noseLength:Object.freeze([.78,1.29]),
 mouthWidth:Object.freeze([.72,1.36]),
 mouthFullness:Object.freeze([.72,1.32])
});
export const FACE_PROFILE_VERSION='face-identity-v1';
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
export function hashFaceIdentity(identifier){
 let h=2166136261;
 for(const char of String(identifier))h=Math.imul(h^char.codePointAt(0),16777619);
 return h>>>0;
}
export function normalizeFaceProfile(input={}){
 const result={};
 for(const [part,types] of Object.entries(FACE_SHAPES))
   result[part+'Type']=types.includes(input[part+'Type'])?input[part+'Type']:types[0];
 for(const [key,[min,max]] of Object.entries(FACE_NUMERIC)){
  const value=finite(input[key]);
  result[key]=value==null?1:Number(clamp(value,min,max).toFixed(3));
 }
 return Object.freeze(result);
}
const variation=(h,step)=>(((h>>>step)^(h*0x45d9f3b))>>>0)/4294967295;
export function createFaceProfile({id='default',kind='human',sex='',overrides={}}={}){
 const stableId=String(kind)+':'+String(id)+':'+String(sex);
 const h=hashFaceIdentity(stableId);
 const v=shift=>variation(h,shift);
 const base={};
 for(const [type,types] of Object.entries(FACE_SHAPES))
  base[type+'Type']=types[Math.floor(v((type.length*3)%16)*types.length)%types.length];
 let i=0;
 for(const [key,[min,max]] of Object.entries(FACE_NUMERIC)){
  const spread=Math.min(.17,(max-min)*.48);
  base[key]=1+(v((i++*5)%19)-.5)*spread*2;
 }
 const parts=normalizeFaceProfile({...base,...overrides});
 return Object.freeze({id:String(id),kind:String(kind),sex:String(sex),version:FACE_PROFILE_VERSION,...parts});
}
export function updateFaceProfile(profile,changes={}){
 return Object.freeze({...profile,...normalizeFaceProfile({...profile,...changes})});
}
export function facialSpeechEnvelope(seconds,syllables=1){
 if(!Number.isFinite(seconds)||seconds<0)return 0;
 const count=Math.max(1,Math.min(140,Math.round(syllables)));
 const duration=count*.17+.18;
 if(seconds>=duration)return 0;
 const fade=Math.min(1,seconds/.09,(duration-seconds)/.16);
 const modulation=.25+.75*Math.abs(Math.sin(seconds*17.5)+.26*Math.sin(seconds*26.5))/.96;
 return Math.max(0,Math.min(1,fade*modulation));
}
export function mouthSyllableCount(text){
 const groups=String(text||'').match(/[ぁ-んァ-ヶー]|[aeiouAEIOU]|[一-龯]/gu);
 return Math.max(1,Math.min(140,groups?.length??1));
}
/** Projected image-space landmark metrics, no screenshot or GPU needed.
 * 2D landmarks are in units of face width, so they are comparable across rigs.
 */
export function projectedFaceLandmarks(face,width=120){
 const f=normalizeFaceProfile(face),eyeSize=width*.115*f.eyeSize;
 const spacing=width*.24*f.eyeSpacing;
 const noseWidth=width*.10*f.noseWidth;
 const noseHeight=width*.16*f.noseLength;
 const mouthWidth=width*.26*f.mouthWidth;
 const fullness=width*.032*f.mouthFullness;
 return Object.freeze({
  leftEye:Object.freeze({x:-spacing,y:-width*.1,width:eyeSize,height:eyeSize*.62}),
  rightEye:Object.freeze({x:spacing,y:-width*.1,width:eyeSize,height:eyeSize*.62}),
  nose:Object.freeze({x:0,y:width*.065,width:noseWidth,height:noseHeight}),
  mouth:Object.freeze({x:0,y:width*.265,width:mouthWidth,height:fullness}),
  symmetry:1,
 });
}
