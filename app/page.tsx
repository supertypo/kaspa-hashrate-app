import HashrateChart from './components/HashrateChart';

export default function Home() {
  return (
    <main className="min-h-screen w-full p-4">
      <h1 className="text-2xl sm:text-4xl font-bold mb-4 text-center">
        Kaspa Network Hashrate
      </h1>
      <div className="w-full h-[calc(100vh-8rem)] bg-gray-800 rounded-lg shadow-xl p-4">
        <HashrateChart />
      </div>
    </main>
  );
}
