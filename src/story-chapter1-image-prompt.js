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
export function buildChapter1ImagePrompt({shot,page,edit='',bible=null,assignment=null,
 manualManifest=null,qualityRules=null,sourceKind='missing'}){
 if(!shot?.key||!page?.stageId)throw Error('Canonical panel metadata is required');
 // A manifest is INPUT to the generator, not merely a repository note.
 // Reject mismatched stage/edition/gender/shot rather than silently ignoring it.
 if(!qualityRules||qualityRules.policyId!=='RPG_ART_P0_ABSOLUTE_NO_IMAGE_TEXT_AND_REAL_CAST'||
    qualityRules.imageRule?.textAllowed!==false||
    qualityRules.referenceRule?.actualBytesMustBeAttached!==true)
   throw Error('P0 image-generation quality manifest must be loaded before prompt handoff');
 if(manualManifest&&(manualManifest.stageId!==shot.stageId||
    manualManifest.edition!==shot.edition||manualManifest.gender!==shot.gender))
   throw Error('Mismatched manual production manifest');
 const manualShot=manualManifest?.shots?.find(s=>s.key===shot.key)||null;
 if(manualManifest&&!manualShot)throw Error('Shot missing from production manifest: '+shot.key);
 const actors=manualShot?.actors||assignment?.visibleActorIds||
  [...new Set([shot.characterId,shot.secondaryId,
   ...(page.edition==='post-gameover'?[]:['commander_'+page.gender])].filter(Boolean))];
 const normalizedActors=[...new Set(actors)];
 const supplemental=Object.entries(manualManifest?.characterMasters||{}).map(([id,r])=>({
  id,path:r.path,role:r.role,visualRule:r.role
 }));
 const refs=[...(bible?.actors||[]),...supplemental.filter(x=>!(bible?.actors||[]).some(r=>r.id===x.id))]
  .filter(x=>normalizedActors.includes(x.id));
 const missing=normalizedActors.filter(id=>!refs.some(r=>r.id===id));
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
  '【シーン・構図／マニフェスト必須入力】',
  manualShot?.scene||assignment?.sceneGoal||shot.sceneKind||page.stageName,
  manualShot?.compositionHint||assignment?.compositionHint||shot.scenery||'台本が示す行動と人物の表情を、一瞬の場面で表現する',
  '当該コマの台本を唯一の正本とする。マニフェストの場面指示と矛盾する場合は生成せず修正対象とする。',
  '',
  '【守るべき人物・見た目】',
  normalizedActors.length?'画面に登場する人物ID（このコマ専用・追加禁止）：'+normalizedActors.join('、'):'登場人物なしの風景・小道具カット',
  ...refs.map(r=>'・'+r.id+'（'+(r.role||'')+'）：'+(r.visualRule||'参照原画と一致させる')+
    '\n  参照画像：'+LIVE+r.path),
  ...missing.map(id=>'・'+id+'：この人物のマスター画像は未特定。別人へ置換しない。'),
  '',
  '【GitHubマニフェストを生成器へ必須投入／省略不可】',
  '共通P0：'+qualityRules.policyId+'。定義済み禁止事項と人物参照の全項目を今回の画像に適用する。',
  'P0禁止要素：'+qualityRules.imageRule.prohibited.join('、'),
  manualManifest?'使用する制作マニフェスト：assets/story/stage-manifests/c01-s01-post-town-male-p01-manual-production.json':'制作マニフェスト：共通P0・当該ステージのキャスト／台本ルールを適用',
  manualManifest?'画風ID：'+(manualManifest.visualStyleLock?.id||'未指定'):'画風ID：STAGE1_HI_FIDELITY_3D_JRPG_ANIME_REALISM_V1',
  manualManifest?'画風定義：'+(manualManifest.visualStyleLock?.look||manualManifest.renderRule):'画風は第1ステージの3D JRPG基準に固定',
  manualManifest?'画風禁止：'+(manualManifest.visualStyleLock?.forbidStyles||[]).join('、'):'2Dセル画・漫画ページ・コマ割りを禁止',
  '画像生成の単位は今指定された1コマのみ。5コマ分の設定は生成要求5回に分け、5コマ1枚のコラージュを描かない。',
  '【生成・品質の絶対条件】',
  '・【P0画風固定】第一章ステージ1原画と同じハイエンド3D JRPGシネマティックCG（アニメ造形×セミリアル）。立体的な顔・髪・瞳、自然な肌の陰影、金属鎧・布の実在感、奥行きのある照明、精密な背景を全コマで維持する。',
  '・【画風基準の原画】'+LIVE+'assets/story/panels/c01-s01-m01.webp',
  '・【画風補助参考】'+LIVE+'assets/story/chapters/c01/panels/c01-s01-m06-male.webp',
  '・2Dイラスト調、セル塗り、漫画ページ、絵コンテ、複数の枠を持つコマ割り、ギルド冒険譚への改変など、既存の3D RPG原画と異なる画風は絶対禁止。',
  '・画風参照と登場人物の実画像ファイルを生成時に実際に添付する。URLやファイルパスだけは添付扱いにしない。未添付なら品質合格も正式・仮登録も主張しない。',
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
  '必須の人物・画風参照は画像ファイル実体を生成器に添付する。現在のプロンプトはテキストであり、画像添付を保証しない。',
  '参照画像URLが自動で読めない場合は、実際に画像を見たと偽らず、参照画像をチャットに添付してもらってください。',
  '画像生成後は単独の完成画像を表示してください。ゲームへの登録やコミットが完了したとは主張しないでください。'
 ];
 return lines.join('\n');
}
