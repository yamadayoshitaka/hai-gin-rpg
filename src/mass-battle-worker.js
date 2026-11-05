import {createMassBattleWorkerHandler} from './mass-battle-worker-runtime.js';

const handle=createMassBattleWorkerHandler((message,transfers=[])=>self.postMessage(message,transfers));
let work=Promise.resolve();
self.onmessage=event=>{work=work.then(()=>handle(event.data));};
