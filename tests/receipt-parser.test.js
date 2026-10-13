// Test suite for carrot-receipt-ocr.js executed via JavaScriptCore (jsc)
// Load carrot-receipt-ocr.js by reading and evaluating in jsc context

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message} (expected: ${expected}, got: ${actual})`);
  }
}

// Emulate module imports in jsc
const fsModule = {
  filterOcrNoise: null,
  isValidCalendarDate: null,
  extractReceiptDate: null,
  extractFuelType: null,
  extractFuelRow: null,
  extractTotalAmount: null,
  extractStationLocation: null,
  parseFuelReceipt: null
};

// Evaluate the module code
const script = readFile('custom_components/carrot_ha/frontend/carrot-receipt-ocr.js');
const stripped = script.replace(/export function/g, 'function').replace(/export async function/g, 'async function');
eval(stripped);

print('Running Receipt Parser Tests...');

// 1. Test: Provided receipt sample (De-identified synthetic representation)
{
  const rawText = `
SK에너지              대표 홍길동
직영 SKE 청계주유소    101-86-60120
경기도 의왕시 민백길 1 (내손동)
Tel)031-423-2323
[등록]2026년05월22일(금) 23:34 POSNo.01

**우리카드(신용구매전표-고객용)**
카드번호 : 5317-64**-****-4794
가맹점No : 601725737 승인No : 83220219 #
매입사:우리카드 (정상승인)
일시[할부]:일시 일련번호:136142444555
고유번호:988936710584

상품명(주유기) 단가   수량     금액
고급휘발유(05) 2,445 X 28.630 70,000
과세금액 63,636   부가세액 6,364

신용카드       70,000
합계금액       70,000
알림 : 136142444555

!(광고)SK주유카드
거래번호:1546
2026052200011546
`;

  const result = parseFuelReceipt(rawText);
  assertEquals(result.date, '2026-05-22', 'Date parsed correctly');
  assertEquals(result.fuel_type, 'premium', 'Fuel type is premium (not ordinary gasoline)');
  assertEquals(result.unit_price_krw, 2445, 'Unit price is 2445');
  assertEquals(result.fuel_liters, 28.63, 'Fuel liters is 28.63');
  assertEquals(result.actual_krw, 70000, 'Actual krw is 70000');
  assert(result.confidence.consistency_passed, 'Three-way consistency passed');
  assertEquals(result.station_name, '직영 SKE 청계주유소', 'Station name extracted');
  assertEquals(result.station_address, '경기도 의왕시 민백길 1', 'Station address with building number extracted');
  print('✓ Test 1 Passed: Standard Korean fuel receipt parsed');
}

// 2. Test: Blacklist noise filtering (approval number, card number, biz number never used as price/quantity)
{
  const noiseText = `
