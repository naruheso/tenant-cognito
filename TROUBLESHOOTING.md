# トラブルシューティング / Troubleshooting

## ❌ "Invalid password" エラー

### 問題
ログインしようとすると "Invalid password" エラーが表示される。

### 原因

このエラーは通常、以下のいずれかが原因です：

1. **Cognito User Poolが未設定** - ユーザーがまだ作成されていない
2. **フロントエンドの設定が不完全** - User Pool IDとClient IDがプレースホルダーのまま
3. **cognito-localが起動していない** - エミュレーターが実行されていない

### 解決方法

#### ステップ1: cognito-localが起動しているか確認

```bash
# Dockerで起動する場合
docker-compose up -d

# ログを確認
docker-compose logs cognito-local

# 起動確認（以下のコマンドでエラーが出なければOK）
curl http://localhost:9229
```

#### ステップ2: User PoolとユーザーをセットアップCognito User Poolの設定

**前提条件**:
- Docker Desktopがインストールされ、起動している
- AWS CLIがインストールされている（`aws --version`で確認）
- jqコマンドがインストールされている（`jq --version`で確認）

macOS/Linuxの場合：
```bash
# AWS CLIのインストール
brew install awscli

# jqのインストール
brew install jq
```

Windowsの場合：
```bash
# AWS CLIはインストーラーからダウンロード
# https://aws.amazon.com/cli/

# jqはChocolateyでインストール
choco install jq
```

**セットアップ実行**:

```bash
# 1. cognito-localをDockerで起動
docker-compose up -d

# 2. 起動確認（数秒待つ）
sleep 5
curl http://localhost:9229

# 3. セットアップスクリプトを実行
chmod +x scripts/setup-cognito.sh
./scripts/setup-cognito.sh
```

スクリプトが成功すると、以下のような出力が表示されます：

```
🔧 Creating Cognito User Pool...
✅ User Pool created: local_abc123xyz
✅ Client created: local_def456uvw

👥 Creating test users...
  ✅ Created user: user1@example.com
  ✅ Created user: admin@company-a.com
  ✅ Created user: user2@example.com
  ✅ Created user: admin@company-b.com
  ✅ Created user: user3@example.com
  ✅ Created user: admin@company-c.com

✅ Setup complete!

📋 Configuration:
  User Pool ID: local_abc123xyz
  Client ID: local_def456uvw

Update packages/frontend/src/App.vue with these IDs:
  UserPoolId: 'local_abc123xyz'
  ClientId: 'local_def456uvw'
```

#### ステップ3: フロントエンドの設定を更新

1. `packages/frontend/src/App.vue`を開く
2. 148-154行目付近の設定を更新：

```typescript
// 変更前（プレースホルダー）
const poolData = {
  UserPoolId: 'local_xxxxxxxx',  // Replace with actual User Pool ID
  ClientId: 'local_yyyyyyyy'     // Replace with actual Client ID
};

// 変更後（setup-cognito.shの出力から取得した実際のID）
const poolData = {
  UserPoolId: 'local_abc123xyz',  // 実際のUser Pool ID
  ClientId: 'local_def456uvw'     // 実際のClient ID
};
```

3. ファイルを保存
4. フロントエンドを再起動（開発サーバーが自動リロードする場合は不要）

```bash
# フロントエンドを再起動
cd packages/frontend
npm run dev
```

#### ステップ4: ログイン確認

1. ブラウザで http://localhost:3000 を開く
2. テナントを選択（例: Company A）
3. ログイン情報を入力：
   - メール: `user1@example.com`
   - パスワード: `Password123!`
4. 「ログイン / Login」をクリック

成功すると、ユーザー情報とトークンが表示されます。

### テストユーザー一覧

セットアップスクリプトで作成されるユーザー：

| テナント | メールアドレス | パスワード |
|---------|--------------|-----------|
| Company A | user1@example.com | Password123! |
| Company A | admin@company-a.com | Password123! |
| Company B | user2@example.com | Password123! |
| Company B | admin@company-b.com | Password123! |
| Company C | user3@example.com | Password123! |
| Company C | admin@company-c.com | Password123! |

### よくある問題と解決方法

#### 問題: `aws: command not found`

**解決**: AWS CLIをインストールしてください

```bash
# macOS
brew install awscli

# Linux
sudo apt-get install awscli

# Windows
# https://aws.amazon.com/cli/ からインストーラーをダウンロード
```

