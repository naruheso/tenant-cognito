# Multi-Tenant Authentication Architecture

## System Overview

このシステムは、Post Authentication Lambdaトリガーを使用して、マルチテナント環境での安全な認証とテナント分離を実現します。

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. User visits frontend (e.g., company-a.localhost:3000)          │
│     - Selects tenant: "company-a"                                   │
│     - Enters credentials: user1@example.com / Password123!          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. Frontend sends authentication request to Cognito                │
│     - Username: user1@example.com                                   │
│     - Password: Password123!                                        │
│     - clientMetadata: { tenant_id: "company-a" }  ← Important!      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Cognito validates credentials                                   │
│     ✅ Username and password are correct                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Post Authentication Lambda Trigger is invoked                   │
│                                                                       │
│     Input:                                                            │
│     - event.request.userAttributes.email = "user1@example.com"      │
│     - event.request.clientMetadata.tenant_id = "company-a"          │
│                                                                       │
│     Processing:                                                       │
│     ┌────────────────────────────────────────────────────────┐      │
│     │  A. Tenant Verification                                 │      │
│     │     - Look up tenant "company-a" in database           │      │
│     │     - Check if user1@example.com belongs to company-a  │      │
│     │     - Result: ✅ User belongs to tenant                │      │
│     └────────────────────────────────────────────────────────┘      │
│                                                                       │
│     ┌────────────────────────────────────────────────────────┐      │
│     │  B. Claims Injection                                    │      │
│     │     - Add custom:tenant_id = "company-a" to token      │      │
│     │     - This claim will be included in the ID token      │      │
│     └────────────────────────────────────────────────────────┘      │
│                                                                       │
│     Output:                                                           │
│     - event.response.claimsOverrideDetails = {                       │
│         claimsToAddOrOverride: {                                     │
│           'custom:tenant_id': 'company-a'                            │
│         }                                                             │
│       }                                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. Cognito generates tokens with custom claims                     │
│                                                                       │
│     ID Token Payload:                                                │
│     {                                                                 │
│       "sub": "user-uuid",                                            │
│       "email": "user1@example.com",                                  │
│       "custom:tenant_id": "company-a",  ← Injected by Lambda        │
│       "exp": 1234567890,                                             │
│       ...                                                             │
│     }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. Frontend receives tokens                                        │
│     - ID Token (with custom:tenant_id claim)                        │
│     - Access Token                                                  │
│     - Refresh Token                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7. Frontend makes API request to Backend                           │
│     GET /api/tenant/data                                            │
│     Headers:                                                         │
│       Authorization: Bearer <ID_TOKEN>                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  8. Backend validates token and extracts tenant                     │
│                                                                       │
│     1. Decode JWT token                                              │
│     2. Extract custom:tenant_id = "company-a"                       │
│     3. Serve tenant-specific data for company-a                     │
│                                                                       │
│     Response:                                                         │
│     {                                                                 │
│       "message": "Welcome to company-a",                             │
│       "tenantId": "company-a",                                       │
│       "data": { ... tenant-specific data ... }                       │
│     }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Security: Rejection Flow

不正なテナントアクセスを試みた場合の動作：

```
┌─────────────────────────────────────────────────────────────────────┐
│  Scenario: user1@example.com tries to access company-b              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1-3. Same as normal flow...                                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Post Authentication Lambda Trigger                              │
│                                                                       │
│     Input:                                                            │
│     - email = "user1@example.com"                                    │
│     - tenant_id = "company-b"  ← Different tenant!                  │
│                                                                       │
│     Processing:                                                       │
│     ┌────────────────────────────────────────────────────────┐      │
│     │  A. Tenant Verification                                 │      │
│     │     - Look up tenant "company-b" in database           │      │
│     │     - Check if user1@example.com belongs to company-b  │      │
│     │     - Result: ❌ User does NOT belong to this tenant   │      │
│     │                                                          │      │
│     │     THROW ERROR!                                         │      │
│     │     "User user1@example.com is not authorized           │      │
│     │      for tenant company-b"                              │      │
│     └────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. Cognito receives error from Lambda                              │
│     → Authentication is rejected                                    │
│     → No tokens are generated                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. Frontend receives authentication error                          │
│     Error: "User is not authorized for tenant company-b"            │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Post Authentication Lambda (`packages/lambda/src/post-authentication.ts`)

**責任 / Responsibilities:**
- テナントとユーザーの関係を検証
- 不正なアクセスを拒否
- 有効なトークンにテナント情報を注入

**データソース / Data Sources:**
- テナントデータベース（本番環境ではDynamoDB/RDSを使用）
- Cognitoからのユーザー情報

### 2. Backend API (`packages/backend/src/index.ts`)

**責任 / Responsibilities:**
- JWTトークンの検証
- `custom:tenant_id`クレームの抽出
- テナント固有のデータ提供
- テナント分離の実施

**エンドポイント / Endpoints:**
- `GET /health` - ヘルスチェック
- `GET /api/tenants` - テナント一覧
- `POST /api/verify-tenant-user` - テナント・ユーザー検証
- `GET /api/user/profile` - ユーザープロファイル（要認証）
- `GET /api/tenant/data` - テナント固有データ（要認証）

### 3. Frontend (`packages/frontend/src/App.vue`)

**責任 / Responsibilities:**
- テナント選択UI
- Cognito認証フロー
- clientMetadataでテナント情報を送信
- トークン管理
- 保護されたAPIへのアクセス

## Tenant Database Structure

```typescript
{
  'company-a': {
    users: ['user1@example.com', 'admin@company-a.com']
  },
  'company-b': {
    users: ['user2@example.com', 'admin@company-b.com']
  },
  'company-c': {
    users: ['user3@example.com', 'admin@company-c.com']
  }
}
```

本番環境では、この構造をDynamoDB、RDS、またはその他のデータベースに実装します。

## Benefits of This Architecture

1. **トークンベースのテナント識別 / Token-based Tenant Identification**
   - バックエンドはトークンのみでテナントを識別できる
   - 追加のデータベースクエリが不要

2. **セキュリティ / Security**
   - 認証時にテナントアクセス権を検証
   - トークン発行前に不正アクセスをブロック

3. **スケーラビリティ / Scalability**
   - ステートレスな設計
   - 水平スケーリングが容易

4. **監査性 / Auditability**
   - すべてのアクセスがLambdaでログに記録される
   - 不正アクセス試行を検出可能

## Production Considerations

1. **データベース / Database**
   - インメモリDBを実DBに置き換え（DynamoDB/RDS）
   - テナント・ユーザー関係の管理インターフェース

2. **JWT検証 / JWT Verification**
   - Cognitoの公開鍵を使用した署名検証
   - jwks-rsaライブラリの使用

3. **エラーハンドリング / Error Handling**
   - より詳細なエラーメッセージ
   - エラーログとモニタリング

4. **パフォーマンス / Performance**
   - データベースクエリのキャッシング
   - Lambda関数のウォームアップ

5. **セキュリティ / Security**
   - レート制限
   - 異常検知
   - 監査ログ
