#!/usr/bin/env bash
# ==============================================================================
# Rithamic Login / Auth Portal - Automated Production Deployment Script
# Usage: ./deploy.sh
# ==============================================================================

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

echo "========================================================"
echo " 🚀 Deploying Rithamic Auth Portal (auth.rithamic.co.in)"
echo " Directory: $REPO_DIR"
echo "========================================================"

# 1. Pull latest changes from git
echo "1. Pulling latest main branch..."
git pull origin main

# 2. Install dependencies & build bundle
echo "2. Installing dependencies and building production bundle..."
npm ci
npm run build

echo "3. Verifying build artifacts..."
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "❌ Build failed: dist/index.html not found!"
    exit 1
fi

echo "========================================================"
echo " ✅ Rithamic Auth Portal build completed successfully!"
echo " Assets are ready in $REPO_DIR/dist"
echo "========================================================"
