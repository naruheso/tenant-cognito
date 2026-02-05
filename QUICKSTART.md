# Quick Start Guide

このガイドでは、最小限のステップでマルチテナント認証システムを起動する方法を説明します。

> ⚠️ **"Invalid password" エラーが出る場合**
> 
> Cognito User Poolの設定が必要です。下記のステップを順番に実行してください。
> 詳細なトラブルシューティングは [TROUBLESHOOTING.md](TROUBLESHOOTING.md) を参照。

## 🚀 クイックスタート (10分)

### 1. セットアップ

```bash
# リポジトリをクローン（既にクローンされている場合はスキップ）
git clone https://github.com/naruheso/tenant-cognito.git
cd tenant-cognito

# 依存関係をインストール
./setup.sh
```

### 2. Cognito User Poolの作成（⚠️ 必須）

**ログイン機能を使用するには、このステップが必須です。**

```bash
# 1. Dockerでcognito-localを起動
docker-compose up -d

# 2. 数秒待つ（エミュレーターの起動を待つ）
sleep 5

# 3. User Poolとテストユーザーを作成
./scripts/setup-cognito.sh
```

スクリプトの出力例：
```
✅ User Pool created: local_abc123xyz
✅ Client created: local_def456uvw

Update packages/frontend/src/App.vue with these IDs:
  UserPoolId: 'local_abc123xyz'
  ClientId: 'local_def456uvw'
```

### 3. フロントエンドの設定を更新（⚠️ 必須）

上記で出力されたIDを使用して、フロントエンドの設定を更新します。

```bash
# エディタでファイルを開く
nano packages/frontend/src/App.vue
# または
code packages/frontend/src/App.vue
```

148-154行目付近を編集：

```typescript
// 変更前
const poolData = {
  UserPoolId: 'local_xxxxxxxx',  // Replace with actual User Pool ID
  ClientId: 'local_yyyyyyyy'     // Replace with actual Client ID
};

// 変更後（setup-cognito.shの出力から取得したIDを使用）
const poolData = {
  UserPoolId: 'local_abc123xyz',  // ← ここを実際のIDに変更
  ClientId: 'local_def456uvw'     // ← ここを実際のIDに変更
};
```

ファイルを保存してください。

### 4. システムの起動### 4. システムの起動

#### オプションA: 個別起動（推奨）

```bash
# ターミナル1: バックエンド
cd packages/backend
npm run dev

# ターミナル2: フロントエンド  
cd packages/frontend
npm run dev
```

フロントエンドが http://localhost:3000 で起動します。

#### オプションB: 一括起動

```bash
npm run dev
```

これで以下が起動します：
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Cognito Local: http://localhost:9229 (既に起動済み)

### 5. ログインをテスト

1. ブラウザで http://localhost:3000 を開く
2. テナントを選択（例: Company A）
3. ログイン情報を入力：
   - メール: `user1@example.com`
   - パスワード: `Password123!`
4. 「ログイン / Login」ボタンをクリック

✅ 成功すると、ユーザー情報とIDトークン（custom:tenant_id付き）が表示されます！

---

## ❌ "Invalid password" エラーが出る場合

このエラーは、Cognito User Poolが正しく設定されていないことを示しています。

### チェックリスト

1. ✅ Docker Desktopが起動していますか？
   ```bash
   docker ps
   ```

2. ✅ cognito-localが起動していますか？
   ```bash
   curl http://localhost:9229
   ```

3. ✅ setup-cognito.shを実行しましたか？
   ```bash
   ./scripts/setup-cognito.sh
   ```

4. ✅ packages/frontend/src/App.vueのUser Pool IDとClient IDを更新しましたか？
   - 148-154行目を確認
   - プレースホルダー(`local_xxxxxxxx`)のままになっていませんか？

5. ✅ フロントエンドを再起動しましたか？
   - ファイルを編集した後、npm run devを再実行

### 詳しいトラブルシューティング

問題が解決しない場合は、[TROUBLESHOOTING.md](TROUBLESHOOTING.md) を参照してください。

完全なステップバイステップの手順と、よくある問題の解決方法が記載されています。

---

## 🧪 テスト方法 (セットアップ完了後)

### 1. バックエンドAPIのテスト

```bash
# ヘルスチェック
curl http://localhost:3001/health

# テナント一覧
curl http://localhost:3001/api/tenants

# テナント検証（正常）
curl -X POST http://localhost:3001/api/verify-tenant-user \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"company-a","email":"user1@example.com"}'

# テナント検証（エラー）
curl -X POST http://localhost:3001/api/verify-tenant-user \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"company-b","email":"user1@example.com"}'
```

