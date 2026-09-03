'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import CrtTerminal from './CrtTerminal';

type Sample = { time: string; altitude: number; shadow: number; temperature: number };
type GraphKey = 'altitude' | 'shadow' | 'temperature';
type RecordedMeasurement = { altitude: number; shadow: number; temperature: number };
type MeasurementMap = Record<number, RecordedMeasurement>;
type OfficialSolarData = {
  source: string;
  location: string;
  date: string;
  latitude: string;
  longitude: string;
  altitudes: { '09': number | null; '12': number | null; '15': number | null; '18': number | null; meridian: number | null };
  raw: { altitude09: string; altitude12: string; altitude15: string; altitude18: string; altitudeMeridian: string };
};

// 관측 기준: 인천옥련초등학교(인천광역시 연수구 한진로 30), 2026년 9월 4일.
// 태양 시각·고도 자료는 공공데이터포털(한국천문연구원) 응답값입니다. API 키는 저장하지 않습니다.
//  - RiseSetInfoService getAreaRiseSetInfo  (location=인천, locdate=20260904): 일출 06:06 · 남중 12:32:20 · 일몰 18:58
//  - SrAltudeInfoService getAreaSrAltudeInfo (location=인천, locdate=20260904): 남중고도 59°45′,
//      09시 33°21′(방위 108°17′) · 12시 58°52′(164°21′) · 15시 44°52′(237°15′) · 18시 10°42′(270°48′)
// 관측 시각(9:30~15:30)의 고도는 위 API 값을 기준점으로 같은 날 태양 위치를 계산해 0.1° 단위로 맞춘 값이고,
// 그림자 길이는 10 cm 막대기 기준(10 ÷ tan 고도)입니다. 기온은 API 자료가 아니라 수업용 예시값입니다.
const observation = {
  school: '인천옥련초등학교',
  address: '인천광역시 연수구 한진로 30',
  date: '2026년 9월 4일',
  area: '인천',
  sunrise: '06:06',
  transit: '12:32:20',
  sunset: '18:58',
  meridianAltitude: '59°45′',
  apiAltitudes: [
    { time: '09:00', altitude: '33°21′', azimuth: '108°17′' },
    { time: '12:00', altitude: '58°52′', azimuth: '164°21′' },
    { time: '15:00', altitude: '44°52′', azimuth: '237°15′' },
    { time: '18:00', altitude: '10°42′', azimuth: '270°48′' },
  ],
  source: '공공데이터포털 한국천문연구원 RiseSetInfoService · SrAltudeInfoService',
};

const samples: Sample[] = [
  { time: '9:30', altitude: 38.9, shadow: 12.4, temperature: 24.2 },
  { time: '10:30', altitude: 49.0, shadow: 8.7, temperature: 25.9 },
  { time: '11:30', altitude: 56.6, shadow: 6.6, temperature: 27.4 },
  { time: '12:30', altitude: 59.7, shadow: 5.8, temperature: 28.5 },
  { time: '13:30', altitude: 57.0, shadow: 6.5, temperature: 29.2 },
  { time: '14:30', altitude: 49.6, shadow: 8.5, temperature: 29.6 },
  { time: '15:30', altitude: 39.7, shadow: 12.1, temperature: 29.3 },
];

const graphMeta: Record<GraphKey, { label: string; unit: string; color: string; min: number; max: number }> = {
  altitude: { label: '태양 고도', unit: '°', color: '#e45b36', min: 30, max: 65 },
  shadow: { label: '그림자 길이', unit: 'cm', color: '#2b8b61', min: 4, max: 14 },
  temperature: { label: '기온', unit: '℃', color: '#3568ad', min: 22, max: 31 },
};

const measurementTolerance = { altitude: 2, shadow: 1.5 };
const koreaToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

function GraphCard({ metric, measurements }: { metric: GraphKey; measurements: MeasurementMap }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meta = graphMeta[metric];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    const pad = { l: 38, r: 16, t: 18, b: 34 };
    const plotW = width - pad.l - pad.r;
    const plotH = height - pad.t - pad.b;
    ctx.strokeStyle = '#dfe4df';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad.t + (plotH / 5) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
    }
    samples.forEach((sample, i) => {
      const x = pad.l + (plotW / 6) * i;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
      ctx.fillStyle = '#66736a'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
      ctx.fillText(sample.time, x, height - 10);
    });
    const points = samples.map((sample, i) => ({
      x: pad.l + (plotW / 6) * i,
      y: pad.t + plotH - (((measurements[i]?.[metric] ?? sample[metric]) - meta.min) / (meta.max - meta.min)) * plotH,
      shown: Boolean(measurements[i]),
    }));
    ctx.strokeStyle = meta.color; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    let drawing = false;
    points.forEach((point) => {
      if (!point.shown) { drawing = false; return; }
      if (!drawing) { ctx.moveTo(point.x, point.y); drawing = true; } else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    points.forEach((point) => {
      if (!point.shown) return;
      ctx.fillStyle = meta.color; ctx.beginPath(); ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2); ctx.fill();
    });
  }, [metric, measurements, meta]);

  return (
    <article className="graph-card">
      <div className="graph-title"><span style={{ background: meta.color }} /> <b>{meta.label}</b><small>{meta.unit}</small></div>
      <canvas ref={canvasRef} role="img" aria-label={`${meta.label} 꺾은선그래프`} />
    </article>
  );
}

