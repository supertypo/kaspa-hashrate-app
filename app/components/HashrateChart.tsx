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

// Slim version of the data for storage
interface SlimHashrateData {
  d: number;  // daaScore
  t: number;  // timestamp in epoch millis
  h: number;  // hashrate
}

interface CacheEntry {
  data: SlimHashrateData[];
  timestamp: number;
}

function slimDownData(data: HashrateData[]): SlimHashrateData[] {
  return data.map(item => ({
    d: item.daaScore,
    t: new Date(item.date_time).getTime(),
    h: item.hashrate_kh
  }));
}

function expandData(data: SlimHashrateData[]): HashrateData[] {
  return data.map(item => ({
    daaScore: item.d,
    date_time: new Date(item.t).toISOString(),
    hashrate_kh: item.h
  }));
}

function getCachedData(url: string): HashrateData[] | null {
  try {
    const cacheEntry = localStorage.getItem(`kaspa-cache-${url}`);
    if (!cacheEntry) return null;

    const { data, timestamp }: CacheEntry = JSON.parse(cacheEntry);
    const now = Date.now();
    const expiryTime = 10 * 60 * 1000; // 10 minutes in milliseconds

    if (now - timestamp > expiryTime) {
      try {
        localStorage.removeItem(`kaspa-cache-${url}`);
      } catch (e) {
        console.warn('Failed to remove expired cache entry', e);
      }
      return null;
    }

    return expandData(data);
  } catch (e) {
    console.warn('Failed to read from cache', e);
    return null;
  }
}

function setCachedData(url: string, data: HashrateData[]) {
  try {
    const cacheEntry: CacheEntry = {
      data: slimDownData(data),
      timestamp: Date.now()
    };
    localStorage.setItem(`kaspa-cache-${url}`, JSON.stringify(cacheEntry));
  } catch (e) {
    console.warn('Failed to write to cache', e);
  }
}

function fetchWithCache(url: string): Promise<HashrateData[]> {
  const cachedData = getCachedData(url);
  if (cachedData) {
    return Promise.resolve(cachedData);
  }

  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then((data) => {
      setCachedData(url, data);
      return data;
    });
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
  { label: '7d', value: '7d', getFn: (date: Date) => subDays(date, 7) },
  { label: '30d', value: '30d', getFn: (date: Date) => subDays(date, 30) },
  { label: '1y', value: '1y', getFn: (date: Date) => subMonths(date, 12) },
  { label: 'All', value: 'all', getFn: () => new Date(0) }
];

function isTimeWindowIncrease(currentRange: string, newRange: string): boolean {
  const rangeSizes: { [key: string]: number } = {
    '7d': 1,
    '30d': 2,
    '1y': 3,
    'all': 4
  };
  return (rangeSizes[newRange] || 0) > (rangeSizes[currentRange] || 0);
}

export default function HashrateChart() {
  const [data, setData] = useState<HashrateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLogScale, setIsLogScale] = useState(false);
  const [dateRange, setDateRange] = useState('all');
  const [isMobile, setIsMobile] = useState(false);
  const chartRef = useRef<ChartJS<"line">>(null);
  const [zoomPlugin, setZoomPlugin] = useState<typeof import('chartjs-plugin-zoom').default | null>(null);
  const [targetDateRange, setTargetDateRange] = useState<string | null>(null);
  const [pendingRange, setPendingRange] = useState<string | null>(null);
  const [newData, setNewData] = useState<HashrateData[] | null>(null);

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

  useEffect(() => {
    // Load saved preferences from localStorage
    const savedDateRange = localStorage.getItem('kaspa-chart-dateRange');
    const savedIsLogScale = localStorage.getItem('kaspa-chart-isLogScale');
    
    if (savedDateRange && dateRanges.some(range => range.value === savedDateRange)) {
      setDateRange(savedDateRange);
    }
    
    if (savedIsLogScale !== null) {
      setIsLogScale(savedIsLogScale === 'true');
    }
  }, []);

  // Effect to handle range changes after data is ready
  useEffect(() => {
    if (pendingRange && newData) {
      setData(newData);
      localStorage.setItem('kaspa-chart-dateRange', pendingRange);
      setDateRange(pendingRange);
      if (chartRef.current) {
        chartRef.current.resetZoom();
      }
      setPendingRange(null);
      setNewData(null);
    }
  }, [pendingRange, newData]);

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
            return format(date, "yyyy-MM-dd HH:mmXXX");
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

  // Initial data load
  useEffect(() => {
    const getResolution = (range: string) => {
      switch (range) {
        case '7d':
          return null;
        case '30d':
          return '3h';
        default:
          return '1d';
      }
    };

    // Get saved date range
    const savedDateRange = localStorage.getItem('kaspa-chart-dateRange');
    const initialRange = savedDateRange && dateRanges.some(range => range.value === savedDateRange)
      ? savedDateRange
      : 'all';

    const resolution = getResolution(initialRange);
    const url = resolution !== null 
      ? `https://api.kaspa.org/info/hashrate/history?resolution=${resolution}`
      : 'https://api.kaspa.org/info/hashrate/history';

    fetchWithCache(url)
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
    // Use target range if it exists (during loading), otherwise use current range
    const rangeToUse = targetDateRange || dateRange;
    const selectedRange = dateRanges.find(r => r.value === rangeToUse);
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
        borderColor: '#6fc7ba',
        backgroundColor: 'rgba(111, 199, 186, 0.5)',
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
                const newRange = range.value;
                const getResolution = (range: string) => {
                  switch (range) {
                    case '7d':
                      return null;
                    case '30d':
                      return '3h';
                    default:
                      return '1d';
                  }
                };

                const resolution = getResolution(newRange);
                const url = resolution !== null 
                  ? `https://api.kaspa.org/info/hashrate/history?resolution=${resolution}`
                  : 'https://api.kaspa.org/info/hashrate/history';

                const increasing = isTimeWindowIncrease(dateRange, newRange);
                
                if (increasing) {
                  // For increasing window: load data first, then change scale
                  fetchWithCache(url)
                    .then((rawData) => {
                      setNewData(rawData);
                      setPendingRange(newRange);
                    })
                    .catch((err) => {
                      console.error('Error fetching data:', err);
                    });
                } else {
                  // For decreasing window: change scale first, then load data
                  localStorage.setItem('kaspa-chart-dateRange', newRange);
                  setDateRange(newRange);
                  if (chartRef.current) {
                    chartRef.current.resetZoom();
                  }
                  
                  fetchWithCache(url)
                    .then((rawData) => {
                      setData(rawData);
                    })
                    .catch((err) => {
                      console.error('Error fetching data:', err);
                    });
                }
              }}
              className={`text-white px-4 py-2 rounded-lg transition-colors ${
                dateRange === range.value ? 'bg-teal-600 hover:bg-teal-500' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            const newValue = !isLogScale;
            localStorage.setItem('kaspa-chart-isLogScale', String(newValue));
            setIsLogScale(newValue);
          }}
          className={`text-white px-4 py-2 rounded-lg transition-colors ${
            isLogScale ? 'bg-teal-600 hover:bg-teal-500' : 'bg-gray-700 hover:bg-gray-600'
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
