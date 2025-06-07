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
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'chartjs-adapter-date-fns';

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

// Configure Chart.js defaults
ChartJS.defaults.locale = 'en-US';

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

function getCachedData(resolution: string | null): HashrateData[] | null {
  try {
    const cacheKey = `kaspa-cache-${resolution || 'full'}`;
    const cacheEntry = localStorage.getItem(cacheKey);
    if (!cacheEntry) return null;

    const { data, timestamp }: CacheEntry = JSON.parse(cacheEntry);
    const now = Date.now();
    const expiryTime = 10 * 60 * 1000; // 10 minutes in milliseconds

    if (now - timestamp > expiryTime) {
      try {
        localStorage.removeItem(cacheKey);
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

function setCachedData(resolution: string | null, data: HashrateData[]) {
  try {
    const cacheEntry: CacheEntry = {
      data: slimDownData(data),
      timestamp: Date.now()
    };
    localStorage.setItem(`kaspa-cache-${resolution || 'full'}`, JSON.stringify(cacheEntry));
  } catch (e) {
    console.warn('Failed to write to cache', e);
  }
}

function fetchWithCache(resolution: string | null): Promise<HashrateData[]> {
  const cachedData = getCachedData(resolution);
  if (cachedData) {
    return Promise.resolve(cachedData);
  }

  const url = resolution 
    ? `https://api.kaspa.org/info/hashrate/history?resolution=${resolution}`
    : 'https://api.kaspa.org/info/hashrate/history';

  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then((data) => {
      try {
        setCachedData(resolution, data);
      } catch (e) {
        console.warn('Failed to cache data:', e);
      }
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

// Helper function to determine the API resolution based on time window
function getResolutionForRange(start: Date, end: Date): string | null {
  const rangeDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (rangeDays <= 14) {
    return null;  // full resolution
  } else if (rangeDays <= 60) {
    return '3h';
  } else {
    return '1d';
  }
}

interface HashrateChartProps {
  isLogScale: boolean;
}

export default function HashrateChart({ isLogScale }: HashrateChartProps) {
  // Main chart data with dynamic resolution
  const [data, setData] = useState<HashrateData[]>([]);
  // Navigator chart data always at 1d resolution
  const [navData, setNavData] = useState<HashrateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // isLogScale is now passed as a prop
  const [isMobile, setIsMobile] = useState(false);
  const mainChartRef = useRef<ChartJS<"line">>(null);
  const navigatorRef = useRef<ChartJS<"line">>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: Date; end: Date } | null>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'both' | null>(null);
  const dragStartRef = useRef<{ x: number; range: { start: Date; end: Date } } | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Log scale is now handled by parent component

    // Load initial data for navigator (always 1d resolution)
    setLoading(true);
    setError(null);  // Clear any previous errors
    
    console.log('Fetching navigator data...');
    fetchWithCache('1d')
      .then((rawData) => {
        console.log('Received navigator data:', rawData.length, 'points');
        if (!rawData || rawData.length === 0) {
          throw new Error('No data returned from API');
        }
        
        // Sort data by date to ensure correct order
        const sortedData = [...rawData].sort((a, b) => 
          new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
        );
        
        setNavData(sortedData);
        
        // Set initial range to the full available range
        const firstDataPoint = new Date(sortedData[0].date_time);
        const lastDataPoint = new Date(sortedData[sortedData.length - 1].date_time);
        
        console.log('Setting initial range to full data:', {
          start: firstDataPoint.toISOString(),
          end: lastDataPoint.toISOString()
        });
        
        setSelectedRange({ start: firstDataPoint, end: lastDataPoint });
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        console.error('Error loading navigator data:', err);
        setError(err.message || 'Failed to load data');
        setLoading(false);
        setNavData([]);
      });
  }, []);

  // Effect to fetch main chart data when selected range changes
  useEffect(() => {
    if (!selectedRange) return;

    const resolution = getResolutionForRange(selectedRange.start, selectedRange.end);
    setLoading(true);
    setError(null);  // Clear any previous errors
    
    console.log('Fetching main chart data...', {
      resolution,
      start: selectedRange.start.toISOString(),
      end: selectedRange.end.toISOString()
    });

    fetchWithCache(resolution)
      .then((rawData) => {
        console.log('Received main chart data:', rawData.length, 'points');
        if (!rawData || rawData.length === 0) {
          throw new Error('No data returned from API');
        }

        // Sort data by date to ensure correct order
        const sortedData = [...rawData].sort((a, b) => 
          new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
        );

        // Add a small buffer to the range to ensure we include boundary points
        const rangeStart = new Date(selectedRange.start.getTime() - 300 * 1000); // 5 minute buffer
        const rangeEnd = new Date(selectedRange.end.getTime() + 300 * 1000);

        // Filter data to the selected range
        const filteredData = sortedData.filter(item => {
          const date = new Date(item.date_time);
          return date >= rangeStart && date <= rangeEnd;
        });

        console.log('Filtered data points:', filteredData.length);

        if (filteredData.length === 0) {
          throw new Error(`No data available for selected range (${selectedRange.start.toISOString()} - ${selectedRange.end.toISOString()})`);
        }

        setData(filteredData);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        console.error('Error loading main chart data:', err);
        setError(err.message || 'Failed to load data');
        setLoading(false);
        setData([]);
      });
  }, [selectedRange]);

  const baseTimeConfig = {
    displayFormats: {
      millisecond: 'HH:mm:ss.SSS',
      second: 'HH:mm:ss',
      minute: 'HH:mm',
      hour: 'dd HH:mm',
      day: 'MMM d',
      week: 'MMM d',
      month: 'MMM yyyy',
      quarter: 'MMM yyyy',
      year: 'yyyy'
    }
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,  // Disable default animations
    transitions: {
      active: {
        animation: {
          duration: 400,
          easing: 'easeOutQuart'
        }
      }
    },
    interaction: {
      mode: 'nearest',
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
        type: 'time',
        time: baseTimeConfig,
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
      tooltip: {
        mode: 'nearest',
        intersect: true,
        callbacks: {
          title: (context) => {
            const date = new Date(context[0].parsed.x);
            return format(date, "yyyy-MM-dd HH:mm'Z'", { locale: enUS });
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

  const mainChartData = {
    datasets: [
      {
        label: 'Network Hashrate',
        data: data.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())
          .map((item) => ({
            x: new Date(item.date_time).getTime(),
            y: item.hashrate_kh,
          })),
        borderColor: '#6fc7ba',
        backgroundColor: 'rgba(111, 199, 186, 0.5)',
        borderWidth: 2,
        pointRadius: 0,
        hitRadius: 30,
        fill: true,
        tension: 0.1,
        spanGaps: true,
      },
    ],
  };

  const navigatorChartData = {
    datasets: [
      {
        label: 'Network Hashrate',
        data: navData.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())
          .map((item) => ({
            x: new Date(item.date_time).getTime(),
            y: item.hashrate_kh,
          })),
        borderColor: '#6fc7ba',
        backgroundColor: 'rgba(111, 199, 186, 0.2)',
        borderWidth: 1,
        pointRadius: 0,
        hitRadius: 0,
        fill: true,
        tension: 0.1,
        spanGaps: true,
      },
    ],
  };

  const navigatorStartTime = navData.length > 0 ? new Date(navData[0].date_time).getTime() : 0;
  const navigatorEndTime = navData.length > 0 ? new Date(navData[navData.length - 1].date_time).getTime() : 0;

  const navigatorOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 8,
    animation: false,
    layout: {
      padding: 0,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    scales: {
      x: {
        type: 'time',
        time: baseTimeConfig,
        display: true,
        grid: {
          display: false,
        },
        ticks: {
          display: false,
        },
        min: navigatorStartTime || undefined,
        max: navigatorEndTime || undefined,
      },
      y: {
        type: isLogScale ? 'logarithmic' : 'linear',
        display: false,
        beginAtZero: false,
        grid: {
          display: false,
        }
      },
    },
  };

  // We don't need this effect anymore since the initial data loading
  // is handled by the navigator data loading effect and the selectedRange effect

  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging || !selectedRange || !navData.length) return;
      
      e.preventDefault();  // Prevent text selection
      const container = document.querySelector('.navigator-container');
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const dataStartTime = new Date(navData[0].date_time).getTime();
      const dataEndTime = new Date(navData[navData.length - 1].date_time).getTime();
      const totalDataRange = dataEndTime - dataStartTime;
      
      // Calculate position in the container (0 to 1), clamped to container bounds
      const relativeX = Math.max(rect.left, Math.min(rect.right, e.clientX));
      const position = (relativeX - rect.left) / rect.width;
      const currentTime = dataStartTime + (position * totalDataRange);
      
      const minWindowSize = 1000 * 60 * 60; // Minimum 1 hour window
      
      if (isDragging === 'start') {
        const newStartTime = Math.max(
          dataStartTime,
          Math.min(
            currentTime,
            selectedRange.end.getTime() - minWindowSize
          )
        );
        setSelectedRange(prev => ({
          start: new Date(newStartTime),
          end: prev?.end ?? selectedRange.end
        }));
      } else if (isDragging === 'end') {
        const newEndTime = Math.min(
          dataEndTime,
          Math.max(
            currentTime,
            selectedRange.start.getTime() + minWindowSize
          )
        );
        setSelectedRange(prev => ({
          start: prev?.start ?? selectedRange.start,
          end: new Date(newEndTime)
        }));
      }
    };

    const handleDragEnd = () => {
      setIsDragging(null);
      dragStartRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, selectedRange, navData]);

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>, type: 'start' | 'end') => {
    if (!selectedRange) return;
    e.preventDefault();
    setIsDragging(type);
    dragStartRef.current = {
      x: e.clientX,
      range: { ...selectedRange }
    };
  };



  const handleNavigatorClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!navigatorRef.current || !selectedRange || !navData.length) return;
    
    // Ignore click if we're dragging
    if (isDragging) return;

    const chart = navigatorRef.current;
    const rect = chart.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const xPercent = x / rect.width;

    const timeRange = selectedRange.end.getTime() - selectedRange.start.getTime();
    const navigationStart = new Date(navData[0].date_time).getTime();
    const navigationEnd = new Date(navData[navData.length - 1].date_time).getTime();
    const totalTimeRange = navigationEnd - navigationStart;
    const clickTime = navigationStart + (totalTimeRange * xPercent);

    // Calculate the desired window position
    const halfWindow = timeRange / 2;
    let startTime = clickTime - halfWindow;
    let endTime = clickTime + halfWindow;

    // Adjust if we go beyond bounds
    if (startTime < navigationStart) {
      const shift = navigationStart - startTime;
      startTime = navigationStart;
      endTime = Math.min(navigationEnd, endTime + shift);
    } else if (endTime > navigationEnd) {
      const shift = endTime - navigationEnd;
      endTime = navigationEnd;
      startTime = Math.max(navigationStart, startTime - shift);
    }

    // Update the range
    setSelectedRange({
      start: new Date(startTime),
      end: new Date(endTime),
    });

    // Update the window position, maintaining the current window size
    const halfWindowSize = timeRange / 2;
    let newStart = new Date(clickTime - halfWindowSize);
    let newEnd = new Date(clickTime + halfWindowSize);

    // Ensure we don't go out of bounds
    if (newStart < new Date(navData[0].date_time)) {
      newStart = new Date(navData[0].date_time);
      newEnd = new Date(newStart.getTime() + timeRange);
    }
    if (newEnd > new Date(navData[navData.length - 1].date_time)) {
      newEnd = new Date(navData[navData.length - 1].date_time);
      newStart = new Date(newEnd.getTime() - timeRange);
    }
    
    setSelectedRange({ start: newStart, end: newEnd });
  };

  const getHandlePosition = (type: 'start' | 'end') => {
    if (!selectedRange || !navData.length) return '0%';
    
    const totalRange = new Date(navData[navData.length - 1].date_time).getTime() - new Date(navData[0].date_time).getTime();
    const startTime = new Date(navData[0].date_time).getTime();
    const dateToUse = type === 'start' ? selectedRange.start : selectedRange.end;
    
    return `${((dateToUse.getTime() - startTime) / totalRange) * 100}%`;
  };

  if (!navData.length) {
    if (loading) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <div className="text-red-500">Failed to load data: {error}</div>
        </div>
      );
    }
    return null;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex-grow relative">
        <Line
          ref={mainChartRef}
          data={mainChartData}
          options={chartOptions}
        />
      </div>
      <div 
        className="h-[60px] w-full relative select-none navigator-container"
      >
        <Line
          ref={navigatorRef}
          data={navigatorChartData}
          options={navigatorOptions}
          onClick={handleNavigatorClick}
        />
        <div className="absolute inset-0">
          {selectedRange && navData.length > 0 && (
            <>
              {/* Selection overlay */}
              <div
                className="absolute top-0 h-full bg-[#6fc7ba33] pointer-events-none"
                style={{
                  left: getHandlePosition('start'),
                  width: `${((selectedRange.end.getTime() - selectedRange.start.getTime()) /
                    (new Date(navData[navData.length - 1].date_time).getTime() - new Date(navData[0].date_time).getTime())) * 100}%`
                }}
              />
              {/* Left handle */}
              <div
                className="absolute top-0 w-2 h-full bg-[#6fc7ba] hover:bg-[#8fdfd3] cursor-ew-resize transform -translate-x-1/2"
                style={{
                  left: getHandlePosition('start')
                }}
                onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => handleDragStart(e, 'start')}
              />
              {/* Right handle */}
              <div
                className="absolute top-0 w-2 h-full bg-[#6fc7ba] hover:bg-[#8fdfd3] cursor-ew-resize transform -translate-x-1/2"
                style={{
                  left: getHandlePosition('end')
                }}
                onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => handleDragStart(e, 'end')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex-grow relative">
        <Line
          ref={mainChartRef}
          data={mainChartData}
          options={chartOptions}
        />
      </div>
      <div 
        className="h-[60px] w-full relative select-none navigator-container"
      >
        <Line
          ref={navigatorRef}
          data={navigatorChartData}
          options={navigatorOptions}
          onClick={handleNavigatorClick}
        />
        <div className="absolute inset-0">
          {selectedRange && navData.length > 0 && (
            <>
              {/* Selection overlay */}
              <div
                className="absolute top-0 h-full bg-[#6fc7ba33] pointer-events-none"
                style={{
                  left: getHandlePosition('start'),
                  width: `${((selectedRange!.end.getTime() - selectedRange!.start.getTime()) /
                    (new Date(navData[navData.length - 1].date_time).getTime() - new Date(navData[0].date_time).getTime())) * 100}%`
                }}
              />
              {/* Left handle */}
              <div
                className="absolute top-0 w-2 h-full bg-[#6fc7ba] hover:bg-[#8fdfd3] cursor-ew-resize transform -translate-x-1/2"
                style={{
                  left: getHandlePosition('start')
                }}
                onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => handleDragStart(e, 'start')}
              />
              {/* Right handle */}
              <div
                className="absolute top-0 w-2 h-full bg-[#6fc7ba] hover:bg-[#8fdfd3] cursor-ew-resize transform -translate-x-1/2"
                style={{
                  left: getHandlePosition('end')
                }}
                onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => handleDragStart(e, 'end')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
