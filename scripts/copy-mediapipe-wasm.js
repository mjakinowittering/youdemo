import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Vendored WASM assets that must be served same-origin in production.
// They are not committed; they are copied out of node_modules at build time.
const copies = [
    {
        src: 'node_modules/@mediapipe/tasks-vision/wasm',
        dest: 'build/mediapipe/wasm',
        files: [
            'vision_wasm_internal.js',
            'vision_wasm_internal.wasm',
            'vision_wasm_nosimd_internal.js',
            'vision_wasm_nosimd_internal.wasm'
        ]
    }
];

for (const { src, dest, files } of copies) {
    mkdirSync(resolve(dest), { recursive: true });
    for (const file of files) {
        copyFileSync(resolve(src, file), resolve(dest, file));
    }
    console.log(`Copied ${files.length} file(s) → ${dest}/`);
}
