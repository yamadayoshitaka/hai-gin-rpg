import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createDragonkinNativeScalpOverlay}
 from '../src/dragonkin-native-scalp.js';
import {FEMALE_SUMMON_FORMS} from '../src/female-summon-forms.js';
import {addFemaleSummonCostume} from '../src/female-summon-costumes.js';

// Exact source-topology regression. Synthetic skinned donor, with the same
// .getVertexPosition/Head weight path as the real Quaternius female GLTF.
const model=new THREE.Group();
const geom=new THREE.SphereGeometry(1,28,20);
geom.scale(.127,.165,.142);
geom.translate(0,.082,0);
const count=geom.getAttribute('position').count;
const ids=new Uint16Array(count*4),weights=new Float32Array(count*4);
for(let i=0;i<count;i++)weights[i*4]=1;
geom.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));
geom.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
const face=new THREE.SkinnedMesh(geom,new THREE.MeshStandardMaterial());
face.name='Superhero_Female';
model.add(face);
const head=new THREE.Bone();head.name='Head';face.add(head);
face.bind(new THREE.Skeleton([head]));
const groomFrame=new THREE.Group();head.add(groomFrame);
const scalp={center:[0,.082,0],radius:[.129,.169,.144],fitted:true};
model.updateMatrixWorld(true);
const crown=createDragonkinNativeScalpOverlay({
 model,headBone:head,groomFrame,scalp,detail:'high'
});
assert.ok(crown,'Head must produce native source triangles');
assert.equal(crown.userData.kind,'dragonkin-native-scalp-surface');
assert.ok(crown.userData.originalHeadTopology);
assert.ok(crown.userData.sourceTriangles>40);
assert.equal(crown.getAttribute('position').count,
 crown.getAttribute('uv').count);
assert.ok(crown.getAttribute('normal').array.every(Number.isFinite));
const bb=new THREE.Box3().setFromBufferAttribute(crown.getAttribute('position'));
assert.ok(bb.max.y>.244 && bb.max.y<.270);
assert.ok(bb.min.y>.082,'Native face overlay should stop above the brow');
assert.ok(bb.max.x<.16 && bb.min.x>-.16,
 'No detached oversize purple hemisphere');
assert.ok(crown.getAttribute('position').count<
 geom.getAttribute('position').count*6,
 'Native scalp extraction must stay within sane mobile triangle budget');
assert.equal(createDragonkinNativeScalpOverlay({
 model,headBone:head,groomFrame,scalp:{...scalp,fitted:false}
}),null,'Never fake a measured source scalp');

const f={head:new THREE.Group(),headGroom:groomFrame,
 chest:new THREE.Group(),pelvis:new THREE.Group(),
 arms:[new THREE.Group(),new THREE.Group()],
 forearms:[new THREE.Group(),new THREE.Group()],
 legs:[new THREE.Group(),new THREE.Group()],
 calves:[new THREE.Group(),new THREE.Group()]};
const all=[];
const attach=(parent,g,role,name,pos=[0,0,0],rot=[0,0,0])=>{
 const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());
 mesh.position.set(...pos);mesh.rotation.set(...rot);
 mesh.name=name;mesh.userData.role=role;parent.add(mesh);all.push(mesh);
 return mesh;
};
const tube=(parent,role,name,points,radius=.01)=>{
 const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
  points.map(p=>new THREE.Vector3(...p))),8,radius,5,false);
 return attach(parent,geo,role,name);
};
assert.equal(addFemaleSummonCostume({
 profile:FEMALE_SUMMON_FORMS.dragon_lord,frames:f,detail:'high',
 attach,tube,nativeScalp:crown,skullFit:scalp,
 attachGroom:attach
}),true);
const actual=all.find(n=>n.name.includes('dragonkin-scaled-hairless-crown'));
assert.ok(actual,'Dragon lord native scalp part missing');
assert.strictEqual(actual.geometry,crown,
 'The actual source-skinned surface must replace the synthetic onion');
assert.strictEqual(actual.parent,groomFrame);
assert.equal(actual.geometry.userData.kind,'dragonkin-native-scalp-surface');
const runtime=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
assert.match(runtime,/createDragonkinNativeScalpOverlay\(/);
assert.match(runtime,/nativeScalp:nativeDragonCrown/);
assert.match(runtime,/dragonCraniumNativeTopology:!!nativeDragonCrown/);
for(const node of all){node.geometry.dispose();node.material.dispose();}
geom.dispose();face.material.dispose();
console.log('Female Dragon Lord native Head topology regression PASS: true source scalp, correct bound, no onion cap, no actor modification');
