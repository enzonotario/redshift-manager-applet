#!/bin/bash

echo "Reloading Cinnamon..."
echo ""
echo "This will restart Cinnamon to apply applet changes."
echo "Your windows will remain open."
echo ""

read -p "Press Enter to reload Cinnamon (or Ctrl+C to cancel)..."

cinnamon --replace &

echo ""
echo "Cinnamon is reloading..."
echo "The applet should now appear in the panel."
echo ""
