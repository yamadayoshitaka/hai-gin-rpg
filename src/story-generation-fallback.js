/** Free-only failover policy: Cloudflare generation -> user-initiated ChatGPT Images.
 * GitHub Actions and Pages cannot invoke ChatGPT Plus image generation directly.
 * Never turn safety moderation into an automatic alternate-provider retry.
 */
export const STORY_HANDOFF_POLICY_VERSION=1;
const LIMIT_CODES=new Set(['3036','4006']);
const CAPACITY_CODES=new Set(['3040']);
export function classifyCloudflareFailure({status,errors=[],localCap=false,credentialsMissing=false}={}){
 if(localCap)return 'FREE_ESTIMATE_CAP';
 if(credentialsMissing)return 'CLOUDFLARE_NOT_CONFIGURED';
 const codeSet=new Set((Array.isArray(errors)?errors:[]).map(x=>String(x?.code??'')));
 if(codeSet.has('3030'))return 'SAFETY_REVIEW_REQUIRED';
 if((status===400||status===429)&&[...codeSet].some(c=>LIMIT_CODES.has(c)))
  return 'FREE_QUOTA_EXHAUSTED';
 if(status===429){
  if([...codeSet].some(c=>CAPACITY_CODES.has(c)))return 'TEMPORARY_CAPACITY_LIMIT';
  return 'API_RATE_LIMITED';
 }
 return 'CLOUDFLARE_ERROR';
}
export function canOfferChatGPTHandoff(reason){
 return ['FREE_QUOTA_EXHAUSTED','API_RATE_LIMITED','FREE_ESTIMATE_CAP',
  'CLOUDFLARE_NOT_CONFIGURED','TEMPORARY_CAPACITY_LIMIT',
  'FREE_DAILY_DISPATCH_ALREADY_USED','NO_VERIFIED_FREE_ADAPTER'].includes(reason);
}
export function chatGPTReviewLink({stageId,edition,gender,shotId}){
 if(!/^c01-s(?:0[1-9]|10)$/.test(String(stageId))||
    !/^(pre|post-town|post-victory|post-defeat|post-gameover)$/.test(String(edition))||
    !['male','female'].includes(gender)||
    !/^c01-s\d\d-(?:m\d+|death-\d+)$/.test(String(shotId)))
   throw Error('Invalid canonical manga handoff target');
 return 'https://yamadayoshitaka.github.io/hai-gin-rpg/story-chapter1-approval.html?'+
  new URLSearchParams({stage:stageId,edition,gender,shot:shotId,provider:'chatgpt'}).toString();
}
export function makeChatGPTHandoff({reason,shot,attemptedRequests=0}){
 if(!canOfferChatGPTHandoff(reason))throw Error('Only quota/availability failures allow manual image handoff');
 if(!shot?.stageId||!shot?.edition||!shot?.gender||!shot?.shotId)
  throw Error('Missing canonical shot identity');
 if(!/^c(?:0[1-9]|1[0-9]|20)-s(?:0[1-9]|10)$/.test(shot.stageId)||
    !/^(pre|post-town|post-victory|post-defeat|post-gameover)$/.test(shot.edition)||
    !['male','female'].includes(shot.gender)||
    !/^c\d{2}-s\d{2}-(?:m\d+|death-\d+)$/.test(shot.shotId)||
    !shot.shotId.startsWith(shot.stageId+'-'))
  throw Error('Invalid 20-chapter exact scene identity');
 return {
  schemaVersion:STORY_HANDOFF_POLICY_VERSION,
  kind:'HAI_GIN_CHATGPT_USER_IMAGE_HANDOFF_NOT_GENERATION',
  reason,providerFrom:'Cloudflare Workers AI Free',
  providerTo:'ChatGPT Images (user-initiated; not OpenAI API)',
  chatGPTReviewUrl:shot.stageId.startsWith('c01-')?chatGPTReviewLink(shot):null,
  shotKey:[shot.stageId,shot.edition,shot.gender,shot.shotId].join('|'),
  stageId:shot.stageId,edition:shot.edition,gender:shot.gender,shotId:shot.shotId,
  apiRequestsAlreadyAttempted:attemptedRequests,
  requiresUserAction:true,actualChatGPTImagesGenerated:0,
  gameArtworkRegistered:0,formallyApproved:false,additionalPaidApiCalls:0,
  nextSteps:'Open ChatGPT Images in the ChatGPT app, use the exact 16:9 image prompt and attach the real stage/cast reference artworks, then submit native image bytes for gated GitHub intake. GitHub Actions cannot automatically invoke subscription Images. Do not mark generated/registered until proven.'
 };
}
