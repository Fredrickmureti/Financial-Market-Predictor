
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EnhancedTradingSignal } from '@/services/enhancedTradingStrategy';
import { TrendingUp, TrendingDown, Minus, Clock, Target, Shield, Zap, Activity, Eye, Volume2, BarChart3 } from 'lucide-react';

interface EnhancedSignalPanelProps {
  signal: EnhancedTradingSignal;
}

export const EnhancedSignalPanel = ({ signal }: EnhancedSignalPanelProps) => {
  const getSignalIcon = () => {
    if (signal.signal.includes('STRONG_BUY')) return <TrendingUp className="h-6 w-6 text-green-600" />;
    if (signal.signal.includes('BUY')) return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (signal.signal.includes('STRONG_SELL')) return <TrendingDown className="h-6 w-6 text-red-600" />;
    if (signal.signal.includes('SELL')) return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  const getSignalColor = () => {
    if (signal.signal.includes('STRONG_BUY')) return 'bg-green-100 text-green-800 border-green-300';
    if (signal.signal.includes('BUY')) return 'bg-green-50 text-green-700 border-green-200';
    if (signal.signal.includes('STRONG_SELL')) return 'bg-red-100 text-red-800 border-red-300';
    if (signal.signal.includes('SELL')) return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-muted text-muted-foreground border-border';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return 'text-green-800 bg-green-200 border-green-400';
    if (confidence >= 90) return 'text-green-700 bg-green-100 border-green-300';
    if (confidence >= 85) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 75) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getConfluenceColor = (score: number) => {
    if (score >= 15) return 'text-purple-800 bg-purple-200 border-purple-400';
    if (score >= 12) return 'text-purple-700 bg-purple-100 border-purple-300';
    if (score >= 8) return 'text-blue-700 bg-blue-100 border-blue-300';
    if (score >= 5) return 'text-yellow-700 bg-yellow-100 border-yellow-300';
    return 'text-gray-700 bg-gray-100 border-gray-300';
  };

  const getMicrostructureColor = (microstructure: string) => {
    if (microstructure === 'bullish') return 'text-green-700 bg-green-100';
    if (microstructure === 'bearish') return 'text-red-700 bg-red-100';
    return 'text-gray-700 bg-gray-100';
  };

  const getVolumeColor = (volume: string) => {
    if (volume === 'high') return 'text-green-700 bg-green-100';
    if (volume === 'medium') return 'text-yellow-700 bg-yellow-100';
    return 'text-gray-700 bg-gray-100';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Smart Money Signal Analysis
          {signal.signal.includes('STRONG') && <Zap className="h-4 w-4 text-yellow-500" />}
          {signal.confluenceScore >= 15 && <Eye className="h-4 w-4 text-purple-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Enhanced Signal */}
        <div className={`p-4 rounded-lg border-2 ${getSignalColor()}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {getSignalIcon()}
              <div>
                <div className="text-xl font-bold">{signal.signal}</div>
                <div className="text-sm opacity-75">
                  {signal.signal.includes('BUY') ? 'Long Position' : signal.signal.includes('SELL') ? 'Short Position' : 'No Position'}
                </div>
              </div>
            </div>
            <div className="text-right space-y-1">
              <Badge className={`border ${getConfidenceColor(signal.confidence)}`}>
                {signal.confidence.toFixed(1)}% Confidence
              </Badge>
              <Badge className={`border ${getConfluenceColor(signal.confluenceScore)}`}>
                Confluence: {signal.confluenceScore}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              {signal.marketRegime === 'trending' ? <Activity className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
              <span>Market: {signal.marketRegime}</span>
            </div>
            <div>Session: {signal.sessionActive ? '🟢 Active' : '🔴 Inactive'}</div>
            <div className="flex items-center gap-2">
              <Badge className={getMicrostructureColor(signal.microstructure)}>
                Structure: {signal.microstructure}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              <Badge className={getVolumeColor(signal.volumeProfile)}>
                Volume: {signal.volumeProfile}
              </Badge>
            </div>
          </div>
          
          <div className="text-sm opacity-75 mt-2">
            Generated at: {new Date(signal.timestamp).toLocaleString()}
          </div>
        </div>

        {/* Smart Money Concepts Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Fair Value Gaps</span>
            </div>
            <div className="text-lg font-bold text-blue-700">{signal.fairValueGaps.length}</div>
            <div className="text-xs text-blue-600">
              Unfilled: {signal.fairValueGaps.filter(g => !g.filled).length}
            </div>
          </div>

          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">Order Blocks</span>
            </div>
            <div className="text-lg font-bold text-purple-700">{signal.orderBlocks.length}</div>
            <div className="text-xs text-purple-600">
              Untested: {signal.orderBlocks.filter(b => !b.tested).length}
            </div>
          </div>

          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Liquidity Zones</span>
            </div>
            <div className="text-lg font-bold text-orange-700">{signal.liquidityZones.length}</div>
            <div className="text-xs text-orange-600">
              Unswept: {signal.liquidityZones.filter(z => !z.swept).length}
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Risk/Reward</span>
            </div>
            <div className="text-lg font-bold text-emerald-700">
              {signal.riskReward ? `1:${signal.riskReward.toFixed(1)}` : 'N/A'}
            </div>
            <div className="text-xs text-emerald-600">
              {signal.riskReward && signal.riskReward >= 2.5 ? 'Excellent' : signal.riskReward && signal.riskReward >= 2.0 ? 'Good' : 'Fair'}
            </div>
          </div>
        </div>

        {/* Enhanced Signal Details */}
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">Entry Price</div>
              <div className="text-sm text-muted-foreground">{signal.price.toFixed(5)}</div>
            </div>
          </div>

          {signal.stopLoss && (
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <Shield className="h-5 w-5 text-red-500" />
              <div className="flex-1">
                <div className="font-medium text-red-700">Smart Stop Loss</div>
                <div className="text-sm text-red-600">{signal.stopLoss.toFixed(5)}</div>
                <div className="text-xs text-red-500">Based on order blocks & liquidity</div>
              </div>
            </div>
          )}

          {signal.takeProfit && (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <Target className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <div className="font-medium text-green-700">Smart Take Profit</div>
                <div className="text-sm text-green-600">{signal.takeProfit.toFixed(5)}</div>
                <div className="text-xs text-green-500">Targeting FVGs & liquidity zones</div>
              </div>
            </div>
          )}

          {signal.trailingStop && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Activity className="h-5 w-5 text-blue-500" />
              <div className="flex-1">
                <div className="font-medium text-blue-700">Trailing Stop</div>
                <div className="text-sm text-blue-600">{signal.trailingStop.toFixed(5)}</div>
                <div className="text-xs text-blue-500">ATR-based dynamic trailing</div>
              </div>
            </div>
          )}
        </div>

        {/* Smart Money Analysis Details */}
        {(signal.fairValueGaps.length > 0 || signal.orderBlocks.length > 0 || signal.liquidityZones.length > 0) && (
          <div>
            <div className="font-medium mb-3">Smart Money Concepts Detected</div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {signal.fairValueGaps.slice(0, 3).map((fvg, index) => (
                <div key={`fvg-${index}`} className="text-sm p-2 bg-blue-50 rounded border-l-2 border-blue-400">
                  💎 {fvg.type.toUpperCase()} FVG: {fvg.low.toFixed(5)} - {fvg.high.toFixed(5)} 
                  ({fvg.strength.toFixed(1)} pips) {fvg.filled ? '✅ Filled' : '⏳ Unfilled'}
                </div>
              ))}
              
              {signal.orderBlocks.slice(0, 3).map((ob, index) => (
                <div key={`ob-${index}`} className="text-sm p-2 bg-purple-50 rounded border-l-2 border-purple-400">
                  🏛️ {ob.type.toUpperCase()} Block: {ob.low.toFixed(5)} - {ob.high.toFixed(5)} 
                  (Strength: {ob.strength.toFixed(1)}) {ob.tested ? '✅ Tested' : '⏳ Untested'}
                </div>
              ))}
              
              {signal.liquidityZones.slice(0, 3).map((lz, index) => (
                <div key={`lz-${index}`} className="text-sm p-2 bg-orange-50 rounded border-l-2 border-orange-400">
                  🎯 {lz.type.replace('_', ' ').toUpperCase()}: {lz.price.toFixed(5)} 
                  (Strength: {lz.strength.toFixed(1)}) {lz.swept ? '✅ Swept' : '⏳ Available'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Signal Reasons */}
        <div>
          <div className="font-medium mb-3">Confluence Analysis ({signal.confluenceScore} points)</div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {signal.reasons.map((reason, index) => (
              <div key={index} className="text-sm p-2 bg-muted rounded border-l-2 border-primary">
                • {reason}
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced Trading Instructions */}
        {signal.signal !== 'HOLD' && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="font-medium text-blue-800 mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Smart Money Trading Plan
            </div>
            <div className="text-sm text-blue-700 space-y-2">
              <div className="font-semibold">📋 Entry Strategy:</div>
              <div>• Enter {signal.signal} position at market price ({signal.price.toFixed(5)})</div>
              <div>• Confluence score: {signal.confluenceScore}/20 ({signal.confluenceScore >= 15 ? 'Excellent' : signal.confluenceScore >= 12 ? 'Very Good' : signal.confluenceScore >= 8 ? 'Good' : 'Fair'})</div>
              
              <div className="font-semibold mt-3">🛡️ Risk Management:</div>
              <div>• Smart stop loss: {signal.stopLoss?.toFixed(5)} (based on order blocks/liquidity)</div>
              <div>• Take profit: {signal.takeProfit?.toFixed(5)} (targeting FVGs/liquidity zones)</div>
              <div>• Risk only 0.5-1% of account balance</div>
              {signal.trailingStop && (
                <div>• Use trailing stop: {signal.trailingStop.toFixed(5)} distance</div>
              )}
              
              <div className="font-semibold mt-3">⚠️ Exit Conditions:</div>
              <div>• Exit if confluence score drops below 5</div>
              <div>• Exit if smart money structure breaks</div>
              <div>• Exit if opposing order blocks get activated</div>
              <div>• Monitor for new FVG formations that contradict position</div>
              
              <div className="font-semibold mt-3">📊 Monitoring:</div>
              <div>• Watch for {signal.microstructure} market structure continuation</div>
              <div>• Monitor {signal.volumeProfile} volume levels</div>
              <div>• Track liquidity zone interactions</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
