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
 * 50v50 and 1000v1000 share realtime combat semantics. A camera cut-in or
 * situation report cannot selectively slow the authoritative mass Worker to
 * 32% while the 50v50 simulation continues at 100%. The explicit tactical
 * pause remains the ONLY control that stops battle time.
 */
export function realtimeBattleCinematicScale({
 town=false,mass=false,paused=false,commander=false,ceremony='idle'
}={}){
 // Use the same battle-time clock for 50, 100 and 1000 soldiers.
 // Presentation effects and camera cuts are handled by their own timers.
 return 1;
}
