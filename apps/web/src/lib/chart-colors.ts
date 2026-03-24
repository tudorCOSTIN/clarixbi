export const CHART_COLORS = {
  primary: ['#2196F3', '#42A5F5', '#90CAF9', '#1976D2', '#0D47A1', '#64B5F6', '#BBDEFB'],
  warm: ['#FF6B35', '#F7931E', '#FFC107', '#FF8A65', '#FFAB40', '#FFD54F', '#FFE082'],
  cool: ['#00BCD4', '#009688', '#4CAF50', '#26A69A', '#66BB6A', '#80CBC4', '#A5D6A7'],
} as const;

export type ChartColorScheme = keyof typeof CHART_COLORS;

export function getSparklineColor(scheme: ChartColorScheme): string {
  return CHART_COLORS[scheme][0]!;
}