#### 問題: `jq: command not found`

**解決**: jqをインストールしてください

```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq

# Windows
choco install jq
```

#### 問題: Docker起動エラー "Cannot connect to the Docker daemon"

**解決**: Docker Desktopを起動してください

```bash
# Docker起動確認
docker ps

# 起動していない場合、Docker Desktopアプリケーションを起動
```

#### 問題: ポート9229が既に使用されている

**解決**: ポートを使用しているプロセスを停止してください

```bash
# 使用中のプロセスを確認（macOS/Linux）
lsof -i :9229

# プロセスを停止
kill -9 <PID>

# または、docker-composeを停止して再起動
docker-compose down
docker-compose up -d
```

#### 問題: "User does not exist" エラー

**原因**: User Poolは作成されたが、ユーザーが作成されていない

**解決**: セットアップスクリプトを再実行するか、手動でユーザーを作成

```bash
# User Pool IDを確認（setup-cognito.shの出力から）
export USER_POOL_ID="local_abc123xyz"
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

# ユーザーを手動作成
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username user1@example.com \
  --user-attributes Name=email,Value=user1@example.com Name=email_verified,Value=true \
  --message-action SUPPRESS \
  --endpoint-url http://localhost:9229 \
  --region local

aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username user1@example.com \
  --password "Password123!" \
  --permanent \
  --endpoint-url http://localhost:9229 \
  --region local
```

#### 問題: "NotAuthorizedException" エラー

**原因**: パスワードが正しくない、またはユーザーのステータスに問題がある

**解決**: パスワードを再設定

```bash
export USER_POOL_ID="local_abc123xyz"
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username user1@example.com \
  --password "Password123!" \
  --permanent \
  --endpoint-url http://localhost:9229 \
  --region local
```

### デバッグ方法

#### Cognitoエミュレーターのログを確認

```bash
# Docker logsを表示
docker-compose logs -f cognito-local
```

#### User Pool内のユーザー一覧を確認

```bash
export USER_POOL_ID="local_abc123xyz"
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

aws cognito-idp list-users \
  --user-pool-id $USER_POOL_ID \
  --endpoint-url http://localhost:9229 \
  --region local
```

#### ブラウザのコンソールでエラーを確認

1. ブラウザで http://localhost:3000 を開く
2. F12キーで開発者ツールを開く
3. Consoleタブを選択
4. ログインを試行
5. エラーメッセージを確認

### 完全なセットアップ手順（最初から）

すべてをクリーンアップして最初からセットアップする場合：

```bash
# 1. すべてのDockerコンテナを停止・削除
docker-compose down -v

# 2. 依存関係をインストール
npm install
npm install --workspaces

# 3. Lambdaをビルド
cd packages/lambda
npm run build
cd ../..

# 4. Cognitoエミュレーターを起動
docker-compose up -d

# 5. 数秒待つ
sleep 5

# 6. User Poolとユーザーを作成
./scripts/setup-cognito.sh

# 7. 出力されたUser Pool IDとClient IDをメモ

# 8. packages/frontend/src/App.vueを編集
# （User Pool IDとClient IDを更新）

# 9. バックエンドを起動
cd packages/backend
npm run dev &

# 10. フロントエンドを起動
cd ../frontend
npm run dev
```

### サポートが必要な場合

問題が解決しない場合は、以下の情報を含めてIssueを作成してください：

1. エラーメッセージの全文
2. ブラウザのコンソールログ
3. `docker-compose logs cognito-local`の出力
4. 実行したコマンドと順序
5. OS情報（macOS, Windows, Linuxなど）

---

## その他のトラブルシューティング

### バックエンドAPIに接続できない

```bash
# バックエンドが起動しているか確認
curl http://localhost:3001/health

# 起動していない場合
cd packages/backend
npm run dev
```

### フロントエンドが起動しない

```bash
# 依存関係を再インストール
cd packages/frontend
rm -rf node_modules
npm install
npm run dev
```

### ビルドエラー

```bash
# 各パッケージをクリーンして再ビルド
cd packages/lambda
rm -rf node_modules dist
npm install
npm run build

cd ../backend
rm -rf node_modules dist
npm install
npm run build

cd ../frontend
rm -rf node_modules dist
npm install
npm run build
```
