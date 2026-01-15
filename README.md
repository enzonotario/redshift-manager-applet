# Redshift Manager Applet

A Cinnamon desktop applet for managing [Redshift](http://jonls.dk/redshift/), providing easy control over screen color temperature and brightness to reduce eye strain.

## Features

- **Temperature & Brightness Control**: Adjust day/night color temperature (1000K-10000K) and brightness (10-100%) via intuitive sliders
- **Automatic Day/Night Switching**: Automatic sunrise/sunset calculation based on location or manual time override
- **Presets System**: Create, save, and quickly apply custom presets with keyboard shortcuts
- **Global Keyboard Shortcuts**: Toggle Redshift, adjust temperature/brightness, and apply presets via hotkeys
- **Configuration Management**: Export/import settings to JSON files
- **Location Auto-Detection**: Automatic latitude/longitude detection via GeoIP

## Requirements

- Linux Mint with Cinnamon desktop environment
- Redshift (`sudo apt install redshift`)
- curl, zenity, notify-send (usually pre-installed)

## Installation

```bash
curl https://github.com/enzonotario/redshift-manager-applet/raw/main/install.sh -sSfL | bash 
```

## Uninstallation

```bash
curl https://github.com/enzonotario/redshift-manager-applet/raw/main/uninstall.sh -sSfL | bash 
```

The uninstall script will:
- Remove the applet from your system
- Optionally remove configuration files (you'll be prompted)
- Reload Cinnamon to apply changes

## Usage

- **Toggle Redshift**: Click the applet icon and use the "Enable Redshift" switch
- **Adjust Settings**: Use the day/night temperature and brightness sliders in the menu
- **Presets**: Access saved presets from the menu or use keyboard shortcuts
- **Settings**: Click "Settings" in the menu to access all configuration options

### Settings Pages

1. **General**: Auto-update interval, smooth transitions
2. **Temperature**: Day/night temperature and brightness values
3. **Appearance**: Custom icon, label display
4. **Keyboard Shortcuts**: Configure global hotkeys
5. **Presets**: Manage saved presets

## Development

```bash
# Reload Cinnamon after code changes
npm run reload-cinnamon

# Full refresh (uninstall, install, reload)
npm run refresh

# Uninstall
npm run uninstall-applet

# Generate OG image
npm run generate-og
```

The OG image generation uses [x-satori](https://github.com/Zhengqbbb/x-satori) to create an Open Graph image for social media sharing. The generated image (`og-image.svg`) includes the applet icon and key features.

## Releasing

Releases are automatically created when you push a tag:

```bash
# Update version in package.json, then:
git tag v0.0.1
git push origin v0.0.1
```

The GitHub Actions workflow will automatically:
- Generate the release archive (`redshift-manager-applet@enzonotario_{VERSION}.tar.gz`)
- Create/update the GitHub release
- Upload the archive file

## Configuration

Settings are stored in:
- Cinnamon settings: `~/.cinnamon/configs/redshift-manager-applet@enzonotario/`
- Config file: `~/.config/redshift-manager-applet/config.json`

## Acknowledgements

This project is heavily inspired by [QRedshiftCinnamon](https://github.com/raphaelquintao/QRedshiftCinnamon) by Raphael Quintao. Thanks for the great work!

## License

MIT License
