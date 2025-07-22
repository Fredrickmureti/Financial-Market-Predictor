
import { CandlestickData, TechnicalIndicator } from './forexService';

export interface AnalysisResult {
  sma20: TechnicalIndicator[];
  sma50: TechnicalIndicator[];
  ema12: TechnicalIndicator[];
  ema26: TechnicalIndicator[];
  rsi: TechnicalIndicator[];
  macd: {
    macd: TechnicalIndicator[];
    signal: TechnicalIndicator[];
    histogram: TechnicalIndicator[];
  };
  bollingerBands: {
    upper: TechnicalIndicator[];
    middle: TechnicalIndicator[];
    lower: TechnicalIndicator[];
  };
  stochastic: {
    k: TechnicalIndicator[];
    d: TechnicalIndicator[];
  };
}

export class TechnicalAnalysis {
  static calculateSMA(data: CandlestickData[], period: number): TechnicalIndicator[] {
    const result: TechnicalIndicator[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, candle) => acc + candle.close, 0);
      result.push({
        timestamp: data[i].timestamp,
        value: sum / period
      });
    }
    
    return result;
  }

  static calculateEMA(data: CandlestickData[], period: number): TechnicalIndicator[] {
    const result: TechnicalIndicator[] = [];
    const multiplier = 2 / (period + 1);
    
    if (data.length === 0) return result;
    
    // First EMA is SMA
    let ema = data.slice(0, period).reduce((acc, candle) => acc + candle.close, 0) / period;
    result.push({
      timestamp: data[period - 1].timestamp,
      value: ema
    });
    
    for (let i = period; i < data.length; i++) {
      ema = (data[i].close - ema) * multiplier + ema;
      result.push({
        timestamp: data[i].timestamp,
        value: ema
      });
    }
    
    return result;
  }

  static calculateRSI(data: CandlestickData[], period: number = 14): TechnicalIndicator[] {
    const result: TechnicalIndicator[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      
      result.push({
        timestamp: data[i + 1].timestamp,
        value: rsi
      });
    }
    
    return result;
  }

  static calculateMACD(data: CandlestickData[]): AnalysisResult['macd'] {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    
    const macdLine: TechnicalIndicator[] = [];
    const signalLine: TechnicalIndicator[] = [];
    const histogram: TechnicalIndicator[] = [];
    
    // Calculate MACD line
    const startIndex = Math.max(0, 26 - 12);
    for (let i = startIndex; i < Math.min(ema12.length, ema26.length); i++) {
      const macdValue = ema12[i + 12 - 1]?.value - ema26[i]?.value;
      if (!isNaN(macdValue)) {
        macdLine.push({
          timestamp: ema26[i].timestamp,
          value: macdValue
        });
      }
    }
    
    // Calculate signal line (9-period EMA of MACD)
    if (macdLine.length >= 9) {
      const multiplier = 2 / 10;
      let signal = macdLine.slice(0, 9).reduce((acc, point) => acc + point.value, 0) / 9;
      
      signalLine.push({
        timestamp: macdLine[8].timestamp,
        value: signal
      });
      
      for (let i = 9; i < macdLine.length; i++) {
        signal = (macdLine[i].value - signal) * multiplier + signal;
        signalLine.push({
          timestamp: macdLine[i].timestamp,
          value: signal
        });
      }
    }
    
    // Calculate histogram
    for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {
      histogram.push({
        timestamp: macdLine[i + (macdLine.length - signalLine.length)].timestamp,
        value: macdLine[i + (macdLine.length - signalLine.length)].value - signalLine[i].value
      });
    }
    
    return { macd: macdLine, signal: signalLine, histogram };
  }

  static calculateBollingerBands(data: CandlestickData[], period: number = 20, stdDev: number = 2): AnalysisResult['bollingerBands'] {
    const sma = this.calculateSMA(data, period);
    const upper: TechnicalIndicator[] = [];
    const middle: TechnicalIndicator[] = [];
    const lower: TechnicalIndicator[] = [];
    
    for (let i = 0; i < sma.length; i++) {
      const dataIndex = i + period - 1;
      const prices = data.slice(dataIndex - period + 1, dataIndex + 1).map(d => d.close);
      const mean = sma[i].value;
      const variance = prices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);
      
      middle.push(sma[i]);
      upper.push({
        timestamp: sma[i].timestamp,
        value: mean + (stdDev * standardDeviation)
      });
      lower.push({
        timestamp: sma[i].timestamp,
        value: mean - (stdDev * standardDeviation)
      });
    }
    
    return { upper, middle, lower };
  }

  static analyzeAll(data: CandlestickData[]): AnalysisResult {
    return {
      sma20: this.calculateSMA(data, 20),
      sma50: this.calculateSMA(data, 50),
      ema12: this.calculateEMA(data, 12),
      ema26: this.calculateEMA(data, 26),
      rsi: this.calculateRSI(data),
      macd: this.calculateMACD(data),
      bollingerBands: this.calculateBollingerBands(data),
      stochastic: {
        k: [], // Simplified for demo
        d: []
      }
    };
  }
}
