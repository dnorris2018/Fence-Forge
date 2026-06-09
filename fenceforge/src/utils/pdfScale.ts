import * as pdfjsLib from 'pdfjs-dist';

/**
 * Standard architectural/engineering scale presets.
 * pixelsPerFt = (inches_per_foot_on_paper) * 72   [since PDF.js uses 72dpi at scale=1]
 * e.g. "1 inch = 10 feet": 1/10 in per ft * 72 = 7.2 px/ft
 */
export interface ScalePreset {
  label: string;
  pixelsPerFt: number;
}

export const SCALE_PRESETS: ScalePreset[] = [
  // Engineering scales
  { label: '1" = 10\'',   pixelsPerFt: 72 / 10   },
  { label: '1" = 20\'',   pixelsPerFt: 72 / 20   },
  { label: '1" = 30\'',   pixelsPerFt: 72 / 30   },
  { label: '1" = 40\'',   pixelsPerFt: 72 / 40   },
  { label: '1" = 50\'',   pixelsPerFt: 72 / 50   },
  { label: '1" = 60\'',   pixelsPerFt: 72 / 60   },
  { label: '1" = 100\'',  pixelsPerFt: 72 / 100  },
  // Architectural scales
  { label: '1/8" = 1\'',  pixelsPerFt: 72 * (1/8)   },
  { label: '3/16" = 1\'', pixelsPerFt: 72 * (3/16)  },
  { label: '1/4" = 1\'',  pixelsPerFt: 72 * (1/4)   },
  { label: '3/8" = 1\'',  pixelsPerFt: 72 * (3/8)   },
  { label: '1/2" = 1\'',  pixelsPerFt: 72 * (1/2)   },
  { label: '3/4" = 1\'',  pixelsPerFt: 72 * (3/4)   },
  { label: '1" = 1\'',    pixelsPerFt: 72            },
];

/**
 * Try to read the /Measure dictionary from a PDF page to auto-detect scale.
 * Returns pixelsPerFt if found, null otherwise.
 * Scale stored as PDF coordinate units per real-world unit.
 */
export async function detectPdfScale(
  buffer: ArrayBuffer,
  pageNum = 1,
): Promise<number | null> {
  try {
    const copy = buffer.slice(0);
    const doc = await pdfjsLib.getDocument({ data: copy }).promise;
    const page = await doc.getPage(pageNum);

    // PDF.js internal – access the raw page dictionary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageProxy = page as any;

    // Different PDF.js versions expose the dict differently
    const rawDict =
      pageProxy._pageDict ??
      pageProxy.pageDict ??
      pageProxy._pageInfo?.pageDict ??
      null;

    if (!rawDict) return null;

    // /VP is an array of viewport dicts, each with a /Measure dict
    const vp = rawDict.get?.('VP');
    const measureDict = Array.isArray(vp)
      ? vp[0]?.get?.('Measure')
      : vp?.get?.('Measure') ?? rawDict.get?.('Measure');

    if (!measureDict) return null;

    // /R is a text ratio string like "1 in = 10 ft" or "1:100"
    const ratioStr: string = measureDict.get?.('R') ?? '';

    // Try to parse "N in = M ft" format
    const inFt = ratioStr.match(/(\d+(?:\.\d+)?)\s*in?\s*=\s*(\d+(?:\.\d+)?)\s*f/i);
    if (inFt) {
      const paperInches = parseFloat(inFt[1]);
      const realFt = parseFloat(inFt[2]);
      if (paperInches > 0 && realFt > 0) {
        return (72 * paperInches) / realFt;
      }
    }

    // Try to parse "1:N" ratio (dimensionless)
    const ratio = ratioStr.match(/1\s*:\s*(\d+(?:\.\d+)?)/);
    if (ratio) {
      const scale = parseFloat(ratio[1]);
      // 1:scale means 1 unit on paper = scale units in real world
      // Assuming units are inches: pixelsPerFt = 72 / (scale / 12)
      return (72 * 12) / scale;
    }

    // Try /X and /D arrays (source and destination unit arrays)
    const xArr = measureDict.get?.('X');
    const dArr = measureDict.get?.('D');
    if (xArr && dArr) {
      // /X and /D are NumberFormat dicts with /U (unit string) and /C (conversion factor)
      const xFactor = (Array.isArray(xArr) ? xArr[0] : xArr)?.get?.('C') ?? 1;
      const dUnit: string = (Array.isArray(dArr) ? dArr[0] : dArr)?.get?.('U') ?? '';
      const dFactor = (Array.isArray(dArr) ? dArr[0] : dArr)?.get?.('C') ?? 1;
      // xFactor PDF user units = dFactor dUnit
      if (dUnit.toLowerCase().includes('ft') || dUnit.toLowerCase().includes('feet')) {
        return xFactor / dFactor;
      }
    }

    return null;
  } catch {
    return null;
  }
}
