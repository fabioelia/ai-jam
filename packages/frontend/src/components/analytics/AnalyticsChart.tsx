import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import type { ChartDataPoint } from '../../types/analytics';

interface AnalyticsChartProps {
  type: 'bar' | 'line' | 'pie' | 'area';
  data: ChartDataPoint[];
  height?: number;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  xAxisDataKey?: string;
  yAxisDataKey?: string;
  nameKey?: string;
  valueKey?: string;
  className?: string;
}

const DEFAULT_COLORS = [
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#14b8a6', // teal-500
];

export default function AnalyticsChart({
  type,
  data,
  height = 300,
  colors = DEFAULT_COLORS,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  xAxisDataKey = 'name',
  yAxisDataKey = 'value',
  nameKey = 'name',
  valueKey = 'value',
  className = '',
}: AnalyticsChartProps) {
  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
            <XAxis
              dataKey={xAxisDataKey}
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            {showTooltip && (
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                }}
                itemStyle={{ color: '#f3f4f6' }}
              />
            )}
            {showLegend && <Legend />}
            <Bar dataKey={valueKey} fill={colors[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
            <XAxis
              dataKey={xAxisDataKey}
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            {showTooltip && (
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                }}
                itemStyle={{ color: '#f3f4f6' }}
              />
            )}
            {showLegend && <Legend />}
            <Line
              type="monotone"
              dataKey={valueKey}
              stroke={colors[0]}
              strokeWidth={2}
              dot={{ fill: colors[0], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
            <XAxis
              dataKey={xAxisDataKey}
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            {showTooltip && (
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                }}
                itemStyle={{ color: '#f3f4f6' }}
              />
            )}
            {showLegend && <Legend />}
            <Area
              type="monotone"
              dataKey={valueKey}
              stroke={colors[0]}
              fill={colors[0]}
              fillOpacity={0.3}
            />
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Pie>
            {showTooltip && (
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                }}
                itemStyle={{ color: '#f3f4f6' }}
              />
            )}
            {showLegend && <Legend />}
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
