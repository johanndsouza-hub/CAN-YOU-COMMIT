const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourceDir = path.resolve(__dirname, 'images');
const outputDir = __dirname;
const concepts = JSON.parse(fs.readFileSync(path.join(__dirname, 'concepts.json'), 'utf8'));
const template = fs.readFileSync(path.join(__dirname, 'frame-template.svg'), 'utf8');
const sizes = [
  { width: 1284, height: 2778, label: '1284x2778' },
  { width: 1242, height: 2208, label: '1242x2208' }
];

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function svgBuf(svg) { return Buffer.from(svg); }

// Phone frame: dark bezel with white outline, Dynamic Island, home indicator.
// Returns an SVG buffer sized phoneW x phoneH with transparent screen cutout.
function phoneFrameSvg(phoneW, phoneH, bezelSide, bezelTop, bezelBottom, screenR) {
  const bodyR = screenR + bezelSide;
  const stroke = 2.5;
  const screenW = phoneW - bezelSide * 2;
  const screenH = phoneH - bezelTop - bezelBottom;
  const pillW = Math.round(phoneW * 0.25);
  const pillH = Math.round(bezelTop * 0.22);
  const pillY = Math.round(bezelTop * 0.28);
  const indW = Math.round(phoneW * 0.25);
  const indH = Math.round(bezelBottom * 0.13);
  const indY = phoneH - Math.round(bezelBottom * 0.32);
  return `<svg width="${phoneW}" height="${phoneH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <mask id="m">
        <rect width="${phoneW}" height="${phoneH}" rx="${bodyR}" fill="white"/>
        <rect x="${bezelSide}" y="${bezelTop}" width="${screenW}" height="${screenH}" rx="${screenR}" fill="black"/>
      </mask>
    </defs>
    <rect width="${phoneW}" height="${phoneH}" rx="${bodyR}" fill="rgba(10,14,28,0.75)" mask="url(#m)"/>
    <rect x="${stroke/2}" y="${stroke/2}" width="${phoneW-stroke}" height="${phoneH-stroke}" rx="${bodyR}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="${stroke}"/>
    <rect x="${(phoneW-pillW)/2}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH/2}" fill="rgba(0,0,0,0.92)"/>
    <rect x="${(phoneW-indW)/2}" y="${indY}" width="${indW}" height="${indH}" rx="${indH/2}" fill="rgba(255,255,255,0.3)"/>
  </svg>`;
}

function headlineSizeFor(concept, compact) {
  const longest = Math.max(...concept.headline.map(l => l.length));
  if (compact) {
    if (longest >= 25) return 68;
    if (longest >= 20) return 76;
    return 84;
  }
  if (longest >= 25) return 86;
  if (longest >= 20) return 96;
  return 108;
}

function renderTemplate(width, height, concept, cfg) {
  const headlineSize = headlineSizeFor(concept, height < 2500);
  const lineGap = Math.round(headlineSize * 1.16);
  const headline = concept.headline.map((line, i) =>
    `<tspan x="${cfg.margin}" dy="${i === 0 ? 0 : lineGap}">${esc(line)}</tspan>`
  ).join('');
  const values = {
    WIDTH: width, HEIGHT: height,
    ACCENT: concept.accent,
    GLOW_X: Math.round(width * 0.82), GLOW_Y: Math.round(height * 0.06),
    GLOW_RX: Math.round(width * 0.55), GLOW_RY: Math.round(height * 0.2),
    MARGIN: cfg.margin,
    HEADLINE_Y: cfg.headlineY,
    HEADLINE_SIZE: headlineSize,
    HEADLINE: headline,
    FOOTER_BASELINE: height - cfg.footerPad,
    FOOTER_SIZE: cfg.footerSize,
    TRACKING: cfg.tracking
  };
  return Object.entries(values).reduce(
    (r, [k, v]) => r.replaceAll(`{{${k}}}`, String(v)), template
  );
}

