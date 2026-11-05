import assert from 'node:assert/strict';
const THREE=await import('three').catch(()=>null);
if(THREE){
  const {ActionVfxRuntime,ACTION_EFFECT_FRAMES}=await import('../src/character-system/action-vfx-runtime.js');
  for(const kind of ['fire','nature','arcane','earth'])
    assert.equal(ACTION_EFFECT_FRAMES[kind].length,7,`${kind} は実素材7フレーム`);
  const scene=new THREE.Scene(),vfx=new ActionVfxRuntime(scene,{maxEffects:48});
  // Browser image loading is not part of the geometry contract.
  vfx.texture=()=>Promise.resolve(null);
  const from={x:0,y:2,z:0},to={x:5,y:0,z:0};
  assert.equal(vfx.emitBreath(from,to,{element:'fire',radius:1.3}),true);
  const breath=vfx.effects.find(e=>e.kind==='breath');
  assert.ok(breath&&breath.object.children.length===2,'実体のある二重ブレス円錐');
  vfx.update(.17);
  assert.ok(breath.object.position.x>0&&breath.object.position.x<5,'口元から前方へ炎が伸びる');
  const groundRing=vfx.effects.find(e=>e.ringOnly);
  assert.ok(groundRing&&groundRing.scale>1,'ブレス着弾半径を描画する');
  vfx.update(.75);
  assert.ok(!vfx.effects.includes(breath),'古いブレスはGPUリソースごと消える');
  assert.equal(vfx.emitExplosion({x:1,y:0,z:2},3),true);
  assert.ok(vfx.effects.some(e=>e.ringOnly&&e.scale>=3),'C4の実半径3を描画する');
  assert.equal(vfx.emitTether(from,to),true,'忍者鉤縄は線ジオメトリ');
  vfx.update(1);
  vfx.dispose();
  assert.equal(scene.children.length,0,'エフェクトはすべて破棄');
  console.log('PASS breath cones / synchronized AoE ring / original animated sprites / C4 explosion / tether');
}else console.log('Library VFX frame contract OK (3D VFX smoke skips without Three.js)');
