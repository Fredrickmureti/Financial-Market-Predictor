
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdvancedAnalysisResult } from '@/services/advancedTechnicalAnalysis';
import { Activity, TrendingUp, BarChart3, Target } from 'lucide-react';

interface AdvancedIndicatorsProps {
  advancedAnalysis: AdvancedAnalysisResult;
}

export const AdvancedIndicators = ({ advancedAnalysis }: AdvancedIndicatorsProps) => {
  const getADXColor = (adx: number) => {
    if (adx > 30) return 'text-green-600 bg-green-100';
    if (adx > 20) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getVolatilityColor = (volatility: string) => {
    switch (volatility) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getMarketRegimeColor = (regime: string) => {
    return regime === 'trending' ? 'text-green-600 bg-green-100' : 'text-blue-600 bg-blue-100';
  };

  const currentADX = advancedAnalysis.adx[advancedAnalysis.adx.length - 1]?.value || 0;
  const currentATR = advancedAnalysis.atr[advancedAnalysis.atr.length - 1]?.value || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Advanced Market Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Market Regime */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Market Regime</span>
            <Badge className={getMarketRegimeColor(advancedAnalysis.marketRegime)}>
              {advancedAnalysis.marketRegime.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Trend Strength: {advancedAnalysis.trendStrength}</span>
          </div>
        </div>

        {/* ADX Analysis */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">ADX (Trend Strength)</span>
            <Badge className={getADXColor(currentADX)}>
              {currentADX.toFixed(1)}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• ADX {'>'}30: Strong trend</div>
            <div>• ADX 20-30: Moderate trend</div>
            <div>• ADX {'<'}20: Weak trend/ranging</div>
          </div>
        </div>

        {/* ATR Volatility */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">ATR Volatility</span>
            <Badge className={getVolatilityColor(advancedAnalysis.volatility)}>
              {advancedAnalysis.volatility.toUpperCase()}
            </Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current ATR:</span>
            <span className="font-medium">{currentATR.toFixed(6)}</span>
          </div>
        </div>

        {/* Pivot Points */}
        <div>
          <div className="text-sm font-medium mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Daily Pivot Points
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-red-500">R2:</span>
              <span className="text-sm font-medium">{advancedAnalysis.pivotPoints.resistance2.toFixed(5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-red-400">R1:</span>
              <span className="text-sm font-medium">{advancedAnalysis.pivotPoints.resistance1.toFixed(5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Pivot:</span>
              <span className="text-sm font-bold">{advancedAnalysis.pivotPoints.pivot.toFixed(5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-green-400">S1:</span>
              <span className="text-sm font-medium">{advancedAnalysis.pivotPoints.support1.toFixed(5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-green-500">S2:</span>
              <span className="text-sm font-medium">{advancedAnalysis.pivotPoints.support2.toFixed(5)}</span>
            </div>
          </div>
        </div>

        {/* Trading Session */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Trading Session</span>
            <Badge variant={advancedAnalysis.sessionFilter ? "default" : "secondary"}>
              {advancedAnalysis.sessionFilter ? '🟢 ACTIVE' : '🔴 INACTIVE'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• London: 08:00-17:00 UTC</div>
            <div>• New York: 13:00-22:00 UTC</div>
            <div>• Tokyo: 00:00-09:00 UTC</div>
          </div>
        </div>

        {/* Market Analysis Summary */}
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-sm font-medium mb-2">Market Analysis Summary</div>
          <div className="text-xs space-y-1">
            <div>✓ Market is in {advancedAnalysis.marketRegime} mode</div>
            <div>✓ Volatility is {advancedAnalysis.volatility}</div>
            <div>✓ Trend strength: {advancedAnalysis.trendStrength}</div>
            <div>✓ Session: {advancedAnalysis.sessionFilter ? 'Optimal trading time' : 'Low activity period'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
