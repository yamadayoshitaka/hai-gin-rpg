/** Declarative game content. No runtime, renderer, UI or Three.js dependencies. */
export const PLAYER_JOBS={
 swordsman:{label:'剣士',skill:'斬撃',cost:25,damage:18,cooldown:1.28,windup:0.66,guardBreak:0},
 knight:{label:'騎士',skill:'盾撃',cost:30,damage:15,cooldown:1.55,windup:0.73,guardBreak:1.7},
 rogue:{label:'盗賊',skill:'迅速斬り',cost:16,damage:12,cooldown:0.66,windup:0.39,guardBreak:0},
 monk:{label:'武闘家',skill:'剛拳',cost:22,damage:22,cooldown:1.04,windup:0.53,guardBreak:0.45},
 merchant:{label:'商人',skill:'銭投げ',cost:18,damage:13,cooldown:1,windup:0.56,guardBreak:0},
 traveler:{label:'旅人',skill:'旅路斬り',cost:19,damage:16,cooldown:1,windup:0.55,guardBreak:0},
 smith:{label:'鍛冶師',skill:'鉄槌',cost:28,damage:22,cooldown:1.4,windup:0.76,guardBreak:1.1},
 chef:{label:'料理人',skill:'包丁連撃',cost:19,damage:17,cooldown:0.88,windup:0.48,guardBreak:0},
 herbalist:{label:'薬師',skill:'薬刃',cost:18,damage:14,cooldown:1,windup:0.58,guardBreak:0},
 bard:{label:'吟遊詩人',skill:'音撃',cost:20,damage:16,cooldown:0.94,windup:0.54,guardBreak:0},
 farmer:{label:'農夫',skill:'大鎌払い',cost:24,damage:19,cooldown:1.24,windup:0.62,guardBreak:0.3},
 scholar:{label:'学者',skill:'魔導書撃',cost:22,damage:20,cooldown:1.15,windup:0.6,guardBreak:0},
 innkeeper:{label:'宿屋従業員',skill:'護身打ち',cost:18,damage:15,cooldown:0.98,windup:0.53,guardBreak:0},
 priest:{label:'僧侶',skill:'聖なる打撃',cost:19,damage:16,cooldown:1,windup:0.57,guardBreak:0},
 mage:{label:'魔法使い',skill:'魔力打撃',cost:24,damage:22,cooldown:1.2,windup:0.67,guardBreak:0},
 archer:{label:'弓使い',skill:'短弓打ち',cost:18,damage:17,cooldown:0.94,windup:0.53,guardBreak:0},
 paladin:{label:'聖騎士',skill:'聖盾撃',cost:27,damage:20,cooldown:1.32,windup:0.66,guardBreak:1.2},
 assassin:{label:'暗殺者',skill:'急所斬り',cost:23,damage:24,cooldown:0.95,windup:0.54,guardBreak:0},
 samurai:{label:'侍',skill:'居合斬り',cost:27,damage:25,cooldown:1.22,windup:0.68,guardBreak:0},
 ranger:{label:'レンジャー',skill:'狩人の刃',cost:20,damage:19,cooldown:1,windup:0.54,guardBreak:0},
};


