/**
 * 灰銀のレゾナンス - 無料の端末読み上げ＋ジョブ別戦闘台詞（端末保存）。
 * Geminiによる台詞追加は利用者の明示設定がある場合だけ。
 * AI音声合成API・有料音声サービスは使わない。
 */
export const VOICE_MAX_VARIANTS=10;
export const VOICE_EVENTS=Object.freeze(['start','run','attack','magic','heal','guard','hit','critical','dead','victory']);
const STORE='hai-gin-battle-voices-v1';
const PREFS='hai-gin-battle-voice-settings-v1';
const LEARNING='hai-gin-battle-voice-learning-v1';
const JOB_LINE={
 '剣士':{attack:['この一撃で決める！','切り込むぞ！'],critical:['まだ剣は折れていない！','ここで退くものか！']},
 '騎士':{attack:['我が槍に続け！','前線を押し上げる！'],guard:['ここは守り抜く！']},
 '盾騎士':{guard:['この盾は破れん！','我が後ろに続け！'],hit:['この程度では揺るがん！']},
 '盾戦士':{guard:['俺が受け止める！','盾を固めろ！'],hit:['耐えてみせる！']},
 '格闘家':{attack:['この拳で突破する！','まだまだ行ける！'],critical:['ここからが本番だ！']},
 '忍者':{attack:['影より討つ！','手裏剣を放つ！'],run:['屋根伝いに行く！'],critical:['姿を隠す！']},
 '盗賊':{attack:['隙だらけだぜ！','お宝はいただき！'],run:['先回りするぞ！']},
 '弓使い':{attack:['狙いは定まった！','射線を確保！'],critical:['距離を取る！']},
 '魔法使い':{magic:['我が魔力よ、燃え上がれ！','術式展開！'],attack:['魔力を解き放つ！']},
 '僧侶':{heal:['傷よ、癒えよ！','皆を救います！'],critical:['どうか加護を！']},
 '召喚士':{magic:['契約の獣よ、応えよ！','今こそ力を貸して！'],attack:['共に戦おう！']},
 '軍師':{start:['各隊、作戦どおりに！','戦線を維持せよ！'],victory:['戦略の勝利だ！','各隊、よく耐えた！']},
 '槍兵':{attack:['長槍で押し返せ！','間合いは我らのもの！']}
};
/** A single source for prerecorded voice generation and the browser fallback. */
export function bundledBattleVoiceLines(){return JOB_LINE;}
const COMMON={
 start:['いざ、出陣！','全隊、戦闘配置！'],
 run:['駆け抜けろ！','急げ！'],
 attack:['今だ！','押し切るぞ！'],
 magic:['術式発動！','魔力よ、応えよ！'],
 heal:['回復するぞ！','まだ助けられる！'],
 guard:['ここは通さない！','守りを固めろ！'],
 hit:['くっ、やるな！','まだ動ける！'],
 critical:['ここが踏ん張りどころだ！','援護を頼む！'],
 dead:['あとは……頼んだ……','無念だ……'],
 victory:['勝ったぞ！','我々の勝利だ！']
};
const safeStore=(storage,key,fallback)=>{try{return JSON.parse(storage?.getItem(key)||'null')||fallback}catch{return fallback}};
const saveStore=(storage,key,obj)=>{try{storage?.setItem(key,JSON.stringify(obj));return true}catch{return false}};
const clean=(text)=>String(text||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,90);
const clipKey=(job,event,text,gender)=>voiceKey(job,event)+'::'+text+'::'+gender;
export function voiceKey(job,event){return String(job||'兵士').slice(0,40)+'::'+String(event||'attack');}
export function voiceEvent(kind,actor={}){
 if(kind==='hit'&&Number(actor.hp)>0&&Number(actor.hp)<=Number(actor.maxHp||actor.job?.hp||Infinity)*.25)return 'critical';
 return ({step:null,jump:null,idle:null,walk:null,run:'run',attack:'attack',magic:'magic',heal:'heal',guard:'guard',hit:'hit',dead:'dead',start:'start',victory:'victory'})[kind]||null;
}
export function createBattleVoiceDirector({storage=globalThis.localStorage,fetcher=globalThis.fetch,synth=globalThis.speechSynthesis,now=()=>Date.now(),notify=()=>{}}={}){
 const prefs=safeStore(storage,PREFS,{enabled:true,learn:false,endpoint:'https://curly-shape-9799.yamada-yoshitaka0818.workers.dev/api/battle-voice'});
 // This existing free-tier Worker is the default for opt-in learning.
 // Keeping learning OFF by default avoids unrequested API calls.
 if(!prefs.endpoint)prefs.endpoint='https://curly-shape-9799.yamada-yoshitaka0818.workers.dev/api/battle-voice';
 const state=safeStore(storage,STORE,{});
 const learning=safeStore(storage,LEARNING,{day:'',count:0,last:0,blockedUntil:0});
 let unlocked=false,audioAllowed=true,busy=false,current=null,currentAudio=null,lastSpoken=0,lastKey='',lastError='',voiceList=[],recordedClips={},recordedCount=0;
 // Static speech audio is produced once in GitHub Actions using the free VOICEVOX engine.
 // Always fall back to on-device Japanese TTS while the pack loads or if a clip fails.
 if(typeof fetcher==='function'){
  Promise.resolve().then(()=>fetcher('./audio/voicevox/manifest.json?v=1',{cache:'force-cache'}))
  .then(r=>r.ok?r.json():null)
  .then(data=>{
   if(data&&typeof data.clips==='object'&&data.clips){
    recordedClips=Object.fromEntries(Object.entries(data.clips)
      .filter(([key,value])=>typeof key==='string'&&typeof value==='string'&&/^audio\/voicevox\/clips\/[a-f0-9]{16}\.mp3$/.test(value)));
    recordedCount=Object.keys(recordedClips).length;
   }
  }).catch(()=>{});
 }
 const lastByKey=new Map();
 const persist=()=>saveStore(storage,STORE,state);
 const updatePrefs=()=>saveStore(storage,PREFS,prefs);
 const seed=(job,event)=>{
  const key=voiceKey(job,event);
  if(!Array.isArray(state[key]))state[key]=[...(JOB_LINE[job]?.[event]||COMMON[event]||COMMON.attack)].map(clean).filter(Boolean).slice(0,VOICE_MAX_VARIANTS);
  return state[key];
 };
 const choose=(job,event,actor={},force=false)=>{
  const list=seed(job,event);
  if(!list.length)return '';
  // Give already-synthesized natural voices priority; still allow new AI lines to be heard.
  const gender=actor?.sex==='female'||actor?.gender==='female'||actor?.id%5===0?'female':'male';
  const ready=list.filter(line=>recordedClips[clipKey(job,event,line,gender)]);
  const source=ready.length&&(force||Math.random()<.75)?ready:list;
  return source[Math.floor(Math.random()*source.length)];
 };
 const japaneseVoices=()=>{
  try{voiceList=synth?.getVoices?.()||[]}catch{voiceList=[]}
  return voiceList.filter(v=>v.lang?.toLowerCase().startsWith('ja'));
 };
 const status=()=>({enabled:prefs.enabled,learn:prefs.learn,unlocked,supported:!!synth&&typeof globalThis.SpeechSynthesisUtterance==='function',japaneseVoices:japaneseVoices().length,recordedClips:recordedCount,highQualityAvailable:recordedCount>0,lastError,entries:Object.values(state).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0)});
 function speakNative(line,job,actor={}){
  if(!synth||typeof globalThis.SpeechSynthesisUtterance!=='function'){lastError='端末の日本語読み上げ機能が見つかりません';notify({kind:'error',text:lastError});return false}
  try{
   const utterance=new globalThis.SpeechSynthesisUtterance(line);
   utterance.lang='ja-JP';
   const female=actor?.sex==='female'||actor?.gender==='female'||actor?.id%5===0;
   const names=japaneseVoices();
   // Prefer installed high-quality Japanese voice engines when present.
   const order=names.slice().sort((a,b)=>{
    const rank=n=>/neural|natural|premium|enhanced|高品質/i.test(n.name)?3:/google|日本語/i.test(n.name)?2:1;
    return rank(b)-rank(a);
   });
   if(order.length)utterance.voice=order[female&&order.length>1?1:0];
   utterance.rate=job==='軍師'?.95:1.0;
   utterance.pitch=female?1.08:job==='盾戦士'||job==='盾騎士'?.94:1.0;
   utterance.volume=.90;
   utterance.onerror=e=>{lastError='音声読み上げ失敗: '+String(e.error||'unknown');notify({kind:'error',text:lastError})};
   synth.speak(utterance);current=utterance;return true;
  }catch(e){lastError=String(e.message||e);notify({kind:'error',text:lastError});return false}
 }
 function speak(job,event,actor={},force=false){
  if(!prefs.enabled||!audioAllowed||(!force&&!unlocked))return false;
  const stamp=now(),key=voiceKey(job,event);
  if(!force&&(stamp-lastSpoken<11000||stamp-(lastByKey.get(key)||0)<27000))return false;
  if(!force&&(synth?.speaking||(currentAudio&&!currentAudio.paused)))return false;
  const line=choose(job,event,actor,force);if(!line)return false;
  lastSpoken=stamp;lastKey=key;lastByKey.set(key,stamp);
  notify({kind:'line',job,event,text:line,actorId:actor?.id,actorTeam:actor?.team,squadId:actor?.squadId});
  if(force){try{synth?.cancel?.()}catch{}try{currentAudio?.pause?.()}catch{}}
  const gender=actor?.sex==='female'||actor?.gender==='female'||actor?.id%5===0?'female':'male';
  const path=recordedClips[clipKey(job,event,line,gender)];
  if(path&&typeof globalThis.Audio==='function'){
   try{
    const audio=new globalThis.Audio('./'+path);
    audio.volume=.88;audio.preload='auto';currentAudio=audio;
    let usedFallback=false;
    const fallback=()=>{
     if(usedFallback||!audioAllowed||!prefs.enabled)return;
     usedFallback=true;lastError='録音音声の再生に失敗したため端末音声へ切り替えました';
     speakNative(line,job,actor);
    };
    audio.onerror=fallback;
    Promise.resolve(audio.play()).catch(fallback);
    return true;
   }catch(e){lastError=String(e.message||e)}
  }
  return speakNative(line,job,actor);
 }
 const normalizeEndpoint=value=>{
  try{const u=new URL(String(value||'').trim());if(u.protocol!=='https:')return '';if(!/\/api\/battle-voice\/?$/.test(u.pathname))u.pathname='/api/battle-voice';u.search='';u.hash='';return u.toString()}catch{return ''}
 };
 async function maybeLearn(job,event){
  const lines=seed(job,event);
  if(!prefs.learn||lines.length>=VOICE_MAX_VARIANTS||busy)return;
  const endpoint=normalizeEndpoint(prefs.endpoint);
  if(!endpoint)return;
  const timestamp=now(),day=new Date(timestamp).toISOString().slice(0,10);
  if(learning.day!==day){learning.day=day;learning.count=0}
  if(learning.count>=20||timestamp<learning.blockedUntil||timestamp-learning.last<60000)return;
  learning.last=timestamp;learning.count++;
  saveStore(storage,LEARNING,learning);
  busy=true;
  try{
   const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job,event,known:lines}),signal:globalThis.AbortSignal?.timeout?.(12000)});
   if(response.status===429){learning.blockedUntil=timestamp+86400000;lastError='AI無料枠の上限に達したため、翌日まで学習停止';notify({kind:'error',text:lastError});return}
   if(!response.ok){learning.blockedUntil=timestamp+600000;lastError='AI中継のエラー ('+response.status+')';return}
   const payload=await response.json();
   const text=clean(payload?.reply);
   if(!text||text.length<2||lines.includes(text))return;
   if(lines.length<VOICE_MAX_VARIANTS){lines.push(text);persist();notify({kind:'learned',job,event,count:lines.length})}
  }catch(e){learning.blockedUntil=timestamp+600000;lastError='AI中継に接続できません';notify({kind:'error',text:lastError})}
  finally{busy=false;saveStore(storage,LEARNING,learning)}
 }
 function cue(kind,actor={}){
  const event=voiceEvent(kind,actor);if(!event)return;
  const job=actor?.job?.name||actor?.jobName||'兵士';
  if(actor?.team===1&&event!=='dead')return; // 自軍の発言を優先
  const spoke=speak(job,event,actor);
  // 発声したイベントのみ学習。大軍戦の大量イベントでAPIを連打しない。
  if(spoke)void maybeLearn(job,event);
 }
 return {
  cue,
  command(actor,command){
   if(/待機|歩行|忍び歩き/.test(command))return;
   const kind=/ダッシュ|走る/.test(command)?'run':/回復|祈り/.test(command)?'heal':/詠唱|召喚|魔法/.test(command)?'magic':/防御|盾/.test(command)?'guard':'attack';
   cue(kind,actor);
  },
  unlock(){unlocked=true;japaneseVoices()},
  setAudioAllowed(value){audioAllowed=!!value;if(!audioAllowed){try{synth?.cancel?.()}catch{}try{currentAudio?.pause?.()}catch{}}},
  enable(value){prefs.enabled=!!value;updatePrefs();if(!value){try{synth?.cancel?.()}catch{}try{currentAudio?.pause?.()}catch{}}},
  setLearn(value){prefs.learn=!!value;updatePrefs()},
  setEndpoint(value){prefs.endpoint=normalizeEndpoint(value);updatePrefs();return prefs.endpoint},
  preview(job='剣士',event='attack',gender='male'){unlocked=true;return speak(job,event,{id:1,gender,sex:gender,job:{name:job}},true)},
  sample(job,event){return choose(job,event)},
  count(job,event){return seed(job,event).length},
  get enabled(){return prefs.enabled},get learning(){return prefs.learn},get endpoint(){return prefs.endpoint},
  get status(){return status()}
 };
}
