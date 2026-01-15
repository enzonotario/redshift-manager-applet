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
HTTP_CODE=$(curl -s -o "$TARGET/$LAST_VERSION.tar.gz" -w "%{http_code}" -L "$ZIP_URL")

if [ "$HTTP_CODE" != "200" ]; then
  qecho "\n => "; qecho "Failed to download (HTTP $HTTP_CODE).\n" "1;31"
  qecho " => "; qecho "URL: $ZIP_URL\n" "1;31"
  qecho " => "; qecho "Make sure the release file exists on GitHub.\n" "1;31"
  rm -f "$TARGET/$LAST_VERSION.tar.gz"
  exit 1
fi

# Verificar que el archivo descargado sea realmente un tar.gz
if ! file "$TARGET/$LAST_VERSION.tar.gz" | grep -q "gzip compressed"; then
  qecho "\n => "; qecho "Downloaded file is not a valid tar.gz archive.\n" "1;31"
  qecho " => "; qecho "The file might be an HTML error page. Checking...\n" "1;31"
  if head -n 1 "$TARGET/$LAST_VERSION.tar.gz" | grep -q "<!DOCTYPE html\|<html"; then
    qecho " => "; qecho "The downloaded file is HTML. The release file may not exist.\n" "1;31"
    qecho " => "; qecho "Expected file: $FILE_NAME\n" "1;31"
    qecho " => "; qecho "Please create a release on GitHub with this file.\n" "1;31"
  fi
  rm -f "$TARGET/$LAST_VERSION.tar.gz"
  exit 1
fi

qecho " Done!\n" "1"

qecho " => " "1"; qecho "Installing..." "0;32"
if ! tar -xzf "$TARGET/$LAST_VERSION.tar.gz" -C "$TARGET" 2>/dev/null; then
  qecho "\n => "; qecho "Failed to extract archive. The file may be corrupted.\n" "1;31"
  rm -f "$TARGET/$LAST_VERSION.tar.gz"
  exit 1
fi

# Verificar que el directorio del applet se haya extraído correctamente
if [ ! -d "$TARGET/$APPLET_UUID" ]; then
  qecho "\n => "; qecho "Error: Expected directory '$APPLET_UUID' not found in archive.\n" "1;31"
  qecho " => "; qecho "The archive should contain '$APPLET_UUID/' at the root level.\n" "1;31"
  qecho " => "; qecho "Archive contents in $TARGET:\n" "1;31"
  ls -la "$TARGET" | grep -E "^d" | head -n 10
  rm -f "$TARGET/$LAST_VERSION.tar.gz"
  exit 1
fi

rm -f "$TARGET/$LAST_VERSION.tar.gz"
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
