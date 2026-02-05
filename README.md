# tenant-cognito

マルチテナント認証検証環境 / Multi-Tenant Authentication Verification Environment

Vue(TS) + Hono(TS) + ローカルCognitoエミュレータを使用した、マルチテナント認証の検証環境です。

## 🎯 核心要件 / Core Requirements

Post Authentication Lambdaトリガーを実装し、ログイン直後に以下を実行します：

1. **テナント検証**: アクセス元のサブドメイン（会社）にユーザーが所属しているかDBと照合し、不一致なら認証を拒否
2. **クレーム注入**: 検証成功時、IDトークンに `custom:tenant_id` を追加

これにより、バックエンドがトークンのみでテナントを識別・分離できるアーキテクチャを実装しています。

## 🏗️ アーキテクチャ / Architecture

```
┌─────────────┐
│   Vue (TS)  │  Frontend - テナント選択とCognito認証
│   Frontend  │
└──────┬──────┘
       │
       ├─ Login with tenant_id (clientMetadata)
       │
       ▼
┌─────────────────────────┐
│  Cognito Local Emulator │
│  ┌───────────────────┐  │
│  │ Post Auth Lambda  │  │  1. テナント検証
│  │   Trigger         │  │  2. クレーム注入 (custom:tenant_id)
│  └───────────────────┘  │
└───────────┬─────────────┘
            │
            ├─ ID Token with custom:tenant_id
            │
            ▼
┌─────────────────────────┐
│     Hono (TS) API       │  JWT検証とテナント分離
│     Backend             │
└─────────────────────────┘
```

## 📦 プロジェクト構成 / Project Structure

```
tenant-cognito/
├── packages/
│   ├── frontend/          # Vue 3 + TypeScript フロントエンド
│   ├── backend/           # Hono + TypeScript バックエンドAPI
│   ├── lambda/            # Post Authentication Lambda トリガー
│   └── cognito-local/     # Cognito ローカルエミュレータ設定
├── docker-compose.yml     # Cognito エミュレータのDocker設定
└── package.json           # ルートパッケージ（ワークスペース管理）
```

## 🚀 セットアップ / Setup

### 前提条件 / Prerequisites

- Node.js 18+ 
- npm 9+
- Docker & Docker Compose (オプション)

### インストール / Installation

```bash
# 依存関係のインストール
npm install

# 各パッケージの依存関係をインストール
npm install --workspaces
```

### Lambda関数のビルド / Build Lambda Functions

```bash
cd packages/lambda
npm run build
```

## 🎮 実行方法 / How to Run

> ⚠️ **重要**: ログイン機能を使用するには、まず Cognito User Pool の設定が必要です。
> 下記の「🧪 テスト方法」セクションを先に実行してください。
> 
> ❌ User Pool未設定の場合、"Invalid password" エラーが発生します。
> ✅ 詳しくは [TROUBLESHOOTING.md](TROUBLESHOOTING.md) をご覧ください。

### ステップ1: Cognito User Poolのセットアップ（初回のみ必須）

```bash
# 1. Dockerでcognito-localを起動
docker-compose up -d

# 2. User Poolとテストユーザーを作成
./scripts/setup-cognito.sh

# 3. 出力されたUser Pool IDとClient IDをコピー
# 例: UserPoolId: 'local_abc123xyz'
#     ClientId: 'local_def456uvw'

# 4. packages/frontend/src/App.vueを編集し、IDを更新
# 148-154行目付近の設定を更新してください
```

### ステップ2: サービスの起動

#### オプションA: 個別起動（推奨・デバッグしやすい）

```bash
# ターミナル1: バックエンド
cd packages/backend
npm run dev

# ターミナル2: フロントエンド
cd packages/frontend
npm run dev
```

#### オプションB: 一括起動

```bash
# すべてのサービスを起動（Cognito emulator, Backend, Frontend）
npm run dev
```

起動後のアクセスポイント：
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Cognito Local: http://localhost:9229

## 🧪 テスト方法 / How to Test

### ⚠️ 必須: Cognito User Poolの初期設定

**ログイン機能を使用する前に、必ずこの設定を完了してください。**

#### オプションA: 自動セットアップスクリプトを使用（推奨）

**前提条件**: Dockerでcognito-localが起動していること、AWS CLIがインストールされていること

```bash
# cognito-localをDockerで起動
docker-compose up -d

# 自動セットアップスクリプトを実行
./scripts/setup-cognito.sh

# スクリプトが出力するUser Pool IDとClient IDを
# packages/frontend/src/App.vue に設定してください
```

