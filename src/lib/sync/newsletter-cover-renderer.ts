import { readFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const MASTER_WIDTH = 900
const MASTER_HEIGHT = 600
const SQUARE_SIZE = 300

function xml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

async function brandAssets() {
  const [logoSource, font] = await Promise.all([
    readFile(path.join(process.cwd(), "public/onboarding/ipn-logo.png")),
    readFile(
      path.join(
        process.cwd(),
        "public/newsletters/brand/Geist-Regular.ttf",
      ),
    ),
  ])
  const logo = await sharp(logoSource)
    .trim({ background: "#ffffff", threshold: 8 })
    .resize(66, 66, { fit: "fill" })
    .png()
    .toBuffer()
  return {
    logo: logo.toString("base64"),
    font: font.toString("base64"),
  }
}

function brandLayer(options: {
  logo: string
  font: string
  monthName: string
  year: number
}) {
  return Buffer.from(`
    <svg width="${MASTER_WIDTH}" height="${MASTER_HEIGHT}" viewBox="0 0 ${MASTER_WIDTH} ${MASTER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#10071e" stop-opacity="0.965"/>
          <stop offset="27.8%" stop-color="#10071e" stop-opacity="0.965"/>
          <stop offset="35.7%" stop-color="#10071e" stop-opacity="0.814"/>
          <stop offset="43.6%" stop-color="#10071e" stop-opacity="0.482"/>
          <stop offset="51.6%" stop-color="#10071e" stop-opacity="0.151"/>
          <stop offset="59.4%" stop-color="#10071e" stop-opacity="0"/>
          <stop offset="100%" stop-color="#10071e" stop-opacity="0"/>
        </linearGradient>
        <clipPath id="logo-circle"><circle cx="70" cy="115" r="33"/></clipPath>
        <style>
          @font-face {
            font-family: "IPN Geist";
            src: url(data:font/ttf;base64,${options.font}) format("truetype");
          }
          text { font-family: "IPN Geist", sans-serif; fill: white; }
          .wordmark { font-size: 14px; letter-spacing: 0.65px; }
          .title { font-size: 70px; stroke: white; stroke-width: 2px; paint-order: stroke; }
          .date { font-size: 29px; stroke: white; stroke-width: 1px; paint-order: stroke; }
        </style>
      </defs>
      <rect width="900" height="600" fill="url(#scrim)"/>
      <image href="data:image/png;base64,${options.logo}" x="37" y="82" width="66" height="66" clip-path="url(#logo-circle)"/>
      <text class="wordmark" x="111" y="109">INTERCOLLEGIATE</text>
      <text class="wordmark" x="111" y="126">PSYCHEDELICS NETWORK</text>
      <g transform="translate(37 0) scale(1.09 1)">
        <text class="title" x="0" y="217">IPN</text>
        <text class="title" x="0" y="283">Members’</text>
        <text class="title" x="0" y="349">Newsletter</text>
      </g>
      <text class="date" x="0" y="422" transform="translate(39 0) scale(1.08 1)">${xml(options.monthName)} ${options.year}</text>
      <rect x="40" y="452" width="67" height="4" rx="2" fill="white"/>
    </svg>
  `)
}

export async function renderNewsletterCovers(options: {
  photo: Buffer
  monthName: string
  year: number
}) {
  const metadata = await sharp(options.photo).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error("Generated newsletter photo has no dimensions")
  }
  const ratio = metadata.width / metadata.height
  if (Math.abs(ratio - 1.5) > 0.03) {
    throw new Error(
      `Generated newsletter photo must be 3:2; received ${metadata.width}x${metadata.height}`,
    )
  }

  const photo = await sharp(options.photo)
    .resize(MASTER_WIDTH, MASTER_HEIGHT, { fit: "cover" })
    .png()
    .toBuffer()
  const assets = await brandAssets()
  const cover = await sharp(photo)
    .composite([
      {
        input: brandLayer({
          ...assets,
          monthName: options.monthName,
          year: options.year,
        }),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer()
  const square = await sharp(cover)
    .extract({ left: 0, top: 0, width: 600, height: 600 })
    .resize(SQUARE_SIZE, SQUARE_SIZE)
    .png({ compressionLevel: 9 })
    .toBuffer()

  return { cover, square }
}
