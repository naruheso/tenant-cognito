<template>
  <div class="app">
    <header class="header">
      <h1>🔐 Multi-Tenant Cognito Demo</h1>
      <p class="subtitle">Vue(TS) + Hono(TS) + Local Cognito Emulator</p>
    </header>

    <main class="container">
      <!-- Tenant Selection -->
      <div class="card" v-if="!isAuthenticated">
        <h2>テナント選択 / Tenant Selection</h2>
        <div class="tenant-selector">
          <label for="tenant">テナント (サブドメイン):</label>
          <select id="tenant" v-model="selectedTenant">
            <option value="">選択してください / Select...</option>
            <option value="company-a">Company A</option>
            <option value="company-b">Company B</option>
            <option value="company-c">Company C</option>
          </select>
        </div>
        <p class="info">
          各テナントには特定のユーザーのみがアクセスできます。<br>
          Each tenant only allows access to specific users.
        </p>
      </div>

      <!-- Login Form -->
      <div class="card" v-if="!isAuthenticated">
        <h2>ログイン / Login</h2>
        <form @submit.prevent="handleLogin" class="form">
          <div class="form-group">
            <label for="email">メールアドレス / Email:</label>
            <input
              type="email"
              id="email"
              v-model="email"
              placeholder="user1@example.com"
              required
            />
          </div>
          <div class="form-group">
            <label for="password">パスワード / Password:</label>
            <input
              type="password"
              id="password"
              v-model="password"
              placeholder="Password123!"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary" :disabled="!selectedTenant || loading">
            {{ loading ? 'ログイン中...' : 'ログイン / Login' }}
          </button>
          <p v-if="error" class="error">{{ error }}</p>
        </form>

        <div class="test-users">
          <h3>テストユーザー / Test Users:</h3>
          <ul>
            <li><strong>Company A:</strong> user1@example.com, admin@company-a.com</li>
            <li><strong>Company B:</strong> user2@example.com, admin@company-b.com</li>
            <li><strong>Company C:</strong> user3@example.com, admin@company-c.com</li>
          </ul>
          <p class="info-small">パスワード: Password123! (全ユーザー共通)</p>
        </div>
      </div>

      <!-- User Info (After Login) -->
      <div class="card success" v-if="isAuthenticated">
        <h2>✅ 認証成功 / Authentication Successful</h2>
        <div class="user-info">
          <p><strong>メール / Email:</strong> {{ userInfo.email }}</p>
          <p><strong>テナント ID / Tenant ID:</strong> <span class="highlight">{{ userInfo.tenantId }}</span></p>
          <p><strong>ユーザー ID / User ID:</strong> {{ userInfo.sub }}</p>
        </div>

        <div class="token-info">
          <h3>🎫 ID Token Claims</h3>
          <pre>{{ formattedToken }}</pre>
        </div>

        <button @click="handleLogout" class="btn btn-secondary">
          ログアウト / Logout
        </button>
      </div>

      <!-- API Test -->
      <div class="card" v-if="isAuthenticated">
        <h2>🔌 API Test (Protected Endpoint)</h2>
        <button @click="testProtectedApi" class="btn btn-primary" :disabled="apiLoading">
          {{ apiLoading ? 'テスト中...' : 'テナント固有データ取得 / Get Tenant Data' }}
        </button>
        <div v-if="apiResponse" class="api-response">
          <h3>API Response:</h3>
          <pre>{{ JSON.stringify(apiResponse, null, 2) }}</pre>
        </div>
        <p v-if="apiError" class="error">{{ apiError }}</p>
      </div>

      <!-- Architecture Explanation -->
      <div class="card info-card">
        <h2>📋 アーキテクチャ説明 / Architecture</h2>
        <div class="architecture">
          <h3>Post Authentication Lambda Trigger の動作:</h3>
          <ol>
            <li>
              <strong>テナント検証:</strong> ユーザーがログイン時に選択したテナント（サブドメイン）が、
              データベース内のユーザー情報と一致するかをチェック
            </li>
            <li>
              <strong>認証拒否:</strong> テナントとユーザーが一致しない場合、認証を拒否
            </li>
            <li>
              <strong>クレーム注入:</strong> 検証成功時、IDトークンに <code>custom:tenant_id</code> を追加
            </li>
            <li>
              <strong>バックエンド処理:</strong> バックエンドはトークンのみでテナントを識別し、
              データを分離できる
            </li>
          </ol>

          <h3>Post Authentication Lambda Trigger Flow:</h3>
          <ol>
            <li>
              <strong>Tenant Verification:</strong> Check if user belongs to the selected tenant (subdomain)
              by comparing with database
            </li>
            <li>
              <strong>Authentication Rejection:</strong> Reject authentication if tenant-user mismatch
            </li>
            <li>
              <strong>Claims Injection:</strong> Add <code>custom:tenant_id</code> to ID token upon success
            </li>
            <li>
              <strong>Backend Processing:</strong> Backend can identify and isolate tenants using token alone
            </li>
          </ol>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

// Cognito configuration for local emulator
// IMPORTANT: Replace these placeholder IDs with actual values from setup-cognito.sh output
// Or use environment variables (see .env.example)
const defaultCognitoEndpoint = 'http://localhost:9229/';
const envCognitoEndpoint = import.meta.env.VITE_COGNITO_ENDPOINT;

