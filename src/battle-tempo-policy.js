/**
 * Realtime 50v50 tempo, independent of the renderer FPS.
 * Full-body dash phase is derived from travelled distance by the existing
 * locomotion rig, so this speeds up pursuit without making feet skate.
 */
export const SKIRMISH_DASH_TEMPO=1.28;
export function skirmishTravelTempo({floorPhase=null,stealth=false}={}){
 return floorPhase==='climb'||stealth?1:SKIRMISH_DASH_TEMPO;
}
/**
 * Ordinary skirmish orders and situation reports must NOT slow the actual
 * battle simulation to 32% speed. Large-scale cinematic slow-motion remains
 * an independently authored behavior.
 */
export function realtimeBattleCinematicScale({
 town=false,mass=false,paused=false,commander=false,ceremony='idle'
}={}){
 if(town||paused||!mass)return 1;
 return commander||ceremony==='order'||ceremony==='result'?.32:1;
}
