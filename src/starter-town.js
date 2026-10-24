/**
 * Ariahan-inspired original 3D town layout for Hai-Gin RPG.
 * Architectural motifs: northern royal castle, western guild/tavern,
 * southern family homes, commercial quarter and east-side chapel.
 * This is not a tile-for-tile reproduction or extracted DQ3 map/artwork.
 * Coordinates are in existing outdoor house generator grid units.
 */
export const STARTER_TOWN={
 id:'revna-ariahan-inspired',name:'黎明の王都レヴナ',theme:'royal-starting-town',
 districts:[
  {id:'royal',name:'北の王城地区',center:[0,-115],purpose:'royal court and castle'},
  {id:'guild',name:'西の旅人街',center:[-50,-65],purpose:'inn, companions and trade'},
  {id:'market',name:'東の商店街',center:[45,-55],purpose:'weapons, armor and supplies'},
  {id:'homes',name:'南の居住区',center:[0,-15],purpose:'family homes and chapel'}
 ],
 // id/kind is resolved by index to remain compatible with existing indoor rooms.
 buildings:[
  {id:'home-hero',kind:'home',name:'旅立ちの家',grid:[-12,-5,6,6,5,0,Math.PI/2],capabilities:['rest','dialogue']},
  {id:'home-east',kind:'home',name:'東の民家',grid:[12,-5,6,6,5,1,-Math.PI/2]},
  {id:'weapon-shop',kind:'weapons',name:'王都武器店',grid:[-18,-16,7,7,6,2,Math.PI/2],capabilities:['shop']},
  {id:'armor-shop',kind:'armor',name:'王都防具店',grid:[18,-17,7,6,5.4,3,-Math.PI/2],capabilities:['shop']},
  {id:'old-house',kind:'old',name:'老人の家',grid:[-13,-33,7,6,6,1,Math.PI/2]},
  {id:'item-shop',kind:'items',name:'旅支度の道具屋',grid:[13,-34,8,6,6.4,2,-Math.PI/2],capabilities:['shop']},
  {id:'workshop',kind:'artisan',name:'城下の工房',grid:[-10,-45,6,6,5.2,0,Math.PI/2]},
  {id:'library',kind:'scholar',name:'王立資料室',grid:[11,-46,7,7,5.9,3,-Math.PI/2]},
  {id:'tavern',kind:'inn',name:'旅人の酒場・宿屋',grid:[-25,-27,14,12,8.8,0,Math.PI/2],capabilities:['inn','dialogue']},
  {id:'guild',kind:'merchant',name:'冒険者ギルド',grid:[25,-28,14,12,8.8,1,-Math.PI/2],capabilities:['shop','dialogue']},
  {id:'chapel',kind:'church',name:'黎明の礼拝堂',grid:[-17,6,7,7,5,2,Math.PI/2]},
  {id:'castle',kind:'manor',name:'レヴナ王城',grid:[18,6,14,12,9.4,3,-Math.PI/2],capabilities:['dialogue']}
 ],
 landmarks:[
  {id:'castle',kind:'royal-castle',label:'北の王城',buildingId:'castle'},
  {id:'central-square',kind:'square',position:[0,0,-37],label:'中央大通り'},
  {id:'fountain',kind:'fountain',position:[0,0,6.8],label:'町の噴水'},
  {id:'southern-gate',kind:'gate',position:[0,0,22],label:'南門'}
 ],
 // NPC coordinates are authored explicitly; remaining generic citizens can still be generated.
 citizens:[
  {id:'merchant-mira',x:-5,z:-13,name:'商人ミラ',role:'merchant',line:'王城へ続く通りには、旅人と商人が集まるの。'},
  {id:'traveler-leon',x:5.6,z:-14,name:'旅人レオン',role:'traveler',line:'北に見えるのがレヴナ王城だ。まずは王様に会うといい。'},
  {id:'citizen',x:-5,z:-36,name:'町の住人',role:'civilian',line:'西の酒場には、冒険の仲間を探す旅人が集まるよ。'},
  {id:'guard-west',x:-8,z:-73,name:'城門衛兵',role:'guard',line:'王城に入るなら武器を納めてくれ。'},
  {id:'guard-east',x:8,z:-74,name:'城門衛兵',role:'guard',line:'この王都は古い王家に守られている。'},
  {id:'tavern-regular',x:-6,z:-54,name:'酒場の常連',role:'civilian',line:'西の酒場なら旅の情報が聞けるぞ。'},
  {id:'market-buyer',x:7,z:-51,name:'買い物客',role:'civilian',line:'東には武器や防具のお店が並んでいるわ。'},
  {id:'young-apprentice',x:-8,z:-23,name:'見習い職人',role:'civilian',line:'旅立つなら、まず装備を整えないとね。'},
  {id:'chapel-pilgrim',x:6,z:4,name:'巡礼者',role:'civilian',line:'礼拝堂には旅の安全を祈る人々が集まる。'},
  {id:'old-soldier',x:-7,z:-45,name:'老兵',role:'civilian',line:'王都の石畳は何百年も人々を見守ってきた。'},
  {id:'courier',x:5,z:-66,name:'王城の使い',role:'civilian',line:'王から新しい布告が届いたところだ。'},
  {id:'farmer',x:-5,z:8,name:'農夫',role:'civilian',line:'町の南には畑と穏やかな街道がある。'},
  {id:'child',x:6,z:-4,name:'町の子ども',role:'civilian',line:'大きくなったら、ぼくも冒険者になるんだ！'},
  {id:'scholar',x:7,z:-40,name:'学者',role:'civilian',line:'この都はかつて大陸交易の要だったという。'},
  {id:'inn-guest',x:-7,z:-62,name:'宿泊客',role:'civilian',line:'長旅なら酒場の宿で休むといい。'}
 ]
};
export function townHouseStructures(town=STARTER_TOWN){
 return town.buildings.map(b=>{
  const [gx,gz,w,d,h,variant,yaw]=b.grid;
  return [gx*2.65,gz*2.5-12,w,d,h,variant,yaw];
 });
}
export function townNpcInfo(town=STARTER_TOWN){return town.citizens.map(n=>[n.x,n.z,n.name,n.line]);}
