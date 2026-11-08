import {massGaitActive} from '../mass-visual-motion.js?v=4.6.35';
import {massLocomotionKind} from '../mass-dash-parity.js?v=4.6.34';
// A single visual state for each detailed soldier. The simulation may report
// an attack for just one 100ms tick; keep its authored animation visible while
// allowing actual tile movement to take priority over an upper-body gesture.
export function selectMassBattleMotion(unit, speed, time, previous={}) {
  if (!unit?.alive) return {state:'dead',observed:'dead',holdUntil:0,holdState:null,moving:false};
  const moving=massGaitActive(unit);
  // Grid units can remain marked "attack" while their cooldown counts down.
  // A finished single-shot clip must return to animated idle, then replay on
  // the next real attack, instead of freezing on its last frame indefinitely.
  const attacking=unit.action==='attack'&&(unit.attackElapsed==null||unit.attackElapsed<.65);
  const casting=unit.action==='skill'&&(unit.attackElapsed==null||unit.attackElapsed<.85);
  const observed=unit.hitFlash>0?'hit':casting?'skill':
    attacking?'attack':unit.action==='blocked'?'blocked':
    unit.action==='walk'?'walk':'idle';
  const freshGesture=['hit','skill','attack'].includes(observed)&&observed!==previous.observed;
  const holdState=freshGesture?observed:previous.holdState??null;
  const holdUntil=freshGesture?time+(observed==='hit'?.35:.65):previous.holdUntil??0;
  // Every moving soldier dashes by default; blocked soldiers stay idle.
  const state=moving?(massLocomotionKind(unit)==='walk'?'walk':'run'):
    observed==='blocked'?'idle':
    holdState&&time<holdUntil?holdState:
    observed==='walk'?'idle':
    ['hit','skill','attack'].includes(observed)?observed:'idle';
  return {state,observed,holdState,holdUntil,moving};
}
