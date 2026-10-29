// Carrot HA Vehicle Journal - Fuel Receipt OCR & Parser Module
// Local WASM Tesseract.js wrapper with image pre-processing and receipt parsing.

/**
 * Clean OCR noise numbers (blacklist patterns like business reg, card number, etc.)
 */
/**
 * Clean OCR noise numbers (blacklist patterns like business reg, card number, customer number, etc.)
 */
export function filterOcrNoise(text) {
  if (!text) return '';
  return text.split('\n').map(line => {
    // Mask business reg: 101-86-60120
    let clean = line.replace(/\b\d{3}-\d{2}-\d{5}\b/g, ' [BIZ_NO] ');
    // Mask card number: 5317-64**-****-4794 or 16-digit cards
    clean = clean.replace(/\b\d{4}[-\s]?[*0-9]{4}[-\s]?[*0-9]{4}[-\s]?\d{4}\b/g, ' [CARD_NO] ');
    // Mask phone number: 031-423-2323, 02-123-4567
    clean = clean.replace(/(?:Tel|TEL|전화)?\s*0\d{1,2}[-)\s]*\d{3,4}[-\s]*\d{4}/g, ' [TEL_NO] ');
    // Mask customer / member / device / slip / receipt / approval / seq / pos / transaction IDs
    clean = clean.replace(/(?:고객\s*(?:No|번호)?|회원\s*(?:No|번호)?|단말기\s*(?:No|번호)?|전표\s*(?:No|번호)?|영수증\s*(?:No|번호)?|승인\s*(?:No|번호)?|일련번호|거래\s*(?:No|번호)?|가맹점\s*(?:No|번호)?|고유번호|POS\s*No)\s*[:\s]*[0-9A-Za-z-]+/gi, ' [CODE_NO] ');
    // Mask standalone barcode or long digit sequence (12 to 24 digits)
    clean = clean.replace(/\b\d{12,24}\b/g, ' [BARCODE] ');
    return clean;
  }).join('\n');
}

/**
 * Validate calendar date. Strictly rejects future dates (tomorrow or later in KST).
 */
export function isValidCalendarDate(year, month, day) {
  const y = Number(year), m = Number(month), d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 2010 || y > 2035) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
  // Future dates (strictly past or today in KST UTC+9)
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 3600000);
  const kstToday = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()));
  const target = new Date(Date.UTC(y, m - 1, d));
  return target <= kstToday;
}

/**
 * Helper to parse a single date string into YYYY-MM-DD
 */
