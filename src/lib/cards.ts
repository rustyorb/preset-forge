/** SillyTavern character card import: V2/V3 JSON, or PNG with embedded chara data. */

export interface CardData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
}

function normalizeCard(json: unknown): CardData {
  if (typeof json !== 'object' || json === null) throw new Error('Card is not a JSON object');
  const obj = json as Record<string, unknown>;
  // V2/V3 cards nest fields under .data; legacy cards are flat.
  const d = (
    typeof obj.data === 'object' && obj.data !== null && (obj.spec || obj.spec_version)
      ? obj.data
      : obj
  ) as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
  const name = str('name');
  if (!name) throw new Error('No character name found - not a character card?');
  return {
    name,
    description: str('description'),
    personality: str('personality'),
    scenario: str('scenario'),
    first_mes: str('first_mes'),
    mes_example: str('mes_example'),
  };
}

/** Extract base64 card JSON from PNG tEXt chunks ('ccv3' preferred, then 'chara'). */
function cardFromPng(bytes: Uint8Array): CardData {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 8 || !sig.every((b, i) => bytes[i] === b)) {
    throw new Error('Not a PNG file');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const texts: Record<string, string> = {};
  let off = 8;
  while (off + 12 <= bytes.length) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    if (type === 'tEXt') {
      const data = bytes.subarray(off + 8, off + 8 + len);
      const nul = data.indexOf(0);
      if (nul > 0) {
        const keyword = String.fromCharCode(...data.subarray(0, nul));
        // Latin-1 text; card payloads are base64 so charCode mapping is safe.
        let text = '';
        const body = data.subarray(nul + 1);
        for (let i = 0; i < body.length; i += 0x8000) {
          text += String.fromCharCode(...body.subarray(i, i + 0x8000));
        }
        texts[keyword] = text;
      }
    }
    if (type === 'IEND') break;
    off += 12 + len;
  }
  const payload = texts['ccv3'] ?? texts['chara'];
  if (!payload) throw new Error('PNG has no embedded character data (no chara/ccv3 chunk)');
  return normalizeCard(JSON.parse(atob(payload)));
}

export async function parseCardFile(file: File): Promise<CardData> {
  if (/\.png$/i.test(file.name)) {
    return cardFromPng(new Uint8Array(await file.arrayBuffer()));
  }
  return normalizeCard(JSON.parse(await file.text()));
}
