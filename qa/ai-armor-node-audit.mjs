import fs from 'node:fs';
const p='assets/characters/free-knight/knight_full_plate_armor.glb';
const b=fs.readFileSync(p);
if(b.toString('ascii',0,4)!=='glTF')throw Error('not GLB');
const n=b.readUInt32LE(12),type=b.readUInt32LE(16);
if(type!==0x4e4f534a)throw Error('missing JSON');
const j=JSON.parse(b.toString('utf8',20,20+n).trim());
const nodes=(j.nodes||[]).filter(x=>x.mesh!==undefined).map(x=>({
 name:x.name||'',meshName:j.meshes?.[x.mesh]?.name||'',
 translation:x.translation||[],rotation:x.rotation||[],scale:x.scale||[],
 primitives:j.meshes?.[x.mesh]?.primitives?.length||0
}));
console.log('FREE_KNIGHT_ARMOR_NODES',JSON.stringify(nodes));
const gloves=nodes.filter(x=>/hand|gaunt|glove|bracer|wrist|cuff|mitten/i.test(x.name+' '+x.meshName));
console.log('FREE_KNIGHT_GAUNTLETS',JSON.stringify(gloves));
const partCount=nodes.length;
if(partCount<30)throw Error('Unexpected incomplete armor '+partCount);
