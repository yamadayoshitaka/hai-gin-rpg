/**
 * Two hundred chapter-aware scene scripts. The first ten scenes belong to
 * the original mainland; later chapters travel to independent continents.
 * This remains linear story narration, not a misleading claim of branching.
 */
import {STORY_CHAPTERS} from './story-chapters.js';
import {continentForChapter} from './continent-campaign.js';
import {STORY_STAGE_BEATS} from './story-stage-beats-v2.js';
// All 200 setups and results are individually authored. The former generic
// ten-line sequence and rotating three chapter quotes caused repeated dialogue.
const kindLead=Object.freeze({
 town:'拠点で軍を整え、店主や村人の話から土地の事情を知る。',
 explore:'魔物の出現にも土地の異変にも、誰かが隠した理由がある。',
 capture:'旗を奪うだけでなく、占領された土地に暮らす人々を守る。',
 defend:'防衛線の後ろには避難できない民がいる。退路を絶ってはならない。',
 siege:'城壁の向こうの敵将も、勝者の記録から消されるかもしれない。',
 boss:'軍師は戦の結果と、その後の歴史に対して責任を負う。'
});
export function narrativeForStage(stage){
 if(!stage||!Number.isInteger(Number(stage.chapter))||!Number.isInteger(Number(stage.slot)))
  throw Error('章と場面を指定してください。');
 const chapter=STORY_CHAPTERS[Number(stage.chapter)-1];
 if(!chapter)throw Error('章がありません。');
 const continent=continentForChapter(chapter.id),slot=Math.max(1,Math.min(10,Number(stage.slot)));
 const [scene,consequence]=STORY_STAGE_BEATS[chapter.id-1][slot-1];
 const dialogue=slot===1?chapter.dialogues[0]:{speaker:'語り手',line:scene};
 const intro=slot===1?chapter.synopsis:slot===10?chapter.narration:chapter.objective;
 const title='第'+chapter.id+'章・第'+slot+'幕「'+(stage.name||chapter.title)+'」';
 const narration=title+'。舞台は'+continent.name+'の'+continent.regionName+'。'+intro+'。'+
  (kindLead[stage.kind]||'')+scene+consequence+
  (slot===1?' '+dialogue.speaker+'は言う。「'+dialogue.line+'」':'')+
  ' この地域の争点は、'+continent.conflict;
 return Object.freeze({title,chapter:chapter.id,slot,continent:continent.name,
  premise:continent.arc,conflict:continent.conflict,scene,consequence,
  speaker:dialogue.speaker,line:dialogue.line,narration});
}
