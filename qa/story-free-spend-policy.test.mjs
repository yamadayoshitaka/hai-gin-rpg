import assert from 'node:assert/strict';
import fs from 'node:fs';
const p=JSON.parse(fs.readFileSync('data/story-generation-spend-policy.json','utf8'));
assert.equal(p.chatGPTSubscriptionMonthlyPlanningBudgetJpy,3000);
assert.equal(p.allowedAdditionalPaidApiSpendJpy,0);
assert.equal(p.cloudflare.dailyWorkflowDispatchesMax,1);
assert.equal(p.cloudflare.paidTierOrTopUpsAllowed,false);
assert.equal(p.chatGPTImageGeneration.automaticPaidApiFallback,false);
assert.equal(p.chatGPTImageGeneration.requiresUserInteraction,true);
const w=fs.readFileSync('.github/workflows/story-cloudflare-free-daily.yml','utf8');
for(const token of ["20 0 * * *","switches.groups?.anime?.enabled!==true","event==\\\"workflow_dispatch\\\"","gh workflow run story-chapter1-free-complete-draft-production.yml --ref main","STORY_FREE_DAILY_SKIP"])
 assert(w.includes(token),'Daily free-only workflow is missing: '+token);
assert(!w.includes('api.openai.com'));
console.log('PASS: ChatGPT subscription-only planning cap (3,000 yen), 0 paid API allowance and one Cloudflare run/day.');
