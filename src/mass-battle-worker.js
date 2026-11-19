import {createMassBattleWorkerHandler} from './mass-battle-worker-runtime.js?v=20261120-shield-cover3';

const handle=createMassBattleWorkerHandler((message,transfers=[])=>self.postMessage(message,transfers));
let work=Promise.resolve();
self.onmessage=event=>{work=work.then(()=>handle(event.data));};
