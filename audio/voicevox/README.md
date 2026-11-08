# 自然な戦闘ボイス（無料・商用利用の条件を確認済みの候補）

本作の音声ファイルは、無料の VOICEVOX Engine を公開 GitHub リポジトリの標準 GitHub Actions ランナーで実行して生成します。ゲーム再生時に有料音声APIを呼び出しません。

## 利用する声の種類

- 男性系8種: 玄野武宏、白上虎太郎、剣崎雌雄、雀松朱司、麒ヶ島宗麟、ちび式じい、†聖騎士 紅桜†、栗田まろん
- 女性・中性系15種: 四国めたん、波音リツ、冥鳴ひまり、九州そら、春日部つむぎ、雨晴はう、WhiteCUL、櫻歌ミコ、小夜/SAYO、猫使アル、猫使ビィ、中国うさぎ、春歌ナナ、ナースロボ＿タイプＴ、ずんだもん

ゲーム内の収録クレジットは audio/voicevox/manifest.json の credits に保存し、ゲームメニューから表示します。VOICEVOXの利用規約と各キャラクターの個別規約に従い、音声の利用元を分かる形で掲示してください。

商用ゲーム配布に個別の許可や別契約が必要な音源（No.7、もち子さん、後鬼、ぞん子等）は自動収録から除外しています。既存の声についても権利者の規約変更は再確認が必要です。

- VOICEVOX公式: https://voicevox.hiroshiba.jp/term/
- 公式音声ライブラリ規約一覧: https://github.com/VOICEVOX/voicevox_vvm/blob/main/README.md

## 自動収録

scripts/build-voicevox-clip-bank.mjs は「ジョブ×状況×台詞×声優タイプ」でWAVを生成します。自動生成は1回のGitHub Actionsで最大440件、保存後は音声生成APIを使わず再生します。初期AI台詞以外の未収録文は端末内の無料TTSにフォールバックします。

ジョブごとに男女各4種類の声が選択でき、個別の兵士IDに基づき戦闘中の声質が一貫する設計です。

GitHub Actions: .github/workflows/free-natural-voices.yml
音声テスト: battle-voice-test.html
