import HashrateChart from './components/HashrateChart';
import Image from 'next/image';

export default function Home() {
  return (
    <main className="min-h-screen w-full p-4">
      <div className="flex items-center justify-center gap-4 mb-4">
        <Image 
          src="/kaspa-logo.svg" 
          alt="Kaspa Logo" 
          className="h-10 sm:h-12 w-auto" 
          width={48}
          height={48}
          priority
        />
        <h1 className="text-2xl sm:text-4xl font-bold">
          Kaspa Network Hashrate
        </h1>
      </div>
      <div className="w-full h-[calc(100vh-8rem)] bg-gray-800 rounded-lg shadow-xl p-4">
        <HashrateChart />
      </div>
    </main>
  );
}
