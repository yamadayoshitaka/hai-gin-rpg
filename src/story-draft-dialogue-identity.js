/**
 * Verify a previously rendered original against the exact same canonical stage
 * when its old prompt used only the scene beat and the current screenplay
 * additionally speaks the stage title as narration. Never accept a different
 * plot beat, outcome, gender or arbitrary substring as source provenance.
 *
 * The caller separately verifies shot key, gender, exact WebP SHA, model,
 * reference-image hashes, native pixels and edition before provisional use.
 */
import {CAMPAIGN_STAGE_BY_ID} from './campaign-stage-plan.js';
import {STORY_STAGE_BEATS} from './story-stage-beats-v2.js';

export function sourceDraftDialogueMatches({stageId,edition,shotId,currentText,sourceText}){
 if(typeof currentText!=='string'||typeof sourceText!=='string')return false;
 if(sourceText===currentText)return true;
 const stage=CAMPAIGN_STAGE_BY_ID[stageId];
 if(!stage||edition!=='pre'||shotId!==stageId+'-m1')return false;
 const beat=STORY_STAGE_BEATS[stage.chapter-1]?.[stage.slot-1]?.[0];
 if(typeof beat!=='string'||sourceText!==beat)return false;
 // Only this single, explicitly documented narration-prefix migration.
 return currentText==='今回の舞台は「'+stage.name+'」。'+beat;
}
