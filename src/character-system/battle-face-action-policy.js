/**
 * Combat expression selection for the player's real sculpted head.
 * Only the protagonist / strategist has an animated face mesh. Expression
 * updates are event-driven because recalculating dermal vertices each frame
 * would be too expensive for Android and 1000vs1000.
 */
export function selectBattleFaceExpression({hit=false,casting=false,attacking=false,moving=false,defeated=false}={}){
 if(defeated)return 'sad';
 if(hit)return 'startled';
 if(casting)return 'focused';
 if(attacking)return 'shout';
 if(moving)return 'determined';
 return 'serious';
}
export function battleFaceExpressionHold(name){
 return name==='shout'||name==='startled'?.25:.14;
}
