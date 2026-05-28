# CSI Score

6因子版CSIスコアの入力・集計用Streamlitアプリです。
Collaborationの10段階評価項目はN/Aとして記録し、ペア比較ではCollaborationも含めて15問を評価します。

## セットアップ

```powershell
uv sync
uv run streamlit run app.py
```

## 初期設定

研究者画面の簡易パスコードは環境変数 `CSI_ADMIN_PASSCODE` で変更できます。
未設定の場合は `csi-admin` です。

```powershell
$env:CSI_ADMIN_PASSCODE = "任意のパスコード"
uv run streamlit run app.py
```

回答データは `data/csi.sqlite3` に保存されます。
