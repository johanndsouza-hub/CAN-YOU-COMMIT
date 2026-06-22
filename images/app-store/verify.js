const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const concepts = require('./concepts.json');

const sizes = [
  { width: 1284, height: 2778, label: '1284x2778' },
  { width: 1242, height: 2208, label: '1242x2208' }
];

(async () => {
  let count = 0;
  for (const size of sizes) {
    for (const concept of concepts) {
      const file = path.join(__dirname, size.label, `${concept.slug}.png`);
      if (!fs.existsSync(file)) throw new Error(`Missing export: ${file}`);
      const metadata = await sharp(file).metadata();
      if (metadata.format !== 'png' || metadata.width !== size.width || metadata.height !== size.height) {
        throw new Error(`Invalid export: ${file}`);
      }
      count += 1;
    }
  }
  if (JSON.stringify(concepts).includes('\u2014')) throw new Error('Generated copy contains an em dash');
  console.log(`Verified ${count} PNG exports and all configured copy.`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
