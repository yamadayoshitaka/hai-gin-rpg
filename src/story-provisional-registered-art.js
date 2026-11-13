/**
 * Deliberately provisional FIRST MISSING chapter-1 story artwork bindings.
 *
 * Exactly 8 Chapter 1 Stage 2 FEMALE PRE-BATTLE shots are mapped to different
 * existing user-accepted mobile WebP crops. The game may display these as
 * clearly marked PROVISIONAL artwork, not as P0 quality-approved illustrations.
 * No image is reused across gender, stage or battle-outcome branches.
 *
 * This does NOT certify attachment of the original character-master bytes or
 * perfect screenplay/character continuity: those still require review.
 */
const base='./assets/story/chapter-drafts/c01/mobile-5x5-20261113/';
const registration=Object.freeze({
 'c01-s02|pre|female|c01-s02-m1':Object.freeze({name:'sheet02-panel04.webp',purpose:'礼拝堂への道を阻む夜の武装勢力'}),
 'c01-s02|pre|female|c01-s02-m2':Object.freeze({name:'sheet01-panel02.webp',purpose:'老騎士ガランの命令と不安'}),
 'c01-s02|pre|female|c01-s02-m3':Object.freeze({name:'sheet02-panel02.webp',purpose:'治癒師イリスと死者名簿の異変'}),
 'c01-s02|pre|female|c01-s02-m4':Object.freeze({name:'sheet01-panel03.webp',purpose:'銀髪のリュシアと軍師の緊迫した軍議'}),
 'c01-s02|pre|female|c01-s02-m5':Object.freeze({name:'sheet03-panel04.webp',purpose:'礼拝堂への道に立ちはだかる不穏な魔術師'}),
 'c01-s02|pre|female|c01-s02-m11':Object.freeze({name:'sheet02-panel01.webp',purpose:'礼拝堂前に集まる人々と軍師'}),
 'c01-s02|pre|female|c01-s02-m13':Object.freeze({name:'sheet03-panel02.webp',purpose:'修道院の石廊下に残る手掛かり'}),
 'c01-s02|pre|female|c01-s02-m15':Object.freeze({name:'sheet04-panel01.webp',purpose:'軍師が守備隊へ戦闘開始の合図を送る'})
});
export const PROVISIONAL_STORY_SHOT_COUNT=Object.keys(registration).length;
export function provisionalRegisteredStoryPanel(shot){
 if(!shot||typeof shot.id!=='string')return null;
 const key=[shot.stageId,shot.comicEdition,shot.protagonistGender,shot.id].join('|');
 const match=registration[key];
 if(!match)return null;
 return Object.freeze({
  key,asset:base+match.name,sourceName:match.name,purpose:match.purpose,
  status:'PROVISIONAL_MOBILE_DRAFT_UNAPPROVED',
  phoneSizeApproved:true,
  screenplayExactnessApproved:false,
  originalMasterImageInputsVerified:false,
  textAndCharacterHumanQAComplete:false,
  mustNotPromoteAsFinal:true
 });
}
