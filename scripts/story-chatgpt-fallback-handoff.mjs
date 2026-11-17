#!/usr/bin/env node
/** Build a ChatGPT Images request for the first real missing compact scene.
 * GitHub Actions cannot invoke ChatGPT subscription Images. No API call,
 * image-generation claim, paid fallback, or P0 approval happens here.
 */
import fs from 'node:fs';
import path from 'node:path';
import {STORY_STAGE_BEATS} from '../src/story-stage-beats-v2.js';
import {makeChatGPTHandoff,canOfferChatGPTHandoff} from '../src/story-generation-fallback.js';

const arg=(key,defaultValue)=>{const i=process.argv.indexOf(key);return i<0?defaultValue:process.argv[i+1];};
const reason=arg('--reason','FREE_DAILY_DISPATCH_ALREADY_USED');
const input=arg('--report','qa-reports/story-sequential-missing/next.json');
const output=arg('--output','qa-reports/story-sequential-missing/chatgpt-handoff.json');
if(!canOfferChatGPTHandoff(reason)||
   !/^qa-reports\/[a-z0-9/._-]+\.json$/.test(input)||
   !/^qa-reports\/[a-z0-9/._-]+\.json$/.test(output)||
   input.includes('..')||output.includes('..'))
 throw Error('Invalid ChatGPT handoff reason or file path');
const budget=JSON.parse(fs.readFileSync('data/story-generation-spend-policy.json','utf8'));
const switches=JSON.parse(fs.readFileSync('data/batch-center-switches.json','utf8'));
if(budget.allowedAdditionalPaidApiSpendJpy!==0||
   budget.chatGPTImageGeneration?.automaticPaidApiFallback!==false||
   budget.chatGPTImageGeneration?.requiresUserInteraction!==true||
   switches.groups?.anime?.enabled!==true)
 throw Error('ChatGPT subscription fallback forbidden by configuration');
const explicit=arg('--shot-key',null);
let row;
if(explicit){
 const parts=/^(c\d{2}-s\d{2})\|(pre|post-town|post-victory|post-defeat|post-gameover)\|(male|female)\|(c\d{2}-s\d{2}-m\d+)$/.exec(explicit);
 if(!parts)throw Error('Invalid provider-stopped shot identity');
 row={stageId:parts[1],edition:parts[2],gender:parts[3],sceneId:parts[4],
  chapter:Number(parts[1].slice(1,3)),key:[parts[1],parts[2],parts[4],parts[3]].join('|'),
  status:'MISSING_ART'};
}else{
 const q=JSON.parse(fs.readFileSync(input,'utf8'));
 if(q.enabled!==true||q.genderVariants!==1760||q.identities!==880||
    !Array.isArray(q.selected)||q.selected.length>20)
  throw Error('Noncanonical or disabled story missing-image queue');
 row=q.selected.find(x=>['MISSING_ART','BROKEN_REGISTRATION'].includes(x.status));
}
if(!row){
 console.log(JSON.stringify({status:'NO_PENDING_CG',generated:0,registered:0}));
 process.exit(0);
}
const m=/^c(0[1-9]|1[0-9]|20)-s(0[1-9]|10)$/.exec(row.stageId);
if(!m||row.chapter!==Number(m[1])||
 !/^(?:pre|post-(?:town|victory|defeat|gameover))(?:-(?:choice|route|ending)-[a-z0-9-]+)*$/.test(row.edition)||
 !['male','female'].includes(row.gender)||
 !/^c\d{2}-s\d{2}-m\d+$/.test(row.sceneId)||
 !row.sceneId.startsWith(row.stageId+'-')||
 row.key!==[row.stageId,row.edition,row.sceneId,row.gender].join('|'))
 throw Error('Noncanonical exact scene, protagonist or outcome');
const chapter=Number(m[1]),stage=Number(m[2]);
const [before,after]=STORY_STAGE_BEATS?.[chapter-1]?.[stage-1]||[];
if(typeof before!=='string'||!before||typeof after!=='string'||!after)
 throw Error('No real stage screenplay for ChatGPT prompt');
