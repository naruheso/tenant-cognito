# Quick Start Guide

このガイドでは、最小限のステップでマルチテナント認証システムを起動する方法を説明します。

## 🚀 クイックスタート (5分)

### 1. セットアップ

```bash
# リポジトリをクローン（既にクローンされている場合はスキップ）
git clone https://github.com/naruheso/tenant-cognito.git
cd tenant-cognito

# 依存関係をインストール
./setup.sh
```

### 2. システムの起動

#### オプションA: 完全なローカル環境（推奨）

```bash
# ターミナル1: バックエンド
cd packages/backend
npm run dev

# ターミナル2: フロントエンド  
cd packages/frontend
npm run dev
```

フロントエンドが http://localhost:3000 で起動します。

#### オプションB: すべて一度に起動

```bash
npm run dev
```

**注意**: cognito-localを使用するには、別途User Poolの設定が必要です（ステップ3参照）。

### 3. Cognito User Poolの設定（オプション）

実際のCognito機能を使用する場合：

```bash
# Dockerでcognito-localを起動
docker-compose up -d

# User PoolとUser Clientを作成
./scripts/setup-cognito.sh

# スクリプトの出力からUser Pool IDとClient IDをコピー
# packages/frontend/src/App.vue を更新
```

## 🧪 テスト方法

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
