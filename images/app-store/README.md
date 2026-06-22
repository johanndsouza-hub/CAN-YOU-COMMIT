# COM-79 App Store screenshots

This folder contains the reproducible App Store screenshot source and exported PNGs for COM-79.

## Source images

The generator reads the real application screenshots from the parent `images/` folder:

- `home2.PNG`
- `calendar.PNG`
- `friends2.jpg`
- `share.PNG`
- `widget_rgb.png`
- `largewidget.png` is retained as the alternate widget source listed in COM-79

No application UI is recreated. The exports use screenshot crops without simulated phone frames or highlighted outline boxes.

## Generate and verify

Requires Node.js 20.9 or newer.

```bash
cd images/app-store
npm ci
npm run generate
npm run verify
```

`concepts.json` controls the sequence, copy, screenshot mapping, and crop selection. `frame-template.svg` controls the shared visual template. Generated marketing copy must not contain em dashes.

## Outputs

- `1284x2778/`: six 6.5-inch iPhone screenshots
- `1242x2208/`: six 5.5-inch iPhone screenshots
- `contact-sheet-*.png`: review previews for each size set

The current sequence follows the revised COM-79 description:

1. Stay Accountable To Yourself
2. Stop Starting Over
3. Accountability Changes Everything
4. Never Break Momentum
5. Every Promise Becomes Proof
6. Keep Your Promise In Sight

Screenshot 3 uses `friends2.jpg`, showing COMMIT Partner wording and Alex Chen's 60-day shared streak.
