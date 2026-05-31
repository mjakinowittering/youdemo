import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
    'vision_wasm_internal.js',
    'vision_wasm_internal.wasm',
    'vision_wasm_nosimd_internal.js',
    'vision_wasm_nosimd_internal.wasm'
];

const src = resolve('node_modules/@mediapipe/tasks-vision/wasm');
const dest = resolve('build/mediapipe/wasm');

mkdirSync(dest, { recursive: true });
for (const file of files) {
    copyFileSync(resolve(src, file), resolve(dest, file));
}
console.log(`Copied ${files.length} MediaPipe WASM files → build/mediapipe/wasm/`);
