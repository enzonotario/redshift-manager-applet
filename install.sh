#!/bin/bash
qecho() {  echo -n -e "\e[$2m$1\e[0m"; }

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
USER=$(logname)

TARGET=~/.local/share/cinnamon/applets
APPLET_UUID="redshift-manager-applet@enzonotario"
REPO_OWNER="enzonotario"
REPO_NAME="redshift-manager-applet"

qecho "Redshift Manager Applet Installation Script! \n" "1"

if [ "$DESKTOP_SESSION" = 'cinnamon-wayland' ]; then
  qecho " => "; qecho "Applet not supported on Wayland, please run Cinnamon in X11!\n" "1;31"
  exit 1
elif [ "$DESKTOP_SESSION" != 'cinnamon' ]; then
  qecho " => "; qecho "You are not running Cinnamon\n" "1;31"
  exit 1
fi

qecho " => " "1"; qecho "Checking for latest version..." "0;32"
TAG_NAME=$(curl -sSL "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest" 2>/dev/null | sed -n -E 's/.+"tag_name"\s*:\s*"(.+)".+/\1/p')

if [ "$TAG_NAME" = '' ]; then
  qecho "\n => "; qecho "Failed to get version, check your internet connection.\n" "1;31"
  qecho " => "; qecho "Make sure you have created a release on GitHub.\n" "1;31"
  exit 1
fi

# Remover el prefijo 'v' si existe para el nombre del archivo
LAST_VERSION=$(echo "$TAG_NAME" | sed 's/^v//')

FILE_NAME="${APPLET_UUID}_${LAST_VERSION}.tar.gz"
ZIP_URL="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/${TAG_NAME}/${FILE_NAME}"

qecho " Done!\n" "1"
qecho "Latest Version: " "1;33"; qecho "${LAST_VERSION}\n" "1;33"

mkdir -p $TARGET

PREVIOUS=false

if [ -d "$TARGET/$APPLET_UUID" ]; then
    rm -R "$TARGET/$APPLET_UUID"
    PREVIOUS=true
fi

qecho " => " "1"; qecho "Downloading files..." "0;32"
if curl -s -o "$TARGET/$LAST_VERSION.tar.gz" -L "$ZIP_URL"; then
  qecho " Done!\n" "1"
else
  qecho "\n => "; qecho "Failed to download, check your internet connection.\n" "1;31"
  exit 1
fi

qecho " => " "1"; qecho "Installing..." "0;32"
tar -xzf "$TARGET/$LAST_VERSION.tar.gz" -C "$TARGET"
rm "$TARGET/$LAST_VERSION.tar.gz"
qecho " Done!\n" "1"

if [ "$PREVIOUS" = true ] ; then
    qecho " => " "1"; qecho "Reloading Applet..." "0;32"
    dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:"$APPLET_UUID" string:'APPLET'
    qecho " Done!\n" "1"
else
    qecho " => " "1"; qecho "Opening Applets Settings..." "0;32"
    setsid cinnamon-settings applets &> /dev/null &
    qecho " Done!\n" "1"
fi

qecho "\nInstallation complete! \n" "1;32"
qecho "To add the applet to your panel:\n" "1"
qecho "  1. Right-click on your Cinnamon panel\n" "0"
qecho "  2. Select 'Applets'\n" "0"
qecho "  3. Find 'Redshift Manager Applet' in the list\n" "0"
qecho "  4. Click the '+' button to add it\n" "0"
