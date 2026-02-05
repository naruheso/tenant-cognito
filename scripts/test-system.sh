#!/bin/bash

echo "🧪 Testing Multi-Tenant Authentication System"
echo ""

# Test 1: Check if backend is running
echo "Test 1: Backend Health Check..."
response=$(curl -s http://localhost:3001/health)
if [ "$response" == '{"status":"ok"}' ]; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend is not responding correctly"
    echo "   Make sure to run: npm run dev:backend"
fi
echo ""

# Test 2: Check tenant database
echo "Test 2: Tenant Database Check..."
response=$(curl -s http://localhost:3001/api/tenants)
if echo "$response" | grep -q "company-a"; then
    echo "✅ Tenant database is configured"
    echo "   Available tenants: company-a, company-b, company-c"
else
    echo "❌ Tenant database not responding"
fi
echo ""

# Test 3: Verify tenant-user relationship
echo "Test 3: Tenant-User Verification..."
response=$(curl -s -X POST http://localhost:3001/api/verify-tenant-user \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"company-a","email":"user1@example.com"}')

if echo "$response" | grep -q '"valid":true'; then
    echo "✅ Tenant verification working (user1@example.com belongs to company-a)"
else
    echo "❌ Tenant verification failed"
fi

response=$(curl -s -X POST http://localhost:3001/api/verify-tenant-user \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"company-b","email":"user1@example.com"}')

if echo "$response" | grep -q '"valid":false'; then
    echo "✅ Tenant isolation working (user1@example.com does not belong to company-b)"
else
    echo "❌ Tenant isolation failed"
fi
echo ""

# Test 4: Check if frontend is accessible
echo "Test 4: Frontend Accessibility..."
frontend_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$frontend_response" == "200" ]; then
    echo "✅ Frontend is accessible at http://localhost:3000"
else
    echo "⚠️  Frontend is not accessible"
    echo "   Make sure to run: npm run dev:frontend"
fi
echo ""

echo "================================"
echo "Summary:"
echo "- Backend API: http://localhost:3001"
echo "- Frontend: http://localhost:3000"
echo "- Cognito Local: http://localhost:9229"
echo ""
echo "Next steps:"
echo "1. Configure Cognito User Pool (see README.md)"
echo "2. Open http://localhost:3000 in browser"
echo "3. Test login with different tenant-user combinations"
echo "================================"