/** Profession-specific command recipes. UI and combat consume these values; no role branching in markup. */
export const JOB_COMMANDS=Object.freeze({
 swordsman:{skills:['斬撃','二連斬','剣閃','烈空斬','剣聖奥義'],support:'気合',supportKind:'stamina'},
 knight:{skills:['盾撃','シールドバッシュ','鉄壁突破','騎士の突進','不落の城壁'],support:'鉄壁',supportKind:'guard'},
 rogue:{skills:['迅速斬り','背面刺突','連続短剣','影縫い','幻影連斬'],support:'身かわし',supportKind:'stamina'},
 monk:{skills:['剛拳','三段拳','気功掌','烈風脚','百烈拳'],support:'気功',supportKind:'stamina'},
 merchant:{skills:['銭投げ','商人の目利き','黄金投擲','大盤振舞','黄金嵐'],support:'商才',supportKind:'stamina'},
 traveler:{skills:['旅路斬り','疾風の一撃','放浪連撃','旅人の覚悟','流星斬'],support:'休息',supportKind:'heal'},
 smith:{skills:['鉄槌','重撃','鎧砕き','鍛造打ち','巨神鉄槌'],support:'堅守',supportKind:'guard'},
 chef:{skills:['包丁連撃','刻み斬り','料理人の乱舞','千切り','極上の一太刀'],support:'まかない',supportKind:'heal'},
 herbalist:{skills:['薬刃','毒刃','薬液散布','秘薬投擲','霊薬乱舞'],support:'調合回復',supportKind:'heal'},
 bard:{skills:['音撃','不協和音','共鳴衝撃','戦場の旋律','英雄讃歌'],support:'癒しの歌',supportKind:'heal'},
 farmer:{skills:['大鎌払い','草刈り旋風','刈り取り','大地の一撃','豊穣の嵐'],support:'踏ん張り',supportKind:'guard'},
 scholar:{skills:['魔導書撃','魔術詠唱','知識の刃','秘術解放','禁書奥義'],support:'瞑想',supportKind:'stamina'},
 innkeeper:{skills:['護身打ち','お盆叩き','連続護身術','用心棒の一撃','宿守の鉄槌'],support:'応急手当',supportKind:'heal'},
 priest:{skills:['聖なる打撃','聖光','浄化の波動','審判の光','神聖なる裁き'],support:'祈り',supportKind:'heal'},
 mage:{skills:['魔力打撃','炎弾','氷晶衝撃','雷撃','大魔導'],support:'魔力集中',supportKind:'stamina'},
 archer:{skills:['短弓打ち','早撃ち','貫通矢','三連射','流星雨'],support:'狙いを定める',supportKind:'stamina'},
 paladin:{skills:['聖盾撃','聖なる突進','光盾砕き','聖剣連撃','天罰の剣'],support:'聖なる加護',supportKind:'guard'},
 assassin:{skills:['急所斬り','影刺し','毒刃連撃','暗影乱舞','絶命刃'],support:'隠密',supportKind:'stamina'},
 samurai:{skills:['居合斬り','逆袈裟','燕返し','飛天居合','無双一閃'],support:'残心',supportKind:'guard'},
 ranger:{skills:['狩人の刃','追跡射撃','二連矢','罠撃ち','狩猟奥義'],support:'野営術',supportKind:'heal'}
});

export const WEAPON_CATALOG=[
 {id:'wood',name:'木剣',power:0,price:0},{id:'iron',name:'鉄の剣',power:5,price:120},
 {id:'steel',name:'鋼の武器',power:11,price:350},{id:'silver',name:'銀の武器',power:19,price:850},
 {id:'mythril',name:'ミスリル武器',power:30,price:1800}
];

export const ARMOR_CATALOG=[
 {id:'cloth',name:'布の服',defense:0,price:0},{id:'leather',name:'革の鎧',defense:2,price:100},
 {id:'chain',name:'鎖かたびら',defense:4,price:300},{id:'plate',name:'鋼の鎧',defense:7,price:700},
 {id:'guardian',name:'守護の鎧',defense:11,price:1700}
];

export const MODEL_FOOTPRINTS={bed_double_A:[4.2,3.6],bed_single_A:[3.9,3.3],table_low:[3.5,3.4],chair_A_wood:[1.8,1.8],shelf_A_big:[3.2,3.1],cabinet_medium:[3.2,3.1],lamp_standing:[1.5,1.5],armchair:[3.1,3]};

export const NPC_INFO=[[-5,-13,'商人ミラ','いらっしゃい！ 水晶街道へようこそ。'],[5.6,-14,'旅人レオン','北の街道には古代遺跡があるらしいよ。'],[-5,-36,'町の住人','レヴナは旅人の集まる町だよ。']];

export const TOWN_BUILDING_KINDS=['home','home','weapons','armor','old','items','artisan','scholar','inn','merchant','church','manor'];
