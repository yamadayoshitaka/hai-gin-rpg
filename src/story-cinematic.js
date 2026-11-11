/**
 * Original tactical-fantasy cinematic cast and illustrated chapter dialogue.
 * Story scripts are deterministic and separate from game-save and combat state.
 * The visual language is hand-built isometric fantasy, not third-party art.
 */
import {STORY_CHAPTERS} from './story-chapters.js';
import {continentForChapter} from './continent-campaign.js';

const person=(id,name,faction,role,secret,arc,portrait)=>Object.freeze({id,name,faction,role,secret,arc,portrait});
export const STORY_KEY_PEOPLE=Object.freeze([
 person('lucia','リュシア','灰銀','摂政','先王の偽造王印を密かに調べている','王家の正統性より民の記憶を選ぶ',0),
 person('garan','ガラン','灰銀','老騎士','先の戦争で鐘守を護れなかった','戦功ではなく撤退と救命の価値を伝える',1),
 person('iris','イリス','灰銀','治癒師','礼拝堂の死者名簿が魔法の燃料だった','記録院の罪を生者に伝える',2),
 person('shion','シオン','灰銀','忍び頭','密書の送り主がかつての師','敵将の娘を救い国境を越えた信義を結ぶ',3),
 person('kai','カイ','灰銀','盗賊・斥候','積荷の中に自身の出自の証拠を見つけた','盗人から証人へ変わる',4),
 person('leon','レオン','灰銀','傭兵隊長','紅炎に家族を残して戦う','報酬より人命を選ぶ',5),
 person('fio','フィオ','灰銀','工兵長','橋と星鐘は同じ古代金属でできている','攻城兵器を避難用の橋に作り替える',6),
 person('edo','エド','灰銀','元騎士・記録官','軍報の戦死者数を改竄する命令を受けた','隠された死者を歴史に残す',7),
 person('mina','ミナ','灰銀','避難民の少女','井戸から亡父の声を聴く','戦争を終える理由を軍師に与える',8),
 person('noel','ノエル','中立','森守・使節','三国の境界に残る古い盟約の継承者','どの王国にも属さない森を守る',9),
 person('raizen','ライゼン','紅炎','国境将軍','民を逃がして命令違反で裁かれた','敵国の軍師と停戦に尽力する',10),
 person('vald','ヴァルド','紅炎','皇帝','星鐘で亡き皇子を取り戻そうとしている','執着を捨て紅炎を民に返す',11),
 person('selika','セリカ','紅炎','皇女','父王の密命を内密に破棄した','処刑された鐘守の証人となる',12),
 person('zahar','ザハル','紅炎','宰相','戦争で回収した記憶を国家財政へ流す','自らが隠した帳簿と向き合う',13),
 person('grad','グラド','紅炎','重装将軍','撤退命令に従わず城門を閉ざした','守るべき城より守るべき人を知る',14),
 person('altea','アルテア','翠嵐','女王','星鐘停止で森の生命力が弱まることを知る','自然と死者の自由を両立する道を探す',15),
 person('orphe','オルフェ','翠嵐','艦隊司令','星鐘の部品を海底に封じた','海路を戦から救援へ転じる',16),
 person('meve','メーヴ','翠嵐','密偵長','鐘守の血筋が三国全てに残ると知る','密偵の情報を公開証言に変える',17),
 person('elne','エルネ','鐘守','最後の鐘守','千年前の記憶の回収儀式を止められなかった','自らの過ちを軍師に委ねる',18),
 person('vess','ヴェス','記録院','記録院長','三国の戦死者を燃料として集計していた','制度の告発を逃げずに受ける',19)
]);
export const STORY_KEY_PERSON_BY_NAME=new Map(STORY_KEY_PEOPLE.flatMap(p=>[
 [p.name,p],
 ...(p.name==='ガラン'?[['老騎士ガラン',p]]:[]),
 ...(p.name==='ミナ'?[['少女ミナ',p]]:[]),
 ...(p.name==='ノエル'?[['森守ノエル',p]]:[]),
 ...(p.name==='エルネ'?[['エルネの残響',p]]:[])
]));
const sceneLines=[
 [['lucia','この勅命に記された王印は、本物ではありません。'],['vess','偽りを暴けば、あなたの国は戦を続けられなくなる。']],
 [['mina','井戸の底で父の声がする。だけど、あれは本当に父さんなの？'],['zahar','記録にあるのは重さだけだ。誰の声かは勘定に入らぬ。']],
 [['shion','木を焼けば道は開く。けれど故郷は二度と戻らない。'],['meve','翠嵐も同じ森で、灰銀の軍列を見張っている。']],
 [['kai','あの箱には敵の印と味方の王印が両方ある。'],['orphe','海へ捨てても、潮が真実を運び戻す。']],
 [['raizen','敵兵であろうと、子供を門の外へ追い出せない。'],['grad','それは皇帝への背信だ、ライゼン。']],
 [['garan','敗北した騎士を責めるな。退路を守るのも誇りだ。'],['selika','紅炎では撤退を命じた者が罪に問われた。']],
 [['iris','聖堂の名簿は祈りではなく燃料の帳簿でした。'],['vess','神殿を守るために、誰かは数えねばならなかった。']],
 [['fio','橋を落とせば敵は止まる。救護隊も止まる。'],['raizen','ならば橋は壊さず、渡る順番を決めろ。']],
 [['altea','この森の魔力は、亡き者の記憶から来ている。'],['noel','美しいものほど、誰かの犠牲を隠しやすい。']],
 [['vald','皇子を取り戻せるなら、帝都の鐘を何度でも鳴らす。'],['selika','父上、戻るのは声だけ。あの人の明日ではありません。']],
 [['meve','帳簿の署名は三国の大臣にある。敵は一国ではない。'],['edo','ならば歴史書も、敵味方を分けずに書きます。']],
 [['shion','屋根の影から見えたのは敵将ではない。避難民だった。'],['raizen','君らの忍びは、今夜だけ敵の門を開けてくれるか。']],
 [['zahar','星鐘の部品を渡せば財政は救える。'],['kai','国庫の数字と、救えなかった命を一緒にするな。']],
 [['grad','この城壁だけは最後まで守り抜く。'],['fio','壁を守る間に、街の人間が閉じ込められるぞ。']],
 [['orphe','海峡に眠る鐘の破片を引き揚げる。'],['altea','海の記憶まで利用しては、森も潮も死ぬ。']],
 [['lucia','先王の命令に背くことが、王家を守る道なのかもしれない。'],['vess','記録の裏には、誰も知らぬ第四の王印がある。']],
 [['elne','千年前、救済と呼んで死者の名を奪いました。'],['iris','ならば最初に、その人々の名を返しましょう。']],
 [['vess','星鐘を止めれば、冬を越せない町がある。'],['lucia','犠牲を止め、民が冬を越せる道を私たちで探します。']],
 [['altea','森か、人の記憶か。どちらも切り捨てられない。'],['vald','皇子を取り戻すため森さえ燃やすつもりだった。だが、もう失う命を増やしたくない。']],
 [['elne','鐘はまだ、誰かの声を閉じ込めている。'],['mina','父さんの声を返して。生きていた日の言葉で。']]
];
const byId=Object.freeze(Object.fromEntries(STORY_KEY_PEOPLE.map(p=>[p.id,p])));
const scene=(type,text,person=null,chapter=1,panel=0)=>Object.freeze({
 id:'c'+String(chapter).padStart(2,'0')+'-p'+String(panel).padStart(2,'0'),
 type,text,speaker:person?.name||'語り手',characterId:person?.id||null,
 faction:person?.faction||'鐘守',role:person?.role||'記録',artSeed:chapter*41+panel*7
});
export function cinematicScenesForChapter(chapter=1){
 const ch=Math.max(1,Math.min(20,Math.floor(Number(chapter)||1)));
 const data=STORY_CHAPTERS[ch-1],pairs=sceneLines[ch-1],out=[];
 out.push(scene('establish',data.narration,null,ch,out.length));
 for(const line of data.dialogues.slice(0,3)){
  const speaker=STORY_KEY_PERSON_BY_NAME.get(line.speaker)||null;
  out.push(scene('portrait',line.line,speaker,ch,out.length));
 }
 for(const [id,line] of pairs){
  out.push(scene('confrontation',line,byId[id],ch,out.length));
 }
 out.push(scene('turn',data.synopsis,null,ch,out.length));
 out.push(scene('ending','誰が何を守るために戦うのか。その答えを、次の戦へ持って行く。',null,ch,out.length));
 return Object.freeze(out);
}
export function storyCastForChapter(chapter){
 const scenes=cinematicScenesForChapter(chapter);
 return [...new Set(scenes.map(s=>s.characterId).filter(Boolean))].map(id=>byId[id]);
}
export function illustratedStorySvg(chapter,sceneIndex=0){
 const ch=Math.max(1,Math.min(20,Math.floor(Number(chapter)||1)));
 const continent=continentForChapter(ch);
 const themes=[
  ['#122845','#6a7990','#ce9c62','#2d4051'],
  ['#192a37','#798a76','#e7bb83','#304d3e'],
  ['#291d39','#81627a','#dea17b','#3d314e'],
  ['#252b49','#8992a7','#e8b9a8','#454262'],
  ['#3b2830','#a06e62','#efbb88','#51444b']
 ];
 const colors=themes[(ch+Math.floor(sceneIndex/2))%themes.length],seed=ch*31+sceneIndex*19;
 const towers=[120,356,702,980].map((x,i)=>{
  const y=320+((seed+i*13)%80),h=90+((seed+i*19)%75);
  return '<g opacity=".82" fill="'+colors[3]+'"><rect x="'+(x-31)+'" y="'+(y-h)+'" width="62" height="'+(h+140)+'"/><path d="M'+(x-40)+' '+(y-h)+' l40 -64 40 64Z"/><rect x="'+(x-8)+'" y="'+(y-h+34)+'" width="16" height="31" fill="#c4a682"/></g>';
 }).join('');
 const flags=[206,595,918].map((x,i)=>'<path d="M'+x+' 350 v-112 l'+(i%2?62:-62)+' 14 -'+(i%2?62:-62)+' 27" fill="'+(i%2?'#ce8e68':'#b9cdda')+'" stroke="#ead5b9" stroke-width="4" opacity=".7"/>').join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 625" role="img" aria-label="オリジナル戦記の城郭と進軍の絵"><defs>'+
 '<linearGradient id="sky" x2="0" y2="1"><stop stop-color="'+colors[0]+'"/><stop offset=".58" stop-color="'+colors[1]+'"/><stop offset="1" stop-color="'+colors[2]+'"/></linearGradient>'+
 '<linearGradient id="ground" x2="0" y2="1"><stop stop-color="'+colors[3]+'"/><stop offset="1" stop-color="#101827"/></linearGradient>'+
 '<radialGradient id="sun"><stop stop-color="#fff7cc" stop-opacity=".85"/><stop offset="1" stop-color="#fff4bc" stop-opacity="0"/></radialGradient>'+
 '<pattern id="grain" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="7" r=".8" fill="#f6e9cb" opacity=".17"/></pattern>'+
 '</defs><rect width="1100" height="625" fill="url(#sky)"/><circle cx="'+(675+seed%170)+'" cy="120" r="210" fill="url(#sun)"/>'+
 '<path d="M0 336 L105 224 204 293 305 173 444 294 588 195 740 311 855 191 1100 321 V625 H0Z" fill="'+colors[3]+'" opacity=".52"/>'+
 '<path d="M0 390 Q200 312 350 386 T700 360 T1100 375 V625 H0Z" fill="#14273c" opacity=".6"/>'+
 towers+'<path d="M0 445 L390 402 590 480 1100 403 1100 625H0Z" fill="url(#ground)"/>'+
 '<path d="M135 625 L497 459 712 449 1070 625" fill="#ac9c85" opacity=".4"/>'+
 '<path d="M0 520 L550 453 L1100 528 M0 567 L550 453 L1100 570" fill="none" stroke="#eed2a7" stroke-width="3" opacity=".4"/>'+
 flags+
 '<g opacity=".86" fill="#101a2b" stroke="#c4b49a" stroke-width="2"><path d="M270 516 l18 -73 31 -34 30 29 18 78 5 70H260Z"/><circle cx="317" cy="401" r="22"/><path d="M328 432 l80 58 -20 15 -78 -39"/><path d="M740 518 l-20 -72 -26 -31 -34 29 -18 74 -5 68h115Z"/><circle cx="692" cy="405" r="21"/><path d="M679 431 l-87 54 18 20 83 -43"/></g>'+
 '<path d="M0 0H1100V625H0Z" fill="url(#grain)"/>'+
 '<path d="M0 0h1100v625H0" fill="none" stroke="#d2b986" stroke-width="10" opacity=".65"/></svg>';
}
export function illustratedStoryDataUri(chapter,sceneIndex=0){
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(illustratedStorySvg(chapter,sceneIndex));
}
