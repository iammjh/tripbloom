#!/usr/bin/env bash

# TripBloom Deployment Helper Script

echo "🚀 TripBloom Deployment Setup"
echo "=============================="
echo ""

# Check if Git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - TripBloom"
fi

echo ""
echo "✅ Setup complete! Next steps:"
echo ""
echo "1️⃣  Push to GitHub:"
echo "   git remote add origin <your-repo-url>"
echo "   git push -u origin main"
echo ""
echo "2️⃣  Set up MongoDB Atlas:"
echo "   - Visit: https://www.mongodb.com/cloud/atlas"
echo "   - Create a free cluster"
echo "   - Get your MONGODB_URI connection string"
echo ""
echo "3️⃣  Deploy Backend to Railway:"
echo "   - Visit: https://railway.app"
echo "   - Click 'New Project' → 'Deploy from GitHub'"
echo "   - Add environment variables"
echo ""
echo "4️⃣  Deploy Frontend to Vercel:"
echo "   - Visit: https://vercel.com"
echo "   - Click 'New Project' → Import Repository"
echo "   - Set root to 'frontend'"
echo ""
echo "📖 For detailed instructions, see: DEPLOYMENT.md"
