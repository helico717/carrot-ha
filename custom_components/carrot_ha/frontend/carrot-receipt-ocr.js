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
 * Extract date from receipt text.
 * Requires contextual indicator or unambiguous calendar date format.
 * Strictly excludes ID/code lines and rejects conflicting multiple dates.
 */
export function extractReceiptDate(text) {
  if (!text) return null;
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

  // Conflict handling: if multiple distinct dates were found, return null (do not guess)
  if (foundDates.size === 1) {
    return Array.from(foundDates)[0];
  }
  return null;
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
 * Extract fuel row: item, unit price, quantity, row amount
 */
export function extractFuelRow(text) {
  const lines = text.split('\n');
  for (const line of lines) {
    // e.g. 고급휘발유(05) 2,445 X 28.630 70,000
    // e.g. 휘발유 1,650 30.303 50,000
    const m = /(고급\s*휘발유|고급유|보통\s*휘발유|무연\s*휘발유|휘발유|경유|디젤)(?:\s*[\(\[]\s*\d+\s*[\)\]])?\s+([1-9][0-9,]{2,5})\s*(?:X|x|\*|\s)\s*([0-9]+\.[0-9]{1,3}|[0-9]+)\s+([1-9][0-9,]{3,7})/i.exec(line);
    if (m) {
      const price = Number(m[2].replace(/,/g, ''));
      const liters = Number(m[3]);
      const amount = Number(m[4].replace(/,/g, ''));
      if (Number.isFinite(price) && Number.isFinite(liters) && Number.isFinite(amount) && price > 0 && liters > 0 && amount > 0) {
        return { unit_price_krw: price, fuel_liters: liters, row_amount: amount };
      }
    }
  }
  return null;
}

/**
 * Extract total payment amount (actual_krw)
 */
export function extractTotalAmount(text) {
  const lines = text.split('\n');
  // 1. Look for explicit total headers: 합계금액, 결제금액, 신용카드, 총액
  for (const line of lines) {
    if (/(?:과세금액|부가세액|할인금액)/.test(line) && !/(?:합계|결제|신용카드)/.test(line)) continue;
    const m = /(?:합계금액|합계|결제금액|신용카드|승인금액|총액)\s*[:\s]*([1-9][0-9,]{3,7})/i.exec(line);
    if (m) {
      const val = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(val) && val >= 1000) return val;
    }
  }
  return null;
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
      const fullAddrMatch = /(?:(서울|경기|인천|강원|충북|충남|전북|전남|경북|경남|제주|부산|대구|광주|대전|울산|세종)(?:특별(?:시|자치시)|광역(?:시)|도|특별자치도)?\s+)?([가-힣]+[시군구])\s+([가-힣0-9\s]+(?:로|길)\s*\d+(?:-\d+)?)/.exec(cleanLine);
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
      const areaMatch = /(?:(서울|경기|인천|강원|충북|충남|전북|전남|경북|경남|제주|부산|대구|광주|대전|울산|세종)(?:특별(?:시|자치시)|광역(?:시)|도|특별자치도)?\s*)?([가-힣]+[시군구])/.exec(lineA);
      if (areaMatch) {
        const nextLine = cleanLines[i + 1];
        // If the immediate next line contains payment words, strictly DO NOT combine!
        if (NON_ADDRESS_WORDS.test(nextLine)) {
          continue;
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

  if (stationAddress && stationAddress.length > 60) {
    stationAddress = null;
  }

  return { station_name: stationName || fallbackName, station_address: stationAddress };
}

/**
 * Full receipt parser with consistency check
 */
export function parseFuelReceipt(rawOcrText) {
  if (!rawOcrText || typeof rawOcrText !== 'string') {
    return {
      date: null,
      fuel_type: null,
      unit_price_krw: null,
      fuel_liters: null,
      actual_krw: null,
      station_name: null,
      station_address: null,
      confidence: { consistency_passed: false, matched_fields: [] }
    };
  }

  // 1. Mask noise numbers (business/card/phone numbers)
  const cleanText = filterOcrNoise(rawOcrText);

  // 2. Extract fields
  const date = extractReceiptDate(cleanText);
  const fuel = extractFuelType(cleanText);
  const fuelRow = extractFuelRow(cleanText);
  let totalAmount = extractTotalAmount(cleanText);

  let unitPrice = fuelRow?.unit_price_krw || null;
  let fuelLiters = fuelRow?.fuel_liters || null;
  let actualKrw = totalAmount || fuelRow?.row_amount || null;

  // If table row was not found, try fallback context searches
  if (!unitPrice) {
    const pm = /(?:단가|리터당|@\/L|원\/L)\s*[:\s]*([1-9][0-9,]{2,5})/i.exec(cleanText);
    if (pm) unitPrice = Number(pm[1].replace(/,/g, ''));
  }
  if (!fuelLiters) {
    const lm = /(?:수량|주유량|리터|L)\s*[:\s]*([0-9]+(?:\.[0-9]{1,3})?)/i.exec(cleanText);
    if (lm) fuelLiters = Number(lm[1]);
  }

  // 3. Three-way consistency check: actual_krw ~ unit_price * fuel_liters
  let consistencyPassed = false;
  if (unitPrice && fuelLiters && actualKrw) {
    const expected = unitPrice * fuelLiters;
    // Allow small decimal rounding error based on quantity precision
    const maxDiff = Math.max(5, unitPrice * 0.002);
    const diff = Math.abs(actualKrw - expected);
    if (diff <= maxDiff) {
      consistencyPassed = true;
    } else {
      // If there is significant discrepancy (e.g. discount, multi-item, or parsing error),
      // do not blindly guess or overwrite.
      // If fuelRow amount matches expected, prefer fuelRow amount
      if (fuelRow && Math.abs(fuelRow.row_amount - expected) <= maxDiff) {
        // Discrepancy is between row amount and card total (e.g. car wash included or discount)
        // Keep actual card total as actualKrw, but keep unitPrice and liters as reported
        consistencyPassed = false;
      } else {
        // Unreliable numbers: keep only what is unambiguously reported
        consistencyPassed = false;
      }
    }
  }

  // 4. Extract location
  const loc = extractStationLocation(cleanText);

  // 5. Gather matched fields
  const matchedFields = [];
  if (date) matchedFields.push('date');
  if (fuel.fuel_type) matchedFields.push('fuel_type');
  if (unitPrice) matchedFields.push('unit_price_krw');
  if (fuelLiters) matchedFields.push('fuel_liters');
  if (actualKrw) matchedFields.push('actual_krw');
  if (loc.station_name || loc.station_address) matchedFields.push('location');

  return {
    date,
    fuel_type: fuel.fuel_type,
    unit_price_krw: unitPrice,
    fuel_liters: fuelLiters,
    actual_krw: actualKrw,
    station_name: loc.station_name,
    station_address: loc.station_address,
    confidence: {
      consistency_passed: consistencyPassed,
      matched_fields: matchedFields
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
  const sidoM = /(서울|경기|인천|강원|충북|충남|전북|전남|경북|경남|제주|부산|대구|광주|대전|울산|세종)(?:특별(?:시|자치시)|광역(?:시)|도|특별자치도)?/.exec(clean);
  const sido = sidoM ? sidoM[1] : null;

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
  const { station_name, station_address } = stationInfo;
  if (!station_name && !station_address) return null;

  // Clean station name for matching (e.g. "직영 SKE 청계주유소" -> "청계주유소")
  const normName = (station_name || '')
    .replace(/^(?:직영\s*|\(주\)\s*)/, '')
    .replace(/^[A-Za-z0-9]+\s+/, '')
    .trim();

  const receiptComp = station_address ? parseRoadAddressComponents(station_address) : null;

  const matches = [];
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
    if (normName && candidateName) {
      nameMatches = candidateName.includes(normName) || normName.includes(candidateName);
    }

    const isGasStation = candidateName.includes('주유소') || candidateName.includes('충전소') ||
      (item.category_name && (item.category_name.includes('주유소') || item.category_name.includes('충전소')));

    if (addrMatches && isGasStation) {
      matches.push({ item, nameMatches });
    }
  }

  if (matches.length === 0) return null;

  // Case 1: Exactly 1 gas station matched the strict road address.
  // There is no competing gas station at this building address, so adopt it safely
  // even if minor OCR character variance exists in station name.
  if (matches.length === 1) {
    const selected = matches[0].item;
    return {
      name: selected.name || selected.place_name,
      address: selected.address || selected.road_address_name || selected.address_name,
      latitude: Number(selected.latitude || selected.y),
      longitude: Number(selected.longitude || selected.x),
      station_id: selected.station_id || null
    };
  }

  // Case 2: Multiple gas stations share the exact same address.
  // Disambiguate by station name if exactly one candidate matches.
  const withName = matches.filter(m => m.nameMatches);
  if (withName.length === 1) {
    const selected = withName[0].item;
    return {
      name: selected.name || selected.place_name,
      address: selected.address || selected.road_address_name || selected.address_name,
      latitude: Number(selected.latitude || selected.y),
      longitude: Number(selected.longitude || selected.x),
      station_id: selected.station_id || null
    };
  }

  // Ambiguous (competing stations at same address and name cannot disambiguate): leave blank
  return null;
}

/**
 * Image preprocessing for OCR:
 * Scales down to maxEdge (2048px), converts to grayscale and enhances contrast.
 * Separated from storage JPEG compression pipeline.
 */
export async function prepareOcrImage(file, maxEdge = 2048) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    const naturalWidth = image.naturalWidth || 1;
    const naturalHeight = image.naturalHeight || 1;
    const maxDimension = Math.max(naturalWidth, naturalHeight);

    // Limit decoding pixels to prevent mobile WASM OOM (around 4 megapixels max)
    const scale = Math.min(1, maxEdge / maxDimension);
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('OCR 캔버스 생성 실패');

    // Fill white background and draw
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    // Grayscale + Contrast Stretch
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;

    // Fast single-pass grayscale + contrast enhancement
    for (let i = 0; i < len; i += 4) {
      const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
      // Smooth dynamic contrast stretch preserving anti-aliasing for Tesseract LSTM
      const enhanced = gray > 200 ? 255 : (gray < 55 ? 0 : (((gray - 55) * 255) / 145) | 0);
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }
    ctx.putImageData(imgData, 0, 0);

    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
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

/**
 * Run fuel receipt OCR with worker lifecycle and cancellation support
 */
export async function runReceiptOcr(file, assetBase, onProgress, abortSignal) {
  const T = await loadTesseractScript(assetBase);
  if (abortSignal?.aborted) throw new Error('Aborted');

  // Preprocess image
  const canvas = await prepareOcrImage(file);
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

    // Run recognition
    const ret = await worker.recognize(canvas);
    if (abortSignal?.aborted) throw new Error('Aborted');

    const rawText = ret?.data?.text || '';
    return {
      rawText,
      parsed: parseFuelReceipt(rawText)
    };
  } finally {
    if (abortSignal) abortSignal.removeEventListener('abort', abortHandler);
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
  }
}
