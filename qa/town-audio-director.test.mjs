import assert from 'node:assert/strict';
import {createTownAudioDirector} from '../src/town-audio-director.js';

const played=[];
class FakeAudio {
 constructor(src){this.src=src;this.paused=true;this.volume=1;this.loop=false;this.preload='';}
 play(){this.paused=false;played.push(this.src);return Promise.resolve();}
 pause(){this.paused=true;}
 addEventListener(){}
}
const previous=globalThis.Audio;
globalThis.Audio=FakeAudio;
try{
 const memory=new Map();
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const director=createTownAudioDirector({storage});
 assert.equal(director.enabled,true,'music must be on by default');
 assert.equal(director.scene,'town');
 director.setScene('castle');
 assert.equal(director.scene,'castle');
 director.setScene('church');
 assert.equal(director.scene,'church');
 director.setScene('shop');
 assert.equal(director.scene,'shop');
 director.setNarrationActive(true);
 director.effect('save'); // no AudioContext on some browsers: no throw and no electronic speech
 director.setEnabled(false);
 assert.equal(director.enabled,false);
 assert.equal(memory.get('hai-gin-town-bgm-enabled-v1'),'false');
 director.setEnabled(true);
 director.unlock();
 assert.ok(played.some(p=>p.endsWith('/assets/audio/town.mp3')));
 assert.ok(played.some(p=>p.endsWith('/assets/audio/battle/forest.ogg')));
 director.dispose();
 console.log('town BGM scene routing, default-on, mute and effect fallback: PASS');
} finally {
 globalThis.Audio=previous;
}
