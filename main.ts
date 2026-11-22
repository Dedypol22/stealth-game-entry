import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const shotsDir = join(here, 'screenshots');

function fail(message: string): never {
    console.error(`main.ts: ${message}`);
    process.exit(1);
}

function validateScreenshots(): string[] {
    if (!existsSync(shotsDir)) fail('screenshots/ is missing beside main.ts');
    const names = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort();
    if (names.length < 3 || names.length > 4) {
        fail(`screenshots/ holds ${names.length} images; the gate needs 3 or 4`);
    }
    for (const name of names) {
        if (!/^[A-Za-z0-9._-]{1,128}$/.test(name) || name.startsWith('-')) {
            fail(`screenshots/${name}: a name of letters, digits and . _ - only`);
        }
        const file = join(shotsDir, name);
        if (!statSync(file).isFile()) fail(`screenshots/${name}: not a regular file`);
        const bytes = statSync(file).size;
        if (bytes > 262144) fail(`screenshots/${name}: ${bytes} bytes, over the 256 KiB cap`);
        const buf = readFileSync(file);
        const jpeg = buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
        const png = buf.length > 7 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
        if (!jpeg && !png) fail(`screenshots/${name}: neither a whole PNG nor a JPEG by its magic bytes`);
        let width = 0;
        let height = 0;
        if (png) {
            width = buf.readUInt32BE(16);
            height = buf.readUInt32BE(20);
        } else {
            let i = 2;
            while (i < buf.length - 9) {
                if (buf[i] !== 0xff) { i += 1; continue; }
                const marker = buf[i + 1];
                const len = buf.readUInt16BE(i + 2);
                if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                    height = buf.readUInt16BE(i + 5);
                    width = buf.readUInt16BE(i + 7);
                    break;
                }
                i += 2 + len;
            }
        }
        const long = Math.max(width, height);
        const short = Math.min(width, height);
        if (!width || !height) fail(`screenshots/${name}: cannot read its pixel size`);
        if (long > 1280) fail(`screenshots/${name}: ${width}x${height}, long side over 1280`);
        if (short < 480) fail(`screenshots/${name}: ${width}x${height}, short side under 480`);
        console.log(`screenshots/${name}: ${width}x${height}, ${bytes} bytes, ok`);
    }
    return names;
}

const screenshots = validateScreenshots();

if (!existsSync(join(here, 'game', 'index.html'))) fail('game/index.html is missing beside main.ts');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`main.ts: wrote game/, ${screenshots.length} screenshots and dossier.json (${dossier.length} bytes) to ${out}`);
