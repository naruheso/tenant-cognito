import { PostAuthenticationTriggerEvent, PostAuthenticationTriggerHandler } from 'aws-lambda';

// In-memory tenant database (in production, use DynamoDB or RDS)
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

/**
 * Post Authentication Lambda Trigger
 * 
 * This Lambda function is triggered after a user successfully authenticates with Cognito.
 * It performs two critical operations:
 * 
 * 1. Tenant Verification:
 *    - Extracts the tenant ID from the request (typically from subdomain or client metadata)
 *    - Checks if the authenticated user belongs to that tenant in the database
 *    - Rejects authentication if user doesn't belong to the tenant
 * 
 * 2. Claims Injection:
 *    - Adds custom:tenant_id to the ID token claims
 *    - This allows backend services to identify the tenant from the token alone
 */
export const handler: PostAuthenticationTriggerHandler = async (event) => {
  console.log('Post Authentication Trigger:', JSON.stringify(event, null, 2));

  try {
    const userEmail = event.request.userAttributes.email;
    
    // Extract tenant ID from client metadata (passed from frontend during authentication)
    const tenantId = event.request.clientMetadata?.tenant_id;

    if (!tenantId) {
      console.error('No tenant_id provided in client metadata');
      throw new Error('Tenant identification required');
    }

    console.log(`Verifying user ${userEmail} for tenant ${tenantId}`);

    // 1. TENANT VERIFICATION
    // Check if tenant exists
    const tenant = tenantDatabase[tenantId];
    if (!tenant) {
      console.error(`Tenant ${tenantId} not found in database`);
      throw new Error(`Invalid tenant: ${tenantId}`);
    }

    // Check if user belongs to this tenant
    const userBelongsToTenant = tenant.users.includes(userEmail);
    if (!userBelongsToTenant) {
      console.error(`User ${userEmail} does not belong to tenant ${tenantId}`);
      throw new Error(`User ${userEmail} is not authorized for tenant ${tenantId}`);
    }

    console.log(`✓ User ${userEmail} verified for tenant ${tenantId}`);

    // 2. CLAIMS INJECTION
    // Add custom:tenant_id to ID token claims
    event.response = {
      claimsOverrideDetails: {
        claimsToAddOrOverride: {
          'custom:tenant_id': tenantId
        }
      }
    };

    console.log(`✓ Added custom:tenant_id claim to token for user ${userEmail}`);

    return event;
  } catch (error) {
    console.error('Authentication failed:', error);
    // Throwing an error will fail the authentication process
    throw error;
  }
};
