# CSI Score

6因子版CSIスコアの入力・集計用ローカルWebアプリです。
Collaborationの10段階評価項目はN/Aとして記録し、ペア比較ではCollaborationも含めて15問を評価します。

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 初期設定

研究者画面の簡易パスコードは環境変数 `CSI_ADMIN_PASSCODE` で変更できます。
未設定の場合は `csi-admin` です。

```bash
CSI_ADMIN_PASSCODE="任意のパスコード" npm run dev
```

回答データは `data/csi.sqlite3` に保存されます。

## テスト

```bash
npm test
npm run build
```
