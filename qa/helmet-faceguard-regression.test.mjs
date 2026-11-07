import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {helmetFaceguardPolicy,shortenedGuardZ} from '../src/character-system/helmet-faceguard-policy.js';

for(const sex of ['male','female']){
  const source=readFileSync(new URL(`../assets/characters/seven-head-equipment-candidates/plate_head-${sex}.glb`,import.meta.url));
  assert.equal(source.toString('utf8',0,4),'glTF');
  const json=JSON.parse(source.toString('utf8',20,20+source.readUInt32LE(12)));
  const names=json.nodes.filter(node=>node.mesh!=null).map(node=>node.name);
  for(const name of ['Fitted brow binding','Nasal fastening','Brow-mounted nasal guard',
    'Bound face opening -1','Bound face opening 1'])
    assert.ok(names.includes(name),`${sex}: source headpiece changed: ${name}`);
  assert.equal(helmetFaceguardPolicy('Fitted brow binding').keep,false,
    `${sex}: duplicated brow band should not cross the eyes`);
  assert.equal(helmetFaceguardPolicy('Nasal fastening').keep,false,
    `${sex}: decorative nose pin must not project like a rod`);
  assert.equal(helmetFaceguardPolicy('Brow-mounted nasal guard').keep,false,
    `${sex}: central forehead/nose guard must never obscure face`);
  assert.ok(helmetFaceguardPolicy('Bound face opening -1').verticalScale<=.65);
  for(const node of json.nodes.filter(n=>n.mesh!=null)){
    const rule=helmetFaceguardPolicy(node.name);
    if(!rule.keep||rule.verticalScale===1)continue;
    const accessor=json.accessors[json.meshes[node.mesh].primitives[0].attributes.POSITION];
    const zMin=accessor.min[2],zMax=accessor.max[2];
    const scaledMin=shortenedGuardZ(zMin,zMax,rule.verticalScale);
    assert.ok(scaledMin>zMin+(zMax-zMin)*.30,
      `${sex}: ${node.name} still reaches the cheek or jaw`);
    assert.equal(shortenedGuardZ(zMax,zMax,rule.verticalScale),zMax,
      `${sex}: a guard must remain attached at the helmet brow`);
  }
  console.log(`PASS ${sex}: redundant visor fittings excluded and cheek/nose guards shortened`);
}
