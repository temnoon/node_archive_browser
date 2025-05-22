#!/bin/bash

# Script to apply fixes for loading issues in Archive Browser

# Make sure we're in the project directory
cd /Users/tem/nab

# Backup original files
echo "Creating backups of original files..."
cp client/src/ConversationView.jsx client/src/ConversationView.jsx.bak
cp client/src/ConversationList.jsx client/src/ConversationList.jsx.bak
cp client/src/utils/messageUtils.js client/src/utils/messageUtils.js.bak 2>/dev/null

# Create utils directory if it doesn't exist
if [ ! -d "client/src/utils" ]; then
  echo "Creating utils directory..."
  mkdir -p client/src/utils
fi

# Create components directory if it doesn't exist
if [ ! -d "client/src/components" ]; then
  echo "Creating components directory..."
  mkdir -p client/src/components
fi

# Apply fixes
echo "Applying fixes..."
mv client/src/ConversationView.jsx.fixed client/src/ConversationView.jsx
mv client/src/ConversationList.jsx.fixed client/src/ConversationList.jsx
mv client/src/utils/messageUtils.js.fixed client/src/utils/messageUtils.js

# Copy utility files and components if they don't exist
for file in fetchUtils.js mediaUtils.js; do
  if [ ! -f "client/src/utils/$file" ]; then
    echo "Creating $file..."
    touch "client/src/utils/$file"
  fi
done

# Reload the application
echo "Fixes applied. Please restart the development server:"
echo "cd client && npm run dev"

echo "If the issue persists, you can use the debug scripts:"
echo "1. Run the debug-console.js script in your browser console"
echo "2. Analyze the most frequent console messages with window.getConsoleStats()"
echo "3. Use the information to identify additional logging issues"

echo "To revert changes:"
echo "cp client/src/ConversationView.jsx.bak client/src/ConversationView.jsx"
echo "cp client/src/ConversationList.jsx.bak client/src/ConversationList.jsx"
echo "cp client/src/utils/messageUtils.js.bak client/src/utils/messageUtils.js"
