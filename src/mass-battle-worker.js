import {createMassBattleWorkerHandler} from './mass-battle-worker-runtime.js?v=4.4.52';

const handle=createMassBattleWorkerHandler((message,transfers=[])=>self.postMessage(message,transfers));
let work=Promise.resolve();
self.onmessage=event=>{work=work.then(()=>handle(event.data));};
