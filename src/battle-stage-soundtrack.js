/**
 * Data-driven battle soundtrack map. Each stage uses its own theme category;
 * custom stages inherit their biome. Only recorded, redistributable CC0
 * files are used, with the original battle score as the offline fallback.
 */
export const BATTLE_SOUNDTRACK_THEMES=Object.freeze({
 castle:{name:'王城決戦',file:'battle.ogg',mood:'勇壮な軍団戦',tempo:1},
 siege:{name:'要塞攻防',file:'siege.ogg',mood:'重厚な包囲戦',tempo:.92},
 forest:{name:'樹海の攻防',file:'forest.ogg',mood:'森林の機動戦',tempo:1.06},
 snow:{name:'白銀の交戦',file:'snow.mp3',mood:'冷たい峠の戦い',tempo:.88},
 desert:{name:'砂海の決戦',file:'desert.mp3',mood:'砂漠の戦陣',tempo:1.08},
 ruins:{name:'廃都の挽歌',file:'ruins.ogg',mood:'暗い古戦場',tempo:.83},
 coast:{name:'河港の防衛',file:'coast.ogg',mood:'水辺の戦い',tempo:1.02}
});
const BIOME_THEME=Object.freeze({
 temperate:'castle',urban:'castle',highland:'siege',
 forest:'forest',plains:'forest',snow:'snow',desert:'desert',
 marsh:'ruins',ruins:'ruins',coast:'coast',village:'coast'
});
const STAGE_OVERRIDES=Object.freeze({
 'royal-castle':'castle','flame-fort':'siege',
 'green-capital':'castle','northern-cliff':'snow',
 'lakeshore':'ruins','river-port':'coast'
});
export function soundtrackForStage(stage){
 const id=String(stage?.id||'');
 const biome=String(stage?.biome||'temperate');
 const key=STAGE_OVERRIDES[id]||BIOME_THEME[biome]||'castle';
 return {id:key,...BATTLE_SOUNDTRACK_THEMES[key]};
}
