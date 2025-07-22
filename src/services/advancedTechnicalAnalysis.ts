
import { CandlestickData, TechnicalIndicator } from './forexService';

export interface AdvancedAnalysisResult {
  adx: TechnicalIndicator[];
  atr: TechnicalIndicator[];
  pivotPoints: {
    pivot: number;
    resistance1: number;
    resistance2: number;
    support1: number;
    support2: number;
  };
  marketRegime: 'trending' | 'ranging';
  trendStrength: 'weak' | 'moderate' | 'strong';
  volatility: 'low' | 'medium' | 'high';
  sessionFilter: boolean;
}

export class AdvancedTechnicalAnalysis {
  static calculateADX(data: CandlestickData[], period: number = 14): TechnicalIndicator[] {
    const result: TechnicalIndicator[] = [];
    const trueRanges: number[] = [];
    const plusDMs: number[] = [];
    const minusDMs: number[] = [];

    // Calculate True Range and Directional Movements
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevHigh = data[i - 1].high;
      const prevLow = data[i - 1].low;
      const prevClose = data[i - 1].close;

      // True Range
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      const tr = Math.max(tr1, tr2, tr3);
      trueRanges.push(tr);

      // Directional Movements
      const plusDM = (high - prevHigh > prevLow - low) ? Math.max(high - prevHigh, 0) : 0;
      const minusDM = (prevLow - low > high - prevHigh) ? Math.max(prevLow - low, 0) : 0;
      plusDMs.push(plusDM);
      minusDMs.push(minusDM);
    }

    // Calculate smoothed values and ADX
    for (let i = period - 1; i < trueRanges.length; i++) {
      const avgTR = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgPlusDM = plusDMs.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgMinusDM = minusDMs.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;

      const plusDI = (avgPlusDM / avgTR) * 100;
      const minusDI = (avgMinusDM / avgTR) * 100;
      const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;

      if (i >= period * 2 - 2) {
        const startIdx = Math.max(0, result.length - period + 1);
        const adxValues = result.slice(startIdx).map(r => r.value);
        adxValues.push(dx);
        const adx = adxValues.reduce((a, b) => a + b, 0) / adxValues.length;

        result.push({
          timestamp: data[i + 1].timestamp,
          value: adx
        });
      } else {
        result.push({
          timestamp: data[i + 1].timestamp,
          value: dx
        });
      }
    }

    return result;
  }

  static calculateATR(data: CandlestickData[], period: number = 14): TechnicalIndicator[] {
    const result: TechnicalIndicator[] = [];
    const trueRanges: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      const tr = Math.max(tr1, tr2, tr3);
      trueRanges.push(tr);

      if (i >= period) {
        const atr = trueRanges.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
        result.push({
          timestamp: data[i].timestamp,
          value: atr
        });
      }
    }

    return result;
  }

  static calculatePivotPoints(data: CandlestickData[]) {
    const lastCandle = data[data.length - 1];
    const high = lastCandle.high;
    const low = lastCandle.low;
    const close = lastCandle.close;

    const pivot = (high + low + close) / 3;
    const resistance1 = (2 * pivot) - low;
    const support1 = (2 * pivot) - high;
    const resistance2 = pivot + (high - low);
    const support2 = pivot - (high - low);

    return {
      pivot,
      resistance1,
      resistance2,
      support1,
      support2
    };
  }

  static determineMarketRegime(adx: TechnicalIndicator[]): { regime: 'trending' | 'ranging', strength: 'weak' | 'moderate' | 'strong' } {
    const currentADX = adx[adx.length - 1]?.value || 0;
    
    if (currentADX > 30) {
      return { regime: 'trending', strength: 'strong' };
    } else if (currentADX > 20) {
      return { regime: 'trending', strength: 'moderate' };
    } else if (currentADX > 15) {
      return { regime: 'ranging', strength: 'weak' };
    } else {
      return { regime: 'ranging', strength: 'weak' };
    }
  }

  static calculateVolatility(atr: TechnicalIndicator[], currentPrice: number): 'low' | 'medium' | 'high' {
    const currentATR = atr[atr.length - 1]?.value || 0;
    const atrPercent = (currentATR / currentPrice) * 100;

    if (atrPercent > 1.5) return 'high';
    if (atrPercent > 0.8) return 'medium';
    return 'low';
  }

  static isSessionActive(): boolean {
    const now = new Date();
    const hour = now.getUTCHours();
    
    // London session: 08:00-17:00 UTC
    const londonSession = hour >= 8 && hour <= 17;
    // New York session: 13:00-22:00 UTC
    const nySession = hour >= 13 && hour <= 22;
    // Tokyo session: 00:00-09:00 UTC
    const tokyoSession = hour >= 0 && hour <= 9;

    return londonSession || nySession || tokyoSession;
  }

  static detectCrossover(current: number[], previous: number[]): 'bullish' | 'bearish' | 'none' {
    if (current.length < 2 || previous.length < 2) return 'none';
    
    const currFast = current[0];
    const currSlow = current[1];
    const prevFast = previous[0];
    const prevSlow = previous[1];

    if (prevFast <= prevSlow && currFast > currSlow) return 'bullish';
    if (prevFast >= prevSlow && currFast < currSlow) return 'bearish';
    return 'none';
  }
}
