'use client';

import dynamic from 'next/dynamic';

const DApp = dynamic(() => import('./DApp'), { ssr: false });

export default function ClientDApp() {
  return <DApp />;
}
