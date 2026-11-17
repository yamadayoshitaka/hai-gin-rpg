#!/usr/bin/env node
/** Owner-only one-shot manual quality requests opened from GitHub Pages.
 * The custom text is recorded on the issue and passed to the Cloudflare world
 * reference renderer only. Other categories dispatch existing deterministic QA
 * and their ChatGPT tasks may read the request on the next hourly run.
 */
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
export const MARKER='<!-- hai-gin-hourly-batch-v1 -->';
const allowed={
 human:'human-v65-quality.yml',
 monster:'monster-anatomy-qa.yml',
 faceHair:'character-six-lane.yml',
 outfit:'character-six-lane.yml',
 creatureMonster:'creature-six-lane.yml',
 creatureSummon:'creature-six-lane.yml',
 world:'world-quality-photoreal.yml',
 anime:'story-cinematic-qa.yml'
};
export function parseRequest(issue,owner){
 if(!issue||issue.user?.login!==owner||!String(issue.title).startsWith('[hai-gin-batch]'))
  throw Error('Not an owner-approved quality instruction');
 const body=String(issue.body||'');
 if(!body.startsWith(MARKER))throw Error('Missing signed-format marker');
 const m=body.match(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/);
 if(!m)throw Error('Missing JSON request');
 const data=JSON.parse(m[1]);
 if(!Object.hasOwn(allowed,data.category))throw Error('Unknown batch category');
 if(['human','world','monster'].includes(data.category))throw Error('Retired batch: use the split FF15 quality lanes');
 const target=String(data.target||'').trim(),instruction=String(data.instruction||'').trim();
 const count=Number(data.max||1);
 if(instruction.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(instruction))
  throw Error('Instruction too long or has forbidden characters');
 if(!Number.isInteger(count)||count<1||count>3)throw Error('Invalid free batch size');
 if(target.length>80||!/^([a-zA-Z0-9:_-]*)$/.test(target))throw Error('Invalid target key');
 if(data.category==='world'&&target&&!/^(object:[a-z][\w-]*|stage:c\d{2}-s\d{2})$/.test(target))
  throw Error('Invalid world object/stage key');
 return {category:data.category,target,instruction,max:count,workflow:allowed[data.category]};
}
function execute(command){
 const args=['workflow','run',command.workflow,'--ref','main'];
 if(['faceHair','outfit','creatureMonster','creatureSummon'].includes(command.category)){
  args.push('-f','slot=auto','-f','category='+command.category);
 }
 if(command.category==='world'){
  const type=command.target.startsWith('object:')?'object':command.target.startsWith('stage:')?'stage':'all';
  args.push('-f','target_type='+type,'-f','target_key='+command.target,
    '-f','next_instruction='+command.instruction,'-f','max_references='+command.max);
 }
 const child=spawnSync('gh',args,{stdio:'inherit',encoding:'utf8',timeout:30000,
  env:{...process.env,GH_REPO:process.env.GITHUB_REPOSITORY}});
 if(child.status!==0)throw Error('Workflow dispatch failed: '+command.workflow);
 return args;
}
if(process.argv[1]?.endsWith('manual-hourly-batch-dispatch.mjs')){
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 const cmd=parseRequest(event.issue,process.env.GITHUB_REPOSITORY_OWNER);
 const args=execute(cmd);
 const summary=[
  '# Manual batch request accepted',
  'Category: '+cmd.category,
  'Target: '+(cmd.target||'next pending'),
  'Workflow: '+cmd.workflow,
  'Instruction stored in GitHub Issue: #'+event.issue.number,
  'Instruction forwarded to Cloudflare reference prompt: '+(cmd.category==='world'?'yes':'no'),
  'Human/monster ChatGPT recurring tasks are not controlled by this workflow.',
  'Result: workflow dispatched, NOT proof that QA or generation completed.',
  'No secrets, no automatic merge.'
 ].join('\n')+'\n';
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 console.log(JSON.stringify({category:cmd.category,workflow:cmd.workflow,
  issue:event.issue.number,target:cmd.target,hasCustomInstruction:!!cmd.instruction}));
}
