#!/bin/bash

# WhereAmI 2.0 Deployment Script for Cloudflare Pages
# This script deploys both the frontend and backend (Pages Functions)

set -e

echo "🚀 Starting WhereAmI 2.0 deployment to Cloudflare Pages..."

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

# Deploy to Cloudflare Pages (includes both frontend and API functions)
echo "🌐 Deploying to Cloudflare Pages..."
wrangler pages deploy .svelte-kit/cloudflare --project-name whereami-app

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Your KV namespace IDs are already configured in wrangler.toml"
echo "2. Create R2 bucket if not already created:"
echo "   wrangler r2 bucket create whereami-images"
echo "3. Update your domain configuration in Cloudflare Dashboard"
echo "4. Test your deployment at your Cloudflare Pages URL"
echo ""
echo "🔗 Useful commands:"
echo "  wrangler pages deployment list --project-name whereami-app"
echo "  wrangler pages deployment tail --project-name whereami-app"
echo "  wrangler r2 bucket list" 