#!/bin/bash

# Configure AWS CLI to use local Cognito emulator
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local
export AWS_REGION=local

COGNITO_ENDPOINT="http://localhost:9229"

echo "🔧 Creating Cognito User Pool..."

# Create User Pool
POOL_OUTPUT=$(aws cognito-idp create-user-pool \
  --pool-name TenantDemoPool \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=true}" \
  --auto-verified-attributes email \
  --endpoint-url $COGNITO_ENDPOINT \
  --region local \
  --output json)

USER_POOL_ID=$(echo $POOL_OUTPUT | jq -r '.UserPool.Id')
echo "✅ User Pool created: $USER_POOL_ID"

# Create User Pool Client
CLIENT_OUTPUT=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name TenantDemoClient \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --endpoint-url $COGNITO_ENDPOINT \
  --region local \
  --output json)

CLIENT_ID=$(echo $CLIENT_OUTPUT | jq -r '.UserPoolClient.ClientId')
echo "✅ Client created: $CLIENT_ID"

# Create test users for Company A
echo ""
echo "👥 Creating test users..."

create_user() {
  local email=$1
  local pool_id=$2
  
  aws cognito-idp admin-create-user \
    --user-pool-id $pool_id \
    --username $email \
    --user-attributes Name=email,Value=$email Name=email_verified,Value=true \
    --message-action SUPPRESS \
    --endpoint-url $COGNITO_ENDPOINT \
    --region local > /dev/null

  aws cognito-idp admin-set-user-password \
    --user-pool-id $pool_id \
    --username $email \
    --password "Password123!" \
    --permanent \
    --endpoint-url $COGNITO_ENDPOINT \
    --region local > /dev/null
  
  echo "  ✅ Created user: $email"
}

# Company A users
create_user "user1@example.com" $USER_POOL_ID
create_user "admin@company-a.com" $USER_POOL_ID

# Company B users
create_user "user2@example.com" $USER_POOL_ID
create_user "admin@company-b.com" $USER_POOL_ID

# Company C users
create_user "user3@example.com" $USER_POOL_ID
create_user "admin@company-c.com" $USER_POOL_ID

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Configuration:"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Client ID: $CLIENT_ID"
echo ""
echo "Update packages/frontend/src/App.vue with these IDs:"
echo "  UserPoolId: '$USER_POOL_ID'"
echo "  ClientId: '$CLIENT_ID'"
