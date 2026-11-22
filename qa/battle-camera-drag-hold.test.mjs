import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const start=source.indexOf('function takeManualBattleCameraControl(){');
const end=source.indexOf('// Wheel zoom and finger drag',start);
assert.ok(start>=0&&end>start,'manual 3D camera handoff is available');
const manualFn=source.slice(start,end);

function cameraState({town=false,locked=false}={}){
 const state={
  TOWN_MODE:town,commandOverviewLocked:locked,manualBattleCameraOverride:false,
  followCamera:true,targetViewFollowing:true,commanderCinematic:{kind:'order'},
  cinematicFocusQueue:[{kind:'order'}],dialogueCameraReturn:{},
  manualCameraSquad:{id:'2',mode:'squad'},manualCameraFocusUntil:Infinity,
  focusedHumanUnitId:42,automaticContactActorId:42,contactSquadId:'2',
  lastGroundTap:{x:20,y:30},setCameraActive(value){this.lastCameraButton=value;},
  syncTeamCameraSwitches(){this.switchRefresh=true;}
 };
 runInNewContext(manualFn+'\ntakeManualBattleCameraControl();',state);
 return state;
}

test('finger drag releases unit following permanently until explicit camera selection',()=>{
 const state=cameraState();
 assert.equal(state.manualBattleCameraOverride,true);
 assert.equal(state.followCamera,false,'no per-frame position overwrite after manual drag');
 assert.equal(state.targetViewFollowing,false,'no per-frame person camera reset after manual drag');
 assert.equal(state.commanderCinematic,null);
 assert.equal(state.cinematicFocusQueue.length,0);
 assert.equal(state.manualCameraSquad,null);
 assert.equal(state.focusedHumanUnitId,null);
 assert.equal(state.lastGroundTap,null);
 assert.equal(state.switchRefresh,true);
 assert.match(source,/if\(followCamera\)\{/,'live follow is gated by followCamera');
 assert.match(source,/manualBattleCameraOverride=false;\s*if\(!TOWN_MODE\)/,
  'only an explicit setBattleCamera call resumes following');
});

test('a stationary tap does not cancel squad tracking; a real drag does',()=>{
 const down=source.slice(source.indexOf("renderer.domElement.addEventListener('pointerdown'"),
  source.indexOf("renderer.domElement.addEventListener('pointerup'"));
 assert.match(down,/battleCameraPointerStarts\.set\(e\.pointerId/);
 assert.match(down,/Math\.hypot\(e\.clientX-origin\.x,e\.clientY-origin\.y\)>=8/);
 assert.match(down,/takeManualBattleCameraControl\(\)/);
 const pointerDownOnly=down.slice(0,down.indexOf("renderer.domElement.addEventListener('pointermove'"));
 assert.doesNotMatch(pointerDownOnly,/takeManualBattleCameraControl\(\)/,
  'a simple pointerdown must not detach the camera');
 const loop=source.slice(source.indexOf('if(followCamera){',source.indexOf('function animate')),
  source.indexOf('updateCommanderCinematic();'));
 assert.match(loop,/if\(followCamera\)\{/);
 assert.match(loop,/camera\.position\.lerp\(personPovPosition,ease\)/,
  'follow loop still works after explicitly selecting a squad again');
});

test('manual 3D camera cannot be stolen by irrelevant overview/town input',()=>{
 assert.equal(cameraState({town:true}).followCamera,true);
 assert.equal(cameraState({locked:true}).followCamera,true);
 assert.match(source,/if\(manualBattleCameraOverride\)\{[\s\S]*?camera\.position\.copy\(shot\.overPosition\)/,
  'loot/annihilation cinematics restore the previous free camera rather than recenter');
 assert.match(source,/battleCameraPointerStarts\.delete\(e\.pointerId\)/);
});
