import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  isWithinInterval,
  differenceInMinutes,
  differenceInDays,
  subDays,
  eachDayOfInterval,
  format as formatDate
} from 'date-fns';
import type { DateRange, DateRangePreset } from '../types/analytics';

// Re-export format for use in components
export const format = formatDate;

export function getDateRangeForPreset(preset: DateRangePreset): DateRange {
  const now = new Date();

  switch (preset) {
    case 'today':
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now),
        preset: 'today'
      };
    case 'week':
      return {
        startDate: startOfWeek(now, { weekStartsOn: 1 }),
        endDate: endOfWeek(now, { weekStartsOn: 1 }),
        preset: 'week'
      };
    case 'month':
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
        preset: 'month'
      };
    case 'quarter':
      return {
        startDate: startOfQuarter(now),
        endDate: endOfQuarter(now),
        preset: 'quarter'
      };
    case 'year':
      return {
        startDate: startOfYear(now),
        endDate: endOfYear(now),
        preset: 'year'
      };
    case 'custom':
      return {
        startDate: startOfMonth(now),
        endDate: endOfDay(now),
        preset: 'custom'
      };
    default:
      return getDateRangeForPreset('month');
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function calculateTrend(current: number, previous: number): {
  value: number;
  direction: 'up' | 'down' | 'neutral';
} {
  if (previous === 0) {
    return {
      value: 0,
      direction: 'neutral'
    };
  }

  const change = ((current - previous) / previous) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';

  return {
    value: Math.abs(change),
    direction
  };
}

export function groupByDate<T extends { date: Date | string }>(
  data: T[],
  dateRange: DateRange
): Array<{ date: string; value: number; data: T[] }> {
  const result = new Map<string, { value: number; data: T[] }>();

  // Initialize all dates in range with 0
  const daysInRange = eachDayOfInterval({
    start: dateRange.startDate,
    end: dateRange.endDate
  });

  daysInRange.forEach(day => {
    const dateStr = format(day, 'MMM d');
    result.set(dateStr, { value: 0, data: [] });
  });

  // Add data points
  data.forEach(item => {
    const itemDate = new Date(item.date);
    if (isWithinInterval(itemDate, dateRange)) {
      const dateStr = format(itemDate, 'MMM d');
      const existing = result.get(dateStr) || { value: 0, data: [] };
      existing.value += 1;
      existing.data.push(item);
      result.set(dateStr, existing);
    }
  });

  return Array.from(result.entries()).map(([date, { value, data }]) => ({
    date,
    value,
    data
  }));
}

export function calculatePercentile(
  data: number[],
  percentile: number
): number {
  if (data.length === 0) return 0;

  const sorted = [...data].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;

  return sorted[Math.max(0, index)];
}

export function calculateMovingAverage(
  data: number[],
  window: number
): number[] {
  if (data.length < window) {
    return data.map(() => data.reduce((a, b) => a + b, 0) / data.length);
  }

  const result: number[] = [];

  for (let i = 0; i <= data.length - window; i++) {
    const slice = data.slice(i, i + window);
    const avg = slice.reduce((a, b) => a + b, 0) / window;
    result.push(avg);
  }

  return result;
}

export function calculateEfficiencyScore(
  completedSessions: number,
  totalSessions: number,
  avgDuration: number,
  avgRetries: number
): number {
  // Base score from completion rate
  const completionScore = (completedSessions / totalSessions) * 40;

  // Duration bonus (faster is better, up to a point)
  const durationBonus = Math.max(0, (1 - Math.min(avgDuration / 120, 1)) * 30);

  // Retry penalty (fewer retries is better)
  const retryPenalty = Math.max(0, (1 - Math.min(avgRetries / 3, 1)) * 30);

  return Math.min(100, Math.max(0, completionScore + durationBonus + retryPenalty));
}

export function calculateProductivityScore(
  ticketsCompleted: number,
  commentsAdded: number,
  sessionHours: number,
  avgCompletionTime: number
): number {
  // Normalize values
  const ticketsScore = Math.min(ticketsCompleted / 10, 1) * 30;
  const commentsScore = Math.min(commentsAdded / 20, 1) * 20;
  const hoursScore = Math.min(sessionHours / 40, 1) * 25;
  const timeScore = Math.max(0, (1 - Math.min(avgCompletionTime / 14, 1))) * 25;

  return ticketsScore + commentsScore + hoursScore + timeScore;
}

export function generateInsight(
  type: 'improvement' | 'warning' | 'info' | 'success',
  category: 'agents' | 'projects' | 'team' | 'process',
  title: string,
  description: string,
  impact: 'high' | 'medium' | 'low',
  suggestedActions?: string[]
) {
  return {
    id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    category,
    title,
    description,
    impact,
    actionable: suggestedActions && suggestedActions.length > 0,
    suggestedActions,
    createdAt: new Date()
  };
}

export function exportToCSV(data: any[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToJSON(data: any, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportToPDF(element: HTMLElement, filename: string): Promise<void> {
  // This is a placeholder - in a real implementation, you'd use a library like jsPDF
  console.log('PDF export not implemented yet for element:', element);
  console.log('Filename would be:', filename);

  // For now, just alert the user
  alert('PDF export will be available in a future update. Please use CSV or JSON export.');
}
