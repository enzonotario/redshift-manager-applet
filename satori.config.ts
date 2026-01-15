import { defineSatoriConfig } from 'x-satori/astro'
import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read the SVG icon and convert to base64 data URL
const iconPath = join(__dirname, 'files/redshift-manager-applet@enzonotario/icons/icon.svg')
const iconSvg = readFileSync(iconPath, 'utf-8')
const iconBase64 = Buffer.from(iconSvg).toString('base64')
const iconDataUrl = `data:image/svg+xml;base64,${iconBase64}`

// Load Inter font from fontsource
// Try to find a woff font file
let fontData: ArrayBuffer
try {
  // Try latin first, then any available
  const fontPath = join(__dirname, 'node_modules', '@fontsource', 'inter', 'files', 'inter-latin-400-normal.woff')
  fontData = readFileSync(fontPath).buffer
} catch {
  try {
    // Fallback to any available woff file
    const fontPath = join(__dirname, 'node_modules', '@fontsource', 'inter', 'files', 'inter-cyrillic-ext-400-normal.woff')
    fontData = readFileSync(fontPath).buffer
  } catch {
    // If no font found, we'll need to download one
    throw new Error('Font file not found. Please ensure @fontsource/inter is installed correctly.')
  }
}

export default defineSatoriConfig({
  width: 1200,
  height: 630,
  fonts: [
    {
      name: 'Inter',
      data: fontData,
      weight: 400,
      style: 'normal',
    },
  ],
  props: {
    title: 'Redshift Manager Applet',
    description: 'A Cinnamon desktop applet for managing Redshift, providing easy control over screen color temperature and brightness to reduce eye strain.',
    icon: iconDataUrl,
  },
})
