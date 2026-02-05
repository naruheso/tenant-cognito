# Post Authentication Lambda - 実装例と動作説明

## 概要

このドキュメントでは、Post Authentication Lambdaトリガーの実装詳細と、マルチテナント認証がどのように機能するかを説明します。

## Lambda関数の実装

### 完全なコード

```typescript
import { PostAuthenticationTriggerEvent, PostAuthenticationTriggerHandler } from 'aws-lambda';

// テナントデータベース（本番環境ではDynamoDB/RDSを使用）
const tenantDatabase: Record<string, { users: string[] }> = {
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

export const handler: PostAuthenticationTriggerHandler = async (event) => {
  console.log('Post Authentication Trigger:', JSON.stringify(event, null, 2));

  try {
    const userEmail = event.request.userAttributes.email;
    const tenantId = event.request.clientMetadata?.tenant_id;

    if (!tenantId) {
      throw new Error('Tenant identification required');
    }

    // 1. テナント検証
    const tenant = tenantDatabase[tenantId];
    if (!tenant) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }

    const userBelongsToTenant = tenant.users.includes(userEmail);
    if (!userBelongsToTenant) {
      throw new Error(`User ${userEmail} is not authorized for tenant ${tenantId}`);
    }

    // 2. クレーム注入
    event.response = {
      claimsOverrideDetails: {
        claimsToAddOrOverride: {
          'custom:tenant_id': tenantId
        }
      }
    };

    return event;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
};
```

## 動作例

### ケース1: 正常な認証（成功）

#### 入力（Event）

```json
{
  "version": "1",
  "triggerSource": "PostAuthentication_Authentication",
  "region": "local",
  "userPoolId": "local_xxxxxxxx",
  "userName": "user1@example.com",
  "request": {
    "userAttributes": {
      "sub": "12345678-1234-1234-1234-123456789abc",
      "email": "user1@example.com",
      "email_verified": "true"
    },
    "clientMetadata": {
      "tenant_id": "company-a"
    }
  },
  "response": {}
}
```

#### 処理フロー

1. **ユーザー情報の取得**
   ```typescript
   userEmail = "user1@example.com"
   tenantId = "company-a"
   ```

2. **テナント存在確認**
   ```typescript
   tenant = tenantDatabase["company-a"]
   // Result: { users: ['user1@example.com', 'admin@company-a.com'] }
   ```

3. **ユーザー所属確認**
   ```typescript
   tenant.users.includes("user1@example.com")
   // Result: true ✅
   ```

4. **クレーム追加**
   ```typescript
   event.response = {
     claimsOverrideDetails: {
       claimsToAddOrOverride: {
         'custom:tenant_id': 'company-a'
       }
     }
   };
   ```

#### 出力（Response）

```json
{
  "version": "1",
  "triggerSource": "PostAuthentication_Authentication",
  "region": "local",
  "userPoolId": "local_xxxxxxxx",
  "userName": "user1@example.com",
  "request": {
    "userAttributes": {
      "sub": "12345678-1234-1234-1234-123456789abc",
      "email": "user1@example.com",
      "email_verified": "true"
    },
    "clientMetadata": {
      "tenant_id": "company-a"
    }
  },
  "response": {
    "claimsOverrideDetails": {
      "claimsToAddOrOverride": {
        "custom:tenant_id": "company-a"
      }
    }
  }
}
```

#### 生成されるIDトークン

```json
{
  "sub": "12345678-1234-1234-1234-123456789abc",
  "aud": "local_yyyyyyyy",
  "email_verified": true,
  "token_use": "id",
  "auth_time": 1707126000,
  "iss": "http://localhost:9229/local_xxxxxxxx",
  "cognito:username": "user1@example.com",
  "exp": 1707129600,
  "iat": 1707126000,
  "email": "user1@example.com",
  "custom:tenant_id": "company-a"    ← 追加されたクレーム
}
```

### ケース2: 不正なテナントアクセス（失敗）

#### 入力（Event）

```json
{
  "version": "1",
  "triggerSource": "PostAuthentication_Authentication",
  "region": "local",
  "userPoolId": "local_xxxxxxxx",
  "userName": "user1@example.com",
  "request": {
    "userAttributes": {
      "sub": "12345678-1234-1234-1234-123456789abc",
      "email": "user1@example.com",
      "email_verified": "true"
    },
    "clientMetadata": {
      "tenant_id": "company-b"    ← 異なるテナント
    }
  },
  "response": {}
}
```

#### 処理フロー

1. **ユーザー情報の取得**
   ```typescript
   userEmail = "user1@example.com"
   tenantId = "company-b"
   ```

2. **テナント存在確認**
   ```typescript
   tenant = tenantDatabase["company-b"]
   // Result: { users: ['user2@example.com', 'admin@company-b.com'] }
   ```

3. **ユーザー所属確認**
   ```typescript
   tenant.users.includes("user1@example.com")
   // Result: false ❌
   ```

4. **エラーをthrow**
   ```typescript
   throw new Error("User user1@example.com is not authorized for tenant company-b");
   ```

#### 結果

- Lambda関数がエラーをthrow
- Cognitoは認証を拒否
- トークンは生成されない
- ユーザーはログインできない

#### エラーレスポンス

