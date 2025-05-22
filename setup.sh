#!/bin/bash

# Node Archive Browser - Setup Script
# This script helps set up the project after cloning from GitHub

echo "🚀 Setting up Node Archive Browser..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ and try again."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

echo "✅ npm found: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Install server dependencies
echo "Installing server dependencies..."
cd server
npm install

# Install client dependencies
echo "Installing client dependencies..."
cd ../client
npm install
cd ..

# Create environment files if they don't exist
echo "🔧 Setting up environment files..."

if [ ! -f "server/.env" ]; then
    cp server/.env.example server/.env
    echo "✅ Created server/.env from example"
else
    echo "ℹ️  server/.env already exists"
fi

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Created .env from example"
else
    echo "ℹ️  .env already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit server/.env to set your archive location:"
echo "   ARCHIVE_ROOT=/path/to/your/exploded_archive_node"
echo ""
echo "2. Start the application:"
echo "   npm run start"
echo ""
echo "3. Open your browser to http://localhost:5173"
echo ""
echo "📚 For more information, see README.md"