#### オプションB: 手動でUser Poolを作成

```bash
# AWS CLIをローカルCognitoエミュレータに向ける
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

# User Pool作成
aws cognito-idp create-user-pool \
  --pool-name TestPool \
  --endpoint-url http://localhost:9229 \
  --region local

# User Pool Client作成
aws cognito-idp create-user-pool-client \
  --user-pool-id <YOUR_POOL_ID> \
  --client-name TestClient \
  --endpoint-url http://localhost:9229 \
  --region local
```

### 2. テストユーザーの作成

各テナント用のテストユーザーを作成します：

```bash
# Company Aのユーザー
aws cognito-idp admin-create-user \
  --user-pool-id <YOUR_POOL_ID> \
  --username user1@example.com \
  --user-attributes Name=email,Value=user1@example.com Name=email_verified,Value=true \
  --endpoint-url http://localhost:9229 \
  --region local

aws cognito-idp admin-set-user-password \
  --user-pool-id <YOUR_POOL_ID> \
  --username user1@example.com \
  --password Password123! \
  --permanent \
  --endpoint-url http://localhost:9229 \
  --region local
```

### 3. UIでのテスト

1. ブラウザで http://localhost:3000 を開く
2. テナントを選択（Company A, B, または C）
3. テストユーザーでログイン：
   - **Company A**: user1@example.com / admin@company-a.com
   - **Company B**: user2@example.com / admin@company-b.com
   - **Company C**: user3@example.com / admin@company-c.com
   - パスワード: `Password123!`

### 4. テナント分離の検証

異なるテナントのユーザーでログインを試みることで、Post Authentication Lambdaの動作を確認できます：

✅ **成功ケース**: Company Aのユーザーが Company Aを選択してログイン
❌ **失敗ケース**: Company Aのユーザーが Company Bを選択してログイン（認証拒否）

## 🔑 Post Authentication Lambda の動作

`packages/lambda/src/post-authentication.ts`

### 1. テナント検証

```typescript
// クライアントメタデータからテナントIDを取得
const tenantId = event.request.clientMetadata?.tenant_id;

// データベースでテナントとユーザーの関係を確認
const tenant = tenantDatabase[tenantId];
const userBelongsToTenant = tenant.users.includes(userEmail);

// ユーザーがテナントに所属していない場合、エラーをthrowして認証を拒否
if (!userBelongsToTenant) {
  throw new Error(`User ${userEmail} is not authorized for tenant ${tenantId}`);
}
```

### 2. クレーム注入

```typescript
// IDトークンにカスタムクレームを追加
event.response.claimsOverrideDetails = {
  claimsToAddOrOverride: {
    'custom:tenant_id': tenantId
  }
};
```

### 3. バックエンドでの利用

バックエンド（Hono）はJWTトークンから `custom:tenant_id` を読み取り、テナントを識別します：

```typescript
const decoded = jwt.decode(token);
const tenantId = decoded['custom:tenant_id'];
// テナント固有のデータアクセス
```

## 🔒 セキュリティ機能

- ✅ JWT署名検証（本番環境ではCognitoの公開鍵を使用）
- ✅ テナント分離（DBレベルでの検証）
- ✅ 認証拒否メカニズム（Lambda trigger内）
- ✅ CORS設定（サブドメイン対応）

## 📝 テナントデータベース

現在は開発用のインメモリデータベースを使用しています：

```typescript
const tenantDatabase = {
  'company-a': {
    users: ['user1@example.com', 'admin@company-a.com']
  },
  'company-b': {
    users: ['user2@example.com', 'admin@company-b.com']
  },
  'company-c': {
    users: ['user3@example.com', 'admin@company-c.com']
  }
};
```

本番環境では、DynamoDB、RDS、またはその他のデータベースを使用してください。

## 🛠️ 技術スタック

- **Frontend**: Vue 3, TypeScript, Vite, Amazon Cognito Identity JS
- **Backend**: Hono, TypeScript, Node.js
- **Auth**: Cognito Local Emulator, Lambda Triggers
- **Dev Tools**: tsx, vite, concurrently

## 📚 参考資料 / References

- [Amazon Cognito Post Authentication Lambda Trigger](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-authentication.html)
- [Hono Documentation](https://hono.dev/)
- [Vue 3 Documentation](https://vuejs.org/)
- [Cognito Local](https://github.com/jagregory/cognito-local)

## 🤝 貢献 / Contributing

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## 📄 ライセンス / License

MIT
