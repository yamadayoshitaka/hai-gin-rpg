/**
 * Character grip BOM. The rig controller consumes these data values only;
 * joint angles and handedness are not embedded in the animation loop.
 * Angles are radians relative to each imported finger's rest quaternion.
 */
export const GRIP_BOM=Object.freeze({
 schemaVersion:1,
 jointAxis:[1,0,0],
 neutral:0.045,
 chains:Object.freeze({
  thumb:Object.freeze([0.30,0.23,0.18]),
  finger:Object.freeze([0.54,0.76,0.48])
 }),
 actionStrength:Object.freeze({idle:0.82,walk:0.82,run:0.82,attack:1,guard:0.95,hit:0.70,dead:0.25}),
 offhandEquipment:Object.freeze(['shield','guard','twinblade','fists'])
});
export function gripAngle({equipment='none',action='idle',side='r',thumb=false,segment=1},config=GRIP_BOM){
 const isArmed=equipment!=='none'&&equipment!==null&&equipment!==undefined;
 const activeHand=side==='r'||(side==='l'&&config.offhandEquipment.includes(equipment));
 if(!isArmed||!activeHand)return config.neutral;
 const chain=thumb?config.chains.thumb:config.chains.finger;
 const index=Number(segment)-1;
 if(!Number.isInteger(index)||index<0||index>=chain.length)throw Error('Unsupported finger segment: '+segment);
 return chain[index]*(config.actionStrength[action]??config.actionStrength.idle);
}
