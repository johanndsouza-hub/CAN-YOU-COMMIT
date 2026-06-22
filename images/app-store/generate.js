const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourceDir = path.resolve(__dirname, '..');
const outputDir = __dirname;
const concepts = JSON.parse(fs.readFileSync(path.join(__dirname, 'concepts.json'), 'utf8'));
const template = fs.readFileSync(path.join(__dirname, 'frame-template.svg'), 'utf8');
const sizes = [
  { width: 1284, height: 2778, label: '1284x2778' },
  { width: 1242, height: 2208, label: '1242x2208' }
];

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function svgBuffer(svg) {
  return Buffer.from(svg);
}

function headlineSizeFor(concept, compact) {
  if (compact) return 77;
  const longest = Math.max(...concept.headline.map(line => line.length));
  if (longest >= 25) return 70;
  if (longest >= 23) return 76;
  if (longest >= 20) return 84;
  return 96;
}

function renderTemplate(width, height, concept, cfg) {
  const headline = concept.headline.map((line, index) =>
    `<tspan x="${cfg.margin}" dy="${index === 0 ? 0 : cfg.lineGap}">${esc(line)}</tspan>`
  ).join('');
  const headlineBottom = cfg.headlineY + (concept.headline.length - 1) * cfg.lineGap;
  const values = {
    WIDTH: width,
    HEIGHT: height,
    ACCENT: concept.accent,
    GLOW_X: width * 0.88,
    GLOW_Y: height * 0.08,
    GLOW_RX: width * 0.55,
    GLOW_RY: height * 0.24,
    MARGIN: cfg.margin,
    EYEBROW_Y: cfg.eyebrowY,
    EYEBROW_SIZE: cfg.eyebrowSize,
    TRACKING: cfg.tracking,
    EYEBROW: esc(concept.eyebrow),
    HEADLINE_Y: cfg.headlineY,
    HEADLINE_SIZE: cfg.headlineSize,
    HEADLINE: headline,
    SUB_Y: headlineBottom + cfg.subGap,
    SUB_SIZE: cfg.subSize,
    SUBHEADLINE: esc(concept.subheadline),
    FOOTER_BASELINE: height - cfg.footerY,
    FOOTER_SIZE: cfg.footerSize,
    FOOTER_RIGHT: width - cfg.margin,
    FOOTER_SMALL: cfg.footerSmall
  };
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template
  );
}

async function roundedImage(file, width, height, radius, position, extract) {
  let pipeline = sharp(path.join(sourceDir, file));
  if (extract) pipeline = pipeline.extract(extract);
  const image = await pipeline.resize(width, height, { fit: 'cover', position }).png().toBuffer();
  const mask = svgBuffer(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="${radius}" fill="white"/></svg>`
  );
  return sharp(image).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function render(concept, size) {
  const { width, height, label } = size;
  const compact = height < 2500;
  const cfg = compact ? {
    margin: 78, eyebrowY: 94, eyebrowSize: 24, tracking: 3,
    headlineY: 190, headlineSize: 77, lineGap: 92, subGap: 76, subSize: 31,
    imageX: 78, imageY: 555, imageW: width - 156, imageH: height - 690,
    radius: 56, footerY: 42, footerSize: 28, footerSmall: 18
  } : {
    margin: 94, eyebrowY: 118, eyebrowSize: 27, tracking: 4,
    headlineY: 230, headlineSize: 96, lineGap: 114, subGap: 86, subSize: 38,
    imageX: 112, imageY: 730, imageW: width - 224, imageH: height - 890,
    radius: 64, footerY: 54, footerSize: 31, footerSmall: 20
  };
  cfg.headlineSize = headlineSizeFor(concept, compact);

  const composites = [];
  if (concept.widgetOnly) {
    const imageHeight = Math.round(cfg.imageW * 614 / 960);
    const widget = await roundedImage(concept.image, cfg.imageW, imageHeight, 36, 'centre');
    composites.push({
      input: widget,
      left: cfg.imageX,
      top: cfg.imageY + Math.round((cfg.imageH - imageHeight) / 2)
    });
  } else {
    const screenshot = await roundedImage(
      concept.image,
      cfg.imageW,
      cfg.imageH,
      cfg.radius,
      concept.position,
      concept.extract
    );
    composites.push({ input: screenshot, left: cfg.imageX, top: cfg.imageY });
  }

  const sizeDir = path.join(outputDir, label);
  fs.mkdirSync(sizeDir, { recursive: true });
  const output = path.join(sizeDir, `${concept.slug}.png`);
  await sharp(svgBuffer(renderTemplate(width, height, concept, cfg)))
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
  for (let index = 0; index < files.length; index += 1) {
    const thumb = await sharp(files[index])
      .resize(thumbW, thumbH, { fit: 'contain', background: '#050914' })
      .png()
      .toBuffer();
    composites.push({ input: thumb, left: gap + index * (thumbW + gap), top: gap });
  }
  await sharp({ create: { width: canvasW, height: canvasH, channels: 3, background: '#050914' } })
    .composite(composites)
    .png()
    .toFile(output);
}

async function main() {
  for (const source of ['home2.PNG', 'calendar.PNG', 'friends.PNG', 'share.PNG', 'widget_rgb.png', 'largewidget.png']) {
    if (!fs.existsSync(path.join(sourceDir, source))) throw new Error(`Missing source image: images/${source}`);
  }
  if (JSON.stringify(concepts).includes('\u2014')) throw new Error('Generated copy must not contain em dashes');

  for (const size of sizes) {
    const files = [];
    for (const concept of concepts) files.push(await render(concept, size));
    await contactSheet(files, path.join(outputDir, `contact-sheet-${size.label}.png`), size.height);
  }
  console.log(`Generated ${concepts.length * sizes.length} App Store PNGs in ${outputDir}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
