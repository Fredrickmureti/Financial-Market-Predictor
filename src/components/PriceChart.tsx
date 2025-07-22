
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { CandlestickData } from '@/services/forexService';
import { AnalysisResult } from '@/services/technicalAnalysis';
import { TradingSignal } from '@/services/tradingStrategy';

interface PriceChartProps {
  data: CandlestickData[];
  analysis: AnalysisResult;
  currentSignal: TradingSignal;
}

export const PriceChart = ({ data, analysis, currentSignal }: PriceChartProps) => {
  // Combine data with indicators for chart
  const chartData = data.slice(-50).map((candle, index) => {
    const sma20 = analysis.sma20[index]?.value;
    const sma50 = analysis.sma50[index]?.value;
    const bbUpper = analysis.bollingerBands.upper[index]?.value;
    const bbLower = analysis.bollingerBands.lower[index]?.value;
    const bbMiddle = analysis.bollingerBands.middle[index]?.value;

    return {
      timestamp: new Date(candle.timestamp).toLocaleTimeString(),
      price: candle.close,
      high: candle.high,
      low: candle.low,
      sma20: sma20,
      sma50: sma50,
      bbUpper: bbUpper,
      bbLower: bbLower,
      bbMiddle: bbMiddle,
    };
  });

  const formatTooltip = (value: number | undefined, name: string) => {
    if (value === undefined) return ['-', name];
    return [value.toFixed(5), name];
  };

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="timestamp" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis 
            domain={['dataMin - 0.001', 'dataMax + 0.001']}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickFormatter={(value) => value.toFixed(4)}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
            formatter={formatTooltip}
          />
          
          {/* Price line */}
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={false}
            name="Price"
          />
          
          {/* Bollinger Bands */}
          <Line 
            type="monotone" 
            dataKey="bbUpper" 
            stroke="hsl(var(--muted-foreground))" 
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
            name="BB Upper"
          />
          <Line 
            type="monotone" 
            dataKey="bbMiddle" 
            stroke="hsl(var(--muted-foreground))" 
            strokeWidth={1}
            dot={false}
            name="BB Middle"
          />
          <Line 
            type="monotone" 
            dataKey="bbLower" 
            stroke="hsl(var(--muted-foreground))" 
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
            name="BB Lower"
          />
          
          {/* Moving Averages */}
          <Line 
            type="monotone" 
            dataKey="sma20" 
            stroke="#3b82f6" 
            strokeWidth={1}
            dot={false}
            name="SMA 20"
          />
          <Line 
            type="monotone" 
            dataKey="sma50" 
            stroke="#ef4444" 
            strokeWidth={1}
            dot={false}
            name="SMA 50"
          />

          {/* Signal reference lines */}
          {currentSignal.stopLoss && (
            <ReferenceLine 
              y={currentSignal.stopLoss} 
              stroke="#ef4444" 
              strokeDasharray="3 3" 
              label="Stop Loss"
            />
          )}
          {currentSignal.takeProfit && (
            <ReferenceLine 
              y={currentSignal.takeProfit} 
              stroke="#22c55e" 
              strokeDasharray="3 3" 
              label="Take Profit"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
