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

// 13. Test: Identification numbers like customer ID (고객번호: 20250522) must NOT be extracted as date
{
  const customerIdText = `
고객번호: 20250522
단가 1,700 수량 10 금액 17,000
`;
  const result = parseFuelReceipt(customerIdText);
  assertEquals(result.date, null, 'Customer ID must NOT be parsed as date even if it forms a valid calendar date');
  print('✓ Test 13 Passed: Customer ID not confused as date');
}

// 14. Test: Multiple conflicting distinct dates must result in null (never guess first one)
{
  const conflictText = `
거래일시: 2026-05-22 10:00
판매일자: 2026-05-20 15:00
휘발유 1,700 X 10.000 17,000
`;
  const result = parseFuelReceipt(conflictText);
  assertEquals(result.date, null, 'Conflicting distinct dates must result in null (leave blank)');
  print('✓ Test 14 Passed: Multiple conflicting dates safely result in null');
}

// 15. Test: Future dates must be rejected
{
  const futureText = `
거래일시: 2035-12-31 23:59
휘발유 1,700 X 10.000 17,000
`;
  const result = parseFuelReceipt(futureText);
  assertEquals(result.date, null, 'Future date beyond today in KST must be rejected');
  print('✓ Test 15 Passed: Future date rejected');
}

// 16. Test: Multiline address extraction must NOT bridge across payment lines
{
  const badMultilineText = `
청계주유소
경기도 시험시
승인금액 70000
가상길 1
`;
  const result = parseFuelReceipt(badMultilineText);
  assertEquals(result.station_address, null, 'Address must not combine lines across payment info');
  print('✓ Test 16 Passed: Address combining blocked when payment line is interleaved');
}

// 17. Test: Strict building number matching (building 1 must NOT match 11 or 1-1)
{
  const stationInfo = { station_name: '청계주유소', station_address: '경기 의왕시 민백길 1' };

  // Candidates with building 11 and building 1-1
  const candidates = [
    { place_name: '청계주유소 분점', road_address_name: '경기 의왕시 민백길 11', latitude: 37.38, longitude: 126.98 },
    { place_name: '청계주유소 별관', road_address_name: '경기 의왕시 민백길 1-1', latitude: 37.38, longitude: 126.98 }
  ];
  const matched = matchStationFromReceipt(stationInfo, candidates);
  assertEquals(matched, null, 'Building 1 must NOT match building 11 or 1-1');

  // Exact building 1 match
  const validCandidates = [
    { place_name: '청계주유소', road_address_name: '경기 의왕시 민백길 1', latitude: 37.3871, longitude: 126.9842 }
  ];
  const validMatched = matchStationFromReceipt(stationInfo, validCandidates);
  assert(validMatched !== null, 'Exact building 1 must match');
  assertEquals(validMatched.address, '경기 의왕시 민백길 1', 'Correct address matched');
  print('✓ Test 17 Passed: Strict building number matching (1 != 11, 1 != 1-1)');
}

// 18. Test: Administrative region mismatch must be rejected
{
  const stationInfo = { station_name: '청계주유소', station_address: '경기 의왕시 민백길 1' };
  const candidates = [
    { place_name: '청계주유소', road_address_name: '충북 음성군 민백길 1', latitude: 36.9, longitude: 127.6 }
  ];
  const matched = matchStationFromReceipt(stationInfo, candidates);
  assertEquals(matched, null, 'Mismatched province/city must be rejected even if road name and number match');
  print('✓ Test 18 Passed: Regional mismatch rejected');
}

// 19. Test: Unique address-matched gas station must be adopted even if station name has minor OCR typo
{
  const stationInfo = { station_name: '직영 Ske 정계주유소', station_address: '경기도 의왕시 민백길 1' };
  const candidates = [
    { place_name: 'SK에너지 청계주유소', road_address_name: '경기 의왕시 민백길 1', category_name: '주유,가스 > 주유소', latitude: 37.3871, longitude: 126.9842 }
  ];
  const matched = matchStationFromReceipt(stationInfo, candidates);
  assert(matched !== null, 'Unique gas station at exact address must match despite minor name OCR variance');
  assertEquals(matched.name, 'SK에너지 청계주유소', 'Matched station name');
  assertEquals(matched.address, '경기 의왕시 민백길 1', 'Matched station address');
  print('✓ Test 19 Passed: Unique address match with minor name OCR variance succeeds');
}

