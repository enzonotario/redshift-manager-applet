#!/bin/bash

set -e

APPLET_UUID="redshift-manager-applet@enzonotario"
APPLET_DIR="$HOME/.local/share/cinnamon/applets/$APPLET_UUID"

echo "Uninstalling Redshift Manager Applet..."

if [ -L "$APPLET_DIR" ]; then
    echo "Removing symlink: $APPLET_DIR"
    rm "$APPLET_DIR"
    echo "✓ Applet uninstalled successfully"
elif [ -d "$APPLET_DIR" ]; then
    echo "Removing directory: $APPLET_DIR"
    rm -rf "$APPLET_DIR"
    echo "✓ Applet uninstalled successfully"
else
    echo "Applet is not installed"
fi

echo ""
echo "Note: You may need to restart Cinnamon (Ctrl+Alt+Esc) or log out/in"
echo "for the changes to take effect."
echo ""
