'use client';

import { useEffect, useRef } from 'react';

const terminalLines = [
  '> HAEBOM SCIENCE OBSERVATORY',
  '> SOUTH SKY SENSOR ONLINE',
  '> GNOMON HEIGHT ........ 10.0 CM',
  '> PROTRACTOR ........... CALIBRATED',
  '> SHADOW RULER ......... READY',
  '> MISSION: RECOVER SOLAR PEAK',
  '> WAITING FOR OBSERVER INPUT _',
];

export default function CrtTerminal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let animation = 0;
    const started = performance.now();

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const gradient = context.createRadialGradient(width * .5, height * .42, 5, width * .5, height * .5, width * .72);
      gradient.addColorStop(0, '#0d2c1b');
      gradient.addColorStop(.55, '#06170e');
      gradient.addColorStop(1, '#010704');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      const elapsed = reduced ? 99999 : now - started;
      const chars = Math.floor(elapsed / 27);
      const joined = terminalLines.join('\n');
      const visible = joined.slice(0, Math.min(chars, joined.length)).split('\n');
      context.font = `${Math.max(9, Math.min(12, width / 36))}px SFMono-Regular, Consolas, monospace`;
      context.textBaseline = 'top';
      context.shadowColor = 'rgba(112,255,165,.72)';
      context.shadowBlur = 7;
      visible.forEach((line, index) => {
        context.fillStyle = index === 0 ? '#b8ffd1' : '#73e79d';
        context.fillText(line, 24, 25 + index * 24);
      });
      context.shadowBlur = 0;

      context.fillStyle = 'rgba(82,255,139,.045)';
      for (let y = 0; y < height; y += 4) context.fillRect(0, y, width, 1);
      if (!reduced) {
        context.fillStyle = 'rgba(180,255,205,.03)';
        for (let i = 0; i < 18; i++) context.fillRect(Math.random() * width, Math.random() * height, 1, 1);
      }
      context.strokeStyle = 'rgba(135,255,174,.11)';
      context.strokeRect(.5, .5, width - 1, height - 1);
      frame += 1;
      if (!reduced || frame < 2) animation = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    animation = requestAnimationFrame(draw);
    return () => { observer.disconnect(); cancelAnimationFrame(animation); };
  }, []);

  return <canvas ref={canvasRef} className="crt-terminal-canvas" aria-hidden="true" />;
}