const shot={stageId:row.stageId,edition:row.edition,gender:row.gender,shotId:row.sceneId};
const handoff=makeChatGPTHandoff({reason,shot,attemptedRequests:0});
const isBefore=row.edition.startsWith('pre');
const target=isBefore?'戦闘前':row.edition.startsWith('post-town')?'町イベント後':
 row.edition.startsWith('post-defeat')?'敗北後':row.edition.startsWith('post-gameover')?'主人公死亡後':'勝利後';
const sourceRule=chapter===1&&stage<=4
 ?'第1章ステージ1〜4のみ既存の正確に一致する同一人物・同一場面の原画を流用可能。'
 :'第1章ステージ5以降は旧原画を流用せず、この場面専用の完全新規原画を作成する。';
const prompt=[
 'RPG「灰銀のレゾナンス」の正本漫画イベント用に、独立した新しいCG原画を1枚作成。',
 '章 '+chapter+'、ステージ '+stage+'、場面 '+row.sceneId+'、'+target+'、主人公 '+(row.gender==='male'?'男性':'女性')+'版。',
 'この場面の物語：'+(isBefore?before:after),
 '物語の前提：'+before,
 '勝利後の事実：'+after+'。戦闘前の絵に勝利結果を描かない。',
 '16:9横長、推奨1536×864px、最低800×450px。一画像一コマで、分割コマ・文字・吹き出し・UI・ロゴ・透かし禁止。',
 'FF15級を目標とする独自の写実的ファンタジーRPG画風。骨格、顔、衣装、素材、照明、表情、構図を丁寧に。',
 '男性版と女性版を混ぜない。人物の容姿・衣装は必ずゲームの正規キャラ原画を参照（ChatGPTに画像を添付してから生成）。参照画像がない人物を勝手に捏造しない。',
 sourceRule,
 '作成後は実画像のWebPバイト、SHA256、シーンID、登場人物と男女版を独立検証する。P0正式画質承認は自動で付与しない。'
].join('\n');
const issueTitle='漫画 ChatGPT Images制作依頼 '+handoff.shotKey;
const json={...handoff,kind:'HAI_GIN_CHATGPT_IMAGES_REQUEST_NOT_IMAGE',
 issueTitle,canonicalQueueKey:row.key,prompt,stageBeat:{before,after},
 actualChatGPTImagesGenerated:0,gameArtworkRegistered:0,formallyApproved:false,
 additionalPaidApiCalls:0,requiresUserAction:true};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(json,null,2)+'\n');
const md=[
 '## ChatGPT Imagesによる漫画生成依頼（未生成）','',
 '**無料枠が使用不可のためChatGPT Imagesに切替。** GitHub ActionsからPlus契約のImagesを自動で実行することはできません。',
 '実行するにはChatGPTの会話でこのコマの画像生成を依頼し、正規キャラクターの参照画像を添付してください。','',
 '|項目|値|','|---|---|',
 '|場面|'+row.key+'|','|切替理由|'+reason+'|',
 '|生成枚数|**0枚（依頼時点）**|','|仮登録 / P0正式承認|0枚 / 0枚|','',
 '### ChatGPT用プロンプト','',
 '~~~text',prompt,'~~~','',
 ...(handoff.chatGPTReviewUrl?['第1章の確認画面: '+handoff.chatGPTReviewUrl,'']:[]),
 '生成した実画像を個別に監査してから可逆仮登録。単なる画像生成依頼を完成品扱いしない。',
 'OpenAI API、有料Cloudflare API、外部有料生成APIへの切替はしません。',
].join('\n')+'\n';
fs.writeFileSync(output.replace(/\.json$/,'.md'),md);
console.log(JSON.stringify({status:'CHATGPT_IMAGES_HANDOFF_CREATED',shotKey:handoff.shotKey,
 reason,issueTitle,requiresUserAction:true,generated:0,registered:0,
 json:output,markdown:output.replace(/\.json$/,'.md')}));
