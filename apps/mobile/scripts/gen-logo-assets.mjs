// Gera os ícones e a logo do app (mobile + web) a partir das artes em img/.
//   - img/icon.png  = símbolo quadrado → ÍCONE do app (launcher/splash/favicon) e /logo.png no app
//   - img/Logo.png  = logo horizontal "hubpatients" (wordmark) → public/wordmark.png
// Requer `sharp` (devDependency na raiz).
//   node apps/mobile/scripts/gen-logo-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ICON = join(ROOT, 'img', 'icon.png'); // símbolo quadrado
const LOGO = join(ROOT, 'img', 'Logo.png'); // wordmark horizontal
const MOBILE = join(ROOT, 'apps', 'mobile', 'assets');
const WEB_APP = join(ROOT, 'apps', 'web', 'src', 'app');
const WEB_PUB = join(ROOT, 'apps', 'web', 'public');

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

/** Compõe uma arte quadrada `src` centralizada num quadrado `size`, ocupando `scale` do lado. */
async function square(src, out, size, bg, scale) {
  const box = Math.round(size * scale);
  const art = await sharp(src).resize(box, box, { fit: 'inside', background: CLEAR }).png().toBuffer();
  const { width = box, height = box } = await sharp(art).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: art, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    .png()
    .toFile(out);
  console.log('•', out.replace(ROOT, '.'));
}

mkdirSync(MOBILE, { recursive: true });
mkdirSync(WEB_PUB, { recursive: true });

// ── Ícone do app (símbolo) — a partir de img/icon.png ────────────────────────
await square(ICON, join(MOBILE, 'icon.png'), 1024, WHITE, 0.82); // iOS/launcher (sem transparência)
await square(ICON, join(MOBILE, 'adaptive-icon.png'), 1024, CLEAR, 0.64); // Android foreground (safe zone ~66%)
await square(ICON, join(MOBILE, 'splash-icon.png'), 1024, CLEAR, 0.46); // splash (bg via config)
await square(ICON, join(MOBILE, 'favicon.png'), 64, WHITE, 0.88);

// Web: favicon + ícone apple + /logo.png (símbolo quadrado usado na sidebar e no hero de login)
await square(ICON, join(WEB_APP, 'icon.png'), 256, CLEAR, 0.9); // favicon (Next detecta app/icon.png)
await square(ICON, join(WEB_APP, 'apple-icon.png'), 180, WHITE, 0.84); // ícone iOS p/ web app
await square(ICON, join(WEB_PUB, 'logo.png'), 256, CLEAR, 0.9); // /logo.png (símbolo no app)

// ── Wordmark horizontal — a partir de img/Logo.png (preserva a proporção) ────
{
  // `trim()` corta a margem vazia em volta da arte ANTES de redimensionar.
  // Sem isso, o arquivo exportado do editor costuma vir com sobra transparente,
  // e a logo aparece pequena dentro da própria caixa — o desenho ocupa menos
  // pixels do que parece. Cortando primeiro, a marca preenche o espaço que a
  // tela reserva para ela.
  const base = sharp(LOGO).trim();
  const meta = await base.toBuffer({ resolveWithObject: true });
  const w = 1024;
  const h = Math.round((meta.info.height / meta.info.width) * w);
  await sharp(meta.data)
    .resize(w, h, { fit: 'inside', background: CLEAR })
    .png()
    .toFile(join(WEB_PUB, 'wordmark.png'));
  console.log('•', join(WEB_PUB, 'wordmark.png').replace(ROOT, '.'), `(${w}x${h}, margem cortada)`);
}

console.log('OK — ícone gerado de img/icon.png; wordmark de img/Logo.png');