function MeasurementInstrument({ sample, angleGuess }: { sample: Sample; angleGuess: number }) {
  const baseX = 500;
  const groundY = 240;
  const unit = 18;
  const poleHeight = 10 * unit;
  const shadowTipX = baseX - sample.shadow * unit;
  const radius = 118;
  const guessRadians = angleGuess * Math.PI / 180;
  const ticks = Array.from({ length: 19 }, (_, i) => i * 5);
  const rulerTicks = Array.from({ length: 161 }, (_, i) => i / 10);

  return (
    <svg className="measurement-instrument" viewBox="0 0 720 300" role="img" aria-label={`막대기 높이 10 cm, 그림자 끝에 중심을 둔 각도기와 막대기 밑 0점에 맞춘 자`}>
      <defs>
        <linearGradient id="shadowFade" x1="1" x2="0"><stop stopColor="#26342b" stopOpacity=".62" /><stop offset="1" stopColor="#26342b" stopOpacity=".12" /></linearGradient>
      </defs>

      <line className="instrument-ground-line" x1="70" y1={groundY} x2="660" y2={groundY} />

      <g className="instrument-protractor">
        <path d={`M ${shadowTipX} ${groundY} L ${shadowTipX + radius} ${groundY} A ${radius} ${radius} 0 0 0 ${shadowTipX} ${groundY - radius} Z`} />
        {ticks.map((angle) => {
          const rad = angle * Math.PI / 180;
          const longTick = angle % 10 === 0;
          const outerX = shadowTipX + Math.cos(rad) * radius;
          const outerY = groundY - Math.sin(rad) * radius;
          const innerRadius = radius - (longTick ? 12 : 7);
          const innerX = shadowTipX + Math.cos(rad) * innerRadius;
          const innerY = groundY - Math.sin(rad) * innerRadius;
          return <line key={angle} x1={innerX} y1={innerY} x2={outerX} y2={outerY} />;
        })}
        {[0, 30, 60, 90].map((angle) => {
          const rad = angle * Math.PI / 180;
          return <text key={angle} x={shadowTipX + Math.cos(rad) * (radius - 24)} y={groundY - Math.sin(rad) * (radius - 24) + 4}>{angle}°</text>;
        })}
        <circle cx={shadowTipX} cy={groundY} r="5" />
        <text className="center-label" x={shadowTipX} y={groundY + 54}>각도기 중심 = 그림자 끝</text>
      </g>

      <line className="true-ray" x1={shadowTipX} y1={groundY} x2={baseX} y2={groundY - poleHeight} />
      <line
        className="guess-ray"
        x1={shadowTipX}
        y1={groundY}
        x2={shadowTipX + Math.cos(guessRadians) * (radius + 14)}
        y2={groundY - Math.sin(guessRadians) * (radius + 14)}
      />

      <line className="instrument-shadow" x1={baseX} y1={groundY - 2} x2={shadowTipX} y2={groundY - 2} />
      <circle className="shadow-tip" cx={shadowTipX} cy={groundY - 2} r="5" />

      <g className="instrument-ruler">
        <rect x={baseX - 16 * unit} y={groundY + 3} width={16 * unit} height="37" rx="2" />
        {rulerTicks.map((value) => {
          const x = baseX - value * unit;
          const whole = Number.isInteger(value);
          const half = Math.round(value * 10) % 5 === 0;
          return <line key={value} x1={x} y1={groundY + 3} x2={x} y2={groundY + (whole ? 19 : half ? 14 : 10)} />;
        })}
        {[0, 5, 10, 15].map((value) => <text key={value} x={baseX - value * unit} y={groundY + 34}>{value}</text>)}
        <text className="ruler-unit" x={baseX - 16 * unit + 7} y={groundY + 34}>cm</text>
      </g>

      <g className="instrument-stick">
        <rect x={baseX - 7} y={groundY - poleHeight} width="14" height={poleHeight} rx="5" />
        <line x1={baseX} y1={groundY - poleHeight + 10} x2={baseX} y2={groundY - 10} />
        <text x={baseX + 15} y={groundY - poleHeight / 2}>10 cm 막대기</text>
      </g>
      <path className="zero-marker" d={`M ${baseX - 8} ${groundY + 48} L ${baseX} ${groundY + 41} L ${baseX + 8} ${groundY + 48}`} />
      <text className="zero-label" x={baseX} y={groundY + 62}>자의 0점 = 막대기 밑</text>
      <g className="instrument-legend" transform="translate(72 72)">
        <line className="true-ray" x1="0" y1="0" x2="28" y2="0" /><text x="36" y="4">막대기 끝 연결선</text>
        <line className="guess-ray" x1="0" y1="22" x2="28" y2="22" /><text x="36" y="26">내 각도 눈금</text>
      </g>
    </svg>
  );
}

