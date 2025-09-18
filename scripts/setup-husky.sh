#!/bin/bash
# Setup Husky hooks for the project

echo "🔧 Setting up Husky hooks..."

# Initialize Husky (this creates .husky/_/husky.sh if needed)
npx husky install

# Make sure the pre-commit hook is executable
chmod +x .husky/pre-commit

echo "✅ Husky setup complete!"
echo "📋 The pre-commit hook will now automatically regenerate DEBUG_BUNDLE.md before each commit."