const resolveCognitoEndpoint = (): string => {
  if (envCognitoEndpoint) return envCognitoEndpoint;
  if (typeof window === 'undefined') return defaultCognitoEndpoint;

  return `${window.location.origin}/cognito/`;
};

const poolData = {
  UserPoolId: 'local_4hsUDavD',  // Replace with actual User Pool ID
  ClientId: '403vdnsd1akvnq4p5kzzhfbnx',     // Replace with actual Client ID
  endpoint: resolveCognitoEndpoint()
};

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: 'local',
  endpoint: poolData.endpoint,
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local'
  }
});

// State
const selectedTenant = ref('');
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const isAuthenticated = ref(false);
const userInfo = ref<any>({});
const idToken = ref('');
const apiLoading = ref(false);
const apiResponse = ref<any>(null);
const apiError = ref('');

const formattedToken = computed(() => {
  if (!idToken.value) return '';
  try {
    const parts = idToken.value.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      return JSON.stringify(payload, null, 2);
    }
  } catch (e) {
    console.error('Failed to parse token', e);
  }
  return 'Invalid token format';
});

const handleLogin = async () => {
  loading.value = true;
  error.value = '';

  try {
    // Use InitiateAuth with USER_PASSWORD_AUTH flow
    const command = new InitiateAuthCommand({
      ClientId: poolData.ClientId,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: email.value,
        PASSWORD: password.value
      },
      ClientMetadata: {
        tenant_id: selectedTenant.value
      }
    });

    const response = await cognitoClient.send(command);
    
    // Get tokens from response
    const idTokenValue = response.AuthenticationResult?.IdToken;
    
    if (!idTokenValue) {
      throw new Error('No ID token received from authentication');
    }

    // Parse token payload
    const parts = idTokenValue.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(atob(parts[1]));

    idToken.value = idTokenValue;
    userInfo.value = {
      email: payload.email,
      tenantId: payload['custom:tenant_id'],
      sub: payload.sub
    };

    isAuthenticated.value = true;
  } catch (err: any) {
    console.error('Login error:', err);
    error.value = err.message || 'ログインに失敗しました / Login failed';
  } finally {
    loading.value = false;
  }
};

const handleLogout = () => {
  isAuthenticated.value = false;
  userInfo.value = {};
  idToken.value = '';
  email.value = '';
  password.value = '';
  selectedTenant.value = '';
  apiResponse.value = null;
  apiError.value = '';
};

const testProtectedApi = async () => {
  apiLoading.value = true;
  apiError.value = '';
  apiResponse.value = null;

  try {
    const response = await fetch('http://localhost:3001/api/tenant/data', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken.value}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    apiResponse.value = await response.json();
  } catch (err: any) {
    console.error('API test error:', err);
    apiError.value = err.message || 'API request failed';
  } finally {
    apiLoading.value = false;
  }
};
</script>

<style scoped>
.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.header {
  background: rgba(255, 255, 255, 0.95);
  padding: 2rem;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header h1 {
  margin: 0;
  color: #333;
  font-size: 2rem;
}

.subtitle {
  margin: 0.5rem 0 0;
  color: #666;
  font-size: 0.9rem;
}

.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.card.success {
  border: 3px solid #10b981;
}

.card.info-card {
  background: #f8fafc;
}

.tenant-selector {
  margin: 1rem 0;
}

.tenant-selector label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
}

.tenant-selector select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
}

.form {
  margin-top: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  background: #cbd5e0;
  cursor: not-allowed;
}

.btn-secondary {
  background: #ef4444;
  color: white;
  margin-top: 1rem;
}

.btn-secondary:hover {
  background: #dc2626;
}

.error {
  color: #ef4444;
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fee2e2;
  border-radius: 8px;
}

.info {
  color: #64748b;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.info-small {
  color: #64748b;
  font-size: 0.85rem;
  font-style: italic;
}

.user-info {
  background: #f0fdf4;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}

.user-info p {
  margin: 0.5rem 0;
  color: #333;
}

.highlight {
  background: #fef3c7;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 700;
  color: #92400e;
}

.token-info {
  margin: 1.5rem 0;
}

.token-info h3 {
  margin-bottom: 0.5rem;
  color: #333;
}

.token-info pre {
  background: #1e293b;
  color: #10b981;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.85rem;
}

.test-users {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #e2e8f0;
}

.test-users h3 {
  margin-bottom: 1rem;
  color: #333;
}

.test-users ul {
  list-style: none;
  padding: 0;
}

.test-users li {
  padding: 0.5rem;
  margin: 0.5rem 0;
  background: #f1f5f9;
  border-radius: 6px;
}

.api-response {
  margin-top: 1rem;
}

.api-response h3 {
  margin-bottom: 0.5rem;
  color: #333;
}

.api-response pre {
  background: #1e293b;
  color: #10b981;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.85rem;
}

.architecture ol {
  line-height: 1.8;
  color: #475569;
}

.architecture code {
  background: #fef3c7;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  color: #92400e;
}
</style>
