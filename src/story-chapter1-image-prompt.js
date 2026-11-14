/**
 * Manga-to-ChatGPT handoff. A normal website cannot invoke a user's ChatGPT
 * image tool or read the resulting ChatGPT image directly. This builds the
 * exact editorial instructions for a user-initiated ChatGPT Images request.
 * Prompt text is client-side; no tokens, paid API or server requests are used.
 */
export const CHATGPT_IMAGES_URL='https://chatgpt.com/';
const RAW='https://raw.githubusercontent.com/yamadayoshitaka/hai-gin-rpg/';
const LIVE=RAW+'main/';
const CANDIDATES=RAW+'story/chapter1-free-actual-art/';
export function buildChapter1ImagePrompt({shot,page,edit='',bible=null,assignment=null,sourceKind='missing'}){
 if(!shot?.key||!page?.stageId)throw Error('Canonical panel metadata is required');
 const actors=(assignment?.visibleActorIds||
  [...new Set([shot.characterId,shot.secondaryId,
   ...(page.edition==='post-gameover'?[]:['commander_'+page.gender])].filter(Boolean))]);
 const refs=(bible?.actors||[]).filter(x=>actors.includes(x.id));
 const missing=actors.filter(id=>!refs.some(r=>r.id===id));
 const gender=page.gender==='female'?'女性':'男性';
 const outcome={'pre':'戦闘前','post-town':'町イベント後','post-victory':'勝利後',
  'post-defeat':'敗北後','post-gameover':'軍師戦死／ゲームオーバー'}[page.edition]||page.edition;
 const lines=[
  '【灰銀のレゾナンス／漫画原画の画像生成依頼】',
  '以下の台本に沿って、最終的な画像を実際に1枚生成してください。文章での解説だけで終えないでください。',
  '制作単位：漫画の独立した1コマ。複数コマの一覧、コラージュ、サムネイル集は禁止。',
  '第一章 '+page.stageName+' / '+outcome+' / '+gender+'主人公',
  '照合キー：'+shot.key+' （画像内に印字しない）',
  'ページ：'+page.number+' / 132、ページ内のコマID：'+shot.shotId+' （画像内に印字しない）',
  '',
  '【このコマの正式な台本】',
  shot.scriptText||shot.displayText||'（台詞のない情景カット）',
  '',
  '【シーン・構図】',
  assignment?.sceneGoal||shot.sceneKind||page.stageName,
  assignment?.compositionHint||shot.scenery||'台本が示す行動と人物の表情を、一瞬の場面で表現する',
  '',
  '【守るべき人物・見た目】',
  actors.length?'画面に登場する人物ID：'+actors.join('、'):'登場人物なしの風景・小道具カット',
  ...refs.map(r=>'・'+r.id+'（'+(r.role||'')+'）：'+(r.visualRule||'参照原画と一致させる')+
    '\n  参照画像：'+LIVE+r.path),
  ...missing.map(id=>'・'+id+'：この人物のマスター画像は未特定。別人へ置換しない。'),
  '',
  '【生成・品質の絶対条件】',
  '・16:9横長の高精細な単一シーン。可能なら1536×864以上のネイティブ画質を目標。単なる拡大処理で品質を偽装しない。',
  '・ゲームの原画として、美麗で立体感のあるシネマティックなファンタジー画風。顔・瞳・髪・服の縫い目・陰影を精密に。',
  '・女性主人公と男性主人公を混同しない。リュシア、イリス、ガランなどを別人・別衣装に変更しない。',
  '・勝利／敗北／ゲームオーバーを混同しない。登場人物を余分に増やさない。',
  '・絵の中に文字を一切描かない：吹き出し、字幕、漢字、ひらがな、英数字、番号、ロゴ、署名、UIは禁止。',
  '・地図、巻物、記録用紙に判読できる文字を描かない。書類は白紙とする。',
  '・台本のセリフはゲームUIで後から表示する。画像に台詞・説明文を焼き込まない。',
  '・構図・人物ID・衣装が合わない場合、誤った完成品として扱わない。',
  '',
  '【今回入力した追加プロンプト・修正指示】',
  edit.trim()||'台本に完全準拠した新しい原画を作成する。特別な修正指示なし。',
  '',
  '【参考にする現在の原画】',
  sourceKind==='candidate'?'生成済み候補：'+CANDIDATES+shot.draftPath:
   shot.legacyPath?'既存ゲーム画像：'+LIVE+shot.legacyPath.replace(/^\.\//,''):
   '未生成につき既存のこのコマの原画はありません。',
  '',
  '参照画像URLが自動で読めない場合は、実際に画像を見たと偽らず、参照画像をチャットに添付してもらってください。',
  '画像生成後は単独の完成画像を表示してください。ゲームへの登録やコミットが完了したとは主張しないでください。'
 ];
 return lines.join('\n');
}