```json
{
  "error": "PostAuthentication failed with error User user1@example.com is not authorized for tenant company-b.",
  "__type": "NotAuthorizedException"
}
```

## フロントエンドからの呼び出し

### Cognito認証時にclientMetadataを渡す

```typescript
const authenticationDetails = new AuthenticationDetails({
  Username: email,
  Password: password
});

const cognitoUser = new CognitoUser({
  Username: email,
  Pool: userPool
});

// clientMetadataでテナント情報を渡す
const clientMetadata = {
  tenant_id: selectedTenant  // "company-a", "company-b", etc.
};

cognitoUser.authenticateUser(authenticationDetails, {
  onSuccess: (session) => {
    const idToken = session.getIdToken();
    const payload = idToken.payload;
    
    // custom:tenant_id クレームを取得
    console.log('Tenant ID:', payload['custom:tenant_id']);
  },
  onFailure: (err) => {
    console.error('Authentication failed:', err);
  },
  clientMetadata  // ← ここでテナント情報を渡す
});
```

## バックエンドでのトークン検証

### JWTトークンからテナント情報を取得

```typescript
import jwt from 'jsonwebtoken';

const verifyToken = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader.substring(7); // "Bearer " を削除

  // トークンをデコード
  const decoded = jwt.decode(token) as any;
  
  // custom:tenant_id クレームを取得
  const tenantId = decoded['custom:tenant_id'];
  
  console.log('Request from tenant:', tenantId);
  
  // テナント固有の処理
  if (!tenantId) {
    return c.json({ error: 'No tenant information in token' }, 403);
  }
  
  c.set('user', decoded);
  c.set('tenantId', tenantId);
  await next();
};

// 保護されたエンドポイント
app.get('/api/tenant/data', verifyToken, (c) => {
  const tenantId = c.get('tenantId');
  
  // テナント固有のデータを返す
  return c.json({
    message: `Data for ${tenantId}`,
    tenantId,
    data: getTenantSpecificData(tenantId)
  });
});
```

## データベース設計（本番環境）

### DynamoDBテーブル例

#### テーブル: TenantUsers

```
PK (Partition Key): tenant_id
SK (Sort Key): user_email
Attributes: {
  tenant_id: string,
  user_email: string,
  role: string,
  created_at: timestamp,
  active: boolean
}
```

#### Lambda関数でのクエリ

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

async function verifyTenantUser(tenantId: string, userEmail: string): Promise<boolean> {
  const command = new GetCommand({
    TableName: "TenantUsers",
    Key: {
      tenant_id: tenantId,
      user_email: userEmail
    }
  });

  try {
    const response = await docClient.send(command);
    return response.Item?.active === true;
  } catch (error) {
    console.error('Database error:', error);
    return false;
  }
}

// Lambda内での使用
const isAuthorized = await verifyTenantUser(tenantId, userEmail);
if (!isAuthorized) {
  throw new Error(`User not authorized for tenant`);
}
```

## セキュリティベストプラクティス

### 1. エラーメッセージの制御

```typescript
// ❌ 悪い例：詳細すぎる情報
throw new Error(`User ${userEmail} does not belong to tenant ${tenantId}`);

// ✅ 良い例：一般的なエラーメッセージ（本番環境）
throw new Error('Authentication failed');

// ログには詳細を記録
console.error(`Authorization failed: ${userEmail} attempted access to ${tenantId}`);
```

### 2. レート制限

```typescript
// Lambda内でユーザーごとの試行回数を制限
const MAX_FAILED_ATTEMPTS = 5;
const failedAttempts = await getFailedAttempts(userEmail);

if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
  throw new Error('Account temporarily locked');
}
```

### 3. 監査ログ

```typescript
// すべての認証試行をログに記録
await logAuthenticationAttempt({
  timestamp: new Date().toISOString(),
  userEmail,
  tenantId,
  success: false,
  reason: 'User not authorized for tenant'
});
```

## テストケース

### ユニットテスト例

```typescript
describe('Post Authentication Lambda', () => {
  it('should succeed for authorized user', async () => {
    const event = {
      request: {
        userAttributes: { email: 'user1@example.com' },
        clientMetadata: { tenant_id: 'company-a' }
      },
      response: {}
    };

    const result = await handler(event);
    
    expect(result.response.claimsOverrideDetails).toBeDefined();
    expect(result.response.claimsOverrideDetails.claimsToAddOrOverride).toEqual({
      'custom:tenant_id': 'company-a'
    });
  });

  it('should fail for unauthorized user', async () => {
    const event = {
      request: {
        userAttributes: { email: 'user1@example.com' },
        clientMetadata: { tenant_id: 'company-b' }
      },
      response: {}
    };

    await expect(handler(event)).rejects.toThrow('not authorized');
  });
});
```

## まとめ

Post Authentication Lambdaトリガーを使用することで：

1. ✅ **認証時の検証**: トークン発行前にテナントアクセス権を検証
2. ✅ **クレーム注入**: トークンにテナント情報を安全に埋め込み
3. ✅ **ステートレス**: バックエンドはトークンのみで動作
4. ✅ **セキュリティ**: 不正アクセスをトークン発行前にブロック
5. ✅ **監査性**: すべての認証試行をログに記録

この仕組みにより、マルチテナントSaaSアプリケーションで安全かつ効率的なテナント分離を実現できます。
