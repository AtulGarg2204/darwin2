import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const DataChart = ({ chartData, type = 'bar' }) => {
  const chartRef = useRef(null);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: chartData.title || 'Data Visualization',
      },
    },
  };

  const ChartComponent = {
    line: Line,
    bar: Bar,
    pie: Pie,
  }[type] || Bar;

  return (
    <div className="h-[300px] w-full">
      <ChartComponent ref={chartRef} options={options} data={chartData} />
    </div>
  );
};

export default DataChart; 