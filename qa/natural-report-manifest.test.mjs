import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {BATTLE_REPORT_VOICES,reportAudioKey} from '../src/battle-report-voice-lines.js';
const manifest=JSON.parse(readFileSync(new URL('../audio/voicevox/manifest.json',import.meta.url),'utf8'));
const total=Object.values(BATTLE_REPORT_VOICES).reduce((n,profile)=>n+profile.lines.length*profile.voices.length,0);
let found=0;
for(const [category,profile] of Object.entries(BATTLE_REPORT_VOICES))
 for(const line of profile.lines)
  for(const voice of profile.voices){
   const key=reportAudioKey(category,line,voice);
   const path=manifest.clips[key];
   assert.ok(path,'Missing prerecorded report voice: '+key);
   assert.match(path,/^audio\/voicevox\/clips\/[a-f0-9]{16}\.wav$/);
   const file=new URL('../'+path,import.meta.url);
   assert.ok(existsSync(file),'Missing WAV bytes: '+path);
   assert.ok(statSync(file).size>4000,'Too-short/empty recording: '+path);
   const header=readFileSync(file).subarray(0,4).toString('utf8');
   assert.equal(header,'RIFF','The natural recording must be a valid WAV: '+path);
   found++;
  }
assert.equal(found,total);
assert.equal(found,44,'All 11 battle report categories x 2 lines x 2 voices must exist');
console.log('PASS '+found+' natural military message recordings, no missing WAV');
