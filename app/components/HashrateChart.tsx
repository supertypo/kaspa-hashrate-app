'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  TooltipItem,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface HashrateData {
  daaScore: number;
  hashrate_kh: number;
  date_time: string;
}

const options: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  scales: {
    x: {
      type: 'linear' as const,
      display: true,
      title: {
        display: true,
        text: 'DAA Score',
        color: '#fff',
      },
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: '#fff',
      },
    },
    y: {
      type: 'linear' as const,
      display: true,
      title: {
        display: true,
        text: 'Hashrate (KH/s)',
        color: '#fff',
      },
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: '#fff',
        callback: (tickValue: number | string) => {
          const value = Number(tickValue);
          return (value / 1e9).toFixed(2) + ' GH/s';
        },
      },
    },
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: '#fff',
      },
    },
    title: {
      display: true,
      text: 'Kaspa Network Hashrate',
      color: '#fff',
      font: {
        size: 16,
      },
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        label: function(context: TooltipItem<'line'>): string {
          const value = context.raw as { x: number; y: number };
          return `Hashrate: ${(value.y / 1e9).toFixed(2)} GH/s`;
        },
      },
    },
  },
};

export default function HashrateChart() {
  const [data, setData] = useState<HashrateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.kaspa.org/info/hashrate/history')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((rawData) => {
        setData(rawData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] text-red-400">
        Error loading data: {error}
      </div>
    );
  }

  const chartData = {
    datasets: [
      {
        label: 'Network Hashrate',
        data: data.map((item) => ({
          x: item.daaScore,
          y: item.hashrate_kh,
        })),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
      },
    ],
  };

  return (
    <div className="w-full h-[600px] p-4">
      <Line options={options} data={chartData} />
    </div>
  );
}
