/**
 * Twenty physically distinct continents, one per chapter.
 * Data/seed is stable across reloads; chapter 1 retains its existing authored map art.
 * Later chapter atlases are original, deterministic vector maps, not copies
 * of chapter 1 or alternative labels on the same photograph.
 */
const entries = [
 ['灰銀大陸','温帯・王国三境','国境の勅命','亡命者を守るため、敵国の使者と密約を結ぶ。','#728d72','#b7aa7f'],
 ['アウレーア大陸','白亜の草原と塩湖','消えた名簿','記憶を売る穀物商と飢えた難民の取引を裁く。','#b6b17a','#d5c393'],
 ['ノルグ大陸','松影の深林','眠る墓標','補給路を開くための伐採か、森に埋もれた村の保護か。','#426e54','#a0bc86'],
 ['ヴェルム大陸','千河の河口と貿易港','罪を運ぶ船','兵の給金を支える星鐘密輸の船団を差し押さえる。','#588c86','#c3b58e'],
 ['カレド大陸','紅砂と峡谷の城塞','開かれた城門','敵将の避難命令が自軍の攻撃計画を揺るがす。','#9e7657','#d7ad7e'],
 ['ネヴィア大陸','白銀の氷河と関所','忘れた戦友','記憶を失った騎士の証言を信じて部隊を救う。','#9cb8b6','#d9dbcb'],
 ['エルシア大陸','鏡湖と湿原の神殿','獣の記憶','召喚獣を救えば村が干上がるという契約の真実を探る。','#5f9c91','#9dc8a8'],
 ['エリオン大陸','翠嵐の樹海と聖樹','先祖の祈り','森を生かす魔力が死者の自由を奪っている。','#4b7e5b','#9aaf7e'],
 ['ロア大陸','断崖と空の回廊','消された声','封印塔の地下にある選別装置を破壊するか証拠を残すか。','#858578','#c0b6a0'],
 ['バルド大陸','烽火の火山と紅炎砦','先王の密書','三国の記録院が消した処刑記録を公にする。','#925950','#c89c6a'],
 ['ミラージュ大陸','春の来ない黒い森','忘却された集落','救済された森の下で、消された村の名前を呼び戻す。','#536f65','#ad9b83'],
 ['イルミス大陸','翠冠の石造王都','最初の誓約','飢饉の記録と千年前の同意契約を王家から取り戻す。','#7e9876','#c3c29c'],
 ['ラエン大陸','焦土の境界平原','女王の会談','責任を認めない両王家に、一人の少女が死者の名を問う。','#a38269','#d1b192'],
 ['アレネ大陸','沈水都市と古代湖','始祖の証言','星鐘を救済の道具として造った者の悔恨を復元する。','#779a9b','#c0c7b0'],
 ['グライド大陸','灰色の玉座と地下迷宮','空白の記録者','予言ではなく本人の自由な意思で鐘の未来を決める。','#747788','#b7b1a1'],
 ['ノクス大陸','黒曜石の夜と断星山','黒星の帰還','名を忘れても結ばれた休戦を、戦場で守り抜く。','#5b606b','#9a9695'],
 ['カンナ大陸','百路の沃野と十字運河','千人の避難路','勝利のためではなく百の避難路を守るため軍を分ける。','#778f67','#bec08d'],
 ['オルブ大陸','鐘骸の火山と地下聖堂','心臓の代償','現在の飢えと死者への加害を同じ議会で審理する。','#8c695e','#c0a38a'],
 ['シルヴァ大陸','三王の庭園と環状城','最後の盟約','三国の王が未来の責任を軍師ひとりに押し付けない。','#809482','#cfc4a3'],
 ['エクセラ大陸','星環の浮島と古の祭壇','星鐘の終曲','解放・封印・継承。どの選択にも生きる人の代償がある。','#8485a2','#d6c6ae']
];
export const CONTINENTS=Object.freeze(entries.map(([name,climate,arc,conflict,land,light],i)=>Object.freeze({
 chapter:i+1,id:'continent-'+String(i+1).padStart(2,'0'),
 name,climate,arc,conflict,land,light,seed:1031+(i+1)*7919
})));
export function continentForChapter(number){
 const value=Number(number);
 return CONTINENTS[Math.max(1,Math.min(20,Number.isFinite(value)?Math.floor(value):1))-1];
}
const hash=(a,b,seed)=>{
 let x=Math.imul((a+91)|0,1664525)^Math.imul((b+17)|0,1013904223)^seed;
 x=Math.imul(x^(x>>>16),2246822507);
 x=Math.imul(x^(x>>>13),3266489909);
 return ((x^(x>>>16))>>>0)/4294967296;
};
const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function continentStagePoints(chapter){
 const c=continentForChapter(chapter);
 // Ten positions fit safely inside the coast silhouette across all seeds.
 return Array.from({length:10},(_,i)=>{
  const angle=(i*.61803398875+hash(i,4,c.seed)*.065)*Math.PI*2;
  const reach=.25+.54*Math.sqrt((i+1)/11);
  return Object.freeze({
   slot:i+1,x:50+Math.cos(angle)*reach*24,
   y:51+Math.sin(angle)*reach*24
  });
 });
}
export function continentMapSvg(chapter){
 const c=continentForChapter(chapter),seed=c.seed;
 const pts=[];
 for(let i=0;i<96;i++){
  const a=i*Math.PI*2/96;
  const jagged=1+(hash(i,5,seed)-.5)*.17+.08*Math.sin(a*5+seed*.0001)+.09*Math.sin(a*9+seed*.0003);
  const x=600+Math.cos(a)*(405*jagged),y=382+Math.sin(a)*(292*jagged);
  pts.push([Math.round(x),Math.round(y)]);
 }
 const landPath='M'+pts.map(p=>p.join(',')).join('L')+'Z';
 let hills='',rivers='',towns='';
 for(let i=0;i<13;i++){
  const a=i*2.399+seed*.0007;
  const x=600+Math.cos(a)*(60+hash(i,3,seed)*270);
  const y=382+Math.sin(a)*(35+hash(i,7,seed)*180);
  const w=18+hash(i,9,seed)*48;
  hills+='<path d="M'+(x-w).toFixed(0)+' '+(y+8).toFixed(0)+' l'+w.toFixed(0)+' -'+(15+w*.7).toFixed(0)+' l'+w.toFixed(0)+' '+(15+w*.7).toFixed(0)+'" fill="none" stroke="#574d3a" stroke-width="3" opacity=".36"/>';
 }
 for(let i=0;i<3;i++){
  const x=430+i*121+hash(i,2,seed)*70;
  rivers+='<path d="M'+x.toFixed(0)+' 190 Q'+(x-85).toFixed(0)+' 330 '+(x+36).toFixed(0)+' 420 T'+(x+55).toFixed(0)+' 635" fill="none" stroke="#7ab5bd" stroke-width="'+(6+i*2)+'" opacity=".72"/>';
 }
 for(const p of continentStagePoints(chapter)){
  const x=(p.x*12).toFixed(1),y=(p.y*7.51).toFixed(1);
  towns+='<circle cx="'+x+'" cy="'+y+'" r="8" fill="#45372a" stroke="#f1d8a6" stroke-width="2" opacity=".76"/>';
 }
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="751" viewBox="0 0 1200 751">'+
 '<defs><radialGradient id="sea"><stop stop-color="#477580"/><stop offset="1" stop-color="#122c3b"/></radialGradient>'+
 '<linearGradient id="land" x2=".8" y2="1"><stop stop-color="'+c.light+'"/><stop offset=".53" stop-color="'+c.land+'"/><stop offset="1" stop-color="#4e634e"/></linearGradient>'+
 '<pattern id="grid" width="70" height="70" patternUnits="userSpaceOnUse"><path d="M70 0H0V70" stroke="#f7eac8" opacity=".10" fill="none"/></pattern></defs>'+
 '<rect width="1200" height="751" fill="url(#sea)"/><rect width="1200" height="751" fill="url(#grid)"/>'+
 '<path d="'+landPath+'" fill="url(#land)" stroke="#e4d7b2" stroke-width="11" stroke-linejoin="round"/>'+
 '<path d="'+landPath+'" fill="none" stroke="#433d32" stroke-width="3" opacity=".75"/>'+
 '<g>'+hills+rivers+towns+'</g>'+
 '<g fill="#f5dfad" font-family="sans-serif" text-anchor="middle"><text x="600" y="66" font-size="31" font-weight="bold">'+esc(c.name)+'</text>'+
 '<text x="600" y="98" font-size="17">'+esc(c.climate)+'</text></g>'+
 '<path d="M1100 112v-50m-9 10 9-10 9 10" stroke="#f8e0ab" stroke-width="3" fill="none"/>'+
 '<text x="1100" y="138" font-size="18" fill="#f8e0ab" text-anchor="middle">N</text></svg>';
}
export function continentMapUrl(chapter){
 return 'url("data:image/svg+xml,'+encodeURIComponent(continentMapSvg(chapter))+'")';
}
