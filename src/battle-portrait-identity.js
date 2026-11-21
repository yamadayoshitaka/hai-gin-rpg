/** UI identity is sourced from the actual enemy species or selected inn captain,
 * not from the combat job that the monster AI happens to reuse internally. */
export const MONSTER_FAMILY_GLYPHS=Object.freeze({
 beast:'🐺',feline:'🐯',avian:'🦅',reptile:'🐉',insect:'🪲',
 arachnid:'🕷️',undead:'💀',golem:'🗿',fiend:'👹',aquatic:'🐟'
});
export function battleMonsterIdentity(unit){
 const spec=unit?.monsterSpec||null;
 const id=spec?.id||unit?.monsterId||'';
 const name=spec?.name||unit?.monsterName||unit?.speciesName||'';
 const family=spec?.family||unit?.monsterFamily||'';
 if(!id&&!name&&!family&&!unit?.isMonster)return null;
 return {id:String(id),name:String(name||'モンスター'),family:String(family)};
}
export function battleSquadPortraitChoice(row,team=Number(row?.team)||0){
 if(Number(team)===1&&row?.monster){
  const monster=row.monster;
  return {kind:'monster',glyph:MONSTER_FAMILY_GLYPHS[monster.family]||'👾',
   name:String(monster.name||'モンスター'),id:String(monster.id||'')};
 }
 if(Number(team)===0&&!row?.isJobDivision&&row?.captain){
  const captain=row.captain;
  return {kind:'captain',job:String(captain.job||'騎士'),id:String(captain.id||row.id),
   name:String(captain.name||captain.characterName||'隊長')};
 }
 return {kind:'job',job:String(row?.job||'兵士'),id:String(row?.id||''),
  name:String(row?.job||'兵士')};
}
