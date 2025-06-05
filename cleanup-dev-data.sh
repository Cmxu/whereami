#!/bin/bash

# WhereAmI Development Data Cleanup Script
# This script clears all KV namespaces and R2 bucket contents
# Use this to reset your development environment when adding new features

set -e  # Exit on any error

echo "🧹 WhereAmI Development Data Cleanup"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Confirmation prompt
echo -e "${YELLOW}⚠️  WARNING: This will permanently delete ALL data in your KV namespaces and R2 bucket!${NC}"
echo ""
echo "This includes:"
echo "  • All user data (profiles, uploaded images count, etc.)"
echo "  • All image metadata"
echo "  • All game data (created games, scores, etc.)"
echo "  • All uploaded images in R2 storage"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Cleanup cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting cleanup process..."
echo ""

# Function to clear a KV namespace
clear_kv_namespace() {
    local binding=$1
    local id=$2
    
    echo -e "🗄️  Clearing KV namespace: ${YELLOW}${binding}${NC} (${id})"
    
    # List all keys in the namespace using correct wrangler syntax with --remote flag
    echo "   🔍 Checking for keys in remote storage..."
    keys=$(wrangler kv key list --namespace-id="$id" --remote 2>/dev/null || echo "[]")
    
    # Debug: Show raw output
    echo -e "   ${BLUE}Debug: Raw output: ${keys}${NC}"
    
    if [ "$keys" = "[]" ] || [ -z "$keys" ]; then
        echo "   ✅ Already empty"
        return
    fi
    
    # Count keys using jq
    key_count=$(echo "$keys" | jq length 2>/dev/null || echo "0")
    
    echo "   📊 Found $key_count keys"
    
    if [ "$key_count" -gt 0 ]; then
        echo "   🔑 Deleting keys..."
        
        # Extract key names and delete them
        echo "$keys" | jq -r '.[].name // .[].key // empty' 2>/dev/null | while IFS= read -r key; do
            if [ -n "$key" ] && [ "$key" != "null" ]; then
                echo "     ➜ Deleting: $key"
                wrangler kv key delete "$key" --namespace-id="$id" --remote 2>/dev/null || echo "     ❌ Failed to delete: $key"
            fi
        done
        
        echo "   ✅ Deletion commands sent"
    else
        echo "   ✅ No keys to delete"
    fi
    echo ""
}

# Function to attempt clearing R2 bucket
clear_r2_bucket() {
    local bucket_name=$1
    
    echo -e "🪣 Attempting to clear R2 bucket: ${YELLOW}${bucket_name}${NC}"
    
    # Note: The current version of wrangler doesn't seem to support listing R2 objects directly
    # We'll provide instructions for manual cleanup if needed
    echo "   ℹ️  Current wrangler version doesn't support direct R2 object listing"
    echo "   📝 To manually clear R2 bucket, you can:"
    echo "      1. Go to Cloudflare Dashboard -> R2 Object Storage"
    echo "      2. Click on '$bucket_name' bucket"
    echo "      3. Select all objects and delete them"
    echo "   🔄 Alternatively, you can delete and recreate the bucket:"
    echo "      wrangler r2 bucket delete $bucket_name"
    echo "      wrangler r2 bucket create $bucket_name"
    echo ""
    
    read -p "   Would you like to delete and recreate the R2 bucket? (y/n): " recreate_bucket
    
    if [ "$recreate_bucket" = "y" ]; then
        echo "   🗑️  Deleting bucket..."
        if wrangler r2 bucket delete "$bucket_name" --force 2>/dev/null; then
            echo "   ✅ Bucket deleted"
            echo "   🆕 Creating new bucket..."
            if wrangler r2 bucket create "$bucket_name" 2>/dev/null; then
                echo "   ✅ New bucket created"
            else
                echo "   ❌ Failed to create new bucket - please create manually"
            fi
        else
            echo "   ❌ Failed to delete bucket - it may not exist or may contain objects"
            echo "   💡 Try deleting all objects first via the Cloudflare Dashboard"
        fi
    else
        echo "   ⏭️  Skipping R2 bucket cleanup"
    fi
    echo ""
}

# Show current state first
echo "🔍 Checking current state in remote storage..."
echo "───────────────────────────────────────────"

# Check each namespace
for binding in "IMAGE_DATA" "USER_DATA" "GAME_DATA"; do
    case $binding in
        "IMAGE_DATA") id="ed09b9a23eeb4a58b500f03e636ea811" ;;
        "USER_DATA") id="7fb86fe8775e461996350c8f2dc6f86b" ;;
        "GAME_DATA") id="8b8aaaeb40844b2c9591c98860b9dd47" ;;
    esac
    
    keys=$(wrangler kv key list --namespace-id="$id" --remote 2>/dev/null || echo "[]")
    key_count=$(echo "$keys" | jq length 2>/dev/null || echo "0")
    echo "   $binding: $key_count keys"
done

echo ""
echo "🗂️  Clearing KV Namespaces..."
echo "─────────────────────────────"
clear_kv_namespace "IMAGE_DATA" "ed09b9a23eeb4a58b500f03e636ea811"
clear_kv_namespace "USER_DATA" "7fb86fe8775e461996350c8f2dc6f86b"
clear_kv_namespace "GAME_DATA" "8b8aaaeb40844b2c9591c98860b9dd47"

# Handle R2 Bucket
echo "🪣 Handling R2 Bucket..."
echo "─────────────────────"
clear_r2_bucket "whereami-images"

echo "🎉 Cleanup process completed!"
echo ""
echo -e "${GREEN}✅ KV namespace cleanup attempted.${NC}"
echo -e "${GREEN}✅ R2 bucket handling completed.${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify cleanup worked by checking your app"
echo "  2. Deploy your app: npm run build && npx wrangler pages deploy .svelte-kit/cloudflare"
echo "  3. Test the clean state in your browser"
echo "  4. Start adding your new features!" 