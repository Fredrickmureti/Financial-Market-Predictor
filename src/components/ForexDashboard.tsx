import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Play, Pause, Download, Activity, Zap, Settings } from 'lucide-react';
import { useForexPrice, useHistoricalData } from '@/hooks/useForexData';
import { useEnhancedTradingSignals } from '@/hooks/useEnhancedTradingSignals';
import { PriceChart } from './PriceChart';
import { EnhancedSignalPanel } from './EnhancedSignalPanel';
import { TechnicalIndicators } from './TechnicalIndicators';
import { AdvancedIndicators } from './AdvancedIndicators';
import { ApiKeyManager } from './ApiKeyManager';
import { EnhancedTradingSignal } from '@/services/enhancedTradingStrategy';
import { TradingSignal, SignalType } from '@/services/tradingStrategy';

const CURRENCY_PAIRS = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDJPY', 'USDCHF'];

export const ForexDashboard = () => {
  const [selectedPair, setSelectedPair] = useState('EURUSD');
  const [isLive, setIsLive] = useState(true);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showApiManager, setShowApiManager] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: currentPrice, isLoading: priceLoading } = useForexPrice(selectedPair, isLive);
  const { data: historicalData, isLoading: historyLoading } = useHistoricalData(selectedPair);
  const tradingData = useEnhancedTradingSignals(historicalData);

  // Convert enhanced signal to basic signal format for PriceChart compatibility
  const convertToBasicSignal = (enhancedSignal: EnhancedTradingSignal): TradingSignal => {
    let basicSignalType: SignalType = 'HOLD';
    
    if (enhancedSignal.signal.includes('BUY')) {
      basicSignalType = 'BUY';
    } else if (enhancedSignal.signal.includes('SELL')) {
      basicSignalType = 'SELL';
    }

    return {
      signal: basicSignalType,
      confidence: enhancedSignal.confidence,
      timestamp: enhancedSignal.timestamp,
      price: enhancedSignal.price,
      reasons: enhancedSignal.reasons
    };
  };

  // Check if user has API keys configured
  useEffect(() => {
    const hasKeys = localStorage.getItem('alphaVantageKey') || 
                   localStorage.getItem('exchangeRateKey') || 
                   localStorage.getItem('currencyApiKey');
    if (!hasKeys) {
      setShowApiManager(true);
      setNotifications(prev => ["⚠️ WARNING: Using mock data. Please add an API key for real-time market data.", ...prev]);
    } else {
      const provider = localStorage.getItem('forexProvider') || 'alphavantage';
      let apiKey = '';
      
      switch(provider) {
        case 'alphavantage':
          apiKey = localStorage.getItem('alphaVantageKey') || '';
          break;
        case 'exchangerate':
          apiKey = localStorage.getItem('exchangeRateKey') || '';
          break;
        case 'currencyapi':
          apiKey = localStorage.getItem('currencyApiKey') || '';
          break;
      }
      
      if (!apiKey) {
        setNotifications(prev => ["⚠️ WARNING: Using mock data. API provider selected but no key provided.", ...prev]);
      }
    }
  }, [refreshKey]);

  useEffect(() => {
    if (tradingData?.signal && !tradingData.signal.signal.includes('HOLD')) {
      const signalStrength = tradingData.signal.signal.includes('STRONG') ? '🔥 STRONG' : 
                            tradingData.signal.signal.includes('WEAK') ? '⚠️ WEAK' : '';
      const message = `${signalStrength} ${tradingData.signal.signal} signal for ${selectedPair} at ${tradingData.signal.price.toFixed(5)} (${tradingData.signal.confidence.toFixed(1)}% confidence, Confluence: ${tradingData.signal.confluenceScore})`;
      setNotifications(prev => [message, ...prev.slice(0, 4)]);
    }
  }, [tradingData?.signal, selectedPair]);

  const handleApiKeysUpdated = () => {
    setRefreshKey(prev => prev + 1);
    setShowApiManager(false);
  };

  const getSignalIcon = (signal: string) => {
    if (signal.includes('STRONG_BUY')) return <TrendingUp className="h-6 w-6 text-green-600" />;
    if (signal.includes('BUY')) return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (signal.includes('STRONG_SELL')) return <TrendingDown className="h-6 w-6 text-red-600" />;
    if (signal.includes('SELL')) return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  const getSignalColor = (signal: string) => {
    if (signal.includes('STRONG_BUY')) return 'text-green-600 bg-green-100 border-green-300';
    if (signal.includes('BUY')) return 'text-green-500 bg-green-50 border-green-200';
    if (signal.includes('STRONG_SELL')) return 'text-red-600 bg-red-100 border-red-300';
    if (signal.includes('SELL')) return 'text-red-500 bg-red-50 border-red-200';
    return 'text-muted-foreground bg-muted border-border';
  };

  const getMarketRegimeIcon = (regime: string) => {
    return regime === 'trending' ? <Activity className="h-4 w-4" /> : <Zap className="h-4 w-4" />;
  };

  const exportToAdvancedPineScript = () => {
    if (tradingData?.strategy) {
      const pineScript = tradingData.strategy.generateAdvancedPineScript();
      const blob = new Blob([pineScript], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedPair}_enhanced_strategy.pine`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (priceLoading || historyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading enhanced forex analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* API Key Manager */}
      {showApiManager && (
        <ApiKeyManager onKeysUpdated={handleApiKeysUpdated} />
      )}

      {/* Data Source Alert */}
      {!showApiManager && (() => {
        const provider = localStorage.getItem('forexProvider') || 'alphavantage';
        let apiKey = '';
        
        switch(provider) {
          case 'alphavantage':
            apiKey = localStorage.getItem('alphaVantageKey') || '';
            break;
          case 'exchangerate':
            apiKey = localStorage.getItem('exchangeRateKey') || '';
            break;
          case 'currencyapi':
            apiKey = localStorage.getItem('currencyApiKey') || '';
            break;
        }
        
        if (!apiKey) {
          return (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 rounded">
              <div className="flex items-center">
                <div className="py-1">
                  <svg className="h-6 w-6 mr-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold">Using Mock Data</p>
                  <p className="text-sm">Currency prices shown are simulated. <button onClick={() => setShowApiManager(true)} className="underline text-blue-700">Add an API key</button> to get real-time market data.</p>
                </div>
              </div>
            </div>
          );
        }
        
        return (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4 rounded">
            <div className="flex">
              <div className="py-1">
                <svg className="h-6 w-6 mr-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-bold">Using Real-time Data</p>
                <p className="text-sm">Connected to {provider.charAt(0).toUpperCase() + provider.slice(1)} API for live market prices.</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Enhanced Forex Trading Strategy v2</h1>
          <p className="text-muted-foreground">Advanced market analysis with confluence scoring and regime detection</p>
          {tradingData?.advancedAnalysis && (
            <div className="flex items-center gap-4 mt-2 text-sm">
              <div className="flex items-center gap-1">
                {getMarketRegimeIcon(tradingData.advancedAnalysis.marketRegime)}
                <span>Market: {tradingData.advancedAnalysis.marketRegime} ({tradingData.advancedAnalysis.trendStrength})</span>
              </div>
              <div>Volatility: {tradingData.advancedAnalysis.volatility}</div>
              <div>Session: {tradingData.advancedAnalysis.sessionFilter ? 'Active' : 'Inactive'}</div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setShowApiManager(!showApiManager)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            API Settings
          </Button>
          
          <Button
            variant={isLive ? "default" : "outline"}
            onClick={() => setIsLive(!isLive)}
            className="flex items-center gap-2"
          >
            {isLive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isLive ? 'Pause' : 'Resume'} Live Data
          </Button>
          
          <Button onClick={exportToAdvancedPineScript} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Enhanced Pine Script
          </Button>
        </div>
      </div>

      {/* Currency Pair Selector */}
      <div className="flex gap-2 flex-wrap">
        {CURRENCY_PAIRS.map((pair) => (
          <Button
            key={pair}
            variant={selectedPair === pair ? "default" : "outline"}
            onClick={() => setSelectedPair(pair)}
            className="text-sm"
          >
            {pair}
          </Button>
        ))}
      </div>

      {/* Enhanced Current Price and Signal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{selectedPair} Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentPrice?.price.toFixed(5)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">Bid:</span>
              <span className="text-sm font-medium">{currentPrice?.bid.toFixed(5)}</span>
              <span className="text-sm text-muted-foreground">Ask:</span>
              <span className="text-sm font-medium">{currentPrice?.ask.toFixed(5)}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Last updated: {currentPrice ? new Date(currentPrice.timestamp).toLocaleTimeString() : 'N/A'}
            </div>
            {tradingData?.advancedAnalysis && (
              <div className="mt-3 text-xs space-y-1">
                <div>ATR: {tradingData.advancedAnalysis.atr[tradingData.advancedAnalysis.atr.length - 1]?.value.toFixed(6)}</div>
                <div>ADX: {tradingData.advancedAnalysis.adx[tradingData.advancedAnalysis.adx.length - 1]?.value.toFixed(1)}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Enhanced Signal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${getSignalColor(tradingData?.signal?.signal || 'HOLD')}`}>
              {getSignalIcon(tradingData?.signal?.signal || 'HOLD')}
              <div className="flex-1">
                <div className="font-bold text-lg">{tradingData?.signal?.signal || 'HOLD'}</div>
                <div className="text-sm">
                  Confidence: {tradingData?.signal?.confidence.toFixed(1) || '0'}%
                </div>
                <div className="text-xs">
                  Confluence Score: {tradingData?.signal?.confluenceScore || 0}
                </div>
              </div>
            </div>
            {tradingData?.signal?.stopLoss && (
              <div className="mt-3 text-sm space-y-1">
                <div>Stop Loss: {tradingData.signal.stopLoss.toFixed(5)}</div>
                <div>Take Profit: {tradingData.signal.takeProfit?.toFixed(5)}</div>
                <div>Risk/Reward: 1:{tradingData.signal.riskReward?.toFixed(1)}</div>
                {tradingData.signal.trailingStop && (
                  <div>Trailing Stop: {tradingData.signal.trailingStop.toFixed(5)}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">System Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              ) : (
                notifications.map((notification, index) => (
                  <div 
                    key={index} 
                    className={`text-xs p-3 rounded ${
                      notification.includes('WARNING') 
                        ? 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800' 
                        : notification.includes('ERROR') 
                          ? 'bg-red-100 border-l-4 border-red-500 text-red-800'
                          : notification.includes('BUY') 
                            ? 'bg-green-50 border-l-4 border-green-500 text-green-800'
                            : notification.includes('SELL')
                              ? 'bg-red-50 border-l-4 border-red-500 text-red-800'
                              : 'bg-muted border-l-4 border-primary'
                    }`}
                  >
                    <div className="flex items-start">
                      {notification.includes('WARNING') && (
                        <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                      {notification}
                      {notification.includes('API key') && (
                        <button 
                          className="ml-2 underline text-blue-700"
                          onClick={() => setShowApiManager(true)}
                        >
                          Add key
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart with converted signal */}
      <Card>
        <CardHeader>
          <CardTitle>Enhanced Price Chart & Technical Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {historicalData && tradingData ? (
            <PriceChart 
              data={historicalData} 
              analysis={tradingData.analysis}
              currentSignal={tradingData.signal ? convertToBasicSignal(tradingData.signal) : undefined}
            />
          ) : (
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              Loading enhanced chart data...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Technical Indicators and Signal Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {tradingData && (
          <>
            <TechnicalIndicators analysis={tradingData.analysis} />
            <AdvancedIndicators advancedAnalysis={tradingData.advancedAnalysis} />
            {tradingData.signal && <EnhancedSignalPanel signal={tradingData.signal} />}
          </>
        )}
      </div>
    </div>
  );
};
