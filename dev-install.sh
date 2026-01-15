#!/bin/bash

set -e

APPLET_UUID="redshift-manager-applet@enzonotario"
APPLET_DIR="$HOME/.local/share/cinnamon/applets/$APPLET_UUID"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/files/$APPLET_UUID"

echo "Installing Redshift Manager Applet..."

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please run 'npm run build' first"
    exit 1
fi

if [ ! -f "$SOURCE_DIR/applet.js" ]; then
    echo "Error: applet.js not found"
    echo "Please run 'npm run build' first"
    exit 1
fi

mkdir -p "$HOME/.local/share/cinnamon/applets"

if [ -L "$APPLET_DIR" ]; then
    echo "Removing existing symlink..."
    rm "$APPLET_DIR"
elif [ -d "$APPLET_DIR" ]; then
    echo "Removing existing directory..."
    rm -rf "$APPLET_DIR"
fi

echo "Creating symlink: $APPLET_DIR -> $SOURCE_DIR"
ln -s "$SOURCE_DIR" "$APPLET_DIR"

echo ""
echo "✓ Installation complete!"
echo ""
echo "To add the applet to your panel:"
echo "  1. Right-click on your Cinnamon panel"
echo "  2. Select 'Applets'"
echo "  3. Find 'Redshift Manager Applet' in the list"
echo "  4. Click the '+' button to add it"
echo ""
echo "To reload after making changes:"
echo "  1. Run 'npm run build'"
echo "  2. Right-click the applet → 'Reload Applet'"
echo ""
