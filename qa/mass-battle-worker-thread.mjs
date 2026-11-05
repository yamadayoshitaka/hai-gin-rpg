import {parentPort} from 'node:worker_threads';
import {createMassBattleWorkerHandler} from '../src/mass-battle-worker-runtime.js';

const handle=createMassBattleWorkerHandler((message,transfers=[])=>parentPort.postMessage(message,transfers));
let work=Promise.resolve();
parentPort.on('message',message=>{work=work.then(()=>handle(message));});
