import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCreatureLocomotion,advanceCreatureLocomotion,creatureLegSwing} from '../src/combat-creature-locomotion.js';

// Authoritative destinations are discrete tiles, but the displayed animal
// must retain velocity across both tile boundaries and changing frame rates.
function simulation(fps,type='wolf'){
  const motion=createCreatureLocomotion(0,0,0,Math.PI/2);
  const frames=[];
  const dt=1/fps;
  const changes=[{at:.35,x:1,z:0},{at:.75,x:2,z:0},
    {at:1.15,x:3,z:0},{at:1.55,x:3,z:1}];
  let next=0,x=0,z=0;
  for(let i=0;i<=fps*3;i++){
    const time=i*dt;
    // AI changes cells at exact 10Hz-scale times regardless of display FPS.
    // Advance to those timestamps before drawing the next interpolated frame.
    while(next<changes.length&&changes[next].at<=time){
      const event=changes[next++];
      advanceCreatureLocomotion(motion,x,z,event.at,{speed:type==='horse'?4:2.6,type});
      x=event.x;z=event.z;
    }
    advanceCreatureLocomotion(motion,x,z,time,{speed:type==='horse'?4:2.6,type});
    frames.push({time,x:motion.x,z:motion.z,vx:motion.velocityX,vz:motion.velocityZ,
      activity:motion.activity,gait:motion.gaitPhase,yaw:motion.facing});
  }
  return frames;
}

const at=(frames,time)=>frames.reduce((best,frame)=>Math.abs(frame.time-time)<Math.abs(best.time-time)?frame:best);
for(const type of ['wolf','horse']){
  const framesByFps=[30,60,120].map(fps=>simulation(fps,type));
  for(let k=0;k<framesByFps.length;k++){
    const frames=framesByFps[k],fps=[30,60,120][k];
    const midpoint=at(frames,.56),later=at(frames,.94);
    assert.ok(midpoint.x>0&&midpoint.x<1,`${type} ${fps}fps で1マス目を滑らかに歩く`);
    assert.ok(later.x>1&&later.x<2,`${type} ${fps}fps で次のマスへ連続移動する`);
    assert.ok(midpoint.activity>.3,`${type} ${fps}fps で脚が歩行モーションへ移行する`);
    for(let i=1;i<frames.length;i++){
      const before=frames[i-1],now=frames[i];
      const step=Math.hypot(now.x-before.x,now.z-before.z);
      const turn=Math.abs(Math.atan2(Math.sin(now.yaw-before.yaw),Math.cos(now.yaw-before.yaw)));
      assert.ok(step<.16,`${type} ${fps}fps で瞬間移動しない: ${now.time}`);
      assert.ok(turn<.2,`${type} ${fps}fps で急旋回しない: ${now.time}`);
      assert.ok(now.gait>=before.gait,`${type} ${fps}fps で脚の位相が巻き戻らない`);
    }
    // Momentum still exists just after the simulation chooses the next tile.
    assert.ok(at(frames,.76).vx>.1,`${type} ${fps}fps タイル境界で歩行速度がゼロにならない`);
    assert.ok(at(frames,3).activity<.03,`${type} ${fps}fps 停止後は脚を休める`);
    assert.ok(Math.abs(at(frames,3).x-3)<.02&&Math.abs(at(frames,3).z-1)<.02,
      `${type} ${fps}fps 停止地点に正確に落ち着く`);
  }
  const values=framesByFps.map(frames=>at(frames,1.4).x);
  assert.ok(Math.max(...values)-Math.min(...values)<.045,
    `${type} は30/60/120fpsで移動結果がほぼ一致する: ${values}`);
}

const rendererSource=readFileSync(new URL('../src/combat-world-object-renderer.js',import.meta.url),'utf8');
assert.match(rendererSource,/advanceCreatureLocomotion\(/,'GPUインスタンスにも速度の連続補間を使う');
assert.match(rendererSource,/motion\.gaitPhase\*2/,'歩行時の身体上下動を足運びと同期する');
const battleSource=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battleSource,/creatureVisualTime\+=dt/,'AI tickとは独立して描画フレーム毎に更新する');
assert.match(battleSource,/creatureVisualTime,massSim\?\.units\|\|actors,elapsed/,
  '歩行の描画時計と攻撃判定時計を分離する');

assert.equal(creatureLegSwing('horse',true,1,1.2,0),0,
 'Stopped horse never lifts a leg while waiting at a bridge');
const slow=creatureLegSwing('horse',true,1,1.2,.2);
const gallop=creatureLegSwing('horse',true,1,1.2,1);
const hind=creatureLegSwing('horse',false,1,1.2,1);
assert.ok(Math.abs(gallop)>Math.abs(slow),'Actual speed increases the leg swing');
assert.ok(Math.abs(gallop-hind)>.25,'Fore and hind hooves do not move as one rigid unit');
console.log('灰狼・軍馬 30/60/120fps / ギャロップ / 旋回 / 停止 / GPU時計独立 OK');
