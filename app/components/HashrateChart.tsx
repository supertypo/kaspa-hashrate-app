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

  TimeScale,
  TooltipItem,
  ChartOptions,
  LogarithmicScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { format, subDays, subMonths } from 'date-fns';

// Register required ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
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
  { label: '30d', value: '30d', getFn: (date: Date) => subDays(date, 30) },
  { label: '1y', value: '1y', getFn: (date: Date) => subMonths(date, 12) },
  { label: 'All', value: 'all', getFn: () => new Date(0) }
];

export default function HashrateChart() {
  const [data, setData] = useState<HashrateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLogScale, setIsLogScale] = useState(false);
  const [dateRange, setDateRange] = useState('all');
  const [isMobile, setIsMobile] = useState(false);
  const chartRef = useRef<ChartJS<"line">>(null);
  const [zoomPlugin, setZoomPlugin] = useState<typeof import('chartjs-plugin-zoom').default | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Dynamically import zoom plugin on client side
    import('chartjs-plugin-zoom').then((module) => {
      const plugin = module.default;
      ChartJS.register(plugin);
      setZoomPlugin(plugin);
    });
  }, []);



  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest' as const,
      axis: 'x',
      intersect: true,
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
          displayFormats: {
            millisecond: 'yyyy-MM-dd HH:mm:ss.SSS',
            second: 'yyyy-MM-dd HH:mm:ss',
            minute: 'yyyy-MM-dd HH:mm',
            hour: 'yyyy-MM-dd HH:mm',
            day: 'yyyy-MM-dd',
            week: 'yyyy-MM-dd',
            month: 'yyyy-MM-dd',
            quarter: 'yyyy-MM-dd',
            year: 'yyyy-MM-dd'
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
          display: !isMobile,
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
            if (isMobile) return '';
            return formatHashrate(Number(tickValue));
          },
          maxTicksLimit: 8,
          autoSkip: true,
        },
      },
    },
    plugins: {
      legend: {
        display: false
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
        mode: 'nearest' as const,
        intersect: true,
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
    const getResolution = () => {
      switch (dateRange) {
        case '30d':
          return '3h';
        case '1y':
          return '1d';
        case 'all':
          return '7d';
        default:
          return '7d';
      }
    };

    fetch(`https://api.kaspa.org/info/hashrate/history?resolution=${getResolution()}`)
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
  }, [dateRange]);

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
        hitRadius: 30,
        fill: true,
      },
    ],
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          {dateRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => {
                setDateRange(range.value);
                if (chartRef.current) {
                  chartRef.current.resetZoom();
                }
              }}
              className={`text-white px-4 py-2 rounded-lg transition-colors ${
                dateRange === range.value ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsLogScale(!isLogScale)}
          className={`text-white px-4 py-2 rounded-lg transition-colors ${
            isLogScale ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          lg
        </button>
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