// 20. Test: Competing gas stations at same address must disambiguate by name or return null
{
  const stationInfo = { station_name: 'SK에너지 청계주유소', station_address: '경기 의왕시 민백길 1' };
  const competingCandidates = [
    { place_name: 'SK에너지 청계주유소', road_address_name: '경기 의왕시 민백길 1', category_name: '주유소', latitude: 37.3871, longitude: 126.9842 },
    { place_name: '현대오일뱅크 의왕주유소', road_address_name: '경기 의왕시 민백길 1', category_name: '주유소', latitude: 37.3871, longitude: 126.9842 }
  ];
  const disambiguated = matchStationFromReceipt(stationInfo, competingCandidates);
  assert(disambiguated !== null, 'Should disambiguate when one matches the station name');
  assertEquals(disambiguated.name, 'SK에너지 청계주유소', 'Correct candidate selected by name');

  // When neither or both match the name, return null
  const ambiguousCandidates = [
    { place_name: 'A주유소', road_address_name: '경기 의왕시 민백길 1', category_name: '주유소', latitude: 37.3871, longitude: 126.9842 },
    { place_name: 'B주유소', road_address_name: '경기 의왕시 민백길 1', category_name: '주유소', latitude: 37.3871, longitude: 126.9842 }
  ];
  const ambiguous = matchStationFromReceipt(stationInfo, ambiguousCandidates);
  assertEquals(ambiguous, null, 'Ambiguous competing stations at same address must return null');
  print('✓ Test 20 Passed: Competing gas stations disambiguation behavior');
}

// Synthetic receipts below follow a real GS-style layout and real Tesseract misreads;
// station, address, phone and card details are fictitious.
const GS_LAYOUT = `
매 출 전 표
( 고 객 용 )
2026-03-16 18:56:50 (054-321-7788)
ODT No : 35
매장명 : 한빛들 주유소
대표자 : 홍길동
사업자번호 : 1234567890
주소 : (712345) 경상북도 예시시 시험면 가
온로 4321 (시험리, 한빛들주유소(GS))
순번 제품명 노즐번호(Nozzle No)
구분 수량 단가 금액
01 경유 09
44.077 1,815 80,000
부가세 과세 물품가액 72,727
부가세 7,273
합 계 (주유금액) 80,000원
[신용카드]
거래 일시 : 2026/03/16 18:55:10
카드 번호 : 1234-5600-****-111*
승인 번호 : 12345678
승인  금액 : 80,000원
`;

// 21. Test: Quantity / price / amount on their own line under a separate item name
{
  const result = parseFuelReceipt(GS_LAYOUT);
  assertEquals(result.date, '2026-03-16', 'Date');
  assertEquals(result.fuel_type, 'diesel', 'Diesel');
  assertEquals(result.unit_price_krw, 1815, 'Unit price from column row');
  assertEquals(result.fuel_liters, 44.077, 'Quantity before price is read as quantity');
  assertEquals(result.actual_krw, 80000, 'Spaced 합 계 / 승인  금액 labels read');
  assert(result.confidence.consistency_passed, 'Consistency passed');
  assertEquals(result.station_name, '한빛들 주유소', 'Station name');
  assertEquals(result.station_address, '경상북도 예시시 시험면 가온로 4321', 'Full province name and wrapped road name joined');
  assertEquals(result.station_phone, '054-321-7788', 'Station phone from header');
  print('✓ Test 21 Passed: Column layout, spaced labels and wrapped address');
}

// 22. Test: Cancelled pre-authorisation must never become the paid amount
{
  const text = `
01 경유 09
4.408 1,815 8,000
합 계 (주유금액) 8,000원
선승인금액 : 149,900원 (취소)
실승인금액 : 8,000원
※ 실 주유금액으로 수정승인 완료
`;
  const result = parseFuelReceipt(text);
  assertEquals(result.actual_krw, 8000, 'Real approved amount, not the cancelled 149,900 pre-auth');
  assertEquals(result.fuel_liters, 4.408, 'Liters');
  assert(result.confidence.consistency_passed, 'Consistency passed');
  assertEquals(extractTotalAmount('선승인금액 : 149,900원 (취소)\n승인금액 : 8,000원'), 8000, 'Pre-auth line skipped even with plain 승인금액');
  print('✓ Test 22 Passed: Cancelled pre-authorisation excluded');
}

