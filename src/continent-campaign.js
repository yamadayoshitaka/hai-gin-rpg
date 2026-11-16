/**
 * One continuous mainland for all 20 chapters and 200 stages.
 *
 * The three nations and neutral borders have stable positions: chapters
 * revisit the same territories rather than inventing a new continent each
 * time. The Chapter-1 hand-authored world image remains the shared base map.
 * Public API names are preserved for older saves and existing map screens.
 */
export const MAINLAND_ID='continent-01';
export const MAINLAND_NAME='灰銀大陸';
export const MAINLAND_MAP_ASSET='./assets/story-world-map-v0.5.webp';
const regionDefinitions=Object.freeze({
 'western-pass':['西の関所','灰銀王国','西部山道',20,23],
 'pine-forest':['松影の森','三国中立地帯','松影の深林',42,25],
 'flame-fort':['紅炎砦','紅炎帝国','火山麓の城塞',65,16],
 'northern-cliff':['北の断崖','紅炎帝国','北部断崖',86,20],
 'silver-capital':['灰銀の本城','灰銀王国','王都と城下町',20,48],
 'central-plains':['中央平原','三国中立地帯','草原と塩湖',43,48],
 'border-town':['境界の町','三国係争地域','国境の街道',64,44],
 'green-watch':['翠嵐の砦','翠嵐王国','森の見張り砦',85,47],
 'river-port':['大河の港','灰銀王国','千河の河口',17,74],
 'lakeshore':['湖畔の荒地','三国中立地帯','古代湖と湿原',44,71],
 'green-capital':['翠嵐の王都','翠嵐王国','樹海の石造王都',67,72],
 'southern-woods':['南の樹海','翠嵐王国','南方の大樹海',86,78]
});
export const MAINLAND_REGIONS=Object.freeze(Object.fromEntries(
 Object.entries(regionDefinitions).map(([id,[name,nation,climate,x,y]])=>[id,
  Object.freeze({id,name,nation,climate,x,y})])
));
const chapterOperations=Object.freeze([
 ['silver-capital','国境の勅命','亡命者を守るため、敵国の使者と密約を結ぶ。'],
 ['central-plains','消えた名簿','記憶を売る穀物商と飢えた難民の取引を裁く。'],
 ['pine-forest','眠る墓標','補給路を開くための伐採か、森に埋もれた村の保護か。'],
 ['river-port','罪を運ぶ船','兵の給金を支える星鐘密輸の船団を差し押さえる。'],
 ['border-town','開かれた城門','敵将の避難命令が自軍の攻撃計画を揺るがす。'],
 ['western-pass','忘れた戦友','記憶を失った騎士の証言を信じて部隊を救う。'],
 ['lakeshore','獣の記憶','召喚獣を救えば村が干上がるという契約の真実を探る。'],
 ['green-watch','先祖の祈り','森を生かす魔力が死者の自由を奪っている。'],
 ['northern-cliff','消された声','封印塔の地下にある選別装置を破壊するか証拠を残すか。'],
 ['flame-fort','先王の密書','三国の記録院が消した処刑記録を公にする。'],
 ['southern-woods','忘却された集落','救済された森の下で、消された村の名前を呼び戻す。'],
 ['green-capital','最初の誓約','飢饉の記録と千年前の同意契約を王家から取り戻す。'],
 ['border-town','女王の会談','責任を認めない両王家に、一人の少女が死者の名を問う。'],
 ['lakeshore','始祖の証言','星鐘を救済の道具として造った者の悔恨を復元する。'],
 ['silver-capital','空白の記録者','予言ではなく本人の自由な意思で鐘の未来を決める。'],
 ['northern-cliff','黒星の帰還','名を忘れても結ばれた休戦を、戦場で守り抜く。'],
 ['central-plains','千人の避難路','勝利のためではなく百の避難路を守るため軍を分ける。'],
 ['flame-fort','心臓の代償','現在の飢えと死者への加害を同じ議会で審理する。'],
 ['green-capital','最後の盟約','三国の王が未来の責任を軍師ひとりに押し付けない。'],
 ['silver-capital','星鐘の終曲','解放・封印・継承。どの選択にも生きる人の代償がある。']
]);
export const CONTINENTS=Object.freeze(chapterOperations.map(([regionId,arc,conflict],i)=>{
 const region=MAINLAND_REGIONS[regionId];
 return Object.freeze({
  chapter:i+1,id:MAINLAND_ID,name:MAINLAND_NAME,continentId:MAINLAND_ID,
  regionId,regionName:region.name,nation:region.nation,
  climate:region.climate,arc,conflict,land:'#728d72',light:'#b7aa7f',
  // Purely staging geometry; never used to alter the coastline or territory.
  seed:1031+(i+1)*7919,
  anchorX:region.x,anchorY:region.y
 });
}));
export function continentForChapter(number){
 const n=Number(number);
 return CONTINENTS[Math.max(1,Math.min(20,Number.isFinite(n)?Math.floor(n):1))-1];
}
const hash=(a,b,seed)=>{
 let x=Math.imul((a+91)|0,1664525)^Math.imul((b+17)|0,1013904223)^seed;
 x=Math.imul(x^(x>>>16),2246822507);
 x=Math.imul(x^(x>>>13),3266489909);
 return ((x^(x>>>16))>>>0)/4294967296;
};
const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
/** Ten stage positions surround the fixed region center, not ten new islands. */
export function continentStagePoints(chapter){
 const c=continentForChapter(chapter);
 return Array.from({length:10},(_,i)=>{
  const angle=(i*0.61803398875+hash(i,4,c.seed)*0.065)*Math.PI*2;
  const radius=i===0?0:3.4+Math.sqrt(i/9)*5.3;
  return Object.freeze({
   slot:i+1,
   x:Math.max(9,Math.min(91,c.anchorX+Math.cos(angle)*radius)),
   y:Math.max(9,Math.min(91,c.anchorY+Math.sin(angle)*radius))
  });
 });
}
/**
 * Stable optional vector reference for diagnostics. The actual campaign UI
 * deliberately uses the SAME authored mainland image on all chapters.
 */
export function continentMapSvg(chapter){
 const c=continentForChapter(chapter);
 const dots=Object.values(MAINLAND_REGIONS).map(region=>
  '<circle cx="'+(region.x*12)+'" cy="'+(region.y*7.51)+'" r="8" fill="#f1dfb4" stroke="#303d38" stroke-width="2"/>').join('');
 const focus='<circle cx="'+(c.anchorX*12)+'" cy="'+(c.anchorY*7.51)+
  '" r="22" fill="none" stroke="#f9ca6e" stroke-width="7"/>';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 751">'+
  '<rect width="1200" height="751" fill="#173b4a"/>'+
  '<path d="M120 165L270 82L425 113L570 64L720 110L875 77L1055 194L1120 344L1080 518L973 659L755 711L590 681L402 723L212 622L103 453Z" fill="#778c68" stroke="#e4d4a8" stroke-width="14"/>'+
  dots+focus+'<text x="600" y="48" fill="#fff0c9" font-size="26" text-anchor="middle">'+
  esc(MAINLAND_NAME+' ／ '+c.regionName)+'</text></svg>';
}
/** Keep the existing hand-authored mainland raster and zoom only by pins. */
export function continentMapUrl(_chapter){
 return 'url("'+MAINLAND_MAP_ASSET+'")';
}
