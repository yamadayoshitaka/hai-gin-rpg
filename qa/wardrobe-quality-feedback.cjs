#!/usr/bin/env node
// Fast, deterministic QA feedback. An unchanged screenshot across multiple
// successful builds is a reason to inspect asset wiring, not to retry the same
// blind geometry edits. This never changes models or accepts its own output.
const fs=require('node:fs');
const path=require('node:path');

function readJson(file){return file&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null}
function failureKind(message){
 if(/hair|scalp|helmet|hood|fiber/i.test(message))return 'hair_headwear';
 if(/XYZ|joint|bounds|body|anatom/i.test(message))return 'rig_fit';
 if(/weapon|grip|finger|thumb|shield|blade|palm/i.test(message))return 'weapon_socket';
 if(/front\/back|orientation/i.test(message))return 'orientation';
 return 'runtime_or_asset';
}
const DIRECTIONS={
 hair_headwear:'頭蓋・髪・兜の実寸と表示マスクを検証。毛量だけの増減を止め、GLB原点と頭骨の接続を確認する。',
 rig_fit:'身体と衣装のワールド座標、骨ウェイト、左右・前後方向を照合。倍率の手動調整を繰り返さない。',
 weapon_socket:'掌と武器グリップの姿勢・接触を数値検証。武器単体の拡大縮小で誤魔化さない。',
 orientation:'前後ビューとモデル正面軸を検証。カメラやモデルの回転補正の重複を除く。',
 runtime_or_asset:'ブラウザ例外・モデル取得・実際に使われた素材パスを確認。古いキャッシュ／別モデル参照を調査する。',
 unchanged:'見た目が変わらない修正の連続を検出。対象GLBと描画中メッシュの対応、ロード順、最適化後の素材差し替えを確認し、数値微調整から原因調査へ切り替える。',
 visual_review:'数値と画像の合格は「リアルな見た目」の合格ではない。職業コンセプト、布・金属の質感、顔・髪・鎧の造形は人の目で採否判定する。',
};

function visualDelta(now,old){
 const current=new Map((now.records||[]).map(row=>[row.job+'-'+row.sex,row]));
 const previous=new Map((old?.records||[]).map(row=>[row.job+'-'+row.sex,row]));
 let delta=0,total=0,compared=0;
 for(const [key,a] of current){
  const b=previous.get(key);
  if(!Array.isArray(a.visualSample)||!Array.isArray(b?.visualSample)||a.visualSample.length!==b.visualSample.length)continue;
  for(let i=0;i<a.visualSample.length;i++){delta+=Math.abs(a.visualSample[i]-b.visualSample[i]);total+=31}
  compared++;
 }
 return compared?{compared,averageFraction:+(delta/total).toFixed(5)}:null;
}
function decide(current,previous,olderFeedback){
 const newKinds=[...new Set((current.failures||[]).map(f=>failureKind(f.error||'')))];
 const change=visualDelta(current,previous);
 const noChange=change!==null&&change.compared>=2&&change.averageFraction<.004;
 const sameFailure=newKinds.length>0&&newKinds.join(',')===(olderFeedback?.failureKinds||[]).join(',');
 const stalledIterations=(noChange||sameFailure)?(olderFeedback?.stalledIterations||0)+1:0;
 const pivot=stalledIterations>=2;
 const focus=newKinds[0]||(pivot?'unchanged':'visual_review');
 const action=pivot?'change_direction':newKinds.length?'fix_regression':change?'review_visual_result':'establish_baseline';
 return {
  mode:current.mode||'full',tested:current.tested,expected:current.expected,
  failures:(current.failures||[]).length,failureKinds:newKinds,
  visualDelta:change,stalledIterations,action,focus,
  recommendation:DIRECTIONS[focus],
  objectiveStatus:newKinds.length?'failed':'passed',
  visualQualityStatus:'human_review_required',
  note:'画像の変化量は改善度ではない。外観の良し悪しを機械が自動承認しない。失敗時も無制限に修正をループしない。',
 };
}

if(require.main===module){
 const args=process.argv.slice(2);
 const get=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
 const currentFile=get('--current'),outFile=get('--out');
 if(!currentFile||!outFile){console.error('Usage: node qa/wardrobe-quality-feedback.cjs --current report.json --out feedback.json [--previous report.json] [--previous-feedback feedback.json]');process.exit(2)}
 const result=decide(readJson(currentFile),readJson(get('--previous')),readJson(get('--previous-feedback')));
 fs.mkdirSync(path.dirname(outFile),{recursive:true});fs.writeFileSync(outFile,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
 if(process.env.GITHUB_STEP_SUMMARY){
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
   `## Wardrobe quality feedback\n\n- Objective QA: **${result.objectiveStatus}** (${result.tested}/${result.expected})\n- Visible change vs previous run: **${result.visualDelta?.averageFraction??'baseline needed'}**\n- Repeated no-progress/failure runs: **${result.stalledIterations}**\n- Decision: **${result.action}**\n- Next focus: **${result.recommendation}**\n\nVisual realism still requires review.\n`);
 }
}
module.exports={decide,visualDelta,failureKind};
