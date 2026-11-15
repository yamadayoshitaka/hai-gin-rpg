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
 if(status===429){
  if([...codeSet].some(c=>CAPACITY_CODES.has(c)))return 'TEMPORARY_CAPACITY_LIMIT';
  if([...codeSet].some(c=>LIMIT_CODES.has(c)))return 'FREE_QUOTA_EXHAUSTED';
  return 'API_RATE_LIMITED';
 }
 return 'CLOUDFLARE_ERROR';
}
export function canOfferChatGPTHandoff(reason){
 return ['FREE_QUOTA_EXHAUSTED','API_RATE_LIMITED','FREE_ESTIMATE_CAP',
  'CLOUDFLARE_NOT_CONFIGURED','TEMPORARY_CAPACITY_LIMIT'].includes(reason);
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
 return {
  schemaVersion:STORY_HANDOFF_POLICY_VERSION,
  kind:'HAI_GIN_CHATGPT_USER_IMAGE_HANDOFF_NOT_GENERATION',
  reason,providerFrom:'Cloudflare Workers AI Free',
  providerTo:'ChatGPT Images (user-initiated; not OpenAI API)',
  chatGPTReviewUrl:chatGPTReviewLink(shot),
  shotKey:[shot.stageId,shot.edition,shot.gender,shot.shotId].join('|'),
  stageId:shot.stageId,edition:shot.edition,gender:shot.gender,shotId:shot.shotId,
  apiRequestsAlreadyAttempted:attemptedRequests,
  requiresUserAction:true,actualChatGPTImagesGenerated:0,
  gameArtworkRegistered:0,formallyApproved:false,additionalPaidApiCalls:0,
  nextSteps:'Open review URL, create the prompt for this exact shot and attach actual actor/style reference files in ChatGPT; export the real generated WebP for existing gated GitHub intake. Do not mark generated/registered until proven.'
 };
}
