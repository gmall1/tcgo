#!/bin/bash

# Smart Copy Script — Update your running instance without reinstalling
# Usage: ./copy-update.sh /path/to/new/zip.zip

if [ $# -eq 0 ]; then
    echo "Usage: ./copy-update.sh /path/to/new/zip.zip"
    echo ""
    echo "Examples:"
    echo "  ./copy-update.sh ~/Downloads/local-tcg-studio.zip"
    echo "  ./copy-update.sh ./local-tcg-studio.zip"
    exit 1
fi

ZIP_FILE="$1"
if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ File not found: $ZIP_FILE"
    exit 1
fi

TEMP_DIR="/tmp/tcg-update-$$"
mkdir -p "$TEMP_DIR"

echo "📦 Extracting $ZIP_FILE..."
unzip -q "$ZIP_FILE" -d "$TEMP_DIR"

EXTRACTED_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "*tcg*" | head -1)
if [ -z "$EXTRACTED_DIR" ]; then
    EXTRACTED_DIR=$(ls -td "$TEMP_DIR"/*/ | head -1)
fi

if [ ! -d "$EXTRACTED_DIR" ]; then
    echo "❌ Could not find extracted directory"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "📂 Extracted to: $EXTRACTED_DIR"
echo ""
echo "🔍 Changed files:"

# Find changed files (simplified — just check what's new/modified)
CHANGED_FILES=$(find "$EXTRACTED_DIR/src" -type f \( -name "*.jsx" -o -name "*.js" \) -printf "%T@ %p\n" | sort -nr | head -20)

if [ -z "$CHANGED_FILES" ]; then
    echo "⚠️  No files found to update"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Copy files to current directory
CURRENT_DIR="${PWD}"

if [ ! -d "$CURRENT_DIR/src" ]; then
    echo "❌ Not in a TCG project directory (no src/ found)"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo ""
echo "📋 Files to copy:"
find "$EXTRACTED_DIR/src" -type f \( -name "*.jsx" -o -name "*.js" \) | while read FILE; do
    RELATIVE=$(echo "$FILE" | sed "s|^$EXTRACTED_DIR/||")
    echo "   ✓ $RELATIVE"
done

echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    rm -rf "$TEMP_DIR"
    exit 0
fi

# Copy all source files
echo "📥 Copying files..."
cp -r "$EXTRACTED_DIR/src/"* "$CURRENT_DIR/src/" 2>/dev/null

# Optional: copy docs
if [ -f "$EXTRACTED_DIR/DEVELOPMENT_WORKFLOW.md" ]; then
    cp "$EXTRACTED_DIR/DEVELOPMENT_WORKFLOW.md" "$CURRENT_DIR/" 2>/dev/null
    echo "   ✓ DEVELOPMENT_WORKFLOW.md"
fi

if [ -f "$EXTRACTED_DIR/MECHANIC_STUDIO_PRODUCTION.md" ]; then
    cp "$EXTRACTED_DIR/MECHANIC_STUDIO_PRODUCTION.md" "$CURRENT_DIR/" 2>/dev/null
    echo "   ✓ MECHANIC_STUDIO_PRODUCTION.md"
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Update complete!"
echo ""
echo "🔄 Your running dev server should auto-reload."
echo "💡 If you see errors, refresh your browser (Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R on Mac)"
echo ""
echo "Next steps:"
echo "  1. Check your browser — it should already show the updates"
echo "  2. Test the new features"
echo "  3. If something broke, the old files are still in your git history"
