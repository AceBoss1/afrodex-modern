#!/bin/bash

# AfroDex Quick Start Script

echo "🚀 Welcome to AfroDex Setup!"
echo "=============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    cp .env.example .env.local
    echo "⚠️  Please edit .env.local and add your API keys:"
    echo "   - NEXT_PUBLIC_ALCHEMY_API_KEY"
    echo "   - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
    echo ""
    read -p "Press Enter after you've updated .env.local..."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Add token logo images to public/tokens/"
echo "   2. Make sure your .env.local has all required keys"
echo "   3. Run: npm run dev"
echo "   4. Open: http://localhost:3000"
echo ""
echo "📚 For more information, see README.md and DEPLOYMENT.md"
echo ""
echo "🎉 Ready to start AfroDex!"
