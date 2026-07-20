import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '1AM Private Proof',
  description: 'A decentralized private proof application built on Midnight Network',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