async function roundedImage(file, w, h, radius, position, extract) {
  let p = sharp(path.join(sourceDir, file));
  if (extract) p = p.extract(extract);
  const img = await p.resize(w, h, { fit: 'cover', position }).png().toBuffer();
  const mask = svgBuf(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" rx="${radius}" fill="white"/></svg>`);
  return sharp(img).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function render(concept, size) {
  const { width, height, label } = size;
  const compact = height < 2500;

  // Phone frame geometry
  const phoneW = 1000;
  const bezelSide = compact ? 20 : 22;
  const bezelTop  = compact ? 60 : 70;
  const bezelBottom = compact ? 44 : 52;
  const screenR   = compact ? 54 : 62;
  const bodyR     = screenR + bezelSide;
  const screenW   = phoneW - bezelSide * 2;

  // Layout: headline at top, then phone frame fills most of canvas
  const cfg = compact ? {
    margin: 76, headlineY: 108, footerPad: 50, footerSize: 25, tracking: 3
  } : {
    margin: 94, headlineY: 136, footerPad: 62, footerSize: 30, tracking: 4
  };

  const headlineSize = headlineSizeFor(concept, compact);
  const lineGap = Math.round(headlineSize * 1.16);
  const headlineLines = concept.headline.length;
  // headline block bottom = headlineY + (lines-1)*lineGap + headlineSize*0.28 (descender)
  const headlineBottom = cfg.headlineY + (headlineLines - 1) * lineGap + Math.round(headlineSize * 0.28);
  const phoneGap = compact ? 48 : 56;
  const phoneY = headlineBottom + phoneGap;

  // Phone height: fill canvas leaving footer zone
  const footerZone = compact ? 100 : 130;
  const phoneH = height - phoneY - footerZone;
  const phoneX = Math.round((width - phoneW) / 2);

  const screenH = phoneH - bezelTop - bezelBottom;
  const screenX = phoneX + bezelSide;
  const screenY = phoneY + bezelTop;

  const composites = [];

  if (concept.widgetOnly) {
    const widgetH = Math.round(screenW * 614 / 960);
    const widget = await roundedImage(concept.image, screenW, widgetH, 36, 'centre');
    composites.push({
      input: widget,
      left: screenX,
      top: screenY + Math.round((screenH - widgetH) / 2)
    });
  } else {
    const screenshot = await roundedImage(
      concept.image, screenW, screenH, screenR, concept.position, concept.extract
    );
    composites.push({ input: screenshot, left: screenX, top: screenY });
  }

  // Phone frame overlay (on top of screenshot)
  const frameBuffer = svgBuf(phoneFrameSvg(phoneW, phoneH, bezelSide, bezelTop, bezelBottom, screenR));
  composites.push({ input: frameBuffer, left: phoneX, top: phoneY });

  const sizeDir = path.join(outputDir, label);
  fs.mkdirSync(sizeDir, { recursive: true });
  const output = path.join(sizeDir, `${concept.slug}.png`);

  await sharp(svgBuf(renderTemplate(width, height, concept, cfg)))
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(output);
  return output;
}

async function contactSheet(files, output, height) {
  const thumbW = 257;
  const thumbH = Math.round(thumbW * height / 1284);
  const gap = 28;
  const canvasW = gap + files.length * (thumbW + gap);
  const canvasH = thumbH + gap * 2;
  const composites = [];
  for (let i = 0; i < files.length; i++) {
    const thumb = await sharp(files[i])
      .resize(thumbW, thumbH, { fit: 'contain', background: '#050914' })
      .png().toBuffer();
    composites.push({ input: thumb, left: gap + i * (thumbW + gap), top: gap });
  }
  await sharp({ create: { width: canvasW, height: canvasH, channels: 3, background: '#050914' } })
    .composite(composites).png().toFile(output);
}

async function main() {
  const required = ['home2.PNG', 'calendar.PNG', 'friends3.png', 'share.PNG', 'widget_rgb.png'];
  for (const src of required) {
    if (!fs.existsSync(path.join(sourceDir, src))) throw new Error(`Missing: images/${src}`);
  }
  if (JSON.stringify(concepts).includes('—')) throw new Error('Em dash detected in copy');

  for (const size of sizes) {
    const files = [];
    for (const concept of concepts) files.push(await render(concept, size));
    await contactSheet(files, path.join(outputDir, `contact-sheet-${size.label}.png`), size.height);
    console.log(`Generated ${size.label} set`);
  }
  console.log(`Done: ${concepts.length * sizes.length} PNGs`);
}

main().catch(e => { console.error(e); process.exit(1); });
