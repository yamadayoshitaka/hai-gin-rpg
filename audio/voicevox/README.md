# 自然な戦闘ボイス（無料 / VOICEVOX）

ゲームでは録音済みの VOICEVOX 音声クリップを優先し、未収録のセリフは端末の日本語テキスト読み上げに戻します。

- 有料音声生成 API は使いません。
- 公開リポジトリのGitHub Actions標準ランナーで音声を合成し、圧縮MP3を audio/voicevox/clips に保存します。
- AIが新しく作ったセリフは端末内に最大10件保存します。未収録セリフは端末の読み上げで再生します。新規セリフの高品質化には追加の音声バッチ生成が必要です。

## クレジット（ゲーム内にも表示）

- VOICEVOX:玄野武宏
- VOICEVOX:四国めたん

VOICEVOXソフトウェアの規約と各キャラクター音声ライブラリの個別規約を遵守してください。

参照
- https://voicevox.hiroshiba.jp/term/
- https://www.virvoxproject.com/voicevoxの利用規約
- https://zunko.jp/con_ongen_kiyaku.html

## 更新

scripts/build-voicevox-clip-bank.mjs は公式VOICEVOX Engine（ローカルHTTP API）で音声を生成します。
GitHub Actionsの Free Natural Battle Voices で手動再生成できます。
既存クリップは二重生成しません。

## 制限

エンジンの音質は声優本人の収録と同じとは限りません。音声生成に失敗しても標準読み上げでゲームは継続します。