export default function Home() {
  const [phase, setPhase] = useState(0);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [measurements, setMeasurements] = useState<MeasurementMap>({});
  const [angleGuess, setAngleGuess] = useState(30);
  const [shadowGuess, setShadowGuess] = useState('');
  const [feedback, setFeedback] = useState('각도기와 자를 자세히 살펴보고 측정값을 입력하세요.');
  const [feedbackTone, setFeedbackTone] = useState<'neutral' | 'good' | 'try' | 'answer'>('neutral');
  const [wrongAttempts, setWrongAttempts] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [setup, setSetup] = useState([false, false, false]);
  const [solved, setSolved] = useState<string[]>([]);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [isDraggingTime, setIsDraggingTime] = useState(false);
  const [solarLocation, setSolarLocation] = useState('서울');
  const [solarDate, setSolarDate] = useState(koreaToday);
  const [officialSolar, setOfficialSolar] = useState<OfficialSolarData | null>(null);
  const [officialSolarError, setOfficialSolarError] = useState('');
  const [officialSolarLoading, setOfficialSolarLoading] = useState(false);
  const sample = samples[sampleIndex];
  const recorded = Object.keys(measurements).map(Number).sort((a, b) => a - b);
  const currentAttempts = wrongAttempts[sampleIndex] ?? 0;
  const progress = Math.round(((setup.filter(Boolean).length + recorded.length + solved.length) / 14) * 100);
  const badge = recorded.length === 7 ? '남중고도 마스터' : recorded.length >= 4 ? '그림자 탐정' : recorded.length >= 1 ? '첫 관측 성공' : '도전 중';

  function chooseSample(index: number) {
    const existing = measurements[index];
    setSampleIndex(index);
    setAngleGuess(existing?.altitude ?? 30);
    setShadowGuess(existing ? String(existing.shadow) : '');
    if (revealed.includes(index)) {
      setFeedback(`정답 확인 완료: 태양 고도 ${samples[index].altitude}°, 그림자 길이 ${samples[index].shadow} cm입니다.`);
      setFeedbackTone('answer');
    } else {
      setFeedback(existing ? '이미 관측한 시각이에요. 다시 실험해 보아도 좋아요!' : '각도기와 자를 자세히 살펴보고 측정값을 입력하세요.');
      setFeedbackTone('neutral');
    }
  }

  function goToNextObservation() {
    const nextAfter = samples.findIndex((_, index) => index > sampleIndex && !measurements[index]);
    const nextFromStart = samples.findIndex((_, index) => !measurements[index]);
    const nextIndex = nextAfter >= 0 ? nextAfter : nextFromStart;
    if (nextIndex >= 0) chooseSample(nextIndex);
    else setPhase(2);
  }

  function chooseTimeFromPosition(clientX: number, surface: HTMLDivElement) {
    const rect = surface.getBoundingClientRect();
    const relativeX = (clientX - rect.left) / rect.width;
    const nextIndex = Math.max(0, Math.min(6, Math.round(((relativeX - 0.12) / 0.75) * 6)));
    if (nextIndex !== sampleIndex) chooseSample(nextIndex);
  }

  function startTimeDrag(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDraggingTime(true);
    chooseTimeFromPosition(event.clientX, event.currentTarget);
  }

  function moveTimeDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingTime) return;
    chooseTimeFromPosition(event.clientX, event.currentTarget);
  }

  function endTimeDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDraggingTime(false);
  }

  function moveTimeWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    let next = sampleIndex;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next -= 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next += 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 6;
    next = Math.max(0, Math.min(6, next));
    if (next !== sampleIndex) {
      event.preventDefault();
      chooseSample(next);
    }
  }

  function toggleSetup(index: number) {
    const next = [...setup];
    if (!next[index]) setScore((value) => value + 15);
    next[index] = !next[index];
    setSetup(next);
  }

  function checkMeasurement() {
    const shadowNumber = Number(shadowGuess);
    const angleDiff = Math.abs(angleGuess - sample.altitude);
    const shadowDiff = Math.abs(shadowNumber - sample.shadow);
    if (!shadowGuess || Number.isNaN(shadowNumber)) {
      setFeedback('그림자 길이도 입력해야 관측을 완료할 수 있어요.'); setFeedbackTone('try'); return;
    }
    if (angleDiff <= measurementTolerance.altitude && shadowDiff <= measurementTolerance.shadow) {
      const first = !measurements[sampleIndex];
      const resultLabel = angleDiff <= .5 && shadowDiff <= .2 ? '정확해요!' : '좋은 근삿값이에요!';
      setMeasurements((items) => ({
        ...items,
        [sampleIndex]: { altitude: angleGuess, shadow: shadowNumber, temperature: sample.temperature },
      }));
      if (first) setScore((value) => value + 120);
      setWrongAttempts((items) => ({ ...items, [sampleIndex]: 0 }));
      setFeedback(first ? `${resultLabel} 입력한 ${angleGuess}°, ${shadowNumber} cm와 기온 ${sample.temperature}℃가 기록표와 그래프로 전송됐어요. +120점` : `${resultLabel} 재측정값 ${angleGuess}°, ${shadowNumber} cm로 기록을 갱신했어요.`);
      setFeedbackTone('good');
    } else {
      const nextAttempts = currentAttempts + 1;
      setWrongAttempts((items) => ({ ...items, [sampleIndex]: nextAttempts }));
      if (nextAttempts >= 3) {
        setMeasurements((items) => ({
          ...items,
          [sampleIndex]: { altitude: sample.altitude, shadow: sample.shadow, temperature: sample.temperature },
        }));
        setRevealed((items) => items.includes(sampleIndex) ? items : [...items, sampleIndex]);
        setAngleGuess(sample.altitude);
        setShadowGuess(String(sample.shadow));
        setFeedback(`3번 시도했어요. 정답은 태양 고도 ${sample.altitude}°, 그림자 길이 ${sample.shadow} cm예요. 정답을 기록했으니 다음 시각으로 넘어가세요.`);
        setFeedbackTone('answer');
      } else {
        const hint = angleDiff > measurementTolerance.altitude && shadowDiff > measurementTolerance.shadow ? '각도기의 중심과 그림자 끝을 모두 다시 확인해 보세요.' : angleDiff > measurementTolerance.altitude ? '막대기 끝과 각도기 중심을 이은 선을 다시 살펴보세요.' : '자의 0 cm가 막대기 밑에 놓였는지 확인해 보세요.';
        setFeedback(`${nextAttempts}/3회 시도했어요. ${hint} 실패해도 점수는 줄지 않아요!`);
        setFeedbackTone('try');
      }
    }
  }

  function answer(id: string, correct: boolean) {
    if (correct) {
      if (!solved.includes(id)) { setSolved((items) => [...items, id]); setScore((value) => value + 100); }
    }
  }

  async function loadOfficialSolarData() {
    setOfficialSolarLoading(true);
    setOfficialSolarError('');
    try {
      const query = new URLSearchParams({ location: solarLocation, date: solarDate });
      const response = await fetch(`/api/solar-altitude?${query}`);
      const result = await response.json() as OfficialSolarData & { error?: string };
      if (!response.ok) throw new Error(result.error || '자료를 불러오지 못했습니다.');
      setOfficialSolar(result);
    } catch (error) {
      setOfficialSolar(null);
      setOfficialSolarError(error instanceof Error ? error.message : '자료를 불러오지 못했습니다.');
    } finally {
      setOfficialSolarLoading(false);
    }
  }

  const phaseNames = ['준비하기', '모의 측정', '기록·그래프', '관계 찾기', '마무리'];

  return (
    <main id="top">
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark" aria-hidden="true">☀</span><span>해봄 과학실</span></a>
        <div className="lesson-chip">6학년 과학 · 계절의 변화 · {observation.school} · {observation.date}</div>
        <div className="header-actions"><div className="score-chip"><span>✦</span> {score}점</div><button className="teacher-button" type="button" onClick={() => setTeacherOpen(true)}>교사용 안내</button></div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span>오늘의 탐구 임무</span><i /> 남쪽 하늘 관측소</div>
          <h1>사라진 태양의<br /><em>최고점을 찾아라!</em></h1>
          <p>관측소의 하루 기록이 사라졌어요. 태양 고도·그림자 길이·기온을 비교해<br className="desktop-break" /> 태양이 가장 높이 뜬 순간과 가장 더운 순간을 찾아주세요.</p>
          <button className="start-button" type="button" onClick={() => { setPhase(1); document.querySelector('#mission')?.scrollIntoView({ behavior: 'smooth' }); }}>관측 임무 시작 <span>→</span></button>
        </div>
        <div className="mission-card">
          <div className="crt-stage" aria-hidden="true">
            <CrtTerminal />
          </div>
          <span>MISSION 01</span><b>남중고도 관측 기록 복구</b>
          <div className="orbit"><div className="orbit-sun">☀</div><div className="observatory">⌂</div></div>
          <dl><div><dt>진행률</dt><dd>{progress}%</dd></div><div><dt>현재 배지</dt><dd>{badge}</dd></div></dl>
        </div>
      </section>

      <section className="mission-shell" id="mission">
        <div className="mission-status">
          <div><span>관측 레벨 1</span><b>{badge}</b></div>
          <div className="progress-wrap"><div className="progress-copy"><span>전체 임무</span><b>{progress}%</b></div><div className="progress-bar"><i style={{ width: `${progress}%` }} /></div></div>
          <div className="points"><span>누적 점수</span><b>{score} P</b></div>
        </div>

        <nav className="steps" aria-label="탐구 단계">
          {phaseNames.map((label, i) => (
            <button type="button" className={phase === i ? 'step active' : 'step'} key={label} onClick={() => setPhase(i)}>
              <span>{i + 1}</span><b>{label}</b>{i < phaseNames.length - 1 && <i />}
            </button>
          ))}
        </nav>

        {phase === 0 && (
          <section className="phase-panel setup-panel">
            <div className="section-heading"><div><span className="section-number">01</span><p>안전하고 정확한 측정</p></div><h2>관측 장비를 준비하세요</h2></div>
            <p className="lead">세 가지 준비를 모두 확인하면 관측소 문이 열립니다. 실제 야외 관측에서는 태양을 맨눈으로 직접 보지 마세요.</p>
            <div className="setup-grid">
              {[
                ['▱', '평평한 곳', '측정기를 기울어지지 않게 놓아요.'],
                ['↔', '그림자와 자', '막대기 그림자와 자를 평행하게 맞춰요.'],
                ['⌁', '각도기 중심', '그림자 끝에 각도기의 중심을 맞춰요.'],
              ].map((item, i) => <button type="button" key={item[1]} onClick={() => toggleSetup(i)} className={setup[i] ? 'setup-card checked' : 'setup-card'}><span className="setup-icon">{setup[i] ? '✓' : item[0]}</span><b>{item[1]}</b><small>{item[2]}</small><em>{setup[i] ? '확인 완료 · +15점' : '눌러서 확인'}</em></button>)}
            </div>
            <button className="next-button" type="button" disabled={!setup.every(Boolean)} onClick={() => setPhase(1)}>관측소로 이동 <span>→</span></button>
          </section>
        )}

        {phase === 1 && (
          <section className="phase-panel lab-section">
            <div className="section-heading"><div><span className="section-number">02</span><p>원하는 시각부터 선택 가능</p></div><h2>태양 고도와 그림자 측정</h2></div>
            <div className="time-quests" aria-label="관측 시각 선택">{samples.map((item, i) => <button type="button" key={item.time} onClick={() => chooseSample(i)} className={`${i === sampleIndex ? 'selected' : ''} ${recorded.includes(i) ? 'done' : ''}`}><span>{recorded.includes(i) ? '✓' : String(i + 1).padStart(2, '0')}</span><b>{item.time}</b></button>)}</div>
            <div className="lab-card">
              <div
                className={`sky-panel time-drag-surface ${isDraggingTime ? 'dragging' : ''}`}
                role="slider"
                tabIndex={0}
                aria-label="관측 시각"
                aria-valuemin={0}
                aria-valuemax={6}
                aria-valuenow={sampleIndex}
                aria-valuetext={sample.time}
                onPointerDown={startTimeDrag}
                onPointerMove={moveTimeDrag}
                onPointerUp={endTimeDrag}
                onPointerCancel={endTimeDrag}
                onKeyDown={moveTimeWithKeyboard}
              >
                <div className="sky-caption"><b>{sample.time}</b> {observation.school} 남쪽 하늘 · 막대기 높이 10 cm</div>
                <div className="drag-hint"><span>↔</span>{isDraggingTime ? '시간 이동 중' : '태양을 좌우로 드래그해 시간 바꾸기'}</div>
                <div className={`sun ${isDraggingTime ? 'grabbed' : ''}`} style={{ left: `${12 + sampleIndex * 12.5}%`, top: `${62 - sample.altitude * .78}%` }}><span /><i aria-hidden="true">↔</i></div>
                <div className="sun-path" aria-hidden="true" />
                <MeasurementInstrument sample={sample} angleGuess={angleGuess} />
              </div>
              <aside className="measure-panel">
                <span className="mini-label">관측 퀘스트 {sampleIndex + 1}/7</span><strong>{sample.time}</strong>
                <label htmlFor="angle-slider">① 각도기 눈금 맞추기 <b>{angleGuess}°</b></label>
                <input id="angle-slider" type="range" min="25" max="65" step="0.5" value={angleGuess} onChange={(event) => setAngleGuess(Number(event.target.value))} />
                <div className="range-scale"><span>25°</span><span>65°</span></div>
                <p className="tolerance-note">눈금 읽기 오차 허용: 각도 ±2° · 그림자 ±1.5 cm</p>
                <label htmlFor="shadow-input">② 그림자 길이 읽기</label>
                <div className="input-unit"><input id="shadow-input" inputMode="decimal" value={shadowGuess} onChange={(event) => setShadowGuess(event.target.value)} placeholder="예: 12.5" /><span>cm</span></div>
                <div className={`feedback ${feedbackTone}`} role="status"><span>{feedbackTone === 'good' ? '✓' : feedbackTone === 'try' ? '↻' : feedbackTone === 'answer' ? '!' : 'i'}</span><p>{feedback}</p></div>
                {revealed.includes(sampleIndex)
                  ? <button className="record-button reveal-next-button" type="button" onClick={goToNextObservation}>정답 확인 완료 · 다음 시각 <span>→</span></button>
                  : <button className="record-button" type="button" onClick={checkMeasurement}>측정값 확인하기 <span>{currentAttempts}/3 시도</span></button>}
              </aside>
            </div>
            <div className="data-source"><b>관측 자료 출처</b> {observation.date} {observation.area} 기준 · 일출 {observation.sunrise} · 남중 {observation.transit} (남중고도 {observation.meridianAltitude}) · 일몰 {observation.sunset}<br />{observation.source} 응답값을 반영했습니다. 시각별 API 고도: {observation.apiAltitudes.map((item) => `${item.time} ${item.altitude}`).join(' · ')}. 기온은 수업용 예시값입니다.</div>
            <div className="mission-foot"><span>{recorded.length}/7 관측 완료</span><button type="button" disabled={recorded.length < 3} onClick={() => setPhase(2)}>그래프 확인하기 →</button></div>
          </section>
        )}

        {phase === 2 && (
          <section className="phase-panel graph-section">
            <div className="section-heading"><div><span className="section-number">03</span><p>관측값이 선으로 이어져요</p></div><h2>관측 기록과 꺾은선그래프</h2></div>
            {recorded.length < 3 && <div className="unlock-note">🔒 모의 측정에서 3개 이상의 시각을 관측하면 그래프가 열려요.</div>}
            <section className="official-solar-card" aria-labelledby="official-solar-title">
              <div className="official-solar-intro">
                <span>공공데이터 연동</span>
                <h3 id="official-solar-title">실제 태양 고도와 비교하기</h3>
                <p>한국천문연구원이 제공하는 지역별 9시·12시·15시·18시 태양 고도와 남중 고도를 불러옵니다.</p>
              </div>
              <div className="official-solar-controls">
                <label>지역<select value={solarLocation} onChange={(event) => setSolarLocation(event.target.value)}>{['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '제주'].map((location) => <option key={location}>{location}</option>)}</select></label>
                <label>날짜<input type="date" value={solarDate} onChange={(event) => setSolarDate(event.target.value)} /></label>
                <button type="button" onClick={loadOfficialSolarData} disabled={officialSolarLoading}>{officialSolarLoading ? '자료 불러오는 중…' : '실제 자료 불러오기'}</button>
              </div>
              {officialSolarError && <div className="official-solar-error" role="alert">{officialSolarError} 교과서 모의측정 자료는 그대로 사용할 수 있습니다.</div>}
              {officialSolar && (
                <div className="official-solar-result">
                  <div className="official-solar-summary"><b>{officialSolar.location} · {`${officialSolar.date.slice(0, 4)}.${officialSolar.date.slice(4, 6)}.${officialSolar.date.slice(6, 8)}`}</b><span>위도 {officialSolar.latitude} · 경도 {officialSolar.longitude}</span></div>
                  <div className="official-solar-values">
                    {[
                      ['09시', officialSolar.raw.altitude09],
                      ['12시', officialSolar.raw.altitude12],
                      ['15시', officialSolar.raw.altitude15],
                      ['18시', officialSolar.raw.altitude18],
                      ['남중 고도', officialSolar.raw.altitudeMeridian],
                    ].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}
                  </div>
                  <p><b>비교 질문:</b> 실제 자료에서도 낮 동안 태양 고도가 높아졌다가 낮아지는지 찾아보세요. <small>출처: {officialSolar.source} · XML 자료를 서버에서 변환</small></p>
                </div>
              )}
            </section>
            <div className="graph-grid"><GraphCard metric="altitude" measurements={measurements} /><GraphCard metric="shadow" measurements={measurements} /><GraphCard metric="temperature" measurements={measurements} /></div>
            <div className="data-table-wrap"><table><caption>하루 동안의 관측 기록 · {observation.date} {observation.school} · 모의 측정에서 제출한 값</caption><thead><tr><th>측정 시각</th>{samples.map((item) => <th key={item.time}>{item.time}</th>)}</tr></thead><tbody><tr><th>태양 고도(°)</th>{samples.map((item, i) => <td key={item.time}>{measurements[i]?.altitude ?? '—'}</td>)}</tr><tr><th>그림자 길이(cm)</th>{samples.map((item, i) => <td key={item.time}>{measurements[i]?.shadow ?? '—'}</td>)}</tr><tr><th>기온(℃)</th>{samples.map((item, i) => <td key={item.time}>{measurements[i]?.temperature.toFixed(1) ?? '—'}</td>)}</tr></tbody></table></div>
            <div className="thermal-lag-card">
              <div><span>태양 고도 최고 · 그림자 최단</span><b>12:30</b><small>59.7° · 5.8 cm</small></div>
              <div className="thermal-arrow"><b>약 2시간 뒤</b><span>지표가 계속 데워져요 →</span></div>
              <div><span>기온 최고</span><b>14:30</b><small>29.6℃</small></div>
            </div>
            <div className="pattern-callout"><span>탐정의 단서</span><div className="pattern-clues"><p>태양 고도의 <b>가장 높은 점</b>과 그림자 길이의 <b>가장 낮은 점</b>은 12:30으로 같아요.</p><p>하지만 기온의 <b>가장 높은 점</b>은 14:30이에요. 왜 약 2시간 늦게 나타나는지 생각해 보세요.</p></div><button type="button" onClick={() => setPhase(3)}>관계 추리하기 →</button></div>
          </section>
        )}

        {phase === 3 && (
          <section className="phase-panel relation-section">
            <div className="section-heading"><div><span className="section-number">04</span><p>증거로 규칙 설명하기</p></div><h2>네 가지 개념 도전</h2></div>
            <p className="lead">틀려도 점수는 줄지 않습니다. 그래프로 돌아가 근거를 다시 찾고 도전하세요.</p>
            <div className="quiz-list">
              <article className={solved.includes('peak') ? 'quiz solved' : 'quiz'}><div className="quiz-num">1</div><div><span>최고점 찾기 · 100 P</span><h3>태양 고도가 가장 높은 시각은 언제인가요?</h3><div className="answers">{['11:30', '12:30', '13:30'].map((item) => <button key={item} type="button" onClick={() => answer('peak', item === '12:30')}>{item}</button>)}</div>{solved.includes('peak') && <p className="answer-feedback">✓ 맞아요. 오후 12시 30분의 태양 고도는 59.7°로 가장 높습니다. 한국천문연구원 자료의 인천 남중 시각은 {observation.transit}, 남중고도는 {observation.meridianAltitude}입니다.</p>}</div></article>
              <article className={solved.includes('shadow') ? 'quiz solved' : 'quiz'}><div className="quiz-num">2</div><div><span>관계 찾기 · 100 P</span><h3>태양 고도가 높아질수록 그림자 길이는 어떻게 되나요?</h3><div className="answers"><button type="button" onClick={() => answer('shadow', true)}>짧아진다</button><button type="button" onClick={() => answer('shadow', false)}>길어진다</button><button type="button" onClick={() => answer('shadow', false)}>변하지 않는다</button></div>{solved.includes('shadow') && <p className="answer-feedback">✓ 정확해요. 태양 고도와 그림자 길이는 반대 방향으로 변합니다.</p>}</div></article>
              <article className={solved.includes('south') ? 'quiz solved' : 'quiz'}><div className="quiz-num">3</div><div><span>과학 용어 · 100 P</span><h3>태양이 정남쪽에 있을 때의 태양 고도를 무엇이라고 하나요?</h3><div className="answers"><button type="button" onClick={() => answer('south', false)}>최고 고도</button><button type="button" onClick={() => answer('south', true)}>태양의 남중 고도</button><button type="button" onClick={() => answer('south', false)}>계절 고도</button></div>{solved.includes('south') && <p className="answer-feedback">✓ 태양이 남중할 때의 고도를 ‘태양의 남중 고도’라고 합니다.</p>}</div></article>
              <article className={solved.includes('temperature') ? 'quiz solved' : 'quiz'}><div className="quiz-num">4</div><div><span>기온의 시간 지연 · 100 P</span><h3>태양 고도가 12:30에 가장 높은데, 기온은 언제 가장 높나요?</h3><div className="answers">{['12:30', '13:30', '14:30'].map((item) => <button key={item} type="button" onClick={() => answer('temperature', item === '14:30')}>{item}</button>)}</div>{solved.includes('temperature') && <p className="answer-feedback">✓ 14:30에 29.6℃로 가장 높아요. 정오 이후에도 지표가 한동안 태양 에너지를 받아 데워지므로 최고 기온은 남중 시각보다 늦게 나타납니다.</p>}</div></article>
            </div>
            <button className="next-button" type="button" disabled={solved.length < 4} onClick={() => setPhase(4)}>최종 보고서 열기 <span>→</span></button>
          </section>
        )}

        {phase === 4 && (
          <section className="phase-panel finish-stage">
            <div className="paper-halo" aria-hidden="true" />
            <article
              className="finish-section paper-surface"
              onPointerMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - 0.5;
                const y = (event.clientY - rect.top) / rect.height - 0.5;
                event.currentTarget.style.setProperty('--paper-rx', `${-y * 8}deg`);
                event.currentTarget.style.setProperty('--paper-ry', `${x * 10}deg`);
                event.currentTarget.style.setProperty('--paper-light-x', `${(x + 0.5) * 100}%`);
                event.currentTarget.style.setProperty('--paper-light-y', `${(y + 0.5) * 100}%`);
              }}
              onPointerLeave={(event) => {
                event.currentTarget.style.setProperty('--paper-rx', '0deg');
                event.currentTarget.style.setProperty('--paper-ry', '0deg');
                event.currentTarget.style.setProperty('--paper-light-x', '50%');
                event.currentTarget.style.setProperty('--paper-light-y', '20%');
              }}
            >
              <div className="paper-grain" aria-hidden="true" />
              <div className="paper-fold paper-fold-left" aria-hidden="true" />
              <div className="paper-fold paper-fold-right" aria-hidden="true" />
              <div className="completion-seal">☀<span>MISSION<br />COMPLETE</span></div>
              <span className="final-kicker">남쪽 하늘 관측소 공식 보고서</span><h2>남중고도의 비밀을 찾았어요!</h2>
              <p>{observation.date} {observation.school}에서 태양은 <b>오후 12시 30분 무렵</b>(남중 {observation.transit}) 정남쪽에서 <b>{observation.meridianAltitude}</b>로 가장 높이 떠요.<br />이때 그림자는 <b>가장 짧지만</b>, 기온은 바로 최고가 되지 않아요. 지표가 한동안 더 데워진 뒤 <b>오후 2시 30분에 29.6℃</b>로 가장 높아집니다.</p>
              <div className="result-grid"><div><span>최종 점수</span><b>{score} P</b></div><div><span>완료 관측</span><b>{recorded.length} / 7</b></div><div><span>획득 배지</span><b>{badge}</b></div></div>
              <div className="final-actions"><button type="button" onClick={() => window.print()}>결과 인쇄하기</button><button type="button" className="outline" onClick={() => { setPhase(1); document.querySelector('#mission')?.scrollIntoView({ behavior: 'smooth' }); }}>관측 다시 보기</button></div>
            </article>
          </section>
        )}
      </section>

      <footer><b>해봄 과학실</b><span>관찰하고 · 측정하고 · 설명하는 과학</span><small>학습 주제: 하루 동안 태양 고도, 그림자 길이, 기온의 관계 · 관측 기준 {observation.school}({observation.address}) {observation.date} · 태양 자료 {observation.source}</small></footer>

      {teacherOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setTeacherOpen(false)}><section className="teacher-modal" role="dialog" aria-modal="true" aria-labelledby="teacher-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="닫기" onClick={() => setTeacherOpen(false)}>×</button><span>교수·학습과정안 연계</span><h2 id="teacher-title">80분 수업 운영 가이드</h2><ol><li><b>도입 5분</b><p>오전·오후 그림자의 차이를 자유롭게 발표하고 학습 문제를 확인합니다.</p></li><li><b>활동 1 · 35분</b><p>평평한 곳, 자와 그림자의 평행, 각도기 중심 정렬을 확인한 뒤 시간대별로 측정합니다.</p></li><li><b>활동 2 · 10분</b><p>태양 고도·그림자 길이·기온 그래프의 최고·최저 시각을 각각 찾습니다.</p></li><li><b>활동 3 · 25분</b><p>남중 시각과 최고 기온 시각을 비교하고, 지표가 데워지는 데 시간이 걸려 최고 기온이 늦게 나타남을 설명합니다.</p></li><li><b>정리 5분</b><p>“그림자가 가장 짧은 시각”과 “기온이 가장 높은 시각”이 다른 까닭을 말로 정리합니다.</p></li></ol><div className="teacher-tip"><b>관찰 평가</b><p>태양 고도와 그림자의 반대 관계뿐 아니라, 남중 이후 최고 기온이 늦게 나타나는 시간 지연까지 설명하는지 확인하세요.</p></div><div className="teacher-tip"><b>자료 출처</b><p>{observation.date} {observation.area} 기준 일출 {observation.sunrise}, 남중 {observation.transit}, 일몰 {observation.sunset}, 남중고도 {observation.meridianAltitude}는 {observation.source} 응답값입니다. 관측 시각별 고도는 이 값을 기준점으로 같은 날 태양 위치를 계산했고, 기온은 예시값입니다.</p></div></section></div>}
    </main>
  );
}
