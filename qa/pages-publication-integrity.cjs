// A GitHub API blob upload once truncated the base64 payload for the large
// motion studio HTML. The result was binary data served as a public webpage,
// even though the workflow itself reported deployment success.
// Reject that kind of corruption before uploading a Pages artifact.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const repo=path.resolve(__dirname,'..');
const files=[
  'index.html',
  'motion-external-test.html',
  'outfit-maintenance.html',
  'src/character-system/rigged-outfit-runtime.js',
  'src/character-system/hair-attachment-runtime.js',
  'src/character-system/hair-headwear-occlusion.js'
];
for(const relative of files){
  const bytes=fs.readFileSync(path.join(repo,relative));
  assert.ok(bytes.length>1500,`${relative}: unexpectedly short publication file`);
  const content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  assert.ok(!content.includes('\0'),`${relative}: binary NUL byte in published source`);
  if(relative.endsWith('.html')){
    assert.match(content.replace(/^\uFEFF/,'').trimStart(),/^<!doctype html>/i,
      `${relative}: no HTML doctype, probable binary/corrupted blob`);
    assert.match(content,/<\/html>/i,`${relative}: HTML ending is missing`);
  }else{
    assert.ok(/\b(import|export)\b/.test(content),
      `${relative}: missing JavaScript module structure`);
  }
}
console.log(`PASS Pages publication integrity: ${files.length} source files are complete UTF-8`);
