/**
 * First-play guide shown before the new-game character setup.
 * Gameplay tips are progressive; do not dump chapter lore before the player
 * meets Lucia. Can be replayed from the title without changing save data.
 */
export const FIRST_PLAY_GUIDE=Object.freeze([
 Object.freeze({id:'world',number:'01',title:'この世界について',eyebrow:'物語の入口',
  icon:'✦',body:'三つの国が、長い戦争を続けている世界。\nあなたは灰銀の国に招かれた、新任の軍師です。',
  tip:'難しい歴史や人物名は、旅のなかで少しずつ分かります。'}),
 Object.freeze({id:'objective',number:'02',title:'あなたの役目',eyebrow:'軍師として',
  icon:'♜',body:'戦う相手も、守る人も、あなたの判断で変わります。\nはじめは町で仲間に会い、王城からの依頼を聞きましょう。',
  tip:'最初からすべての作戦を覚える必要はありません。'}),
 Object.freeze({id:'town',number:'03',title:'町での移動と探索',eyebrow:'基本操作',
  icon:'⌖',body:'画面の移動スティックで歩き、視点を動かして周囲を見渡します。\n建物や住民に近づくと、会話・探索ができます。',
  tip:'困ったら町の地図を開き、行きたい施設を選びます。'}),
 Object.freeze({id:'party',number:'04',title:'部隊を編成する',eyebrow:'戦いの準備',
  icon:'⚔',body:'軍師に兵士を割り当てて部隊を作ります。\n支援・攻撃・バランスなど、得意な役割を組み合わせましょう。',
  tip:'初めはオート編成を使っても大丈夫です。'}),
 Object.freeze({id:'battle',number:'05',title:'出撃と号令',eyebrow:'物語から戦場へ',
  icon:'⚑',body:'ワールドマップで次のステージを選ぶと、物語を見てから出撃します。\n戦闘は自動で進み、必要な時だけ軍師が号令を出せます。',
  tip:'最初の目的は勝つことより、物語と操作に慣れることです。'})
]);
