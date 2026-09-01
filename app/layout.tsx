import type { Metadata } from 'next';
import '@designcodeio/threeui/style.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://sun-altitude-lab.ohjinwoo9696.chatgpt.site'),
  title: '해봄 과학실 | 태양의 남중고도 탐구',
  description: '6학년 과학: 하루 동안 태양 고도, 그림자 길이, 기온의 관계를 탐구하는 수업용 웹앱',
  openGraph: {
    title: '태양의 남중고도 탐구',
    description: '사라진 태양의 최고점을 찾아라! 6학년 과학 게임형 탐구 수업',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '태양의 남중고도 탐구' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '태양의 남중고도 탐구',
    description: '사라진 태양의 최고점을 찾아라! 6학년 과학 게임형 탐구 수업',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
