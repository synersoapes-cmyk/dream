'use client';

import dynamic from 'next/dynamic';

import '@/features/simulator/styles/fonts.css';
import '@/features/simulator/styles/theme.css';

const SimulatorApp = dynamic(
  () => import('@/features/simulator').then((mod) => mod.SimulatorApp),
  {
    ssr: false,
  }
);

export function SimulatorPageEntry() {
  return (
    <div className="h-screen w-full">
      <SimulatorApp />
    </div>
  );
}
