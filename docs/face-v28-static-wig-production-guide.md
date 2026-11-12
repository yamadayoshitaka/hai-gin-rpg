# 顔モデル v28：静的ヘアカード式ウィッグ・目・肩穴の制作指針

## 参考にした公式制作資料

- [Blender Generate Hair Curves](https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/hair/generation/generate_hair_curves.html)：頭皮の実メッシュ表面に毛根を配置し、ヘアガイドを定義する。
- [Blender Interpolate Hair Curves](https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/hair/generation/interpolate_hair_curves.html)：少数のガイドを補間して見た目の毛量を増やす。毛の基礎ガイドを全本リアルタイム物理シミュレーションする必要はない。
- [Blender Set Hair Curve Profile](https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/hair/write/set_hair_curve_profile.html)：根元から毛先への太さの変化と先細りを設計する。
- [Unity Hair Shader / Hair Cards](https://docs.unity3d.com/ja/Packages/com.unity.render-pipelines.high-definition%4010.5/manual/hair-shader.html)：ゲーム用ヘアカードを重ねた描画、透過の並びに起因する表示問題。参考は制作方式でありWebGLのHDRPシェーダーを導入するものではない。
- [three.js BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html)：頂点・インデックス・法線を明示し、静的メッシュとしてレンダリングする。

## 実装ルール

1. **独立着脱ウィッグ**。キャラ本体の実頭部と同形の透明土台を別アセット内に保持し、顔・胴体の原GLBは変更しない。
2. 毛根は頭皮の高い位置に置き、額・眉間・頬から毛を出さない。前髪・側頭部・後頭部のガイドを分離する。
3. 静的な帯状ヘアカード（アルファ透過なし、DoubleSide）。根元は細く、中間は幅を保ち、先端を細くする。細い補助毛は静的メッシュで増やす。
4. **髪の重力・バネ・風・フレームごとの衝突・フレームごとの法線更新を停止**。頭皮/体との位置合わせはウィッグ生成時だけ実行する。旋回・ズームではメッシュを動かさない。
5. 密度は1倍/3倍/10倍を選択でき、スマホでは3倍で起動する。10倍は見た目確認用である。
6. 頭頂部の四角いブロックは幅広すぎる根元カードと太い頭頂毛束を抑えて改善する。透明土台自体は描画に寄与しない。
7. 眼球は従来の独立球体を使わず、顔面に沿うアーモンド面。虹彩はまぶたに収まる **真円** で生成し、縦方向に潰す clamp を使わない。
8. 肩の開口部は首の接続とは別物。胴体実メッシュの切断面の左右の輪郭にそれぞれキャップを作り、中心の首接続を遮らない。

## 確認方法

スマホの face-body-studio.html で正面・横顔・頭頂・後頭部を検査。
「髪だけ表示」で頭皮/本体の非表示後もウィッグが見えること、密度変更後のGLB保存、
カラコンが横線に潰れず真円に見えること、肩の穴が埋まっていることを目視確認する。

QA成功は外観完成を意味しない。原画に近い自然な造形かは実機確認後に判定する。
