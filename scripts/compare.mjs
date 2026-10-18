// Screenshots every visual story and compares it with the approved boards in
// docs/design/reference/. Run through `npm run compare`, which builds Storybook
// into .storybook-static first. Pass words to filter: `npm run compare -- editor`.
//
// Each board in reference/manifest.json names a Storybook story (title + name).
// The story must render one element with data-compare="root" at the board's
// size. Writes, per board, into .compare/:
//   <name>.png        the build
//   <name>-side.png   reference | build | diff, side by side
//   <name>-diff.png   the pixelmatch diff on its own
// and the same for each data-section of a screen (header, stage, dock, ...),
// cropped from both by the section's own box, so a shift in one band doesn't
// show as a diff in every band below it.
//
// Media is masked: [data-compare-mask], <video> and <canvas> are painted
// magenta in both the reference and the build before diffing, so camera feeds,
// screen captures and thumbnails never count, but their size and place do.
//
// `vsHtml` (the reference .html rendered here, on this machine) is the number
// to drive to zero. `percent` compares with the exported .png, which carries
// the exporting machine's text antialiasing.
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const port = 6107;
const origin = `http://127.0.0.1:${port}`;
const storybookDir = '.storybook-static';
const reference = 'docs/design/reference';
const out = '.compare';
// A board or section fails when more than this share of its pixels differ
// from the reference .html; override with COMPARE_MAX=0.5
const maxPercent = Number(process.env.COMPARE_MAX ?? 0.1);
const filters = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const renderReferences = process.argv.includes('--render-references');

const magenta = [255, 0, 255, 255];
// Animations and transitions off, no caret: the boards are still frames
const freeze = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`;

const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.wasm': 'application/wasm',
    '.tflite': 'application/octet-stream'
};

function startServer(root) {
    const server = createServer((req, res) => {
        const path = decodeURIComponent(new URL(req.url, origin).pathname);
        let file = normalize(join(root, path));
        if (!file.startsWith(normalize(root))) {
            res.writeHead(403).end();
            return;
        }
        if (path.endsWith('/')) file = join(file, 'index.html');
        if (!existsSync(file)) {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, {
            'content-type': types[extname(file)] ?? 'application/octet-stream'
        });
        createReadStream(file).pipe(res);
    });
    return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

// Loads a page at the board's size, freezes it, and returns the root element's
// screenshot plus the boxes of its masks and sections, relative to the root
async function capture(browser, url, width, height) {
    const page = await browser.newPage({
        viewport: { width, height: height ?? 1200 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce'
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: freeze });
    const root = page.locator('[data-compare="root"]').first();
    await root.waitFor({ state: 'visible', timeout: 15000 });
    await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const png = PNG.sync.read(await root.screenshot({ animations: 'disabled' }));
    const boxes = await root.evaluate((el) => {
        const origin = el.getBoundingClientRect();
        const rel = (node) => {
            const b = node.getBoundingClientRect();
            return {
                x: Math.round(b.left - origin.left),
                y: Math.round(b.top - origin.top),
                w: Math.round(b.width),
                h: Math.round(b.height)
            };
        };
        const masks = [...el.querySelectorAll('[data-compare-mask], video, canvas')].map(rel);
        const sections = Object.fromEntries(
            [...el.querySelectorAll('[data-section]')].map((node) => [
                node.dataset.section,
                rel(node)
            ])
        );
        return { masks, sections };
    });
    await page.close();
    return { png, ...boxes };
}

function paint(png, boxes) {
    for (const { x, y, w, h } of boxes) {
        for (let row = Math.max(0, y); row < Math.min(png.height, y + h); row++) {
            for (let col = Math.max(0, x); col < Math.min(png.width, x + w); col++) {
                png.data.set(magenta, (row * png.width + col) * 4);
            }
        }
    }
    return png;
}

function crop(png, { x, y, w, h }) {
    const width = Math.max(1, Math.min(w, png.width - x));
    const height = Math.max(1, Math.min(h, png.height - y));
    const part = new PNG({ width, height });
    PNG.bitblt(png, part, Math.max(0, x), Math.max(0, y), width, height, 0, 0);
    return part;
}

function pad(png, width, height, fill) {
    const canvas = new PNG({ width, height });
    for (let i = 0; i < canvas.data.length; i += 4) canvas.data.set(fill, i);
    PNG.bitblt(png, canvas, 0, 0, png.width, png.height, 0, 0);
    return canvas;
}

// Pads a pair to the same size with magenta, so a size difference shows as a
// diff, and counts the pixels that differ
function match(ref, build) {
    const w = Math.max(ref.width, build.width);
    const h = Math.max(ref.height, build.height);
    const a = pad(ref, w, h, magenta);
    const b = pad(build, w, h, magenta);
    const diff = new PNG({ width: w, height: h });
    const mismatched = pixelmatch(a.data, b.data, diff.data, w, h, {
        threshold: 0.05
    });
    return { a, b, diff, w, h, mismatched };
}

function sideBySide(images, gap) {
    const width = images.reduce((sum, img) => sum + img.width, 0) + gap * (images.length - 1);
    const height = Math.max(...images.map((img) => img.height));
    const canvas = pad(new PNG({ width: 1, height: 1 }), width, height, [128, 128, 128, 255]);
    let x = 0;
    for (const img of images) {
        PNG.bitblt(img, canvas, 0, 0, img.width, img.height, x, 0);
        x += img.width + gap;
    }
    return canvas;
}

async function compare(label, html, build, png) {
    const vs = match(html, build);
    await writeFile(`${out}/${label}-diff.png`, PNG.sync.write(vs.diff));
    await writeFile(
        `${out}/${label}-side.png`,
        PNG.sync.write(sideBySide([vs.a, vs.b, vs.diff], 24))
    );
    const vsPng = png ? match(png, build) : null;
    return {
        label,
        reference: `${html.width}×${html.height}`,
        build: `${build.width}×${build.height}`,
        vsHtml: Number(((100 * vs.mismatched) / (vs.w * vs.h)).toFixed(2)),
        percent: vsPng ? Number(((100 * vsPng.mismatched) / (vsPng.w * vsPng.h)).toFixed(2)) : null
    };
}

const manifest = JSON.parse(await readFile(`${reference}/manifest.json`, 'utf8'));
const boards = [
    ...manifest.screens.map((board) => ({ ...board, kind: 'screens' })),
    ...manifest.components.map((board) => ({ ...board, kind: 'components' }))
].filter((board) => filters.length === 0 || filters.some((word) => board.name.includes(word)));

const browser = await chromium.launch();

// --render-references: re-export every reference .png from its .html (after
// editing a board by hand). Media is not masked in the exported .png.
if (renderReferences) {
    for (const board of boards) {
        const file = `${process.cwd()}/${reference}/${board.kind}/${board.name}.html`;
        const { png } = await capture(browser, `file://${file}`, board.width, board.height);
        await writeFile(`${reference}/${board.kind}/${board.name}.png`, PNG.sync.write(png));
        console.log(`rendered ${board.kind}/${board.name}.png`);
    }
    await browser.close();
    process.exit(0);
}

