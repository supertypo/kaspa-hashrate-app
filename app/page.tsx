import HashrateChart from './components/HashrateChart';

export default function Home() {
  return (
    <main className="min-h-screen w-full p-4">
      <div className="flex items-center justify-center gap-4 mb-4">
        <img src="/kaspa-logo.svg" alt="Kaspa Logo" className="sm:h-20" />
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
