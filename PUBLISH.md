# GitHub Pagesでの公開と確認

- プレイURL：https://anemia111.github.io/life-simulator/
- ソース：https://github.com/anemia111/life-simulator
- テスト・デプロイ：https://github.com/anemia111/life-simulator/actions
- ワークフロー：.github/workflows/pages.yml

mainへpushすると、npm ci、Vitest、Chromium主要操作、型チェックを含む本番ビルドを実行し、すべて通った成果物をPagesへ公開する。コードをpushしただけで公開完了と扱わず、該当コミットのdeploy成功を確認する。Viteは相対アセットパス。画面左下にv0.6、フッターにPHASE 5が表示される版がこのリリース。

公開の確認は新しいブラウザコンテキストで行う。開始→求人応募→時間進行→人生目標→年表→交流→共同資金→JSON保存を確認し、PC/320pxで文書全体の横はみ出し、コンソール例外、アセットの失敗を調べる。ローカルの操作試験と公開配信の確認を区別する。

## 既存ブラウザの古い表示

以前、正しいURLでも既存Chrome/IABが別アプリの古い画面を表示し、新しい隔離ChromiumではLife Simulatorが表示された。既存プロファイルのキャッシュ/Service Worker状態が原因と考えられるが、このリポジトリの配信確認だけで既存プロファイルの解消を確認したことにはしない。

古い画面が出る場合は、まずプライベートウィンドウで上のURLと左下の版を確認する。サイトデータの削除はIndexedDBの人生セーブも消す可能性があるため、保存済み人生を残したい場合に無差別なデータ削除を行わない。通常版が操作できる環境ではJSONをバックアップできる。既存ブラウザのデータを自動削除したり、他アプリのService Workerを解除する処理は実装していない。
