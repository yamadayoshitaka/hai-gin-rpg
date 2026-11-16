/**
 * Two hundred chapter-aware scene scripts. The first ten scenes belong to
 * the original mainland; later chapters travel to independent continents.
 * This remains linear story narration, not a misleading claim of branching.
 */
import {STORY_CHAPTERS} from './story-chapters.js';
import {continentForChapter} from './continent-campaign.js';
const phaseLines=Object.freeze([
 ['港に着いた軍師は、その土地で戦争よりも古い悲しみを聞く。','国の命令より、目の前の人間の証言を先に確かめることになった。'],
 ['偵察兵は見知らぬ墓標を発見する。名前が削られているのは、石が風化したからではない。','人々は同じ出来事を少しずつ異なる言葉で語り、軍師は証言を照合する。'],
 ['護送団が国境を越えようとしている。積荷の中には記録院の紋章を隠した箱があった。','補給路を奪うだけでは真実は残らない。護衛も運び手も生きたまま話を聞く必要がある。'],
 ['古い遺構に、地図から削除された道がある。そこを通れば戦を短くできる。','しかし、その道は住民の墓と畑を横切っていた。近道には誰かの生活の重さがある。'],
 ['戦火から逃れてきた人々が、味方の旗を見て立ち止まる。旗だけでは安全を約束できない。','軍師は目的の達成と避難路の確保を同時に求められた。'],
 ['夜明け前、鍵のかかった記録庫へ斥候が入る。忍者とシーフがそれぞれ別の入口を調べる。','帳簿には敵味方の区別なく、取り戻されていない名前が刻まれていた。'],
 ['敵将にも故郷があり、兵にも家族がいる。勝利の数を増やすことが戦争の終わりではない。','軍議では、死者を弔う時間を奪ってまで進軍すべきか意見が割れた。'],
 ['証拠は揃い始めたが、国の上層部は公表を拒む。真実には政権を揺るがす力があった。','誰を守るために沈黙するのか。問いに答えないままでは次の国へ渡れない。'],
 ['最終防衛線の向こうには、国境を越えて積み重なった記録が眠る。','軍師は兵を集め、城壁の内側にいる人々の退路まで計画に書き加えた。'],
 ['決戦の鐘が鳴る。これまで選んだ戦い方と救えなかった声が、軍師をここまで導いた。','勝つことは結末ではない。次の土地で何を語り継ぐかが、残された者の責任となる。']
]);
const kindLead=Object.freeze({
 town:'拠点で軍を整え、店主や村人の話から土地の事情を知る。',
 explore:'魔物の出現にも土地の異変にも、誰かが隠した理由がある。',
 capture:'旗を奪うだけでなく、占領された土地に暮らす人々を守る。',
 defend:'防衛線の後ろには避難できない民がいる。退路を絶ってはならない。',
 siege:'城壁の向こうの敵将も、勝者の記録から消されるかもしれない。',
 boss:'軍師は戦の結果と、その後の歴史に対して責任を負う。'
});
export function narrativeForStage(stage){
 if(!stage||!Number.isInteger(Number(stage.chapter))||!Number.isInteger(Number(stage.slot)))
  throw Error('章と場面を指定してください。');
 const chapter=STORY_CHAPTERS[Number(stage.chapter)-1];
 if(!chapter)throw Error('章がありません。');
 const continent=continentForChapter(chapter.id),slot=Math.max(1,Math.min(10,Number(stage.slot)));
 const [scene,consequence]=phaseLines[slot-1],dialogue=chapter.dialogues[(slot-1)%chapter.dialogues.length];
 const intro=slot===1?chapter.synopsis:slot===10?chapter.narration:chapter.objective;
 const title='第'+chapter.id+'章・第'+slot+'幕「'+(stage.name||chapter.title)+'」';
 const narration=title+'。舞台は'+continent.name+'。'+intro+'。'+
  (kindLead[stage.kind]||'')+scene+consequence+
  ' '+dialogue.speaker+'は言う。「'+dialogue.line+'」'+
  'その決断の先には、'+continent.conflict;
 return Object.freeze({title,chapter:chapter.id,slot,continent:continent.name,
  premise:continent.arc,conflict:continent.conflict,scene,consequence,
  speaker:dialogue.speaker,line:dialogue.line,narration});
}
