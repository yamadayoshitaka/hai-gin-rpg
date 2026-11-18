/* Contract for a batch record delivered inside a verified GitHub Pages build.
 * Deployment success is NOT inferred from green QA or workflow_dispatch.
 * A journal read from the same Pages build as its release.json + HTML stamp
 * proves this journal is public. No claim is made about model visual quality.
 */
(function(root){
 'use strict';
 const validSha=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
 function evaluate({pageSha,releaseSha,last,verifiedSource}={}){
  const published=validSha(pageSha)&&validSha(releaseSha)&&pageSha===releaseSha;
  const mainCommitted=last?.status==='source_committed_main'&&
   Number(last.sourceCommits)>0&&validSha(last.mainAfterSha);
  const previousCommit=Number(verifiedSource?.sourceCommits)>0&&
   validSha(verifiedSource?.mainAfterSha);
  const staticPassed=last?.qaStatus==='passed'||last?.gameQuality?.staticPassed===true;
  const staticFailed=last?.qaStatus==='failed'||last?.gameQuality?.staticStatus==='static_fail';
  const hasCandidate=last?.pr>0||last?.attempts?.some(x=>x.status==='merged_to_main');
  const steps={
   launch:'done',
   code:mainCommitted?'done':last?.status==='blocked_candidates'?'pending':'skipped',
   qa:staticPassed?'done':staticFailed?'failed':'skipped',
   commit:mainCommitted?'done':'skipped',
   pr:mainCommitted&&hasCandidate?'skipped':'skipped',
   merge:mainCommitted?'skipped':'skipped',
   deploy:published?'done':'pending'
  };
  return Object.freeze({
   steps,published,mainCommitted,previousCommit,
   releaseSha:published?releaseSha:null,
   message:published?
    ('Pages公開を確認：'+releaseSha.slice(0,12)+
     (mainCommitted?'／今回の実ソース変更が本編に反映':
      previousCommit?'／過去の実ソースコミットの記録も配信中':
      '／今回は実ソース変更なし')):
    'Pages公開SHA未照合：workflow_dispatchだけでは公開完了にしません',
   improvementVerified:false
  });
 }
 root.HaiGinPagesAudit=Object.freeze({evaluate});
})(typeof window!=='undefined'?window:globalThis);
