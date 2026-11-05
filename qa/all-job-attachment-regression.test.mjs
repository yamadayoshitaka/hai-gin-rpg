import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {EQUIPMENT_TYPES,equipmentForJob} from '../src/character-system/equipment-catalog.js';
import {HELD_GRIP_FRACTIONS,sourceGripFromBounds} from '../src/character-system/equipment-grip-policy.js';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(repo,p),'utf8');
const data=read('src/outfit-maintenance-model.js');
const jobs=[...data.slice(data.indexOf('export const JOBS'),data.indexOf('// Job identity')).matchAll(/\['(job\d\d|king|minister|servant|princess|prince|queen)','([^']+)'\]/g)];
assert.equal(jobs.length,16,'maintain all ten classes plus six court roles');
const rigged=read('src/character-system/rigged-outfit-runtime.js');
assert.match(rigged,/sourceGripFromBounds\(/,'weapon must be aligned by its actual handle');
assert.match(rigged,/object\.position\.copy\(palm\.sub\(rotated\)\)/,'mount exactly at palm');
assert.match(rigged,/gripAnchor=\{kind,source:measured,palm:/,'each weapon must report its contact point');
assert.match(rigged,/piece\.position\.copy\(person\.position\)/,'copy joint XYZ for all 65 bones, not just pelvis');
assert.match(rigged,/hand\.localToWorld\(palmWorld\)/,'weapons must touch the CHARACTER palm in world XYZ');
assert.match(rigged,/item\.parent\.worldToLocal\(palmWorld\)/,'correct the true hilt displacement in the weapon parent frame');
assert.match(rigged,/maxJointXYZError/,'provide world XYZ drift for render-time QA');
assert.match(rigged,/graspPose\.set\(bone/,'equipped fingers must wrap instead of remaining in the T pose');
assert.match(rigged,/thumb_0\$\{segment\}_\$\{side\}/,'each weapon hand must oppose its real thumb around the hilt');
assert.match(rigged,/gripCalibratedAxis='raised-in-palm'/,'the blade must rise above a closed hand instead of disappearing along T-pose arms');
assert.match(rigged,/tipAbovePalm/,'verify that the blade actually extends above the palm');
assert.match(rigged,/restFingerPose/,'switching jobs must release the old closed-finger pose');
assert.match(data,/torsoSamples/,'all decorations need an anatomical torso envelope');
assert.match(data,/surfaceAt\(beltY\)/,'waist belt must use the proper surface');
const hair=read('src/character-system/hair-attachment-runtime.js');
assert.match(hair,/lod\.scale\.set\(fitX,fitY,fitZ\)/,'hair cannot fit by uniform scale alone');
assert.match(hair,/fitted-scalp-underlay/,'close exposed scalp gaps under strand hairstyles');
assert.match(hair,/anatomical-root-fibers/,'real swept strand geometry must cover the bare-looking crown');
assert.match(hair,/mesh\.getVertexPosition\(i,point\)/,'trace the skinned scalp instead of guessing a sphere');
assert.match(hair,/scalpMethod:scalpSurface\?/,'report whether true anatomical scalp was generated');

let checked=0,held=0;
for(const [,job,name] of jobs){
  assert.match(data,new RegExp(`\\b${job}:\\s*\\{concept:`),`missing custom clothes for ${name}`);
  for(const sex of ['male','female']){
    const classSource=new RegExp(`${job}:\\s*\\{concept:[^\\n]+base:'(ranger|peasant)'`).exec(data);
    assert.ok(classSource,`missing wardrobe base ${job}`);
    const source=classSource[1]==='ranger'?'Ranger':'Peasant';
    const prefix=sex==='male'?'Male':'Female';
    assert.ok(existsSync(path.join(repo,`assets/characters/quaternius-outfits/${prefix}_${source}.gltf`)),`${name}/${sex} wardrobe GLTF missing`);
    const equip=equipmentForJob(job);
    for(const kind of [equip.main,equip.offhand].filter(Boolean)){
      assert.ok(EQUIPMENT_TYPES[kind],`${name}/${sex} unregistered prop ${kind}`);
      if(kind==='shield'){
        assert.equal(EQUIPMENT_TYPES.shield.mount.bone,'lowerarm_l',`${name}/${sex} shield must follow forearm`);
        continue;
      }
      const fraction=HELD_GRIP_FRACTIONS[kind];
      assert.ok(fraction>.05&&fraction<.6,`${name}/${sex} unsafe prop grip ${kind}`);
      let min={x:-.04,y:-.2,z:-.01},max={x:.04,y:1.0,z:.01};
      const asset=EQUIPMENT_TYPES[kind].asset;
      if(asset){
        const model=JSON.parse(read(`assets/props/fantasy-megakit/${asset}.gltf`));
        const accessor=model.accessors[model.meshes[0].primitives[0].attributes.POSITION];
        [min,max]=[accessor.min,accessor.max].map(a=>({x:a[0],y:a[1],z:a[2]}));
      }
      const grip=sourceGripFromBounds(kind,min,max);
      assert.ok(grip.y>min.y&&grip.y<max.y,`${name}/${sex} grip outside source mesh`);
      held++;
    }
    checked++;
  }
}
assert.equal(checked,32);
assert.ok(held>=20,`Expected weapon grip checks across 16 roles: ${held}`);
console.log(`PASS all-job attachment matrix: ${checked} outfits, ${held} prop contact points and scalp/torso envelopes`);
