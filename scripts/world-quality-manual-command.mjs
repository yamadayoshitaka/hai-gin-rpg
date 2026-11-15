#!/usr/bin/env node
/**
 * Validated, no-credential operator instructions for one world-quality batch.
 * GitHub issue creation is the authenticated entry point from the static Pages dashboard.
 * The instructions only affect a 2D reference prompt and target selection, never shell/code.
 */
import fs from 'node:fs';
import path from 'node:path';
export const ISSUE_MARKER='<!-- hai-gin-world-quality-request-v1 -->';
const kinds=new Set(['all','object','stage']);
const normalizeText=x=>String(x??'').trim().replace(/\r\n?/g,'\n');
export function normalizeRequest(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Missing command object');
 const kind=normalizeText(raw.kind||'all');
 const target=normalizeText(raw.target||'');
 const instruction=normalizeText(raw.instruction||'');
 const max=Number(raw.maxReferences??1);
 if(!kinds.has(kind))throw Error('Invalid target type');
 if(target&&(!/^(object:[a-z][\w-]*|stage:c\d{2}-s\d{2})$/.test(target)||target.split(':')[0]!==kind))
  throw Error('Target must match selected type and catalog key');
 if(!Number.isInteger(max)||max<1||max>3)throw Error('Free-only maximum must be 1..3');
 if(instruction.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(instruction))
  throw Error('Instruction too long or contains control characters');
 return {schemaVersion:1,kind,target,instruction,maxReferences:max};
}
export function parseIssueBody(body){
 if(typeof body!=='string'||!body.startsWith(ISSUE_MARKER))throw Error('Not a quality request');
 const match=body.match(/```json\s*([\s\S]*?)\s*```/);
 if(!match)throw Error('Missing JSON instruction block');
 return normalizeRequest(JSON.parse(match[1]));
}
export function makeIssueBody(raw){
 const command=normalizeRequest(raw);
 return ISSUE_MARKER+'\n```json\n'+JSON.stringify(command,null,2)+'\n```\n\n'
  +'この依頼は無料Cloudflare枠内で、実写品質の2D見本と3D比較候補のみ作成します。'
  +'ゲーム本番への反映・自動マージは行いません。';
}
function cli(){
 const eventName=process.env.GITHUB_EVENT_NAME||'';
 const eventPath=process.env.GITHUB_EVENT_PATH;
 if(!eventPath)throw Error('GitHub event payload required');
 const event=JSON.parse(fs.readFileSync(eventPath,'utf8'));
 let command;
 if(eventName==='issues'){
  if(!String(event.issue?.title||'').startsWith('[world-quality]')||
      event.issue?.user?.login!==process.env.GITHUB_REPOSITORY_OWNER)
   throw Error('Only a repository owner quality issue is allowed');
  command=parseIssueBody(event.issue.body);
 }else if(eventName==='workflow_dispatch'){
  const inp=event.inputs||{};
  command=normalizeRequest({
   kind:inp.target_type||'all',target:inp.target_key||'',
   instruction:inp.next_instruction||'',maxReferences:inp.max_references||1
  });
 }else{
  console.log('No manual request for scheduled or push run');
  return;
 }
 const output=path.resolve('qa-reports/world-quality/manual-command.json');
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(command,null,2)+'\n');
 console.log(JSON.stringify({manualRequest:true,kind:command.kind,target:command.target||'next pending',
   maxReferences:command.maxReferences,instructionChars:command.instruction.length}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))cli();
