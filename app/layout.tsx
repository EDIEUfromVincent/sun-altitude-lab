import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '해봄 과학실 | 태양의 남중고도 탐구',
  description: '6학년 과학: 하루 동안 태양 고도, 그림자 길이, 기온의 관계를 탐구하는 수업용 웹앱',
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
