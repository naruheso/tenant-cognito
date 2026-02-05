#!/bin/bash
set -e

echo "🚀 Setting up Multi-Tenant Cognito Demo Environment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Installing root dependencies...${NC}"
npm install

echo -e "${BLUE}Step 2: Installing workspace dependencies...${NC}"
npm install --workspaces

echo -e "${BLUE}Step 3: Building Lambda functions...${NC}"
cd packages/lambda
npm run build
cd ../..

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "  1. Start Cognito emulator: npm run docker:up"
echo "  2. Configure Cognito User Pool (see README.md)"
echo "  3. Start services: npm run dev"
echo ""
echo "Or simply run: npm run dev (if using local cognito-local)"
