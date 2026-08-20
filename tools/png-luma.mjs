// png-luma.mjs -- read a shipped screenshot WITHOUT launching a browser.
//
// Every other image tool in this tree (crop.mjs, compare.mjs) boots Chrome to
// get a decoder, which means a claim about a shot can only be checked by
// someone willing to spend a browser. Round twelve shipped two claims about
// shots/door-sign that the shots themselves contradict, and this is the
// cheapest thing that would have caught them: zlib is in node, PNG is a
// filtered raster, and mean luminance over a rectangle is one loop.
//
//   node tools/png-luma.mjs shot.png x y w h [x y w h ...]
//
// Prints, per rectangle: mean/min/max relative luminance (Rec.709 on the sRGB
// bytes, 0..1), and the ratio of each rectangle to the first one. Zero deps,
// pure node -- safe to run in a batch alongside anything else.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decodePng(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`);
  let p = 8, width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error(`${file}: only 8-bit is supported (got ${depth})`);
  if (interlace !== 0) throw new Error(`${file}: interlaced PNG is not supported`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`${file}: unsupported colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  // per-scanline defilter, PNG spec 9.2 -- a, b, c are the left, up and
  // up-left bytes of the ALREADY reconstructed image
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i];
      const a = i >= channels ? out[dst + i - channels] : 0;
      const b = y > 0 ? out[dst - stride + i] : 0;
      const c = i >= channels && y > 0 ? out[dst - stride + i - channels] : 0;
      let v;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`${file}: bad filter ${filter} on row ${y}`);
      out[dst + i] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

// Rec.709 on the sRGB bytes: this is what the EYE is being asked to compare,
// which is the quantity the legibility law is about. Not linearised -- the
// screenshot is already the displayed image.
export function lumaRect(img, x0, y0, w, h) {
  const { width, height, channels, data } = img;
  let sum = 0, n = 0, min = 1, max = 0;
  for (let y = Math.max(0, y0); y < Math.min(height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(width, x0 + w); x++) {
      const i = (y * width + x) * channels;
      const l = channels === 1
        ? data[i] / 255
        : (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      sum += l; n++;
      if (l < min) min = l;
      if (l > max) max = l;
    }
  }
  return { mean: n ? sum / n : 0, min, max, pixels: n };
}

if (process.argv[1] && process.argv[1].endsWith('png-luma.mjs')) {
  const [file, ...rest] = process.argv.slice(2);
  if (!file || rest.length < 4 || rest.length % 4) {
    console.error('usage: png-luma.mjs shot.png x y w h [x y w h ...]');
    process.exit(1);
  }
  const img = decodePng(file);
  console.log(`${file}  ${img.width}x${img.height}  ${img.channels} channels`);
  let first = null;
  for (let i = 0; i < rest.length; i += 4) {
    const [x, y, w, h] = rest.slice(i, i + 4).map(Number);
    const r = lumaRect(img, x, y, w, h);
    if (first === null) first = r.mean;
    console.log(`  [${x},${y} ${w}x${h}]  mean ${r.mean.toFixed(4)}  min ${r.min.toFixed(4)}  max ${r.max.toFixed(4)}  ratio-to-first ${(r.mean / (first || 1e-9)).toFixed(2)}x`);
  }
}
