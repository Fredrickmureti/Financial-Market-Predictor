
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TradingSignal } from '@/services/tradingStrategy';
import { TrendingUp, TrendingDown, Minus, Clock, Target, Shield } from 'lucide-react';

interface SignalPanelProps {
  signal: TradingSignal;
}

export const SignalPanel = ({ signal }: SignalPanelProps) => {
  const getSignalIcon = () => {
    switch (signal.signal) {
      case 'BUY':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'SELL':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <Minus className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getSignalColor = () => {
    switch (signal.signal) {
      case 'BUY':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'SELL':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signal Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Signal */}
        <div className={`p-4 rounded-lg border ${getSignalColor()}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {getSignalIcon()}
              <div>
                <div className="text-xl font-bold">{signal.signal}</div>
                <div className="text-sm opacity-75">
                  {signal.signal === 'BUY' ? 'Long Position' : signal.signal === 'SELL' ? 'Short Position' : 'No Position'}
                </div>
              </div>
            </div>
            <Badge variant="outline" className={getConfidenceColor(signal.confidence)}>
              {signal.confidence.toFixed(1)}% Confidence
            </Badge>
          </div>
          
          <div className="text-sm opacity-75">
            Generated at: {new Date(signal.timestamp).toLocaleString()}
          </div>
        </div>

        {/* Signal Details */}
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">Entry Price</div>
              <div className="text-sm text-muted-foreground">{signal.price.toFixed(5)}</div>
            </div>
          </div>

          {signal.stopLoss && (
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
              <Shield className="h-5 w-5 text-red-500" />
              <div>
                <div className="font-medium text-red-700">Stop Loss</div>
                <div className="text-sm text-red-600">{signal.stopLoss.toFixed(5)}</div>
              </div>
            </div>
          )}

          {signal.takeProfit && (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <Target className="h-5 w-5 text-green-500" />
              <div>
                <div className="font-medium text-green-700">Take Profit</div>
                <div className="text-sm text-green-600">{signal.takeProfit.toFixed(5)}</div>
              </div>
            </div>
          )}

          {signal.riskReward && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="font-medium text-blue-700">Risk/Reward Ratio</span>
              <span className="text-blue-600 font-bold">1:{signal.riskReward}</span>
            </div>
          )}
        </div>

        {/* Signal Reasons */}
        <div>
          <div className="font-medium mb-3">Analysis Reasons</div>
          <div className="space-y-2">
            {signal.reasons.map((reason, index) => (
              <div key={index} className="text-sm p-2 bg-muted rounded border-l-2 border-primary">
                • {reason}
              </div>
            ))}
          </div>
        </div>

        {/* Trading Instructions */}
        {signal.signal !== 'HOLD' && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="font-medium text-blue-800 mb-2">Trading Instructions</div>
            <div className="text-sm text-blue-700 space-y-1">
              <div>1. Enter {signal.signal} position at market price</div>
              <div>2. Set stop loss at {signal.stopLoss?.toFixed(5)}</div>
              <div>3. Set take profit at {signal.takeProfit?.toFixed(5)}</div>
              <div>4. Risk 1-2% of account balance</div>
              <div>5. Monitor for signal changes</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
