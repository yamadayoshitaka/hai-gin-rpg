/**
 * Art references actually registered for Chapter 1 (2026-11-11).
 *
 * Character definitions for the wider campaign do NOT certify that Chapters
 * 2–20 have finished scene illustrations. Preserve identity and art status.
 * The female commander's master is provisional, not an approved 3D sculpt.
 */
const freeze=entry=>Object.freeze(entry);
export const CHAPTER_ONE_ART_REFERENCES=Object.freeze([
 freeze({
  key:'commander-female',label:'女性主人公（第1章・暫定人物マスター）',
  characterId:'hero-girl-01',
  image:'assets/story/characters/commander/female-master.webp',
  source:'character-master',status:'provisional',
  notes:'金髪の長いレイヤー、青い目、銀色の鎧と濃青の布。顔・髪・装備を参考にし、3D完成扱いはしない'
 }),
 freeze({
  key:'lucia',label:'リュシア（第1章・登録人物マスター）',
  characterId:'lucia',
  image:'assets/story/characters/lucia/master.webp',
  source:'character-master',status:'registered',
  notes:'摂政リュシア本人の原画。場面ごとの別肖像画より人物マスターを優先'
 }),
 freeze({
  key:'garan',label:'ガラン（第1章・場面用参考肖像）',
  characterId:'garan',
  image:'assets/story-cinema/cast/garan.webp',
  source:'cinema-cast',status:'provisional',
  notes:'場面用参考資料であり、確定した人物マスター・3Dモデルではない'
 }),
 freeze({
  key:'iris',label:'イリス（第1章・場面用参考肖像）',
  characterId:'iris',
  image:'assets/story-cinema/cast/iris.webp',
  source:'cinema-cast',status:'provisional',
  notes:'場面用参考資料であり、確定した人物マスター・3Dモデルではない'
 })
]);
export const CHAPTER_ONE_ART_BY_KEY=Object.freeze(
 Object.fromEntries(CHAPTER_ONE_ART_REFERENCES.map(item=>[item.key,item]))
);
export const FEMALE_COMMANDER_ART_PALETTE=Object.freeze({
 skin:'#edcbbf',
 iris:'#719ac1',
 hair:'#d7b58b',
 cloth:'#263958',
 armor:'#c9cbd3'
});
export const FEMALE_COMMANDER_REFERENCE_KEY='commander-female';
export function artReferenceForFeatured(key){
 return key==='hero-girl-01'?CHAPTER_ONE_ART_BY_KEY[FEMALE_COMMANDER_REFERENCE_KEY]:null;
}
