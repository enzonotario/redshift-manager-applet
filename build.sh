#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPLET_UUID="redshift-manager-applet@enzonotario"
SOURCE_DIR="$ROOT_DIR/files/$APPLET_UUID"
METADATA_FILE="$SOURCE_DIR/metadata.json"
DIST_DIR="$ROOT_DIR/dist"

VERSION="$(node -p "require('./package.json').version")"
FILE_NAME="${APPLET_UUID}_${VERSION}.tar.gz"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    exit 1
fi

if [ ! -f "$SOURCE_DIR/applet.js" ]; then
    echo "Error: applet.js not found in $SOURCE_DIR"
    exit 1
fi

node <<EOF
const fs = require('fs');

const metadataPath = ${METADATA_FILE@Q};
const version = ${VERSION@Q};
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

metadata.version = version;
fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 4) + '\n');
EOF

mkdir -p "$DIST_DIR"
tar -czf "$DIST_DIR/$FILE_NAME" -C "$ROOT_DIR/files" "$APPLET_UUID"

echo "✓ Build complete"
echo "  Version: $VERSION"
echo "  Archive: dist/$FILE_NAME"
