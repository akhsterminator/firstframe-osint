/**
 * A small ISO-BMFF (MP4/MOV) metadata reader that runs anywhere: it only needs
 * a way to read byte ranges, so it works on a browser File or a Node buffer.
 *
 * It reads what phones and editors commonly write: the movie creation time,
 * QuickTime keys (make, model, software, GPS, creation date), iTunes-style
 * tags (©too, ©xyz, ©mak, ©mod) and whether a C2PA box is present.
 */

export type ByteReader = (offset: number, length: number) => Promise<Uint8Array>;

export interface Mp4Metadata {
  fields: Record<string, string>;
  createdAt?: string;
  gps?: { lat: number; lon: number };
  c2paBox: boolean;
}

const MAC_EPOCH_OFFSET = 2_082_844_800; // seconds between 1904-01-01 and 1970-01-01
const MAX_MOOV = 32 * 1024 * 1024;
const C2PA_UUID = "d8fec3d61b0e483c92975828877ec481";
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "udta", "meta", "ilst", "edts", "dinf", "stbl"]);

const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("");
const utf8 = (b: Uint8Array) => new TextDecoder().decode(b).replace(/\0+$/, "");
const hex = (b: Uint8Array) => Array.from(b, (c) => c.toString(16).padStart(2, "0")).join("");

interface Box {
  type: string;
  start: number;
  headerSize: number;
  size: number;
}

function readBoxes(buf: Uint8Array, from: number, to: number): Box[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: Box[] = [];
  let p = from;
  while (p + 8 <= to) {
    let size = view.getUint32(p);
    const type = latin1(buf.subarray(p + 4, p + 8));
    let header = 8;
    if (size === 1 && p + 16 <= to) {
      size = Number(view.getBigUint64(p + 8));
      header = 16;
    } else if (size === 0) {
      size = to - p;
    }
    if (size < header || p + size > to) break;
    out.push({ type, start: p, headerSize: header, size });
    p += size;
  }
  return out;
}

/** In MP4 files `meta` is a full box (4 bytes of version/flags); in QuickTime it isn't. */
function metaChildrenStart(buf: Uint8Array, box: Box): number {
  const body = box.start + box.headerSize;
  const isFull = buf[body] === 0 && buf[body + 1] === 0 && buf[body + 2] === 0 && buf[body + 3] === 0;
  return isFull ? body + 4 : body;
}

/** A `data` atom: size, "data", type(4), locale(4), value. */
function dataValue(buf: Uint8Array, box: Box): string | undefined {
  const inner = readBoxes(buf, box.start + box.headerSize, box.start + box.size).find((b) => b.type === "data");
  if (!inner) return undefined;
  const v = buf.subarray(inner.start + inner.headerSize + 8, inner.start + inner.size);
  return utf8(v);
}

/** Old-style QuickTime text atom: u16 length, u16 language, text. */
function qtText(buf: Uint8Array, box: Box): string | undefined {
  const body = box.start + box.headerSize;
  if (box.size - box.headerSize < 4) return undefined;
  const len = (buf[body]! << 8) | buf[body + 1]!;
  if (len === 0 || body + 4 + len > box.start + box.size) return dataValue(buf, box);
  return utf8(buf.subarray(body + 4, body + 4 + len));
}

export function parseIso6709(s: string | undefined): { lat: number; lon: number } | undefined {
  const m = s?.match(/^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  return { lat, lon };
}

const ITUNES: Record<string, string> = {
  "©too": "encoder",
  "©swr": "software",
  "©mak": "make",
  "©mod": "model",
  "©day": "date",
  "©xyz": "location",
  "©cmt": "comment",
  "©nam": "title",
};

function walkMoov(buf: Uint8Array, from: number, to: number, out: Record<string, string>, keys: string[] = []) {
  for (const box of readBoxes(buf, from, to)) {
    const body = box.start + box.headerSize;
    const end = box.start + box.size;
    if (box.type === "mvhd") {
      const version = buf[body];
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const secs = version === 1 ? Number(view.getBigUint64(body + 4)) : view.getUint32(body + 4);
      if (secs > MAC_EPOCH_OFFSET) out.creation_time = new Date((secs - MAC_EPOCH_OFFSET) * 1000).toISOString();
    } else if (box.type === "keys") {
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const count = view.getUint32(body + 4);
      let p = body + 8;
      keys = [];
      for (let i = 0; i < count && p + 8 <= end; i++) {
        const size = view.getUint32(p);
        if (size < 8) break;
        keys.push(utf8(buf.subarray(p + 8, p + size)));
        p += size;
      }
    } else if (box.type === "ilst") {
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      for (const item of readBoxes(buf, body, end)) {
        const index = view.getUint32(item.start + 4);
        const name = ITUNES[item.type] ?? (index >= 1 && index <= keys.length ? keys[index - 1] : undefined);
        const value = dataValue(buf, item);
        if (name && value) out[name.toLowerCase()] = value.slice(0, 200);
      }
    } else if (ITUNES[box.type]) {
      const value = qtText(buf, box);
      if (value) out[ITUNES[box.type]!] ??= value.slice(0, 200);
    } else if (box.type === "meta") {
      walkMoov(buf, metaChildrenStart(buf, box), end, out, keys);
    } else if (CONTAINERS.has(box.type)) {
      walkMoov(buf, body, end, out, keys);
    }
  }
}

export async function readMp4Metadata(read: ByteReader, size: number): Promise<Mp4Metadata> {
  const fields: Record<string, string> = {};
  let c2paBox = false;
  let offset = 0;
  let guard = 0;

  while (offset + 8 <= size && guard++ < 10_000) {
    const head = await read(offset, Math.min(32, size - offset));
    const top = readBoxes(head, 0, head.length)[0] ?? (() => {
      // The box extends past our 32-byte peek; read just its size and type.
      const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
      let s = view.getUint32(0);
      let header = 8;
      if (s === 1) {
        s = Number(view.getBigUint64(8));
        header = 16;
      } else if (s === 0) s = size - offset;
      return { type: latin1(head.subarray(4, 8)), start: 0, headerSize: header, size: s };
    })();
    if (top.size < 8) break;
    if (top.type === "uuid" && hex(head.subarray(top.headerSize, top.headerSize + 16)) === C2PA_UUID) c2paBox = true;
    if (top.type === "moov" && top.size <= MAX_MOOV) {
      const moov = await read(offset, top.size);
      walkMoov(moov, top.headerSize, moov.length, fields);
    }
    offset += top.size;
  }

  const created = fields["com.apple.quicktime.creationdate"] ?? fields.creation_time;
  const gps = parseIso6709(fields["com.apple.quicktime.location.iso6709"] ?? fields.location);
  if (gps) {
    gps.lat = Math.round(gps.lat * 1000) / 1000;
    gps.lon = Math.round(gps.lon * 1000) / 1000;
    fields.gps = `${gps.lat.toFixed(3)}, ${gps.lon.toFixed(3)}`;
  }
  delete fields["com.apple.quicktime.location.iso6709"];
  delete fields.location;
  return { fields, createdAt: created && !Number.isNaN(Date.parse(created)) ? new Date(created).toISOString() : undefined, gps, c2paBox };
}

/** Reader over a browser Blob or File. */
export function blobReader(blob: Blob): ByteReader {
  return async (offset, length) => new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer());
}
