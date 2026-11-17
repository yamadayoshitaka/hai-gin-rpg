import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCloudflareFailure,canOfferChatGPTHandoff,makeChatGPTHandoff,chatGPTReviewLink} from '../src/story-generation-fallback.js';
test('2026 Cloudflare free quota 429/3036 triggers user-initiated ChatGPT, not paid API',()=>{
 const reason=classifyCloudflareFailure({status:429,errors:[{code:3036,message:'daily free allocation exceeded'}]});
 assert.equal(reason,'FREE_QUOTA_EXHAUSTED');
 assert.equal(canOfferChatGPTHandoff(reason),true);
 const h=makeChatGPTHandoff({reason,shot:{stageId:'c01-s04',edition:'post-victory',gender:'female',shotId:'c01-s04-m8'},attemptedRequests:1});
 assert.match(h.chatGPTReviewUrl,/shot=c01-s04-m8/);
 assert.equal(h.requiresUserAction,true);
 assert.equal(h.actualChatGPTImagesGenerated,0);
 assert.equal(h.additionalPaidApiCalls,0);
});
test('old quota code, temporary rate limit and missing credentials are separate',()=>{
 assert.equal(classifyCloudflareFailure({status:429,errors:[{code:4006}]}),'FREE_QUOTA_EXHAUSTED');
 assert.equal(classifyCloudflareFailure({status:429,errors:[{code:3040}]}),'TEMPORARY_CAPACITY_LIMIT');
 assert.equal(classifyCloudflareFailure({status:429,errors:[]}), 'API_RATE_LIMITED');
 assert.equal(classifyCloudflareFailure({credentialsMissing:true}),'CLOUDFLARE_NOT_CONFIGURED');
 assert.equal(classifyCloudflareFailure({localCap:true}),'FREE_ESTIMATE_CAP');
});
test('safety moderation cannot be bypassed by automatic fallback',()=>{
 const r=classifyCloudflareFailure({status:400,errors:[{code:3030}]});
 assert.equal(r,'SAFETY_REVIEW_REQUIRED');
 assert.equal(canOfferChatGPTHandoff(r),false);
 assert.throws(()=>makeChatGPTHandoff({reason:r,shot:{}}));
});
test('harden wrong stage/gender/shot injections',()=>{
 assert.throws(()=>chatGPTReviewLink({stageId:'../../etc',edition:'pre',gender:'male',shotId:'bad'}));
 assert.throws(()=>chatGPTReviewLink({stageId:'c01-s04',edition:'pre',gender:'unknown',shotId:'c01-s04-m5'}));
});

test('Daily Free dispatch unavailable becomes a ChatGPT Images request, never an unapproved API fallback',()=>{
 assert.equal(canOfferChatGPTHandoff('FREE_DAILY_DISPATCH_ALREADY_USED'),true);
 assert.equal(canOfferChatGPTHandoff('NO_VERIFIED_FREE_ADAPTER'),true);
 const q=makeChatGPTHandoff({reason:'NO_VERIFIED_FREE_ADAPTER',shot:{
  stageId:'c20-s10',edition:'pre',gender:'female',shotId:'c20-s10-m1'
 }});
 assert.equal(q.providerTo,'ChatGPT Images (user-initiated; not OpenAI API)');
 assert.equal(q.chatGPTReviewUrl,null);
 assert.equal(q.actualChatGPTImagesGenerated,0);
 assert.equal(q.formallyApproved,false);
 assert.throws(()=>makeChatGPTHandoff({reason:'FREE_DAILY_DISPATCH_ALREADY_USED',shot:{
  stageId:'c20-s10',edition:'pre',gender:'male',shotId:'c20-s09-m1'
 }}));
});
