const JUMB = new TextEncoder().encode("jumb");
const C2PA = new TextEncoder().encode("c2pa");

function includes(hay: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** Look for an embedded C2PA manifest (a JUMBF box labelled "c2pa"). */
export async function hasC2paManifest(file: Blob): Promise<boolean> {
  const chunk = 4 << 20;
  let jumb = false;
  let c2pa = false;
  let tail = new Uint8Array(0);
  for (let off = 0; off < file.size; off += chunk) {
    const part = new Uint8Array(await file.slice(off, off + chunk).arrayBuffer());
    const buf = new Uint8Array(tail.length + part.length);
    buf.set(tail);
    buf.set(part, tail.length);
    jumb ||= includes(buf, JUMB);
    c2pa ||= includes(buf, C2PA);
    if (jumb && c2pa) return true;
    tail = buf.subarray(Math.max(0, buf.length - 8));
  }
  return false;
}