사업자번호: 123-45-67890
승인번호: 87654321
가맹점번호: 99887766
전화: 02-987-6543
합계금액: 50,000
단가: 1,650
수량: 30.303
`;
  const result = parseFuelReceipt(noiseText);
  assertEquals(result.actual_krw, 50000, 'Actual amount must be 50,000, not approval or biz number');
  assertEquals(result.unit_price_krw, 1650, 'Unit price must be 1,650');
  assertEquals(result.fuel_liters, 30.303, 'Fuel liters must be 30.303');
  print('✓ Test 2 Passed: Noise numbers blacklisted');
}

// 3. Test: Premium vs Gasoline distinction and nozzle stripping
{
  const premiumText = `고급휘발유[02] 2,500 X 20.000 50,000`;
  const gasolineText = `보통휘발유(01) 1,700 X 10.000 17,000`;
  const dieselText = `자동차용경유 1,500 X 20.000 30,000`;

  const rPrem = parseFuelReceipt(premiumText);
  assertEquals(rPrem.fuel_type, 'premium', 'Distinguish premium');
  assertEquals(rPrem.unit_price_krw, 2500, 'Premium unit price');

  const rGas = parseFuelReceipt(gasolineText);
  assertEquals(rGas.fuel_type, 'gasoline', 'Distinguish gasoline');
  assertEquals(rGas.unit_price_krw, 1700, 'Gasoline unit price');

  const rDie = parseFuelReceipt(dieselText);
  assertEquals(rDie.fuel_type, 'diesel', 'Distinguish diesel');
  assertEquals(rDie.unit_price_krw, 1500, 'Diesel unit price');
  print('✓ Test 3 Passed: Fuel type classification & nozzle stripping');
}

// 4. Test: Calendar date validation (past dates allowed, impossible dates rejected)
{
  assert(isValidCalendarDate(2020, 2, 29), 'Leap year 2020-02-29 is valid');
  assert(!isValidCalendarDate(2021, 2, 29), 'Non-leap year 2021-02-29 is invalid');
  assert(!isValidCalendarDate(2026, 4, 31), 'April has 30 days, 31 is invalid');
  assert(isValidCalendarDate(2024, 12, 31), 'Past date 2024-12-31 is valid');
  print('✓ Test 4 Passed: Calendar validation');
}

// 5. Test: Missing fields remain null (NEVER filled with 0 or guesses)
{
  const partialText = `
GS칼텍스 삼거리주유소
서울 강남구 테헤란로 152
날짜: 2026-03-15
신용카드 결제금액: 30,000원
`;
  const result = parseFuelReceipt(partialText);
  assertEquals(result.date, '2026-03-15', 'Date is extracted');
  assertEquals(result.actual_krw, 30000, 'Amount is extracted');
  assertEquals(result.unit_price_krw, null, 'Unit price must be NULL, not 0');
  assertEquals(result.fuel_liters, null, 'Fuel liters must be NULL, not calculated or 0');
  assertEquals(result.fuel_type, null, 'Fuel type must be NULL');
  assert(!result.confidence.consistency_passed, 'Consistency check not passed due to missing fields');
  print('✓ Test 5 Passed: Missing fields remain null (no 0 or fabricated calculation)');
}

// 6. Test: Discrepancy / discount handling
{
  const discountText = `
휘발유 1,600 X 50.000 80,000
주유할인: -5,000
최종결제금액: 75,000
`;
  const result = parseFuelReceipt(discountText);
  assertEquals(result.unit_price_krw, 1600, 'Unit price extracted');
  assertEquals(result.fuel_liters, 50, 'Liters extracted');
  assertEquals(result.actual_krw, 75000, 'Actual card payment is 75000');
  assert(!result.confidence.consistency_passed, 'Flagged as inconsistent due to discount difference');
  print('✓ Test 6 Passed: Discount / discrepancy gracefully detected');
}

// 7. Test: Tax amount (과세금액) vs Total amount (합계금액) discrimination
{
  const taxSample = `
상품명: 보통휘발유
단가: 1,750
수량: 20.000
과세금액: 31,818
부가세액: 3,182
합계금액: 35,000
신용카드: 35,000
`;
  const result = parseFuelReceipt(taxSample);
  assertEquals(result.actual_krw, 35000, 'Actual amount must be total 35,000, NOT tax base 31,818');
  assertEquals(result.unit_price_krw, 1750, 'Unit price 1,750');
  assertEquals(result.fuel_liters, 20, 'Liters 20.000');
  assert(result.confidence.consistency_passed, 'Consistency passed (1750 * 20 == 35000)');
  print('✓ Test 7 Passed: Tax base vs Total amount discrimination');
}

// 8. Test: 8-digit numbers discrimination (approval number 83220219 is NOT date)
{
  const codeDateSample = `
