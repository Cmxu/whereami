#!/bin/bash

# WhereAmI 2.0 Deployment Script for Cloudflare Pages
# This script deploys both the frontend and backend (Pages Functions)
# Usage: ./deploy.sh [production|development]

set -e

# Default to production if no argument provided
ENVIRONMENT=${1:-production}

# Validate environment argument
if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "development" ]]; then
    echo "❌ Invalid environment. Use 'production' or 'development'"
    echo "Usage: ./deploy.sh [production|development]"
    exit 1
fi

# Set project names based on environment
if [[ "$ENVIRONMENT" == "development" ]]; then
    PROJECT_NAME="whereami"
    BRANCH_NAME="dev"
    echo "🔧 Deploying to DEVELOPMENT environment..."
    echo "   Project: $PROJECT_NAME"
    echo "   Branch: $BRANCH_NAME"
    echo "   URL: Will be available at dev.whereami.pages.dev"
else
    PROJECT_NAME="whereami"
    BRANCH_NAME="main"
    echo "🚀 Deploying to PRODUCTION environment..."
    echo "   Project: $PROJECT_NAME"
    echo "   Branch: $BRANCH_NAME"
    echo "   URL: geo.cmxu.io"
fi

echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare. Please run:"
    echo "wrangler login"
    exit 1
fi

echo "✅ Wrangler CLI found and authenticated"

# Build the SvelteKit application
echo "📦 Building SvelteKit application..."
npm run build

# Deploy to Cloudflare Pages with environment-specific settings
echo "🌐 Deploying to Cloudflare Pages ($ENVIRONMENT)..."
wrangler pages deploy .svelte-kit/cloudflare --project-name "$PROJECT_NAME" --branch "$BRANCH_NAME"

echo "✅ Deployment complete!"
echo ""
echo "📋 Environment: $ENVIRONMENT"
if [[ "$ENVIRONMENT" == "development" ]]; then
    echo "🔗 Dev URL: https://dev.whereami.pages.dev"
    echo "📝 Note: Uses the same KV namespaces and R2 bucket as production"
    echo "⚠️  This is for testing only - does not affect geo.cmxu.io"
else
    echo "🔗 Production URL: https://geo.cmxu.io"
fi
echo ""
echo "📋 Next steps:"
if [[ "$ENVIRONMENT" == "development" ]]; then
    echo "1. Test your changes at the dev URL above"
    echo "2. When ready, deploy to production with: ./deploy.sh production"
else
    echo "1. Your production site is now updated"
    echo "2. For development testing, use: ./deploy.sh development"
fi
echo ""
echo "🔗 Useful commands:"
echo "  wrangler pages deployment list --project-name $PROJECT_NAME"
echo "  wrangler pages deployment tail --project-name $PROJECT_NAME"
echo "  wrangler r2 bucket list" 