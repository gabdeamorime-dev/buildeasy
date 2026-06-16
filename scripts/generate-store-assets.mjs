#!/usr/bin/env node
/** Génère icon.png (1024) et splash.png (2732) pour @capacitor/assets */
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')
const assetsDir = join(root, 'assets')

const BRAND = '#2563EB'
const BRAND_DARK = '#1D4ED8'

const houseSvg = (size, fg = '#ffffff') => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="108" fill="${BRAND}"/>
  <path d="M256 96L96 224v192h128V320h64v96h128V224L256 96z" fill="${fg}" stroke="${fg}" stroke-width="8" stroke-linejoin="round"/>
  <rect x="224" y="288" width="64" height="128" rx="6" fill="${BRAND_DARK}"/>
</svg>`

const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="${BRAND}"/>
  <g transform="translate(1366 1186)">
    <path d="M0 -220L-220 0v220h140v-120h160v120h140V0L0 -220z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <rect x="-80" y="80" width="160" height="140" rx="10" fill="${BRAND_DARK}"/>
  </g>
  <text x="1366" y="1520" text-anchor="middle" fill="#fff" font-family="system-ui,-apple-system,sans-serif" font-size="120" font-weight="800" letter-spacing="-2">BuildEasy</text>
  <text x="1366" y="1620" text-anchor="middle" fill="#BFDBFE" font-family="system-ui,-apple-system,sans-serif" font-size="52" font-weight="600">Gestion de chantier BTP</text>
</svg>`

await mkdir(assetsDir, { recursive: true })

await sharp(Buffer.from(houseSvg(1024)))
  .png()
  .toFile(join(assetsDir, 'icon.png'))

await sharp(Buffer.from(splashSvg))
  .png()
  .toFile(join(assetsDir, 'splash.png'))

console.log('✓ assets/icon.png (1024×1024)')
console.log('✓ assets/splash.png (2732×2732)')