// 23. Test: Several noisy OCR passes vote; only the squashed pass reads the big digits
{
  const normalPass = `
2026-03-18 18:56:50 (054-321-7788)
매장명 : 한빛들 주유소
주소 : (712345) 경상북도 예시시 시험면 가
온로 4321 (시험리, 한빛들주유소(69))
01 Ar 09
44.07 100 50,000
합 계 (주유금액) aD 0(원
`;
  const squashedPass = `
2026-03-16 18:56:50 (054-321-7788)
매장명 : 한빛틀 주유소
44.077    1,815        80,000
부가세 파세 물풀가램 72,727
할 계 <주유금여? 80, 0002
신용카등| . 2026/03/16 18:55:10
`;
  const adaptivePass = `
2026-03-16 18:56:50 - (054-321-7788)
| 44.077 1,815 80,000 §
한 계 <주유금애> 80,000원 |
`;
  const result = parseFuelReceipt([normalPass, squashedPass, adaptivePass]);
  assertEquals(result.date, '2026-03-16', 'Majority date wins over a single misread 18');
  assertEquals(result.unit_price_krw, 1815, 'Unit price from squashed passes');
  assertEquals(result.fuel_liters, 44.077, 'Liters from squashed passes');
  assertEquals(result.actual_krw, 80000, 'Amount, with "80,0002" (원 misread) understood');
  assert(result.confidence.consistency_passed, 'Consistency passed');
  assertEquals(result.station_address, '경상북도 예시시 시험면 가온로 4321', 'Address from the normal pass');
  assertEquals(result.confidence.passes, 3, 'Three passes combined');

  const single = parseFuelReceipt(normalPass);
  assertEquals(single.unit_price_krw, null, 'Misread digits that break price × quantity are not filled');
  assertEquals(single.fuel_liters, null, 'Unverified liters stay empty');
  print('✓ Test 23 Passed: Multi-pass voting and verified numbers');
}

// 24. Test: A misread card total does not override a verified fuel row without a discount
{
  const text = `
01 휘발유
30.303 1,650 50,000
합계 60,000
`;
  const result = parseFuelReceipt(text);
  assertEquals(result.actual_krw, 50000, 'Verified row amount wins when nothing explains the difference');
  print('✓ Test 24 Passed: Misread total overridden by verified row');
}

// 25. Test: Numbers that cannot form price × quantity = amount are never combined
{
  const text = `
2026-03-16 18:56:50
발생포인트 : 44
가용포인트 : 585
부가세 과세 물품가액 72,727
부가세 7,273
ODT No : 35
`;
  const result = parseFuelReceipt(text);
  assertEquals(result.unit_price_krw, null, 'No price invented');
  assertEquals(result.fuel_liters, null, 'No liters invented');
  assertEquals(solveFuelTriple(text), null, 'Solver finds nothing');
  print('✓ Test 25 Passed: No triple invented from unrelated numbers');
}

// 26. Test: OCR variants of fuel name and impossible building numbers
{
  assertEquals(extractFuelType('01 경우                     09').fuel_type, 'diesel', '경우 on an item row is diesel');
  assertEquals(extractFuelType('카드 결제 경우 적립').fuel_type, null, '경우 in a sentence is not a fuel');
  assertEquals(extractStationLocation('경상북도 예시시 시험면 가온로 0022').station_address, null, 'Building number starting with 0 is a misread');
  print('✓ Test 26 Passed: Fuel name OCR variant and building number sanity');
}

// 27. Test: Phone number match and name-only match
{
  const candidates = [
    { place_name: 'GS칼텍스 한빛들주유소', road_address_name: '경북 예시시 시험면 가온로 4321', phone: '054-321-7788', latitude: 36.1, longitude: 128.1 },
    { place_name: '한빛들마트', road_address_name: '경북 예시시 시험면 가온로 4320', phone: '054-321-0000', latitude: 36.1, longitude: 128.1 }
  ];
  const byPhone = matchStationFromReceipt({ station_name: null, station_address: '예시시 가온로 0021', station_phone: '054-321-7788' }, candidates);
  assert(byPhone !== null, 'Unique phone match adopted even with a wrong address');
  assertEquals(byPhone.name, 'GS칼텍스 한빛들주유소', 'Phone matched station');

  const byName = matchStationFromReceipt({ station_name: '한빛들 주유소', station_address: null }, candidates);
  assert(byName !== null, 'Unique distinctive station name adopted without address');
  assertEquals(byName.name, 'GS칼텍스 한빛들주유소', 'Name matched station (spaces ignored)');

  const generic = matchStationFromReceipt({ station_name: '주유소', station_address: null }, candidates);
  assertEquals(generic, null, 'Generic name alone never matches');
  print('✓ Test 27 Passed: Phone and name-only station matching');
}

print('\nALL RECEIPT PARSER TESTS (27/27) PASSED SUCCESSFULLY!');
