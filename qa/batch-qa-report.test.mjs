import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MARKER} from '../scripts/manual-hourly-batch-dispatch.mjs';
import {parseFeedbackContext,validateOriginIssue,formatQAComment} from '../scripts/batch-qa-report.mjs';

const metadata={eventName:'workflow_dispatch',category:'human',status:'success',stage:'qa',
  repo:'yamadayoshitaka/hai-gin-rpg',runId:'43707121865',attempt:'1'};
const event={inputs:{batch_issue:'399'}};
function validIssue(category='human'){
  return {number:399,title:'[hai-gin-batch] human：次の指示',
    user:{login:'yamadayoshitaka'},
    body:MARKER+'\n```json\n'+JSON.stringify({category,target:'',instruction:'Repair the model mesh',max:1})+'\n```'};
}
test('normal scheduled/PR runs never post issue feedback',()=>{
  assert.equal(parseFeedbackContext(event,{...metadata,eventName:'push'}),null);
  assert.equal(parseFeedbackContext({inputs:{}},metadata),null);
});
test('each category can be routed and reports QA without claiming asset repair',()=>{
  for(const category of ['human','monster','world','anime']){
    const ctx=parseFeedbackContext(event,{...metadata,category});
    assert.equal(ctx.category,category);
    assert.equal(validateOriginIssue(validIssue(category),ctx,'yamadayoshitaka').category,category);
    const msg=formatQAComment(ctx);
    assert(msg.includes('actions/runs/43707121865'));
    assert(msg.includes('未完了'));assert(msg.includes('MANUAL_BATCH_HANDLED'));
    assert(msg.includes('hai-gin-batch-qa-v1'));
  }
});
test('owner, issue kind, status and category validation prevent spoofing',()=>{
  const ctx=parseFeedbackContext(event,metadata);
  assert.throws(()=>validateOriginIssue(validIssue(),ctx,'otherowner'),/owner/);
  assert.throws(()=>validateOriginIssue(validIssue('monster'),ctx,'yamadayoshitaka'),/mismatch/);
  assert.throws(()=>validateOriginIssue({...validIssue(),pull_request:{}},ctx,'yamadayoshitaka'),/Issue/);
  assert.throws(()=>parseFeedbackContext(event,{...metadata,status:'unknown'}),/status/);
  assert.throws(()=>parseFeedbackContext(event,{...metadata,stage:'../../bad'}),/stage/);
});
