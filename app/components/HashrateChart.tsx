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
  LogarithmicScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { format, subDays, subHours, subMonths, subWeeks } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
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

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  layout: {
    padding: {
      left: 10,
      right: 20,
      top: 0,
      bottom: 10
    }
  },
  scales: {
    x: {
      type: 'time' as const,
      time: {
        unit: 'hour' as const,
        displayFormats: {
          hour: 'MMM d, HH:mm'
        }
      },
      display: true,
      title: {
        display: true,
        text: 'Time',
        color: '#fff',
        padding: { top: 10 }
      },
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: '#fff',
        maxRotation: 45,
        minRotation: 45
      },
    }
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: '#fff',
        padding: 20
      },
    },
    title: {
      display: false
    }
  },
};

const dateRanges = [
  { label: '24 Hours', value: '24h', getFn: (date: Date) => subHours(date, 24) },
  { label: '7 Days', value: '7d', getFn: (date: Date) => subDays(date, 7) },
  { label: '30 Days', value: '30d', getFn: (date: Date) => subDays(date, 30) },
  { label: '3 Months', value: '3m', getFn: (date: Date) => subMonths(date, 3) },
  { label: '6 Months', value: '6m', getFn: (date: Date) => subMonths(date, 6) },
  { label: '1 Year', value: '1y', getFn: (date: Date) => subMonths(date, 12) },
  { label: '2 Years', value: '2y', getFn: (date: Date) => subMonths(date, 24) },
  { label: '3 Years', value: '3y', getFn: (date: Date) => subMonths(date, 36) },
  { label: 'All', value: 'all', getFn: (date: Date) => new Date(0) }
];

function formatHashrate(hashrate: number): string {
  const units = ['KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
  let value = hashrate;
  let unitIndex = 0;

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

export default function HashrateChart() {
  const [data, setData] = useState<HashrateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLogScale, setIsLogScale] = useState(false);
  const [dateRange, setDateRange] = useState('all');

  const chartOptions: ChartOptions<'line'> = {
    ...baseOptions,
    scales: {
      ...baseOptions.scales,
      y: {
        type: isLogScale ? 'logarithmic' : 'linear',
        display: true,
        title: {
          display: true,
          text: 'Hashrate',
          color: '#fff',
          padding: { bottom: 10 }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: '#fff',
          callback: (tickValue: number | string) => {
            return formatHashrate(Number(tickValue));
          },
        },
      },
    },
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: (context) => {
            const date = new Date(context[0].parsed.x);
            return format(date, 'PPpp');
          },
          label: function(context: TooltipItem<'line'>): string[] {
            const dataIndex = context.dataIndex;
            const dataPoint = data[dataIndex];
            return [
              `Hashrate: ${formatHashrate(dataPoint.hashrate_kh)}`,
              `DAA Score: ${dataPoint.daaScore.toLocaleString()}`
            ];
          },
        },
      },
    },
  };

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

  const filteredData = data.filter(item => {
    const itemDate = new Date(item.date_time);
    const selectedRange = dateRanges.find(r => r.value === dateRange);
    if (!selectedRange) return true;
    const startDate = selectedRange.getFn(new Date());
    return itemDate >= startDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full text-red-400">
        Error loading data: {error}
      </div>
    );
  }

  const chartData = {
    datasets: [
      {
        label: 'Network Hashrate',
        data: filteredData.map((item) => ({
          x: new Date(item.date_time).getTime(),
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
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-4">
          <select
            value={isLogScale ? 'logarithmic' : 'linear'}
            onChange={(e) => setIsLogScale(e.target.value === 'logarithmic')}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <option value="linear">Linear Scale</option>
            <option value="logarithmic">Logarithmic Scale</option>
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
          >
            {dateRanges.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex-1">
        <Line options={chartOptions} data={chartData} />
      </div>
    </div>
  );
}
