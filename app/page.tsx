'use client';

import HashrateChart from './components/HashrateChart';
import Image from 'next/image';
import { useState, useEffect } from 'react';

export default function Home() {
  const [isLogScale, setIsLogScale] = useState(false);

  useEffect(() => {
    const savedIsLogScale = localStorage.getItem('kaspa-chart-isLogScale');
    if (savedIsLogScale !== null) {
      setIsLogScale(savedIsLogScale === 'true');
    }
  }, []);
  return (
    <main className="min-h-screen w-full p-4">
      <div className="flex items-center justify-center relative mb-4">
        <div className="flex items-center gap-4">
          <Image 
            src="/kaspa-logo.svg" 
            alt="Kaspa Logo" 
            className="h-12 sm:h-16 w-auto" 
            width={64}
            height={64}
            priority
          />
          <h1 className="text-2xl sm:text-4xl font-bold">
            Kaspa Network Hashrate
          </h1>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <button
            onClick={() => {
              const newValue = !isLogScale;
              setIsLogScale(newValue);
              localStorage.setItem('kaspa-chart-isLogScale', String(newValue));
            }}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              isLogScale 
                ? 'bg-[#6fc7ba] text-black' 
                : 'bg-[#6fc7ba33] text-white hover:bg-[#6fc7ba22]'
            }`}
          >
            log
          </button>
        </div>
      </div>
      <div className="w-full h-[calc(100vh-8rem)] bg-gray-800 rounded-lg shadow-xl p-4">
        <HashrateChart 
          isLogScale={isLogScale}
        />
      </div>
    </main>
  );
}
