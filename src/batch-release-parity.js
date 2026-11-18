/* Compare current GitHub main with the exact GitHub Pages HTML/release build. */
(function(root){
 'use strict';
 const validSha=value=>typeof value==='string'&&/^[0-9a-f]{40}$/i.test(value);
 function evaluate({mainSha,releaseSha,pageSha}={}){
  const main=validSha(mainSha)?mainSha.toLowerCase():null;
  const release=validSha(releaseSha)?releaseSha.toLowerCase():null;
  const page=validSha(pageSha)?pageSha.toLowerCase():null;
  const compareUrl=main&&release&&main!==release
   ?'https://github.com/yamadayoshitaka/hai-gin-rpg/compare/'+release+'...'+main:null;
  if(!page||!release)return Object.freeze({
   status:'unverified_release',main,release,page,compareUrl,
   message:'公開HTMLまたはrelease.jsonのSHAを取得できません。公開版は未検証です。'
  });
  if(page!==release)return Object.freeze({
   status:'mixed_release',main,release,page,compareUrl,
   message:'公開HTMLとrelease.jsonのSHAが不一致です。配信キャッシュまたは公開物を確認してください。'
  });
  if(!main)return Object.freeze({
   status:'unverified_main',main,release,page,compareUrl,
   message:'公開版内のSHAは一致していますが、最新mainを取得できず新旧を判定できません。'
  });
  return Object.freeze(main===release?{
   status:'synced',main,release,page,compareUrl:null,
   message:'最新mainと公開PagesのSHAが一致しています。'
  }:{
   status:'different',main,release,page,compareUrl,
   message:'最新mainと公開PagesのSHAが異なります。差分の公開状況・コミット順を確認してください。'
  });
 }
 root.HaiGinReleaseParity=Object.freeze({evaluate});
})(typeof window!=='undefined'?window:globalThis);
