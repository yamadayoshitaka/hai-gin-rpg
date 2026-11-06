import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactEyebrowBand,conformEyebrowsToFace} from '../src/character-system/eyebrow-surface-policy.js';

// Audit the real 7-head female/male GLTF bind-pose geometry, not an artistic
// placeholder or screenshot pixel guess. Eyebrows have independent vertices
// and can float 1-2 cm ahead of the skinned forehead after normalization.
for(const sex of ['Male','Female']){
  const path=new URL(`../assets/characters/quaternius-base/Superhero_${sex}_FullBody.gltf`,import.meta.url);
  const json=JSON.parse(readFileSync(path,'utf8'));
  const binary=readFileSync(new URL(`../assets/characters/quaternius-base/Superhero_${sex}_FullBody.bin`,import.meta.url));
  const readPositions=meshIndex=>{
    const accessor=json.accessors[json.meshes[meshIndex].primitives[0].attributes.POSITION];
    const view=json.bufferViews[accessor.bufferView];
    const offset=(view.byteOffset||0)+(accessor.byteOffset||0);
    const coordinates=new Float32Array(accessor.count*3);
    for(let i=0;i<coordinates.length;i++)coordinates[i]=binary.readFloatLE(offset+i*4);
    return coordinates;
  };
  assert.match(json.meshes[0].name,/^(?:Face|Eyebrows)$/,'mesh index 0 must be the independent eyebrow surface');
  assert.ok(json.nodes.some(n=>n.name==='Eyebrows'),'must retain skinned eyebrow mesh');
  const source=readPositions(0),face=readPositions(2);
  const corrected=conformEyebrowsToFace(source,face);
  assert.ok(corrected.surfaceSamples>=100,`${sex}: insufficient forehead geometry`);
  assert.ok(corrected.corrected>source.length/3*.75,`${sex}: eyebrows not conforming to head contour`);
  assert.ok(corrected.maxBefore>.009,`${sex}: source depth gap test no longer covers the original error`);
  assert.ok(corrected.maxAfter<.005,`${sex}: eyebrow still floats beyond 5 mm`);
  assert.deepEqual(corrected.positions.length,source.length,`${sex}: must preserve geometry/skinning vertex counts`);
  const compact=compactEyebrowBand(source);
  const maxY=Math.max(...Array.from(source).filter((_,i)=>i%3===1));
  const minY=Math.min(...Array.from(source).filter((_,i)=>i%3===1));
  const compactMax=Math.max(...Array.from(compact).filter((_,i)=>i%3===1));
  const compactMin=Math.min(...Array.from(compact).filter((_,i)=>i%3===1));
  assert.ok(compactMax-compactMin<=(maxY-minY)*.53,
    `${sex}: imported triangular eyebrow wedges are still too tall`);
  const tailored=conformEyebrowsToFace(compact,face);
  assert.ok(tailored.maxAfter<.005,`${sex}: compact brows must remain against the forehead`);
  console.log(`PASS ${sex}: ${corrected.corrected} eyebrow vertices conformed; gap ${(corrected.maxBefore*1000).toFixed(1)} -> ${(corrected.maxAfter*1000).toFixed(1)} mm`);
}
