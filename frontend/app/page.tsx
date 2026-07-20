import dynamic from 'next/dynamic';

const DApp = dynamic(() => import('@/components/DApp'), { ssr: false });

export default function Home() {
  return <DApp />;
}
