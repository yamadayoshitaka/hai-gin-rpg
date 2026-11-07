/**
 * 50 independently named, stage-ready monster species. This catalog is pure
 * data (no renderer or DOM dependency). Values are editable in the bestiary
 * without changing the canonical defaults.
 */
export const MONSTER_FAMILIES=Object.freeze({
  beast:'獣', feline:'魔獣', avian:'飛行', reptile:'竜・爬虫',
  insect:'甲虫', arachnid:'蜘蛛', undead:'不死', golem:'ゴーレム',
  fiend:'魔族', aquatic:'水棲',
});
export const MONSTER_ELEMENTS=Object.freeze({
  physical:'物理',fire:'火',water:'水',ice:'氷',wind:'風',
  earth:'土',light:'光',dark:'闇',nature:'自然',lightning:'雷',
});
const data=[
 // Each variant has a different crest, tail, limbs, plating and/or weapon profile.
 ['m001','灰牙の狼王','beast','physical','N',6,'#565f68','#9da7af','#d7bf96','咆哮・噛みつき'],
 ['m002','紅蓮の獄狼','beast','fire','R',18,'#512b34','#a84b36','#ed9b5a','火炎牙・突進'],
 ['m003','氷霜フェンリル','beast','ice','UR',38,'#aecedd','#e8f8ff','#6c95ca','凍結の咆哮'],
 ['m004','雷迅の魔狼','beast','lightning','R',28,'#56567b','#b2a4dc','#f7e16a','電撃突進'],
 ['m005','翠森の古狼','beast','nature','SR',32,'#384a42','#80a48a','#a8c77a','樹霊の遠吠え'],
 ['m006','黒爪パンサー','feline','dark','N',9,'#26272e','#787a96','#e9d2af','影の爪'],
 ['m007','白銀の剣歯虎','feline','ice','R',23,'#d0d6cf','#f7f9f2','#6b8b94','凍牙乱舞'],
 ['m008','紅眼の獅子王','feline','fire','UR',42,'#926044','#d9ab63','#f0c879','王者の咆哮'],
 ['m009','砂嵐の豹獣','feline','wind','R',26,'#c09c5c','#f2db91','#8f6844','砂塵斬り'],
 ['m010','紫電の雷虎','feline','lightning','SR',37,'#373052','#8d79c6','#e9d76b','雷爪連撃'],
 ['m011','荒野の大鷲','avian','wind','N',8,'#785b40','#c0ab81','#e1d6b3','急降下'],
 ['m012','蒼嵐グリフォン','avian','wind','UR',36,'#536a7b','#d7bc79','#9cd9e9','暴風羽撃'],
 ['m013','焔羽フェニックス','avian','fire','UR',48,'#a54a32','#f1a148','#ffe09c','不死炎翼'],
 ['m014','霜白の氷梟','avian','ice','R',22,'#d5dfed','#8aa0c1','#91d8f0','凍眠羽根'],
 ['m015','夜月の鴉天狗','avian','dark','SR',30,'#2c2b3d','#716ba0','#d6b9e1','闇羽散弾'],
 ['m016','沼地の大蜥蜴','reptile','water','N',10,'#4b6658','#86a482','#d6c58f','尾の薙ぎ払い'],
 ['m017','鋼鱗バジリスク','reptile','earth','R',25,'#586468','#a3aaa1','#e8b76d','石化睨み'],
 ['m018','毒棘ヒュドラ','reptile','nature','UR',46,'#35554e','#79a274','#c1e68d','猛毒連射'],
 ['m019','熔岩サラマンダー','reptile','fire','SR',35,'#7c3e34','#d36b41','#f6b45f','溶岩噴出'],
 ['m020','深海リヴァイアサン','reptile','water','UR',55,'#255971','#5aacc1','#a6e3e9','大海嘯'],
 ['m021','鉄甲ビートル','insect','earth','N',12,'#3c4b3b','#85926b','#c7ae7a','角突撃'],
 ['m022','紅鎧カブトムシ','insect','fire','R',24,'#724038','#c1784d','#e3ac63','炎角回転'],
 ['m023','翠鎌マンティス','insect','nature','SR',31,'#3f704b','#8cb35f','#e3df96','双鎌乱舞'],
 ['m024','紫毒スカラベ','insect','dark','R',29,'#584472','#a182bc','#bfe89a','毒液噴出'],
 ['m025','黄金の神虫','insect','light','UR',47,'#997f37','#edd06e','#fdf2ba','神光の甲殻'],
 ['m026','洞窟スパイダー','arachnid','earth','N',8,'#554741','#8a7064','#e1bb8d','糸の拘束'],
 ['m027','紫毒タランチュラ','arachnid','dark','R',22,'#57324f','#b36895','#eaa8bd','毒針落とし'],
 ['m028','白霧の氷蜘蛛','arachnid','ice','SR',34,'#bacbda','#e5eef3','#91c4e3','氷糸結界'],
 ['m029','火山の炎蜘蛛','arachnid','fire','R',32,'#613831','#c76b44','#e8b45c','火炎の蜘蛛糸'],
 ['m030','深淵の女王蜘蛛','arachnid','dark','UR',52,'#2c2745','#7a6296','#e1b9dc','闇毒の巣'],
 ['m031','骸骨剣士','undead','dark','N',11,'#a69c81','#ded6b7','#89605f','骨刃'],
 ['m032','古墓のミイラ','undead','earth','R',24,'#8b7b64','#c5b69a','#799268','呪縛'],
 ['m033','青炎の死霊騎士','undead','fire','SR',39,'#324659','#7397b9','#81dfe0','幽鬼炎斬'],
 ['m034','血月ヴァンパイア','undead','dark','UR',50,'#423047','#a65a68','#e7a3a6','吸血の霧'],
 ['m035','霜冥のリッチ','undead','ice','UR',57,'#5b6c88','#c6d5e7','#c6b8e6','氷霊呪文'],
 ['m036','石壁ゴーレム','golem','earth','N',15,'#6c6962','#a7a398','#d5c6a3','巨拳粉砕'],
 ['m037','青銅の守護像','golem','earth','R',29,'#54766c','#9fb19a','#dbbd78','回転鉄拳'],
 ['m038','紫晶クリスタル巨兵','golem','light','SR',40,'#5f548e','#aca2de','#e0c8f5','晶石光線'],
 ['m039','熔鉄の溶岩巨人','golem','fire','UR',54,'#5a403b','#c87750','#f6c565','熔鉄落下'],
 ['m040','聖光の白銀巨像','golem','light','UR',62,'#a2adb5','#e2e8dd','#f4da9f','神罰の掌'],
 ['m041','小鬼インプ','fiend','dark','N',7,'#583d61','#a06c92','#e7d4aa','爪と悪戯'],
 ['m042','獄門のガーゴイル','fiend','earth','R',27,'#4b4f5a','#9297a9','#d4c0a5','石翼裂斬'],
 ['m043','紅蓮デーモン','fiend','fire','SR',41,'#6c2c36','#bf5760','#f2ab70','地獄火柱'],
 ['m044','深紫サキュバス','fiend','dark','UR',49,'#50335d','#b07ebd','#ecbad9','魅了・闇槍'],
 ['m045','魔王の黒騎兵','fiend','dark','UR',65,'#2d2d3c','#777287','#e0b8b0','魔槍の嵐'],
 ['m046','浅瀬スライム','aquatic','water','N',5,'#3b9fa7','#98dcd2','#c0f4e8','水泡'],
 ['m047','深海の大蛸','aquatic','water','R',27,'#694266','#b6759d','#d3add0','八腕絞め'],
 ['m048','蒼甲シーサーペント','aquatic','ice','SR',38,'#2c7594','#79c0d5','#b7e8eb','氷海波動'],
 ['m049','海鳴りクラーケン','aquatic','dark','UR',54,'#354c6a','#6d91b4','#cad8e1','深淵の触手'],
 ['m050','珊瑚の海神獣','aquatic','light','UR',61,'#548d89','#b8d9ca','#f6dcc9','海神の裁き'],
];
const ranks=['N','R','SR','UR'];
export const MONSTER_CATALOG=Object.freeze(data.map(([id,name,family,element,rarity,level,base,highlight,accent,skill],i)=>{
 const variant=i%5;
 const hp=Math.round((60+level*10)*(variant===4?1.45:1));
 return Object.freeze({
   id,name,family,element,rarity,level,skill,variant,
   colors:Object.freeze({base,highlight,accent}),
   stats:Object.freeze({hp,attack:Math.round(7+level*2.7),defense:Math.round(3+level*1.45),speed:Math.round(5+variant*2+(family==='feline'?5:0))}),
   size: Number((.91+variant*.13+(family==='golem'?.24:0)).toFixed(2)),
   anatomy:MONSTER_FAMILIES[family],
   description:`${MONSTER_ELEMENTS[element]}属性の${MONSTER_FAMILIES[family]}系モンスター。${skill}を使用。`,
 });
}));
export const MONSTER_BY_ID=Object.freeze(Object.fromEntries(MONSTER_CATALOG.map(item=>[item.id,item])));
export function monsterList({family='',element='',keyword=''}={}){
 const q=String(keyword).trim().toLowerCase();
 return MONSTER_CATALOG.filter(m=>(!family||m.family===family)&&(!element||m.element===element)&&(!q||[m.id,m.name,m.skill,m.description].some(s=>s.toLowerCase().includes(q))));
}
export function validateMonsterCatalog(){
 const ids=new Set();
 for(const m of MONSTER_CATALOG){
   if(ids.has(m.id))throw Error('モンスターID重複: '+m.id);
   if(!MONSTER_FAMILIES[m.family]||!MONSTER_ELEMENTS[m.element]||!ranks.includes(m.rarity))throw Error('不正な定義: '+m.id);
   ids.add(m.id);
 }
 if(MONSTER_CATALOG.length!==50||ids.size!==50)throw Error('モンスターは50種必要');
 return true;
}
validateMonsterCatalog();
