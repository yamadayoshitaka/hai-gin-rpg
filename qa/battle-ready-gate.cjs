/** Actual game battle startup classification.
 * The newest 50v50 page sometimes starts directly with battleReady=true
 * and 100 actors, WITHOUT visible three-step wizard tabs. Waiting for
 * legacy tabs then times out despite a fully loaded production game.
 * Never fabricate ready=true; read the game's own startup telemetry.
 */
function classifyBattleStartup({ready=false,actors=0,visibleWizard=false,errorVisible=false}={}){
 if(errorVisible)return 'runtime_error';
 if(visibleWizard)return 'wizard';
 if(ready===true&&Number.isInteger(actors)&&actors>=100)return 'running';
 return 'pending';
}
module.exports={classifyBattleStartup};
