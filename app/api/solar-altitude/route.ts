const API_URL = 'https://apis.data.go.kr/B090041/openapi/service/SrAltudeInfoService/getAreaSrAltudeInfo';

function readTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match?.[1]?.trim() ?? '';
}

function angleToDecimal(value: string) {
  const match = value.match(/(-?\d+)[^\d-]+(\d+)/);
  if (!match) return null;
  const degree = Number(match[1]);
  const minute = Number(match[2]);
  const sign = match[1].startsWith('-') ? -1 : 1;
  return Number((sign * (Math.abs(degree) + minute / 60)).toFixed(2));
}

export async function GET(request: Request) {
  const serviceKey = process.env.PUBLIC_DATA_SERVICE_KEY;
  if (!serviceKey) {
    return Response.json({ error: '공공데이터 인증키가 서버에 설정되지 않았습니다.' }, { status: 503 });
  }

  const requestUrl = new URL(request.url);
  const location = requestUrl.searchParams.get('location')?.trim() || '서울';
  const date = requestUrl.searchParams.get('date')?.replaceAll('-', '') || '';

  if (!/^[가-힣]{1,10}$/.test(location) || !/^\d{8}$/.test(date)) {
    return Response.json({ error: '지역 또는 날짜 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const apiUrl = new URL(API_URL);
  apiUrl.searchParams.set('ServiceKey', serviceKey);
  apiUrl.searchParams.set('location', location);
  apiUrl.searchParams.set('locdate', date);

  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    const xml = await response.text();
    const resultCode = readTag(xml, 'resultCode');
    const resultMessage = readTag(xml, 'resultMsg') || readTag(xml, 'resultMag');

    if (!response.ok || resultCode !== '00') {
      return Response.json({ error: resultMessage || '공공데이터 응답을 불러오지 못했습니다.' }, { status: 502 });
    }

    const raw = {
      altitude09: readTag(xml, 'altitude_09'),
      altitude12: readTag(xml, 'altitude_12'),
      altitude15: readTag(xml, 'altitude_15'),
      altitude18: readTag(xml, 'altitude_18'),
      altitudeMeridian: readTag(xml, 'altitudeMeridian') || readTag(xml, 'altitude_meridian'),
      azimuth09: readTag(xml, 'azimuth_09'),
      azimuth12: readTag(xml, 'azimuth_12'),
      azimuth15: readTag(xml, 'azimuth_15'),
      azimuth18: readTag(xml, 'azimuth_18'),
    };

    if (!raw.altitude09 || !raw.altitude12 || !raw.altitude15 || !raw.altitudeMeridian) {
      return Response.json({ error: '해당 날짜와 지역의 태양 고도 자료가 없습니다.' }, { status: 404 });
    }

    return Response.json({
      source: '한국천문연구원 태양고도 정보',
      location: readTag(xml, 'location') || location,
      date: readTag(xml, 'locdate') || date,
      latitude: readTag(xml, 'latitude'),
      longitude: readTag(xml, 'longitude'),
      altitudes: {
        '09': angleToDecimal(raw.altitude09),
        '12': angleToDecimal(raw.altitude12),
        '15': angleToDecimal(raw.altitude15),
        '18': angleToDecimal(raw.altitude18),
        meridian: angleToDecimal(raw.altitudeMeridian),
      },
      raw,
    }, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=86400' },
    });
  } catch {
    return Response.json({ error: '천문 데이터 서버 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' }, { status: 504 });
  }
}
