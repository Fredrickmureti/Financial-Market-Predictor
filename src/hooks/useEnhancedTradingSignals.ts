
import { useMemo } from 'react';
import { CandlestickData } from '../services/forexService';
import { TechnicalAnalysis } from '../services/technicalAnalysis';
import { AdvancedTechnicalAnalysis } from '../services/advancedTechnicalAnalysis';
import { EnhancedTradingStrategy, EnhancedTradingSignal } from '../services/enhancedTradingStrategy';

export const useEnhancedTradingSignals = (data: CandlestickData[] | undefined) => {
  return useMemo(() => {
    if (!data || data.length < 100) { // Increased minimum data requirement for smart money concepts
      return null;
    }

    console.log('Analyzing enhanced trading signals with smart money concepts for', data.length, 'candles');

    const analysis = TechnicalAnalysis.analyzeAll(data);
    const adx = AdvancedTechnicalAnalysis.calculateADX(data);
    const atr = AdvancedTechnicalAnalysis.calculateATR(data);
    const pivotPoints = AdvancedTechnicalAnalysis.calculatePivotPoints(data);
    const marketRegimeData = AdvancedTechnicalAnalysis.determineMarketRegime(adx);
    const currentPrice = data[data.length - 1].close;
    const volatility = AdvancedTechnicalAnalysis.calculateVolatility(atr, currentPrice);
    const sessionFilter = AdvancedTechnicalAnalysis.isSessionActive();

    const advancedAnalysis = {
      adx,
      atr,
      pivotPoints,
      marketRegime: marketRegimeData.regime,
      trendStrength: marketRegimeData.strength,
      volatility,
      sessionFilter
    };

    const strategy = new EnhancedTradingStrategy();
    const signal = strategy.generateEnhancedSignal(data, analysis, advancedAnalysis);

    console.log('Enhanced signal generated:', {
      signal: signal.signal,
      confidence: signal.confidence,
      confluenceScore: signal.confluenceScore,
      fairValueGaps: signal.fairValueGaps.length,
      orderBlocks: signal.orderBlocks.length,
      liquidityZones: signal.liquidityZones.length,
      volumeProfile: signal.volumeProfile,
      microstructure: signal.microstructure,
      reasons: signal.reasons.slice(0, 3) // Log first 3 reasons
    });

    return {
      signal,
      analysis,
      advancedAnalysis,
      strategy
    };
  }, [data]);
};
