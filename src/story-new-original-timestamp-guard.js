/**
 * A newly generated image can be in an obsolete review directory even though
 * its actual creation was AFTER the user changed the new-original policy.
 * Trust the original Git commit creation proof, not the folder label.
 * This only authorizes INPUT into the existing independent WebP/SHA/scene/
 * gender/reference verification; it is NEVER a P0 visual approval.
 */
import {STORY_NEW_ART_START_DATE} from './story-art-sourcing-policy.js';
const START=Date.parse(STORY_NEW_ART_START_DATE+'T00:00:00+09:00');
export function eligibleFreshReviewSource({stageId,edition,gender,expected,source,gitIntroduction}){
 if(!/^c01-s(?:0[5-9]|10)$/.test(stageId)||!['pre','post-victory','post-town'].includes(edition)||
  !['male','female'].includes(gender)||
  typeof expected!=='string'||typeof source!=='string'||
  !expected.includes('/cloudflare-chapter1-new-originals/')||
  source!==expected.replace('/cloudflare-chapter1-new-originals/','/cloudflare-chapter1-free/'))
  return false;
 const [commit,stamp,subject]=String(gitIntroduction||'').trim().split('\t');
 if(!/^[a-f0-9]{40}$/.test(commit)||!Number.isFinite(Date.parse(stamp))||
  Date.parse(stamp)<START)return false;
 return new RegExp('^art\\(review\\): '+stageId+' '+edition+' '+gender+
  ' page [1-9][0-9]* [1-5] real unapproved frames$').test(subject);
}
