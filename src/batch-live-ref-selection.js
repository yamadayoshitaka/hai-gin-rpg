/* Live branch selection for the batch center; the historical PR catalog is never a current-head authority. */
(function(root){
 'use strict';
 const patterns=Object.freeze({
  world:/^(?:world\/|feat\/world|feature\/world|fix\/world|chore\/world)|(?:\bworld\b|オブジェクト|木組み|石組み|furniture|town.prop|joinery)/i,
  faceHair:/(?:face.?hair|scalp|headwear|face.hair|hair|wig|facial|顔.?髪|頭皮|メイク)/i,
  outfit:/(?:outfit|wardrobe|garment|armor|costume|cloak|cape|pauldron|衣装|マント|鎧)/i,
  creatureMonster:/(?:creature|monster|summon|avian|canid|feline|beast|wolf|phoenix|モンスター|召喚)/i,
  creatureSummon:/(?:creature|monster|summon|avian|canid|feline|beast|wolf|phoenix|モンスター|召喚)/i,
  gameQuality:/(?:game.quality|battle.fps|frame.pac|frame.budget|performance|battle.render|battle.lod|runtime.error|戦闘描画|画質.?FPS|ゲーム品質)/i,
  anime:/(?:anime|manga|story|comic|chapter|漫画|物語)/i
 });
 const aliases=Object.freeze({human:'faceHair',monster:'creatureMonster'});
 function groupOf(category){return aliases[category]||category;}
 function selectable(pr,category){
  if(!pr||pr.state!=='open'||pr.base?.ref!=='main'||!pr.head?.sha||!pr.head?.ref)return false;
  const key=groupOf(category),pattern=patterns[key];
  if(!pattern)return false;
  return pattern.test(pr.head.ref)||pattern.test(pr.title||'');
 }
 function recent(prs,category,max=12){
  if(!Array.isArray(prs))return [];
  return prs.filter(p=>selectable(p,category))
   .sort((a,b)=>Date.parse(b.updated_at||0)-Date.parse(a.updated_at||0)||
    Number(b.number)-Number(a.number))
   .slice(0,max).map(p=>({
    pr:p.number,title:p.title,branch:p.head.ref,sha:p.head.sha,
    updatedAt:p.updated_at,draft:p.draft===true
   }));
 }
 function previewPage(category){
  const key=groupOf(category);
  return {world:'object-list.html',faceHair:'face-mesh-studio.html',
   outfit:'outfit-maintenance.html',gameQuality:'tactics-wireframe.html',creatureMonster:'monster-manager.html',
   creatureSummon:'monster-manager.html',anime:'story-chapter1-approval.html'}[key]||'tactics-wireframe.html';
 }
 function mainRow(category,sha){
  return {pr:0,title:'main 最新の正本',branch:'main',
   sha:/^[0-9a-f]{40}$/.test(String(sha))?sha:null,
   page:previewPage(category),ids:[],params:groupOf(category)==='anime'?'stage=c01-s04':'',
   object:category==='world'?'castle_001':'',canonical:true};
 }
 function liveRows(prs,category,sha){
  const page=previewPage(category);
  return [mainRow(category,sha),...recent(prs,category).map(p=>({...p,page,ids:[],
   params:groupOf(category)==='anime'?'stage=c01-s04':'',
   object:category==='world'?'castle_001':''}))];
 }
 root.HaiGinBatchRefs=Object.freeze({selectable,recent,previewPage,mainRow,liveRows,groupOf});
})(typeof window!=='undefined'?window:globalThis);