function parseDateString(str) {
  if (!str) return null;
  // Compact 8-digit: 20260522
  const cMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(str.trim());
  if (cMatch) {
    const y = Number(cMatch[1]), m = Number(cMatch[2]), d = Number(cMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  // Formatted: 2026년 05월 22일 or 2026-05-22 or 2026.05.22
  const fMatch = /(\d{4})[년연넌변전./\s-]+(\d{1,2})[월원./\s-]+(\d{1,2})/.exec(str);
  if (fMatch) {
    const y = Number(fMatch[1]), m = Number(fMatch[2]), d = Number(fMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  // 2-digit year: 26.05.22 or 26/05/22
  const sMatch = /(2[0-9])[./-](\d{1,2})[./-](\d{1,2})/.exec(str);
  if (sMatch) {
    const y = 2000 + Number(sMatch[1]), m = Number(sMatch[2]), d = Number(sMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}

/**
 * Candidate transaction dates: context-labelled dates, or unambiguous full dates when none are labelled.
 */
function receiptDateCandidates(text) {
  if (!text) return new Set();
  const lines = text.split('\n');
  const foundDates = new Set();

  // Pattern 1: With explicit transaction date context (거래일시, 주유일시, [등록], 판매일자, 결제일자 등)
  const contextDateRegex = /(?:\[등록\]|거래\s*일[시장자]|주유\s*일[시장자]|판매\s*일[시장자]|매출\s*일[시장자]|결제\s*일[시장자]|승인\s*일[시장자]|일[시장자])\s*[:\s]*(\d{4}[년연넌변전./\s-]+\d{1,2}[월원./\s-]+\d{1,2}|2[0-9][./-]\d{1,2}[./-]\d{1,2}|\b20[2-3][0-9](?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\b)/gi;

  for (const line of lines) {
    // Exclude identification lines containing customer/member/card/device/approval IDs
    if (/(?:고객|회원|단말기|전표|영수증|가맹점|고유|카드|바코드)\s*(?:번호|No)/i.test(line)) {
      continue;
    }
    let m;
    while ((m = contextDateRegex.exec(line)) !== null) {
      const parsed = parseDateString(m[1]);
      if (parsed) foundDates.add(parsed);
    }
  }

  // Pattern 2: If no context-based date found, look for unambiguous full date formats:
  // e.g. 2026년 05월 22일(금) or 2026-05-22 or 2026.05.22
  if (foundDates.size === 0) {
    for (const line of lines) {
      if (line.includes('[CODE_NO]') || line.includes('[CARD_NO]') || line.includes('[BIZ_NO]') || line.includes('[BARCODE]')) continue;
      if (/(?:고객|회원|단말기|전표|영수증|승인|거래|가맹점|고유|카드|바코드)\s*(?:번호|No)/i.test(line)) continue;

      // Unambiguous Korean date or dash/dot separated date
      const p1 = /(?:\[등록\]\s*)?(\d{4})[년연넌변전./\s-]+(\d{1,2})[월원./\s-]+(\d{1,2})[일\s]*/g;
      let m;
      while ((m = p1.exec(line)) !== null) {
        const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
        if (isValidCalendarDate(y, mo, d)) {
          foundDates.add(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      }

      // 2-digit year separated date (26/05/22, 26.05.22, 26-05-22)
      const p2 = /\b(2[0-9])[./-](\d{1,2})[./-](\d{1,2})\b/g;
      while ((m = p2.exec(line)) !== null) {
        const y = 2000 + Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
        if (isValidCalendarDate(y, mo, d)) {
          foundDates.add(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      }
      // Note: Standalone 8-digit numbers without context are strictly NOT parsed here
      // to avoid false positives with ID/serial numbers.
    }
  }

  return foundDates;
}

/**
 * Extract date from receipt text.
 * Requires contextual indicator or unambiguous calendar date format.
 * Strictly excludes ID/code lines and rejects conflicting multiple dates.
 */
export function extractReceiptDate(text) {
  const foundDates = receiptDateCandidates(text);
  // Conflict handling: if multiple distinct dates were found, return null (do not guess)
  return foundDates.size === 1 ? Array.from(foundDates)[0] : null;
}

/**
 * Extract fuel type and nozzle info
 */
export function extractFuelType(text) {
  // Strict matching order: premium must come before gasoline
  const patterns = [
    { type: 'premium', regex: /(고급\s*휘발유|고급유)(?:\s*[\(\[]\s*(\d+)\s*[\)\]])?/ },
    { type: 'gasoline', regex: /(보통\s*휘발유|무연\s*휘발유|휘발유)(?:\s*[\(\[]\s*(\d+)\s*[\)\]])?/ },
    { type: 'diesel', regex: /(자동차용\s*경유|경유|디젤)(?:\s*[\(\[]\s*(\d+)\s*[\)\]])?/ },
    // OCR reads 경유 as 경우 on item rows ("01 경우 09")
    { type: 'diesel', regex: /^\s*\d{1,2}\s+(경우)(?=\s|$)()/m },
  ];
  for (const item of patterns) {
    const m = item.regex.exec(text);
    if (m) {
      return {
        fuel_type: item.type,
        raw_name: m[1],
        nozzle: m[2] || null
      };
    }
  }
  return { fuel_type: null, raw_name: null, nozzle: null };
}

/**
 * Collapse spaces that receipts print between the letters of a label
 * ("합 계" -> "합계", "승인  금액" -> "승인금액") so label rules see one word.
 */
const SPACED_LABELS = ['실승인금액', '선승인금액', '최종결제금액', '실결제금액', '합계금액', '결제금액', '승인금액', '주유금액', '거래일시', '거래일자', '판매일자', '승인번호', '합계', '단가', '수량', '금액'];
const SPACED_LABEL_REGEXES = SPACED_LABELS.map(label => [new RegExp(label.split('').join('[ \\t]*'), 'g'), label]);
export function normalizeLabelSpacing(text) {
  let out = text || '';
  for (const [regex, label] of SPACED_LABEL_REGEXES) out = out.replace(regex, label);
  return out;
}

/**
 * Read one OCR number token as the values it may stand for.
 * Thermal receipts often come back as "80,0002" (원 read as 2), "8 ,000" or "80.000".
 */
function numberReadings(token) {
  const t = token.replace(/\s+/g, '');
  const out = [];
  if (/^\d{1,3}(?:,\d{3})+$/.test(t)) out.push({ value: Number(t.replace(/,/g, '')), kind: 'int' });
  else if (/^\d{1,3}(?:,\d{3})*,\d{3}\d$/.test(t)) out.push({ value: Number(t.slice(0, -1).replace(/,/g, '')), kind: 'int', weak: true });
  else if (/^\d+\.\d{1,3}$/.test(t)) {
    const decimals = t.split('.')[1].length;
    out.push({ value: Number(t), kind: 'dec', decimals });
    if (decimals === 3 && /^\d{1,3}\./.test(t)) out.push({ value: Number(t.replace('.', '')), kind: 'int', weak: true });
  } else if (/^\d{1,3}(?:\.\d{3}){2,}$/.test(t)) out.push({ value: Number(t.replace(/\./g, '')), kind: 'int', weak: true });
  else if (/^\d+$/.test(t)) out.push({ value: Number(t), kind: 'int', plain: true });
  else if (/^\d{1,3},\d{1,2}$/.test(t)) out.push({ value: Number(t.replace(',', '.')), kind: 'dec', decimals: t.split(',')[1].length, weak: true });
  return out.filter(r => Number.isFinite(r.value));
}

/**
 * Remove dates and clock times so their digits never become prices or quantities.
 */
function maskDatesAndTimes(line) {
  return line
    .replace(/\d{2,4}\s*[년./-]\s*\d{1,2}\s*[월./-]\s*\d{1,2}\s*일?/g, ' [DATE] ')
    .replace(/\d{1,2}\s*[:;]\s*\d{2}(?:\s*[:;]\s*\d{2})?/g, ' [TIME] ');
}

function lineNumberTokens(line) {
  const masked = maskDatesAndTimes(line.replace(/\[(?:BIZ_NO|CARD_NO|TEL_NO|CODE_NO|BARCODE)\]/g, ' # '));
  const tokens = [];
  const regex = /\d+(?:[ ]?[.,][ ]?\d+)*/g;
  let m;
  while ((m = regex.exec(masked)) !== null) {
    const before = masked.slice(Math.max(0, m.index - 6), m.index);
    const after = masked.slice(m.index + m[0].length, m.index + m[0].length + 3);
    tokens.push({ text: m[0], readings: numberReadings(m[0]), quantityLabel: /(?:수량|주유량|리터)\s*[:：]?\s*$/.test(before) || /^\s*(?:L\b|ℓ|리터)/i.test(after), priceLabel: /단가\s*[:：]?\s*$/.test(before) });
  }
  return tokens;
}

const TOTAL_TIERS = [
  /(?:실승인금액|실결제금액|최종결제금액|받을금액)/,
  /(?:승인금액|결제금액|합계금액|합계|주유금액|총액|신용카드)/
];

/**
 * Total payment candidates with priority tier (0 = final approved amount).
 * Cancelled pre-authorisation lines ("선승인금액 149,900원 (취소)") are excluded.
 */
function totalAmountCandidates(text) {
  const lines = normalizeLabelSpacing(text || '').split('\n');
  const out = [];
  for (const line of lines) {
    if (/(?:취소|선승인)/.test(line)) continue;
    if (/(?:과세금액|부가세액|할인금액|물품가액)/.test(line) && !/(?:합계|결제|신용카드|승인금액)/.test(line)) continue;
    for (let tier = 0; tier < TOTAL_TIERS.length; tier++) {
      const m = TOTAL_TIERS[tier].exec(line);
      if (!m) continue;
      if (tier === 1 && /선승인금액/.test(line)) continue;
      const rest = line.slice(m.index + m[0].length);
      for (const token of lineNumberTokens(rest)) {
        const reading = token.readings.find(r => r.kind === 'int' && r.value >= 1000 && r.value <= 2000000);
        if (reading) { out.push({ value: reading.value, tier }); break; }
      }
      break;
    }
  }
  return out;
}

/**
 * Extract total payment amount (actual_krw)
 */
export function extractTotalAmount(text) {
  const candidates = totalAmountCandidates(text);
  if (!candidates.length) return null;
  const bestTier = Math.min(...candidates.map(c => c.tier));
  return candidates.find(c => c.tier === bestTier).value;
}

/**
 * Find unit price, quantity and amount wherever they are on the receipt by requiring
 * price × quantity = amount. Layout, column order and line breaks do not matter, and a
 * misread digit breaks the equation instead of silently producing a wrong value.
 */
export function solveFuelTriple(text) {
  const lines = (text || '').split('\n');
  const prices = [], quantities = [], amounts = [];
  let tokenId = 0;
  lines.forEach((line, lineIndex) => {
    for (const token of lineNumberTokens(line)) {
      const id = tokenId++;
      for (const r of token.readings) {
        if (r.kind === 'int' && r.value >= 500 && r.value <= 3500 && !(r.plain && token.text.length > 4)) prices.push({ ...r, id, lineIndex, labeled: token.priceLabel });
        if (r.kind === 'int' && r.value >= 1000 && r.value <= 2000000) amounts.push({ ...r, id, lineIndex });
        if (r.kind === 'dec' && r.value >= 0.5 && r.value <= 300) quantities.push({ ...r, id, lineIndex, labeled: token.quantityLabel });
        if (r.kind === 'int' && token.quantityLabel && r.value >= 1 && r.value <= 300) quantities.push({ value: r.value, kind: 'dec', decimals: 0, id, lineIndex, labeled: true });
      }
    }
  });
  let best = null;
  for (const q of quantities) {
    for (const p of prices) {
      if (p.id === q.id) continue;
      const expected = p.value * q.value;
      const tolerance = p.value * 0.5 * Math.pow(10, -(q.decimals || 0)) + 1;
      for (const a of amounts) {
        if (a.id === p.id || a.id === q.id) continue;
        if (Math.abs(a.value - expected) > tolerance) continue;
        const span = Math.max(p.lineIndex, q.lineIndex, a.lineIndex) - Math.min(p.lineIndex, q.lineIndex, a.lineIndex);
        let score = span === 0 ? 6 : span <= 2 ? 4 : span <= 6 ? 2 : 0;
        if (q.decimals >= 2) score += 2;
        if (p.labeled) score += 1;
        if (q.labeled) score += 1;
        if (p.weak || q.weak || a.weak) score -= 2;
        if (!best || score > best.score) best = { unit_price_krw: p.value, fuel_liters: q.value, row_amount: a.value, score };
      }
    }
  }
  return best;
}

/**
 * Station phone number (first landline-style number on the receipt header).
 */
export function extractStationPhone(text) {
  const m = /(?:^|[^\d])(0(?:2|[3-6][1-5]|70|50\d?))\s*[-).]?\s*(\d{3,4})\s*[-.]?\s*(\d{4})(?!\d)/m.exec(text || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Extract station name and road address
 */
export function extractStationLocation(text) {
  let stationName = null;
  let stationAddress = null;

  const NON_ADDRESS_WORDS = /(?:승인|금액|결제|카드|할부|단가|수량|합계|과세|부가세|취소|가맹점|대표|전화|Tel|사업자|고객|회원|품목|상품|휘발유|경유|등유|LPG|주유기|세차|포인트|쿠폰|할인)/i;

  const rawLines = (text || '').split('\n');
  const cleanLines = [];
  for (const line of rawLines) {
    let clean = line.replace(/\[(?:BIZ_NO|CARD_NO|TEL_NO|CODE_NO|BARCODE)\]/g, ' ').trim();
    if (clean) {
      // Normalize OCR misread of '1' as '|', 'l', or 'I' immediately following road name
      clean = clean.replace(/([가-힣]+(?:로|길)\s*)[|lI](\s|$|\()/g, '$11$2');
      cleanLines.push(clean);
    }
  }

  let fallbackName = null;
  for (let i = 0; i < cleanLines.length; i++) {
    const cleanLine = cleanLines[i];

    // Station name: prioritize specific name containing 주유소 or 충전소 over generic energy/oil brand
    const specificMatch = /(?:직영\s*)?([가-힣A-Za-z0-9\s]{2,25}(?:주유소|충전소))/i.exec(cleanLine);
    if (specificMatch && !stationName) {
      if (!cleanLine.includes('카드') && !cleanLine.includes('발급') && !cleanLine.includes('할인') && !cleanLine.includes('적립')) {
        stationName = specificMatch[0].trim();
      }
    }

    // Fallback brand pattern (e.g. SK에너지, GS칼텍스)
    const brandMatch = /(?:직영\s*)?([가-힣A-Za-z0-9\s]{2,20}(?:에너지|오일))/i.exec(cleanLine);
    if (brandMatch && !fallbackName) {
      if (!cleanLine.includes('카드') && !cleanLine.includes('발급') && !cleanLine.includes('할인') && !cleanLine.includes('적립')) {
        fallbackName = brandMatch[0].trim();
      }
    }

    // Single-line Address pattern: Province? + City/Gun/Gu + Road name + Number
    if (!stationAddress && !NON_ADDRESS_WORDS.test(cleanLine)) {
      const fullAddrMatch = /(?:(서울|경기|인천|강원|충청북|충청남|충북|충남|전라북|전라남|전북|전남|경상북|경상남|경북|경남|제주|부산|대구|광주|대전|울산|세종)(?:특별(?:시|자치시)|광역(?:시)|도|특별자치도)?\s+)?([가-힣]+[시군구])\s+([가-힣0-9\s]+(?:로|길)\s*\d+(?:-\d+)?)/.exec(cleanLine);
      if (fullAddrMatch) {
        stationAddress = fullAddrMatch[0].trim();
      }
    }
  }

  // Multiline Address Fallback: strictly adjacent consecutive lines only
  // Must NOT have intermediate payment/approval/amount lines.
  if (!stationAddress) {
    for (let i = 0; i < cleanLines.length - 1; i++) {
      const lineA = cleanLines[i];
      if (NON_ADDRESS_WORDS.test(lineA)) continue;

      // Line A has province and/or city/gun/gu
      const areaMatch = /(?:(서울|경기|인천|강원|충청북|충청남|충북|충남|전라북|전라남|전북|전남|경상북|경상남|경북|경남|제주|부산|대구|광주|대전|울산|세종)(?:특별(?:시|자치시)|광역(?:시)|도|특별자치도)?\s*)?([가-힣]+[시군구])/.exec(lineA);
      if (areaMatch) {
        const nextLine = cleanLines[i + 1];
        // If the immediate next line contains payment words, strictly DO NOT combine!
        if (NON_ADDRESS_WORDS.test(nextLine)) {
          continue;
        }

        // A road name wrapped onto the next line ("... 산포면 영" + "산로 6022") keeps its first part.
        const tail = lineA.slice(areaMatch.index + areaMatch[0].length);
        const wrapped = /([가-힣]+)\s*$/.exec(tail);
        const wrappedRoad = /^([가-힣0-9]*(?:로|길)\s*\d+(?:-\d+)?)/.exec(nextLine);
        if (wrapped && wrappedRoad && !/[시군구읍면동리도]$/.test(wrapped[1]) && !(wrapped[1] === '가' && /\d$/.test(tail.slice(0, wrapped.index)))) {
          const middle = tail.slice(0, wrapped.index).trim();
          const combined = `${areaMatch[0]} ${middle} ${wrapped[1]}${wrappedRoad[1]}`.replace(/\s+/g, ' ').trim();
          if (combined.length <= 60) {
            stationAddress = combined;
            break;
          }
        }

        // The immediate next line must begin with road name + building number
        const roadMatch = /^([가-힣0-9\s]+(?:로|길)\s*\d+(?:-\d+)?)/.exec(nextLine);
        if (roadMatch) {
          const combined = `${areaMatch[0]} ${roadMatch[0]}`.replace(/\s+/g, ' ').trim();
          if (combined.length <= 60) {
            stationAddress = combined;
            break;
          }
        }
      }
    }
  }

  // Building numbers never start with 0: "영산로 0022" is a misread, not an address
  if (stationAddress && (stationAddress.length > 60 || /(?:로|길)\s*0\d/.test(stationAddress))) {
    stationAddress = null;
  }

  return { station_name: stationName || fallbackName, station_address: stationAddress };
}

function emptyReceipt() {
  return {
    date: null,
    fuel_type: null,
    unit_price_krw: null,
    fuel_liters: null,
    actual_krw: null,
    station_name: null,
    station_address: null,
    station_phone: null,
    confidence: { consistency_passed: false, matched_fields: [], passes: 0 }
  };
}

// Winner of a vote only when it is strictly ahead; a tie means the evidence conflicts.
function voteWinner(votes) {
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  if (ranked.length > 1 && ranked[1][1] === ranked[0][1]) return null;
  return ranked[0][0];
}

// Most common value (compared without spaces); a tie falls back to the earliest pass.
function voteFirst(values) {
  const key = v => v.replace(/\s+/g, '');
  const votes = new Map();
  values.forEach(v => { if (v) votes.set(key(v), (votes.get(key(v)) || 0) + 1); });
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const top = ranked.filter(r => r[1] === ranked[0][1]).map(r => r[0]);
  return values.find(v => v && top.includes(key(v))) || null;
}

const DISCOUNT_WORDS = /(?:할인|차감|쿠폰|포인트\s*사용|사용\s*포인트|세차|부가\s*상품)/;

/**
 * Full receipt parser with consistency check.
 * Accepts one OCR text or several OCR passes of the same photo; fields are decided by
 * votes across passes, and price/quantity are only filled when price × quantity = amount.
 */
export function parseFuelReceipt(rawOcrText) {
  const passes = (Array.isArray(rawOcrText) ? rawOcrText : [rawOcrText]).filter(t => typeof t === 'string' && t.trim());
  if (!passes.length) return emptyReceipt();

  // 1. Mask noise numbers (business/card/phone numbers) and join spaced labels
  const cleaned = passes.map(t => normalizeLabelSpacing(filterOcrNoise(t)));

  // 2. Date: each pass votes; a pass with one unambiguous date counts double
  const dateVotes = new Map();
  for (const text of cleaned) {
    const found = receiptDateCandidates(text);
    for (const d of found) dateVotes.set(d, (dateVotes.get(d) || 0) + (found.size === 1 ? 2 : 1));
  }
  const date = voteWinner(dateVotes);

  // 3. Fuel type
  const fuelVotes = new Map();
  for (const text of cleaned) {
    const type = extractFuelType(text).fuel_type;
    if (type) fuelVotes.set(type, (fuelVotes.get(type) || 0) + 1);
  }
  const fuelType = voteWinner(fuelVotes);

  // 4. Price × quantity = amount, agreed across passes
  const tripleVotes = new Map();
  for (const text of cleaned) {
    const triple = solveFuelTriple(text);
    if (!triple) continue;
    const key = `${triple.unit_price_krw}|${triple.fuel_liters}|${triple.row_amount}`;
    const prev = tripleVotes.get(key);
    tripleVotes.set(key, { triple, score: (prev ? prev.score + 3 : 0) + triple.score });
  }
  const rankedTriples = [...tripleVotes.values()].sort((a, b) => b.score - a.score);
  const triple = rankedTriples.length && !(rankedTriples.length > 1 && rankedTriples[1].score === rankedTriples[0].score)
    ? rankedTriples[0].triple : null;

  // 5. Total paid amount
  const totals = cleaned.flatMap(text => totalAmountCandidates(text));
  const bestTier = totals.length ? Math.min(...totals.map(c => c.tier)) : null;
  const totalVotes = new Map();
  totals.filter(c => c.tier === bestTier).forEach(c => totalVotes.set(c.value, (totalVotes.get(c.value) || 0) + 1));
  const total = voteWinner(totalVotes);

  let actualKrw = null;
  let consistencyPassed = false;
  if (triple) {
    if (totals.some(c => c.value === triple.row_amount) || total === null) {
      actualKrw = triple.row_amount;
      consistencyPassed = true;
    } else if (cleaned.some(text => DISCOUNT_WORDS.test(text))) {
      // Discount or extra items: card total differs from the fuel row on purpose
      actualKrw = total;
    } else {
      // No reason for the card total to differ: the verified row wins over a misread total
      actualKrw = triple.row_amount;
      consistencyPassed = true;
    }
  } else {
    actualKrw = total;
  }

  // 6. Station name, address and phone
  const locations = cleaned.map(text => extractStationLocation(text));
  // Lowercase Latin runs are OCR noise ("ear eat 주유소"); brand prefixes are uppercase.
  const stationName = voteFirst(locations.map(l => l.station_name).filter(n => n && !/[a-z]{2,}/.test(n)));
  const stationAddress = voteFirst(locations.map(l => l.station_address));
  const stationPhone = voteFirst(passes.map(t => extractStationPhone(t)));

  const matchedFields = [];
  if (date) matchedFields.push('date');
  if (fuelType) matchedFields.push('fuel_type');
  if (triple) matchedFields.push('unit_price_krw', 'fuel_liters');
  if (actualKrw) matchedFields.push('actual_krw');
  if (stationName || stationAddress || stationPhone) matchedFields.push('location');

  return {
    date,
    fuel_type: fuelType,
    unit_price_krw: triple ? triple.unit_price_krw : null,
    fuel_liters: triple ? triple.fuel_liters : null,
    actual_krw: actualKrw,
    station_name: stationName,
    station_address: stationAddress,
    station_phone: stationPhone,
    confidence: {
      consistency_passed: consistencyPassed,
      matched_fields: matchedFields,
      passes: passes.length
    }
  };
}

/**
 * Parse road address into structured components: sido, sigungu, road, mainNum, subNum
 */
export function parseRoadAddressComponents(addr) {
  if (!addr || typeof addr !== 'string') return null;
  const clean = addr.replace(/\(.*?\)/g, ' ').replace(/\[.*?\]/g, ' ').trim();

  // Province (시/도)
  const sidoM = /(서울|경기|인천|강원|충청북|충청남|충북|충남|전라북|전라남|전북|전남|경상북|경상남|경북|경남|제주|부산|대구|광주|대전|울산|세종)(?:특별(?:시|자치시)|광역(?:시)|도|특별자치도)?/.exec(clean);
  const sido = sidoM ? ({ 충청북: '충북', 충청남: '충남', 전라북: '전북', 전라남: '전남', 경상북: '경북', 경상남: '경남' }[sidoM[1]] || sidoM[1]) : null;

  // City / Gun / Gu (시/군/구)
  const sigunguM = /([가-힣]+[시군구])/.exec(clean);
  const sigungu = sigunguM ? sigunguM[1] : null;

  // Road name and building number: e.g. "민백길 1" or "민백길 1-2"
  const roadM = /([가-힣0-9]+(?:로|길))\s*(\d+)(?:-(\d+))?/.exec(clean);
  if (!roadM) return null;

  return {
    sido,
    sigungu,
    road: roadM[1].replace(/\s+/g, ''),
    mainNum: Number(roadM[2]),
    subNum: roadM[3] ? Number(roadM[3]) : 0
  };
}

/**
 * Match gas station candidate using address and normalized name against search results.
 * Strictly requires unique candidate and exact road name + main/sub building number match.
 * Prevents building 1 from matching 11 or 1-1, and validates administrative regions.
 */
export function matchStationFromReceipt(stationInfo, searchCandidates) {
  if (!stationInfo || !Array.isArray(searchCandidates) || searchCandidates.length === 0) {
    return null;
  }
  const { station_name, station_address, station_phone } = stationInfo;
  if (!station_name && !station_address && !station_phone) return null;

  const toResult = selected => ({
    name: selected.name || selected.place_name,
    address: selected.address || selected.road_address_name || selected.address_name,
    latitude: Number(selected.latitude || selected.y),
    longitude: Number(selected.longitude || selected.x),
    station_id: selected.station_id || null
  });

  // The printed phone number identifies one business: a unique phone match wins outright
  const phoneDigits = (station_phone || '').replace(/\D/g, '');
  if (phoneDigits.length >= 9) {
    const byPhone = searchCandidates.filter(item => (item.phone || '').replace(/\D/g, '') === phoneDigits);
    if (byPhone.length === 1) return toResult(byPhone[0]);
  }

  // Clean station name for matching (e.g. "직영 SKE 청계주유소" -> "청계주유소")
  const normName = (station_name || '')
    .replace(/^(?:직영\s*|\(주\)\s*)/, '')
    .replace(/^[A-Za-z0-9]+\s+/, '')
    .replace(/\s+/g, '')
    .trim();

  const receiptComp = station_address ? parseRoadAddressComponents(station_address) : null;

  const matches = [];
  const nameOnly = [];
  for (const item of searchCandidates) {
    const candidateName = (item.name || item.place_name || '').trim();
    const candidateAddr = (item.address || item.road_address_name || item.address_name || '').trim();
    const candidateComp = parseRoadAddressComponents(candidateAddr);

    let addrMatches = false;
    if (receiptComp && candidateComp) {
      // 1. Road name must match exactly
      const roadMatches = receiptComp.road === candidateComp.road;
      // 2. Building number: mainNum and subNum must match strictly! (1 != 11, 1 != 1-1)
      const numMatches = receiptComp.mainNum === candidateComp.mainNum && receiptComp.subNum === candidateComp.subNum;
      // 3. Region checks: if both specify city/gun/gu or province, they must NOT contradict
      let regionMatches = true;
      if (receiptComp.sigungu && candidateComp.sigungu && receiptComp.sigungu !== candidateComp.sigungu) {
        regionMatches = false;
      }
      if (receiptComp.sido && candidateComp.sido && receiptComp.sido !== candidateComp.sido) {
        regionMatches = false;
      }

      addrMatches = roadMatches && numMatches && regionMatches;
    }

    // Name criteria
    let nameMatches = false;
    const compactCandidate = candidateName.replace(/\s+/g, '');
    if (normName && compactCandidate) {
      nameMatches = compactCandidate.includes(normName) || normName.includes(compactCandidate);
    }

    const isGasStation = candidateName.includes('주유소') || candidateName.includes('충전소') ||
      (item.category_name && (item.category_name.includes('주유소') || item.category_name.includes('충전소')));

    if (addrMatches && isGasStation) {
      matches.push({ item, nameMatches });
    }
    if (nameMatches && isGasStation) nameOnly.push(item);
  }

  // No readable address: accept a distinctive name only when exactly one gas station carries it
  if (!receiptComp) {
    const distinctive = normName.replace(/(?:주유소|충전소)$/, '').length >= 3;
    return distinctive && nameOnly.length === 1 ? toResult(nameOnly[0]) : null;
  }

  if (matches.length === 0) return null;

  // Case 1: Exactly 1 gas station matched the strict road address.
  // There is no competing gas station at this building address, so adopt it safely
  // even if minor OCR character variance exists in station name.
  if (matches.length === 1) {
    return toResult(matches[0].item);
  }

  // Case 2: Multiple gas stations share the exact same address.
  // Disambiguate by station name if exactly one candidate matches.
  const withName = matches.filter(m => m.nameMatches);
  if (withName.length === 1) {
    return toResult(withName[0].item);
  }

  // Ambiguous (competing stations at same address and name cannot disambiguate): leave blank
  return null;
}

/**
 * Decode the photo once (EXIF orientation applied by the browser), bounded for mobile memory.
 */
async function decodeReceiptImage(file, maxEdge = 3000) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    const naturalWidth = image.naturalWidth || 1;
    const naturalHeight = image.naturalHeight || 1;
    const scale = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OCR 캔버스 생성 실패');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function rotateCanvas(source, degrees) {
  if (!degrees) return source;
  const canvas = document.createElement('canvas');
  canvas.width = source.height;
  canvas.height = source.width;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(degrees * Math.PI / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

function grayPixels(data) {
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) gray[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  return gray;
}

/**
 * Locate the receipt paper: the largest bright region (Otsu threshold on a thumbnail).
 * Returns a box in source pixels, or null when no clear paper region exists.
 */
export function findReceiptPaper(source) {
  const size = 240, scale = size / Math.max(source.width, source.height);
  const w = Math.max(1, Math.round(source.width * scale)), h = Math.max(1, Math.round(source.height * scale));
  const thumb = document.createElement('canvas');
  thumb.width = w;
  thumb.height = h;
  const ctx = thumb.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const gray = grayPixels(ctx.getImageData(0, 0, w, h).data);

  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, weightB = 0, bestVar = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    weightB += hist[t];
    if (!weightB) continue;
    const weightF = gray.length - weightB;
    if (!weightF) break;
    sumB += t * hist[t];
    const between = weightB * weightF * (sumB / weightB - (sum - sumB) / weightF) ** 2;
    if (between > bestVar) { bestVar = between; threshold = t; }
  }

  const label = new Uint8Array(w * h);
  let bestArea = 0, bestBox = null;
  for (let start = 0; start < w * h; start++) {
    if (gray[start] <= threshold || label[start]) continue;
    const stack = [start];
    label[start] = 1;
    let area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (stack.length) {
      const p = stack.pop(), px = p % w, py = (p / w) | 0;
      area++;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
      const next = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const q of next) {
        if (q < 0 || q >= w * h || label[q] || gray[q] <= threshold) continue;
        label[q] = 1;
        stack.push(q);
      }
    }
    if (area > bestArea) { bestArea = area; bestBox = [x0, y0, x1, y1]; }
  }
  // Too small = no paper found; nearly the whole frame = already a close-up, no crop needed
  const coverage = bestArea / (w * h);
  if (!bestBox || coverage < 0.04 || coverage > 0.85) return null;
  const [x0, y0, x1, y1] = bestBox;
  const pad = 2;
  const x = Math.max(0, (x0 - pad) / scale), y = Math.max(0, (y0 - pad) / scale);
  return {
    x, y,
    w: Math.min(source.width - x, (x1 - x0 + 1 + 2 * pad) / scale),
    h: Math.min(source.height - y, (y1 - y0 + 1 + 2 * pad) / scale)
  };
}

/**
 * Render one OCR pass: crop to the paper, scale text to a Tesseract-friendly size,
 * optionally squash vertically (double-height receipt digits) and threshold locally.
 */
export function renderOcrPass(source, box, { yScale = 1, adaptive = false, targetWidth = 1400, maxPixels = 4200000 } = {}) {
  const b = box || { x: 0, y: 0, w: source.width, h: source.height };
  let scale = targetWidth / b.w;
  if (b.w * scale * b.h * scale * yScale > maxPixels) scale = Math.sqrt(maxPixels / (b.w * b.h * yScale));
  const width = Math.max(1, Math.round(b.w * scale)), height = Math.max(1, Math.round(b.h * scale * yScale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('OCR 캔버스 생성 실패');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, b.x, b.y, b.w, b.h, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const gray = grayPixels(data);

  if (adaptive) {
    // Local mean threshold handles shadows and paper curl
    const stride = width + 1, integral = new Float64Array(stride * (height + 1)), r = 20, offset = 12;
    for (let y = 0; y < height; y++) {
      let row = 0;
      for (let x = 0; x < width; x++) {
        row += gray[y * width + x];
        integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
      }
    }
    for (let y = 0; y < height; y++) {
      const ya = Math.max(0, y - r), yb = Math.min(height, y + r + 1);
      for (let x = 0; x < width; x++) {
        const xa = Math.max(0, x - r), xb = Math.min(width, x + r + 1);
        const mean = (integral[yb * stride + xb] - integral[ya * stride + xb] - integral[yb * stride + xa] + integral[ya * stride + xa]) / ((xb - xa) * (yb - ya));
        const v = gray[y * width + x] < mean - offset ? 0 : 255, k = (y * width + x) * 4;
        data[k] = data[k + 1] = data[k + 2] = v;
      }
    }
  } else {
    // Plain grayscale: Tesseract's LSTM reads thin thermal print better without a hard stretch
    for (let j = 0; j < gray.length; j++) {
      const k = j * 4;
      data[k] = data[k + 1] = data[k + 2] = gray[j];
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Image preprocessing for OCR (first pass): decode, crop to the receipt and enhance.
 * Separated from storage JPEG compression pipeline.
 */
export async function prepareOcrImage(file) {
  const source = await decodeReceiptImage(file);
  return renderOcrPass(source, findReceiptPaper(source));
}

let tesseractLoadingPromise = null;

/**
 * Ensure Tesseract.js script is loaded lazily on demand
 */
export async function loadTesseractScript(assetBase) {
  if (window.Tesseract) return window.Tesseract;
  if (tesseractLoadingPromise) return tesseractLoadingPromise;

  tesseractLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('tesseract/tesseract.min.js', assetBase).href;
    script.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error('Tesseract 라이브러리 초기화 실패'));
    };
    script.onerror = () => reject(new Error('Tesseract 스크립트를 불러오지 못했어요.'));
    document.head.append(script);
  });
  return tesseractLoadingPromise;
}

// Tesseract output swings with text size, so text is read at two sizes and fields are voted.
// Squashed passes read the double-height digits of the fuel row.
const OCR_PASSES = [
  { targetWidth: 1000 },
  { yScale: 0.55 },
  { targetWidth: 1600 },
  { targetWidth: 1300 },
  { yScale: 0.55, adaptive: true }
];
// Stop early only after both text sizes and one digit pass have voted.
const MIN_OCR_PASSES = 3;
const RECEIPT_WORDS = /(?:주유|합계|금액|단가|수량|경유|휘발유|카드|매출|승인|부가세)/g;

function receiptWordCount(text) {
  return (text.match(RECEIPT_WORDS) || []).length;
}

function receiptComplete(parsed) {
  return parsed.confidence.consistency_passed && parsed.date && parsed.fuel_type &&
    parsed.station_address && (parsed.station_name || parsed.station_phone);
}

/**
 * Run fuel receipt OCR with worker lifecycle and cancellation support.
 * Several passes of the same photo are combined by parseFuelReceipt.
 */
export async function runReceiptOcr(file, assetBase, onProgress, abortSignal) {
  const T = await loadTesseractScript(assetBase);
  if (abortSignal?.aborted) throw new Error('Aborted');

  const decoded = await decodeReceiptImage(file);
  if (abortSignal?.aborted) throw new Error('Aborted');

  const tesseractBase = new URL('tesseract/', assetBase).href;
  const workerPath = new URL('worker.min.js', tesseractBase).href;
  const corePath = tesseractBase;
  const langPath = new URL('lang/', tesseractBase).href;

  let worker = null;
  const abortHandler = () => {
    if (worker) {
      try { worker.terminate(); } catch (_) {}
    }
  };
  if (abortSignal) abortSignal.addEventListener('abort', abortHandler, { once: true });

  try {
    worker = await T.createWorker('kor+eng', 1, {
      workerPath,
      corePath,
      langPath,
      logger: m => {
        if (onProgress && typeof onProgress === 'function') {
          onProgress(m);
        }
      }
    });

    if (abortSignal?.aborted) throw new Error('Aborted');

    const recognize = async canvas => {
      const ret = await worker.recognize(canvas);
      if (abortSignal?.aborted) throw new Error('Aborted');
      return ret?.data?.text || '';
    };

    // Pass 1, and a sideways retry when the photo shows no receipt words at all
    let source = decoded;
    let box = findReceiptPaper(source);
    let firstText = await recognize(renderOcrPass(source, box, OCR_PASSES[0]));
    if (receiptWordCount(firstText) < 2) {
      for (const degrees of [90, 270]) {
        const rotated = rotateCanvas(decoded, degrees);
        const rotatedBox = findReceiptPaper(rotated);
        const text = await recognize(renderOcrPass(rotated, rotatedBox, OCR_PASSES[0]));
        if (receiptWordCount(text) > receiptWordCount(firstText)) {
          source = rotated;
          box = rotatedBox;
          firstText = text;
        }
      }
    }

    const texts = [firstText];
    let parsed = parseFuelReceipt(texts);
    for (let i = 1; i < OCR_PASSES.length; i++) {
      if (onProgress && typeof onProgress === 'function') onProgress({ status: 'receipt pass', pass: i + 1, total: OCR_PASSES.length });
      texts.push(await recognize(renderOcrPass(source, box, OCR_PASSES[i])));
      parsed = parseFuelReceipt(texts);
      if (texts.length >= MIN_OCR_PASSES && receiptComplete(parsed)) break;
    }

    return {
      rawText: texts.join('\n\n'),
      passes: texts,
      parsed
    };
  } finally {
    if (abortSignal) abortSignal.removeEventListener('abort', abortHandler);
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
  }
}