if (!existsSync(`${storybookDir}/index.json`)) {
    await browser.close();
    throw new Error(
        `No ${storybookDir}/index.json: run \`npm run compare\`, which builds Storybook first`
    );
}
const index = JSON.parse(await readFile(`${storybookDir}/index.json`, 'utf8'));
const stories = Object.values(index.entries ?? index.stories ?? {}).filter(
    (entry) => entry.type === 'story' || entry.type === undefined
);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const server = await startServer(storybookDir);
const rows = [];

try {
    for (const board of boards) {
        const label = board.name;
        const story = stories.find(
            (entry) => entry.title === board.story.title && entry.name === board.story.name
        );
        if (!story) {
            rows.push({ label, note: `no story "${board.story.title} / ${board.story.name}"` });
            continue;
        }
        const build = await capture(
            browser,
            `${origin}/iframe.html?id=${story.id}&viewMode=story`,
            board.width,
            board.height
        );
        const htmlFile = `${process.cwd()}/${reference}/${board.kind}/${board.name}.html`;
        const ref = await capture(browser, `file://${htmlFile}`, board.width, board.height);
        const pngFile = `${reference}/${board.kind}/${board.name}.png`;
        const refPng = existsSync(pngFile) ? PNG.sync.read(await readFile(pngFile)) : null;

        // Masks: each side paints its own media; the exported .png takes the
        // reference's boxes
        paint(build.png, build.masks);
        paint(ref.png, ref.masks);
        if (refPng) paint(refPng, ref.masks);
        await writeFile(`${out}/${label}.png`, PNG.sync.write(build.png));

        rows.push(await compare(label, ref.png, build.png, refPng));
        for (const section of board.sections ?? []) {
            const r = ref.sections[section];
            const b = build.sections[section];
            if (!b) {
                rows.push({
                    label: `${label}-${section}`,
                    note: `no [data-section="${section}"] in the story`
                });
                continue;
            }
            rows.push(
                await compare(
                    `${label}-${section}`,
                    crop(ref.png, r),
                    crop(build.png, b),
                    refPng ? crop(refPng, r) : null
                )
            );
        }
    }
} finally {
    await browser.close();
    server.close();
}

console.table(rows);
await writeFile(`${out}/report.json`, JSON.stringify(rows, null, 4));

// Any board or section over the limit, or missing, fails the run
const failing = rows.filter((row) => row.note || row.vsHtml > maxPercent);
console.log(
    failing.length === 0
        ? `All ${boards.length} boards and their sections within ${maxPercent}% of the reference.`
        : `${failing.length} rows over ${maxPercent}% or missing: ${failing.map((row) => row.label).join(', ')}`
);
if (failing.length) process.exitCode = 1;
