
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AnalysisResult } from '@/services/technicalAnalysis';

interface TechnicalIndicatorsProps {
  analysis: AnalysisResult;
}

export const TechnicalIndicators = ({ analysis }: TechnicalIndicatorsProps) => {
  const getRSIColor = (rsi: number) => {
    if (rsi >= 70) return 'text-red-500';
    if (rsi <= 30) return 'text-green-500';
    return 'text-muted-foreground';
  };

  const getRSILevel = (rsi: number) => {
    if (rsi >= 70) return 'Overbought';
    if (rsi <= 30) return 'Oversold';
    if (rsi >= 50) return 'Bullish';
    return 'Bearish';
  };

  const currentRSI = analysis.rsi[analysis.rsi.length - 1]?.value || 0;
  const currentMACD = analysis.macd.macd[analysis.macd.macd.length - 1]?.value || 0;
  const currentSignal = analysis.macd.signal[analysis.macd.signal.length - 1]?.value || 0;
  const currentHistogram = analysis.macd.histogram[analysis.macd.histogram.length - 1]?.value || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Technical Indicators</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* RSI */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">RSI (14)</span>
            <span className={`text-sm font-bold ${getRSIColor(currentRSI)}`}>
              {currentRSI.toFixed(1)} - {getRSILevel(currentRSI)}
            </span>
          </div>
          <div className="relative">
            <Progress value={currentRSI} className="h-2" />
            <div className="absolute top-0 left-[30%] w-0.5 h-2 bg-green-500"></div>
            <div className="absolute top-0 left-[70%] w-0.5 h-2 bg-red-500"></div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span>
            <span>30</span>
            <span>70</span>
            <span>100</span>
          </div>
        </div>

        {/* MACD */}
        <div>
          <div className="text-sm font-medium mb-3">MACD (12,26,9)</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">MACD Line:</span>
              <span className={`text-sm font-medium ${currentMACD > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {currentMACD.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Signal Line:</span>
              <span className={`text-sm font-medium ${currentSignal > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {currentSignal.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Histogram:</span>
              <span className={`text-sm font-medium ${currentHistogram > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {currentHistogram.toFixed(6)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Signal: {currentMACD > currentSignal ? 'Bullish Crossover' : 'Bearish Crossover'}
            </div>
          </div>
        </div>

        {/* Moving Averages */}
        <div>
          <div className="text-sm font-medium mb-3">Moving Averages</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">SMA 20:</span>
              <span className="text-sm font-medium">
                {analysis.sma20[analysis.sma20.length - 1]?.value.toFixed(5) || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">SMA 50:</span>
              <span className="text-sm font-medium">
                {analysis.sma50[analysis.sma50.length - 1]?.value.toFixed(5) || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">EMA 12:</span>
              <span className="text-sm font-medium">
                {analysis.ema12[analysis.ema12.length - 1]?.value.toFixed(5) || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">EMA 26:</span>
              <span className="text-sm font-medium">
                {analysis.ema26[analysis.ema26.length - 1]?.value.toFixed(5) || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Bollinger Bands */}
        <div>
          <div className="text-sm font-medium mb-3">Bollinger Bands (20,2)</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Upper:</span>
              <span className="text-sm font-medium">
                {analysis.bollingerBands.upper[analysis.bollingerBands.upper.length - 1]?.value.toFixed(5) || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Middle:</span>
              <span className="text-sm font-medium">
                {analysis.bollingerBands.middle[analysis.bollingerBands.middle.length - 1]?.value.toFixed(5) || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Lower:</span>
              <span className="text-sm font-medium">
                {analysis.bollingerBands.lower[analysis.bollingerBands.lower.length - 1]?.value.toFixed(5) || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