승인번호: 83220219
일자: 2026.04.10
휘발유 1,650 X 10.000 16,500
`;
  const result = parseFuelReceipt(codeDateSample);
  assertEquals(result.date, '2026-04-10', 'Correct date extracted, 83220219 approval number not confused as date');
  assertEquals(result.actual_krw, 16500, 'Amount 16,500');
  print('✓ Test 8 Passed: 8-digit approval number not confused as date');
}

// 9. Test: Station match uniqueness and ambiguity rejection
{
  const stationInfo = { station_name: '직영 SKE 청계주유소', station_address: '경기도 의왕시 민백길 1 (내손동)' };

  // Case A: Exactly 1 unique match
  const candidatesA = [
    { place_name: 'SKE 청계주유소', road_address_name: '경기 의왕시 민백길 1', latitude: 37.3871, longitude: 126.9842 },
    { place_name: '의왕백운호수공원', road_address_name: '경기 의왕시 백운로 100', latitude: 37.37, longitude: 126.99 }
  ];
  const matchedA = matchStationFromReceipt(stationInfo, candidatesA);
  assert(matchedA !== null, 'Candidate A matched');
  assertEquals(matchedA.name, 'SKE 청계주유소', 'Correct station name');
  assertEquals(matchedA.address, '경기 의왕시 민백길 1', 'Correct address');

  // Case B: Multiple ambiguous stations at the same address/area -> MUST BE NULL
  const candidatesB = [
    { place_name: '청계주유소 A동', road_address_name: '경기 의왕시 민백길 1', latitude: 37.3871, longitude: 126.9842 },
    { place_name: '청계주유소 B동', road_address_name: '경기 의왕시 민백길 1', latitude: 37.3872, longitude: 126.9843 }
  ];
  const matchedB = matchStationFromReceipt(stationInfo, candidatesB);
  assertEquals(matchedB, null, 'Ambiguous candidates must return null (leave blank)');

  // Case C: Unrelated candidates -> MUST BE NULL
  const candidatesC = [
    { place_name: '판교테크노주유소', road_address_name: '경기 성남시 분당구 판교역로 10', latitude: 37.4, longitude: 127.1 }
  ];
  const matchedC = matchStationFromReceipt(stationInfo, candidatesC);
  assertEquals(matchedC, null, 'Unrelated candidates must return null');

  print('✓ Test 9 Passed: Station matching uniqueness and ambiguity rejection');
}

// 10. Test: Multiline address extraction
{
  const multilineText = `
청계주유소
경기도 의왕시
민백길 1 (내손동)
단가 1,700 수량 10 금액 17,000
`;
  const result = parseFuelReceipt(multilineText);
  assertEquals(result.station_address, '경기도 의왕시 민백길 1', 'Multiline address correctly joined and extracted');
  print('✓ Test 10 Passed: Multiline address extracted across line breaks');
}

// 11. Test: City/road address without province
{
  const noProvinceText = `
삼거리주유소
의왕시 민백길 1
2026-05-22
단가 1,700 수량 10 금액 17,000
`;
  const result = parseFuelReceipt(noProvinceText);
  assertEquals(result.station_address, '의왕시 민백길 1', 'City and road address extracted without province');
  print('✓ Test 11 Passed: City-level road address extracted');
}

// 12. Test: OCR date delimiter misreads and compact 8-digit date
{
  const misreadDateText = `
[등록]2026연 05월 22일(금) 23:34
단가 1,700 수량 10 금액 17,000
`;
  const r1 = parseFuelReceipt(misreadDateText);
  assertEquals(r1.date, '2026-05-22', 'Date parsed with 연 misread');

  const compactDateText = `
거래일자: 20260522 23:34
단가 1,700 수량 10 금액 17,000
`;
  const r2 = parseFuelReceipt(compactDateText);
  assertEquals(r2.date, '2026-05-22', 'Compact 8-digit date parsed');
  print('✓ Test 12 Passed: OCR date delimiter misreads and compact fallback');
}

print('\nALL RECEIPT PARSER TESTS PASSED SUCCESSFULLY!');
