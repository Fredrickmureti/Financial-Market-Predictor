
import { useMemo } from 'react';
import { CandlestickData } from '../services/forexService';
import { TechnicalAnalysis } from '../services/technicalAnalysis';
import { TradingStrategy, TradingSignal } from '../services/tradingStrategy';

export const useTradingSignals = (data: CandlestickData[] | undefined) => {
  return useMemo(() => {
    if (!data || data.length < 50) {
      return null;
    }

    const analysis = TechnicalAnalysis.analyzeAll(data);
    const strategy = new TradingStrategy();
    const signal = strategy.generateSignal(data, analysis);

    return {
      signal,
      analysis,
      strategy
    };
  }, [data]);
};
