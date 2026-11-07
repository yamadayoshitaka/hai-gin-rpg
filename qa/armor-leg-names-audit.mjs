import fs from 'node:fs';
import {classifyArmorMesh} from '../src/character-system/armor-mesh-classification.js';
for(const sex of ['male','female']){
 const path='assets/characters/seven-head-equipment-candidates/plate_legs-'+sex+'.glb';
 const bytes=fs.readFileSync(path);
 if(bytes.toString('ascii',0,4)!=='glTF')throw Error('Invalid GLB '+path);
 const len=bytes.readUInt32LE(12),type=bytes.readUInt32LE(16);
 if(type!==0x4e4f534a)throw Error('Missing GLB JSON '+path);
 const doc=JSON.parse(bytes.toString('utf8',20,20+len).trim());
 const names=(doc.nodes||[]).filter(node=>node.mesh!==undefined).map(node=>({
  name:node.name,meshName:doc.meshes[node.mesh]?.name,slot:classifyArmorMesh('legs',node.name)
 }));
 console.log('ARMOR_LEG_NAMES',JSON.stringify({sex,names}));
 if(!names.length)throw Error('No armor meshes in '+path);
 const attached=names.filter(x=>x.slot!=='skip');
 const skipped=names.filter(x=>x.slot==='skip');
 console.log('ARMOR_LEG_COUNTS',JSON.stringify({sex,attached:attached.length,skipped:skipped.length,skippedNames:skipped.map(x=>x.name)}));
 if(!attached.length)throw Error('All leg meshes skipped; missing actual armor');
}
