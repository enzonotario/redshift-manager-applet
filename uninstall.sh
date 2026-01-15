#!/bin/bash
qecho() {  echo -n -e "\e[$2m$1\e[0m"; }

TARGET=~/.local/share/cinnamon/applets
APPLET_UUID="redshift-manager-applet@enzonotario"
CONFIG_DIR="$HOME/.cinnamon/configs/$APPLET_UUID"
CONFIG_FILE="$HOME/.config/redshift-manager-applet/config.json"

qecho "Redshift Manager Applet Uninstallation Script! \n" "1"

if [ "$DESKTOP_SESSION" = 'cinnamon-wayland' ]; then
  qecho " => "; qecho "Applet not supported on Wayland, please run Cinnamon in X11!\n" "1;31"
  exit 1
elif [ "$DESKTOP_SESSION" != 'cinnamon' ]; then
  qecho " => "; qecho "You are not running Cinnamon\n" "1;31"
  exit 1
fi

# Verificar si el applet está instalado
if [ ! -d "$TARGET/$APPLET_UUID" ] && [ ! -L "$TARGET/$APPLET_UUID" ]; then
  qecho " => "; qecho "Applet is not installed.\n" "1;33"
  exit 0
fi

qecho " => " "1"; qecho "Removing applet..." "0;32"
if [ -L "$TARGET/$APPLET_UUID" ]; then
    rm "$TARGET/$APPLET_UUID"
elif [ -d "$TARGET/$APPLET_UUID" ]; then
    rm -rf "$TARGET/$APPLET_UUID"
fi
qecho " Done!\n" "1"

# Preguntar si desea eliminar la configuración
if [ -d "$CONFIG_DIR" ] || [ -f "$CONFIG_FILE" ]; then
  qecho " => " "1"; qecho "Configuration files found.\n" "0;33"
  qecho "Do you want to remove configuration files? (y/N): " "0"
  read -r response
  if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    qecho " => " "1"; qecho "Removing configuration files..." "0;32"
    [ -d "$CONFIG_DIR" ] && rm -rf "$CONFIG_DIR"
    [ -f "$CONFIG_FILE" ] && rm -f "$CONFIG_FILE"
    [ -d "$HOME/.config/redshift-manager-applet" ] && rmdir "$HOME/.config/redshift-manager-applet" 2>/dev/null || true
    qecho " Done!\n" "1"
  else
    qecho " => "; qecho "Configuration files kept.\n" "0;33"
  fi
fi

qecho " => " "1"; qecho "Reloading Cinnamon..." "0;32"
if dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:"$APPLET_UUID" string:'APPLET' 2>/dev/null; then
  qecho " Done!\n" "1"
else
  qecho "\n => "; qecho "Could not reload applet automatically.\n" "1;33"
  qecho " => "; qecho "Please restart Cinnamon (Ctrl+Alt+Esc) or log out/in.\n" "0"
fi

qecho "\nUninstallation complete! \n" "1;32"
qecho "The applet has been removed from your system.\n" "0"
