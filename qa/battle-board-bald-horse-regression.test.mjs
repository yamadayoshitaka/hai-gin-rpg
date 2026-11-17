import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 riderSeatAnchor,riderSeatLocalOffset,riderSeatHeight,
 CREATURE_PERFORMANCE
} from '../src/combat-creature-performance.js';
import {battleClosedBackCoverage} from '../src/character-system/battle-visual-pipeline.js';
import {outfitSurfaceRole} from '../src/character-system/outfit-surface-policy.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

// Ground truth from the actual horse sculpt: saddle felt at
// h=1.22 + .40 and leather seat at h+.51, centered at z=-.18.
// Check the pelvis, not the boot/root, actually clears the saddle.
for(const commanderMount of [false,true]){
 const horse={id:'h-1',type:'horse',category:'mount',alive:true,mountedBy:5,commanderMount};
 const at=riderSeatAnchor(horse);
 const size=commanderMount?1.12:1;
 const actualSeat=(1.22+.51+.055)*size;
 assert.ok(at.y>actualSeat-.03,
  'animated rider pelvis must sit above the physical padded horse saddle');
 assert.ok(Math.abs(at.z-(-.18*size))<.07,
  'rider must sit at the saddle centre rather than inside the rear croup');
 assert.equal(riderSeatLocalOffset(horse).z,at.z);
 assert.equal(riderSeatHeight(horse),at.y);
}
assert.ok(CREATURE_PERFORMANCE.horse.seat>1.7);

// Source clothing already has an opaque skinned back. Reject a duplicate
// planar cardboard rear covering, but do not reveal the hidden nude torso.
const originalPanel={isSkinnedMesh:true,visible:false,
 geometry:{getAttribute:()=>({count:350})}};
const source=battleClosedBackCoverage({quality:'battle',
 panel:originalPanel,opaqueLining:1});
assert.equal(source.closed,true);
assert.deepEqual(source.forceCoveredRegions,['torso']);
assert.deepEqual(source.preserveRegions,[]);
const exposed=battleClosedBackCoverage({quality:'battle',
 panel:originalPanel,opaqueLining:0});
assert.equal(exposed.closed,false,'never mask genuinely uncovered back skin');

assert.equal(outfitSurfaceRole('male_ranger_body','MI_Ranger'),'body');
assert.equal(outfitSurfaceRole('male_peasant_body','MI_Peasant'),'body');
const outfit=read('src/character-system/rigged-outfit-runtime.js');
assert.match(outfit,/if\(lowDetail&&\(opaqueTorsoLiningMaterials\+sourceOpaqueTorsoMaterials\)>0\)/,
 'only validated source-fabric costumes suppress redundant back plates');
assert.match(outfit,/panel\.visible=false;panel\.userData\.replacedByOpaqueSourceBack=true/,
 'hide flat duplicate sheets, including in the captured GPU army');
for(const name of ['complete-back-tunic-lining','heroic-cuirass-backplate',
 'l-cuirass-closed-flank','r-cuirass-closed-flank'])
 assert.ok(outfit.includes("'"+name+"'"),'cardboard duplicate suppression: '+name);

const army=read('src/mass-battle-real-army.js');
assert.match(army,/quality:'near',hero:false/,
 'GPU army masters receive dense hair directly on their NEW sculpted head');
assert.match(army,/if\(scalp\.after\.source==='studio-scalp'\)/,
 'only one correctly aligned hair layer may be captured');
assert.doesNotMatch(army,/if\(studioHairRoot\)studioHairRoot\.visible=false/,
 'studio hair must not be replaced with an engulfed donor GLB');
const hair=read('src/character-system/hair-attachment-runtime.js');
assert.match(hair,/length=quality==='battle'\?\.028/,
 'real anatomical scalp retains its visible swept root fibres');
const battle=read('tactics-wireframe.html');
assert.match(battle,/20261117-ground-walk-yaw1/,
 'browser must load the corrected GPU mesh, not cached prior source');
assert.match(battle,/20261117-horse-saddle-fix1/,
 'both 50v50 and 1000v1000 riders share the measured horse seat');
console.log('PASS: no flat back plates, new-sculpt root hair, saddle-centred real rider and intact exposed skin');