### 2. フロントエンドのテスト

ブラウザで http://localhost:3000 を開きます。

#### テストシナリオ1: 正常なログイン ✅

1. テナント: **Company A** を選択
2. ログイン情報:
   - メール: `user1@example.com`
   - パスワード: `Password123!`
3. 結果: ログイン成功、IDトークンに `custom:tenant_id: "company-a"` が含まれる

#### テストシナリオ2: テナント分離の検証 ❌

1. テナント: **Company B** を選択
2. ログイン情報:
   - メール: `user1@example.com` (Company Aのユーザー)
   - パスワード: `Password123!`
3. 結果: Post Authentication Lambdaがエラーを返し、認証が拒否される

### 3. Post Authentication Lambdaの動作確認

Lambda関数のログを確認するには：

```bash
# cognito-localのログを確認
docker-compose logs -f cognito-local
```

成功時のログ例：
```
Verifying user user1@example.com for tenant company-a
✓ User user1@example.com verified for tenant company-a
✓ Added custom:tenant_id claim to token
```

失敗時のログ例：
```
Verifying user user1@example.com for tenant company-b
User user1@example.com does not belong to tenant company-b
Authentication failed
```

## 📊 システムの状態確認

```bash
./scripts/test-system.sh
```

このスクリプトは以下をチェックします：
- ✅ バックエンドのヘルスチェック
- ✅ テナントデータベースの設定
- ✅ テナント検証機能
- ✅ テナント分離機能
- ✅ フロントエンドのアクセス可能性

## 🎯 デモユーザー

### Company A
- `user1@example.com` / `Password123!`
- `admin@company-a.com` / `Password123!`

### Company B
- `user2@example.com` / `Password123!`
- `admin@company-b.com` / `Password123!`

### Company C
- `user3@example.com` / `Password123!`
- `admin@company-c.com` / `Password123!`

## 🔍 主要コンポーネント

### 1. Post Authentication Lambda
- **場所**: `packages/lambda/src/post-authentication.ts`
- **機能**: テナント検証とクレーム注入
- **テスト**: Lambdaのビルド成功を確認

```bash
cd packages/lambda
npm run build
ls -l dist/post-authentication.js  # ビルド成果物を確認
```

### 2. Backend API (Hono)
- **場所**: `packages/backend/src/index.ts`
- **ポート**: 3001
- **エンドポイント**:
  - `GET /health` - ヘルスチェック
  - `GET /api/tenants` - テナント一覧
  - `POST /api/verify-tenant-user` - テナント検証
  - `GET /api/user/profile` - ユーザープロファイル（要認証）
  - `GET /api/tenant/data` - テナント固有データ（要認証）

### 3. Frontend (Vue)
- **場所**: `packages/frontend/src/App.vue`
- **ポート**: 3000
- **機能**:
  - テナント選択
  - Cognito認証
  - トークン表示
  - API呼び出しデモ

## 🐛 トラブルシューティング

### ポートが既に使用されている

```bash
# ポート3000が使用中
lsof -ti:3000 | xargs kill -9

# ポート3001が使用中
lsof -ti:3001 | xargs kill -9

# ポート9229が使用中（cognito-local）
lsof -ti:9229 | xargs kill -9
```

### Lambda関数がビルドできない

```bash
cd packages/lambda
rm -rf node_modules dist
npm install
npm run build
```

### フロントエンドがCognitoに接続できない

`packages/frontend/src/App.vue` でUser Pool IDとClient IDが正しく設定されているか確認してください：

```typescript
const poolData = {
  UserPoolId: 'local_xxxxxxxx',  // 実際のIDに置き換え
  ClientId: 'local_yyyyyyyy'     // 実際のIDに置き換え
};
```

## 📚 詳細ドキュメント

- [README.md](README.md) - 詳細なセットアップガイド
- [ARCHITECTURE.md](ARCHITECTURE.md) - システムアーキテクチャと認証フロー

## 🎉 次のステップ

1. ブラウザで http://localhost:3000 を開く
2. 異なるテナントとユーザーの組み合わせでログインを試す
3. IDトークンの `custom:tenant_id` クレームを確認
4. 保護されたAPI（テナントデータ取得）を呼び出す
5. システムログでテナント検証の動作を確認

楽しんでください！🚀
