'use client';

import { useEffect, useState, useRef } from 'react';
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
import { format, subDays, subHours, subMonths } from 'date-fns';

// Register required ChartJS components
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

const dateRanges = [
  { label: '24 Hours', value: '24h', getFn: (date: Date) => subHours(date, 24) },
  { label: '7 Days', value: '7d', getFn: (date: Date) => subDays(date, 7) },
  { label: '30 Days', value: '30d', getFn: (date: Date) => subDays(date, 30) },
  { label: '3 Months', value: '3m', getFn: (date: Date) => subMonths(date, 3) },
  { label: '6 Months', value: '6m', getFn: (date: Date) => subMonths(date, 6) },
  { label: '1 Year', value: '1y', getFn: (date: Date) => subMonths(date, 12) },
  { label: '2 Years', value: '2y', getFn: (date: Date) => subMonths(date, 24) },
  { label: '3 Years', value: '3y', getFn: (date: Date) => subMonths(date, 36) },
  { label: 'All', value: 'all', getFn: () => new Date(0) }
];

export default function HashrateChart() {
  const [data, setData] = useState<HashrateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLogScale, setIsLogScale] = useState(false);
  const [dateRange, setDateRange] = useState('all');
  const chartRef = useRef<ChartJS<"line">>(null);
  const [zoomPlugin, setZoomPlugin] = useState<typeof import('chartjs-plugin-zoom').default | null>(null);

  useEffect(() => {
    // Dynamically import zoom plugin on client side
    import('chartjs-plugin-zoom').then((module) => {
      const plugin = module.default;
      ChartJS.register(plugin);
      setZoomPlugin(plugin);
    });
  }, []);

  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  const chartOptions: ChartOptions<'line'> = {
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
          unit: 'day' as const,
          displayFormats: {
            day: 'yyyy-MM-dd',
            hour: 'yyyy-MM-dd HH:mm'
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
          maxTicksLimit: 20,
          color: '#fff',
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true
        },
      },
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
      legend: {
        position: 'top' as const,
        labels: {
          color: '#fff',
          padding: 20
        },
      },
      zoom: zoomPlugin ? {
        pan: {
          enabled: true,
          mode: 'x',
          modifierKey: 'shift', // Hold shift to pan
        },
        zoom: {
          wheel: {
            enabled: false,
          },
          pinch: {
            enabled: true
          },
          mode: 'x',
          drag: {
            enabled: true,
            modifierKey: undefined, // No modifier for zoom
            backgroundColor: 'rgba(99, 102, 241, 0.3)',
            borderColor: 'rgba(99, 102, 241, 0.8)',
          },
        },
        limits: {
          x: {
            min: 'original',
            max: 'original',
          },
        },
      } : undefined,
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
          <span className="text-gray-400 text-sm">Hold Shift to pan</span>
          <button
            onClick={() => setIsLogScale(!isLogScale)}
            className={`text-white px-4 py-2 rounded-lg transition-colors ${
              isLogScale ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Log
          </button>
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                handleResetZoom();
              }}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
            >
              {dateRanges.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleResetZoom}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              title="Reset Zoom"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1">
        <Line
          ref={chartRef}
          options={chartOptions}
          data={chartData}
        />
      </div>
    </div>
  );
}
