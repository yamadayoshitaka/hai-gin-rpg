/**
 * Manual ChatGPT Plus manga page queue. Never invokes ChatGPT in a batch or
 * bypasses subscription image limits; all actual image requests are user-led.
 */
export const PAGE_SHOT_LIMIT=5;
export const DEFAULT_STAGE='c01-s05';
export const DEFAULT_GENDER='male';
export const DEFAULT_EDITION='pre';

export function validateFiveShotPage(page){
 if(!page||!Array.isArray(page.shots)||page.shots.length<1||
   page.shots.length>PAGE_SHOT_LIMIT)
  throw Error('One page requires one to five canonical shots');
 const unique=new Set();
 for(const shot of page.shots){
  if(!shot||shot.stageId!==page.stageId||
    shot.edition!==page.edition||shot.gender!==page.gender||
    shot.key!==[page.stageId,page.edition,page.gender,shot.shotId].join('|')||
    unique.has(shot.key))throw Error('Mixed or repeated canonical shot');
  unique.add(shot.key);
 }
 return page;
}
export function chooseFirstPage(pages,{
 stageId=DEFAULT_STAGE,gender=DEFAULT_GENDER,edition=DEFAULT_EDITION
}={}){
 const candidate=pages.find(p=>p.stageId===stageId&&p.gender===gender&&p.edition===edition);
 return validateFiveShotPage(candidate||pages[0]);
}
export function reviewUrl(shot){
 if(!shot?.key||!shot?.stageId||!shot?.shotId)throw Error('Missing shot');
 return './story-chapter1-approval.html?'+new URLSearchParams({
  stage:shot.stageId,edition:shot.edition,gender:shot.gender,
  shot:shot.shotId,provider:'chatgpt'
 }).toString();
}
export function buildFiveShotPacket(page, prompts){
 validateFiveShotPage(page);
 if(!Array.isArray(prompts)||prompts.length!==page.shots.length||
   prompts.some((p,i)=>p?.shotKey!==page.shots[i].key||
     typeof p.prompt!=='string'||!p.prompt.includes(p.shotKey)))
  throw Error('Five-shot packet cannot mismatch canonical panel');
 return [
  '灰銀のレゾナンス｜通常ChatGPT Plus・第一章5コマ制作',
  'この作業はユーザー操作のChatGPT Imagesのみ。Work、OpenAI API、外部有料API、Web版自動RPAを使わない。',
  '重要：以下は一つのページのコマ別指示。各コマ必ず独立した画像1枚。5コマ合成画像・一覧・絵コンテを生成しない。',
  '実際の画像生成は1コマずつ。画像生成が利用枠等で止まったら未完了として終了し、完成と記載しない。',
  '同じ登場人物・舞台・陰影を維持し、男女と勝敗分岐を混在させない。画像内の文字、番号、吹き出し、UIは禁止。',
  '各コマを描くとき、そのコマの人物マスターと男女対応の画風基準の実画像を添付して参照する。URLの記載だけでは添付したことにならない。',
  '制作対象：'+page.stageName+' / '+page.stageId+' / '+page.gender+' / '+page.edition,
  '制作順序：'+page.shots.map((s,i)=>(i+1)+'番 '+s.shotId).join(' → '),
  '',
  ...prompts.flatMap(({shotKey,prompt},i)=>[
   '━━━━ コマ '+(i+1)+' / '+prompts.length+' ━━━━',
   '登録キー（絵には表示しない）：'+shotKey,
   prompt,''
  ]),
  '完成画像を各コマID別に保存して検査するまで、GitHub登録・コミット・公開完了とは扱わない。'
 ].join('\n');
}
