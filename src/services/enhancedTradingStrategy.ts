
import { CandlestickData } from './forexService';
import { AnalysisResult } from './technicalAnalysis';
import { AdvancedAnalysisResult, AdvancedTechnicalAnalysis } from './advancedTechnicalAnalysis';

export type EnhancedSignalType = 'STRONG_BUY' | 'BUY' | 'WEAK_BUY' | 'HOLD' | 'WEAK_SELL' | 'SELL' | 'STRONG_SELL';

export interface FairValueGap {
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  index: number;
  filled: boolean;
  strength: number;
}

export interface OrderBlock {
  type: 'demand' | 'supply';
  high: number;
  low: number;
  volume: number;
  index: number;
  tested: boolean;
  strength: number;
}

export interface LiquidityZone {
  type: 'buy_liquidity' | 'sell_liquidity';
  price: number;
  strength: number;
  index: number;
  swept: boolean;
}

export interface EnhancedTradingSignal {
  signal: EnhancedSignalType;
  confidence: number;
  timestamp: string;
  price: number;
  reasons: string[];
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  riskReward?: number;
  marketRegime: 'trending' | 'ranging';
  sessionActive: boolean;
  confluenceScore: number;
  fairValueGaps: FairValueGap[];
  orderBlocks: OrderBlock[];
  liquidityZones: LiquidityZone[];
  volumeProfile: 'high' | 'medium' | 'low';
  microstructure: 'bullish' | 'bearish' | 'neutral';
}

export interface EnhancedStrategyConfig {
  riskPercentage: number;
  atrMultiplierSL: number;
  atrMultiplierTP: number;
  minConfidence: number;
  minADX: number;
  maxSpread: number;
  useTrailingStop: boolean;
  fvgMinSize: number;
  orderBlockMinVolume: number;
  liquidityThreshold: number;
}

export class EnhancedTradingStrategy {
  private config: EnhancedStrategyConfig;

  constructor(config: EnhancedStrategyConfig = {
    riskPercentage: 1,
    atrMultiplierSL: 1.2,
    atrMultiplierTP: 2.0,
    minConfidence: 65, // Reduced from 85
    minADX: 10, // Reduced from 15
    maxSpread: 3,
    useTrailingStop: true,
    fvgMinSize: 0.0002, // Reduced to catch smaller gaps
    orderBlockMinVolume: 1.2, // Reduced from 1.5
    liquidityThreshold: 0.6 // Reduced from 0.8
  }) {
    this.config = config;
  }

  generateEnhancedSignal(
    data: CandlestickData[], 
    analysis: AnalysisResult,
    advancedAnalysis: AdvancedAnalysisResult
  ): EnhancedTradingSignal {
    const currentPrice = data[data.length - 1].close;
    const timestamp = data[data.length - 1].timestamp;
    const atr = advancedAnalysis.atr[advancedAnalysis.atr.length - 1]?.value || 0.001;
    
    // Smart Money Concepts with relaxed parameters
    const fairValueGaps = this.identifyFairValueGaps(data);
    const orderBlocks = this.identifyOrderBlocks(data);
    const liquidityZones = this.identifyLiquidityZones(data);
    const volumeProfile = this.analyzeVolumeProfile(data);
    const microstructure = this.analyzeMarketMicrostructure(data, fairValueGaps, orderBlocks);
    
    const confluenceAnalysis = this.analyzeAdvancedConfluence(
      data, analysis, advancedAnalysis, currentPrice, 
      fairValueGaps, orderBlocks, liquidityZones, volumeProfile, microstructure
    );
    
    const signal = this.determineSmartMoneySignal(confluenceAnalysis, advancedAnalysis, microstructure);
    
    const stopLoss = this.calculateSmartStopLoss(currentPrice, atr, signal, orderBlocks, liquidityZones);
    const takeProfit = this.calculateSmartTakeProfit(currentPrice, atr, signal, fairValueGaps, liquidityZones);
    const trailingStop = this.config.useTrailingStop ? atr * 0.6 : undefined;

    return {
      signal,
      confidence: confluenceAnalysis.confidence,
      timestamp,
      price: currentPrice,
      reasons: confluenceAnalysis.reasons,
      stopLoss,
      takeProfit,
      trailingStop,
      riskReward: takeProfit && stopLoss ? Math.abs(takeProfit - currentPrice) / Math.abs(currentPrice - stopLoss) : undefined,
      marketRegime: advancedAnalysis.marketRegime,
      sessionActive: advancedAnalysis.sessionFilter,
      confluenceScore: confluenceAnalysis.confluenceScore,
      fairValueGaps,
      orderBlocks,
      liquidityZones,
      volumeProfile,
      microstructure
    };
  }

  private identifyFairValueGaps(data: CandlestickData[]): FairValueGap[] {
    const gaps: FairValueGap[] = [];
    
    for (let i = 2; i < data.length - 1; i++) {
      const prev = data[i - 1];
      const current = data[i];
      const next = data[i + 1];
      
      // Bullish FVG: Previous candle low > Next candle high
      if (prev.low > next.high) {
        const gapSize = prev.low - next.high;
        if (gapSize >= this.config.fvgMinSize) {
          gaps.push({
            type: 'bullish',
            high: prev.low,
            low: next.high,
            index: i,
            filled: false,
            strength: gapSize / prev.close * 10000
          });
        }
      }
      
      // Bearish FVG: Previous candle high < Next candle low
      if (prev.high < next.low) {
        const gapSize = next.low - prev.high;
        if (gapSize >= this.config.fvgMinSize) {
          gaps.push({
            type: 'bearish',
            high: next.low,
            low: prev.high,
            index: i,
            filled: false,
            strength: gapSize / prev.close * 10000
          });
        }
      }
    }
    
    // Check if gaps are filled
    for (const gap of gaps) {
      for (let j = gap.index + 1; j < data.length; j++) {
        if (gap.type === 'bullish' && data[j].low <= gap.low) {
          gap.filled = true;
          break;
        }
        if (gap.type === 'bearish' && data[j].high >= gap.high) {
          gap.filled = true;
          break;
        }
      }
    }
    
    return gaps.slice(-8); // Keep last 8 gaps
  }

  private identifyOrderBlocks(data: CandlestickData[]): OrderBlock[] {
    const blocks: OrderBlock[] = [];
    
    for (let i = 3; i < data.length - 3; i++) {
      const candle = data[i];
      const volume = candle.volume || 1;
      const avgVolume = data.slice(Math.max(0, i - 5), i).reduce((sum, c) => sum + (c.volume || 1), 0) / 5;
      
      // More lenient volume requirement
      if (volume > avgVolume * this.config.orderBlockMinVolume) {
        const bodySize = Math.abs(candle.close - candle.open);
        const candleRange = candle.high - candle.low;
        
        // Bullish order block (demand zone) - more lenient body requirement
        if (candle.close > candle.open && bodySize > candleRange * 0.5) {
          let tested = false;
          for (let j = i + 1; j < data.length; j++) {
            if (data[j].low <= candle.high && data[j].low >= candle.low) {
              tested = true;
              break;
            }
          }
          
          blocks.push({
            type: 'demand',
            high: candle.high,
            low: candle.low,
            volume,
            index: i,
            tested,
            strength: (volume / avgVolume) * (bodySize / candleRange)
          });
        }
        
        // Bearish order block (supply zone)
        if (candle.close < candle.open && bodySize > candleRange * 0.5) {
          let tested = false;
          for (let j = i + 1; j < data.length; j++) {
            if (data[j].high >= candle.low && data[j].high <= candle.high) {
              tested = true;
              break;
            }
          }
          
          blocks.push({
            type: 'supply',
            high: candle.high,
            low: candle.low,
            volume,
            index: i,
            tested,
            strength: (volume / avgVolume) * (bodySize / candleRange)
          });
        }
      }
    }
    
    return blocks.slice(-6);
  }

  private identifyLiquidityZones(data: CandlestickData[]): LiquidityZone[] {
    const zones: LiquidityZone[] = [];
    
    // Find swing highs and lows with shorter lookback
    for (let i = 3; i < data.length - 3; i++) {
      const candle = data[i];
      const leftCandles = data.slice(i - 3, i);
      const rightCandles = data.slice(i + 1, i + 4);
      
      // Swing high
      const isSwingHigh = leftCandles.every(c => c.high < candle.high) && 
                         rightCandles.every(c => c.high < candle.high);
      
      if (isSwingHigh) {
        let swept = false;
        for (let j = i + 1; j < data.length; j++) {
          if (data[j].high > candle.high) {
            swept = true;
            break;
          }
        }
        
        zones.push({
          type: 'sell_liquidity',
          price: candle.high,
          strength: this.calculateLiquidityStrength(data, i, 'high'),
          index: i,
          swept
        });
      }
      
      // Swing low
      const isSwingLow = leftCandles.every(c => c.low > candle.low) && 
                        rightCandles.every(c => c.low > candle.low);
      
      if (isSwingLow) {
        let swept = false;
        for (let j = i + 1; j < data.length; j++) {
          if (data[j].low < candle.low) {
            swept = true;
            break;
          }
        }
        
        zones.push({
          type: 'buy_liquidity',
          price: candle.low,
          strength: this.calculateLiquidityStrength(data, i, 'low'),
          index: i,
          swept
        });
      }
    }
    
    return zones.slice(-8);
  }

  private calculateLiquidityStrength(data: CandlestickData[], index: number, type: 'high' | 'low'): number {
    const candle = data[index];
    const volume = candle.volume || 1;
    const avgVolume = data.slice(Math.max(0, index - 5), index).reduce((sum, c) => sum + (c.volume || 1), 0) / 5;
    
    let touchCount = 0;
    const targetPrice = type === 'high' ? candle.high : candle.low;
    
    for (let i = Math.max(0, index - 10); i < Math.min(data.length, index + 10); i++) {
      if (i === index) continue;
      
      const tolerance = targetPrice * 0.0002; // 2 pip tolerance
      if (type === 'high' && Math.abs(data[i].high - targetPrice) <= tolerance) {
        touchCount++;
      } else if (type === 'low' && Math.abs(data[i].low - targetPrice) <= tolerance) {
        touchCount++;
      }
    }
    
    return (volume / avgVolume) + (touchCount * 0.3);
  }

  private analyzeVolumeProfile(data: CandlestickData[]): 'high' | 'medium' | 'low' {
    const recentData = data.slice(-10);
    const currentVolume = recentData[recentData.length - 1]?.volume || 1;
    const avgVolume = recentData.reduce((sum, c) => sum + (c.volume || 1), 0) / recentData.length;
    
    if (currentVolume > avgVolume * 1.3) return 'high';
    if (currentVolume > avgVolume * 0.7) return 'medium';
    return 'low';
  }

  private analyzeMarketMicrostructure(
    data: CandlestickData[], 
    fvgs: FairValueGap[], 
    orderBlocks: OrderBlock[]
  ): 'bullish' | 'bearish' | 'neutral' {
    const recentData = data.slice(-5);
    const currentPrice = data[data.length - 1].close;
    
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    // Price action analysis
    const higherHighs = this.countHigherHighs(recentData);
    const lowerLows = this.countLowerLows(recentData);
    
    if (higherHighs > lowerLows) bullishSignals += 1;
    else if (lowerLows > higherHighs) bearishSignals += 1;
    
    // FVG analysis
    const bullishFVGs = fvgs.filter(g => g.type === 'bullish' && !g.filled && currentPrice > g.low).length;
    const bearishFVGs = fvgs.filter(g => g.type === 'bearish' && !g.filled && currentPrice < g.high).length;
    
    bullishSignals += bullishFVGs;
    bearishSignals += bearishFVGs;
    
    // Order block analysis
    const demandBlocks = orderBlocks.filter(b => b.type === 'demand' && !b.tested && currentPrice > b.low).length;
    const supplyBlocks = orderBlocks.filter(b => b.type === 'supply' && !b.tested && currentPrice < b.high).length;
    
    bullishSignals += demandBlocks;
    bearishSignals += supplyBlocks;
    
    if (bullishSignals > bearishSignals) return 'bullish';
    if (bearishSignals > bullishSignals) return 'bearish';
    return 'neutral';
  }

  private countHigherHighs(data: CandlestickData[]): number {
    let count = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i].high > data[i - 1].high) count++;
    }
    return count;
  }

  private countLowerLows(data: CandlestickData[]): number {
    let count = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i].low < data[i - 1].low) count++;
    }
    return count;
  }

  private analyzeAdvancedConfluence(
    data: CandlestickData[], 
    analysis: AnalysisResult, 
    advancedAnalysis: AdvancedAnalysisResult,
    currentPrice: number,
    fvgs: FairValueGap[],
    orderBlocks: OrderBlock[],
    liquidityZones: LiquidityZone[],
    volumeProfile: string,
    microstructure: string
  ) {
    const signals = {
      bullish: 0,
      bearish: 0,
      reasons: [] as string[],
      confluenceScore: 0
    };

    // Traditional technical analysis (higher weight)
    const rsi = analysis.rsi[analysis.rsi.length - 1]?.value;
    if (rsi) {
      if (rsi < 30) {
        signals.bullish += 4;
        signals.confluenceScore += 4;
        signals.reasons.push(`RSI oversold: ${rsi.toFixed(1)}`);
      } else if (rsi > 70) {
        signals.bearish += 4;
        signals.confluenceScore += 4;
        signals.reasons.push(`RSI overbought: ${rsi.toFixed(1)}`);
      } else if (rsi < 40) {
        signals.bullish += 2;
        signals.confluenceScore += 2;
        signals.reasons.push(`RSI bullish: ${rsi.toFixed(1)}`);
      } else if (rsi > 60) {
        signals.bearish += 2;
        signals.confluenceScore += 2;
        signals.reasons.push(`RSI bearish: ${rsi.toFixed(1)}`);
      }
    }

    // MACD signals (higher weight)
    const macdHist = analysis.macd.histogram[analysis.macd.histogram.length - 1]?.value;
    const prevMACDHist = analysis.macd.histogram[analysis.macd.histogram.length - 2]?.value;

    if (macdHist && prevMACDHist) {
      if (prevMACDHist <= 0 && macdHist > 0) {
        signals.bullish += 5;
        signals.confluenceScore += 5;
        signals.reasons.push('MACD bullish crossover');
      } else if (prevMACDHist >= 0 && macdHist < 0) {
        signals.bearish += 5;
        signals.confluenceScore += 5;
        signals.reasons.push('MACD bearish crossover');
      } else if (macdHist > 0) {
        signals.bullish += 2;
        signals.confluenceScore += 2;
        signals.reasons.push('MACD above zero');
      } else if (macdHist < 0) {
        signals.bearish += 2;
        signals.confluenceScore += 2;
        signals.reasons.push('MACD below zero');
      }
    }

    // EMA trend
    const ema12 = analysis.ema12[analysis.ema12.length - 1]?.value;
    const ema26 = analysis.ema26[analysis.ema26.length - 1]?.value;

    if (ema12 && ema26) {
      if (ema12 > ema26 && currentPrice > ema12) {
        signals.bullish += 3;
        signals.confluenceScore += 3;
        signals.reasons.push('Bullish EMA trend');
      } else if (ema12 < ema26 && currentPrice < ema12) {
        signals.bearish += 3;
        signals.confluenceScore += 3;
        signals.reasons.push('Bearish EMA trend');
      }
    }

    // Smart Money Concepts (reduced weight but still important)
    const nearBullishFVG = fvgs.find(g => 
      g.type === 'bullish' && !g.filled && 
      currentPrice >= g.low * 0.998 && currentPrice <= g.high * 1.002
    );
    
    const nearBearishFVG = fvgs.find(g => 
      g.type === 'bearish' && !g.filled && 
      currentPrice <= g.high * 1.002 && currentPrice >= g.low * 0.998
    );

    if (nearBullishFVG) {
      signals.bullish += 3;
      signals.confluenceScore += 3;
      signals.reasons.push(`Near bullish FVG (${nearBullishFVG.strength.toFixed(1)} pips)`);
    }

    if (nearBearishFVG) {
      signals.bearish += 3;
      signals.confluenceScore += 3;
      signals.reasons.push(`Near bearish FVG (${nearBearishFVG.strength.toFixed(1)} pips)`);
    }

    // Order Block Analysis
    const nearDemandBlock = orderBlocks.find(b => 
      b.type === 'demand' && !b.tested &&
      currentPrice >= b.low * 0.998 && currentPrice <= b.high * 1.002
    );

    const nearSupplyBlock = orderBlocks.find(b => 
      b.type === 'supply' && !b.tested &&
      currentPrice >= b.low * 0.998 && currentPrice <= b.high * 1.002
    );

    if (nearDemandBlock) {
      signals.bullish += 3;
      signals.confluenceScore += 3;
      signals.reasons.push(`Near demand block (strength: ${nearDemandBlock.strength.toFixed(1)})`);
    }

    if (nearSupplyBlock) {
      signals.bearish += 3;
      signals.confluenceScore += 3;
      signals.reasons.push(`Near supply block (strength: ${nearSupplyBlock.strength.toFixed(1)})`);
    }

    // Market microstructure
    if (microstructure === 'bullish') {
      signals.bullish += 2;
      signals.confluenceScore += 2;
      signals.reasons.push('Bullish market structure');
    } else if (microstructure === 'bearish') {
      signals.bearish += 2;
      signals.confluenceScore += 2;
      signals.reasons.push('Bearish market structure');
    }

    // Volume confirmation
    if (volumeProfile === 'high') {
      signals.confluenceScore += 2;
      signals.reasons.push('High volume confirmation');
    }

    // Session filter (reduced penalty)
    if (!advancedAnalysis.sessionFilter) {
      signals.confluenceScore -= 1;
      signals.reasons.push('Outside major sessions');
    } else {
      signals.confluenceScore += 1;
      signals.reasons.push('Active trading session');
    }

    const totalSignals = signals.bullish + signals.bearish;
    let confidence = totalSignals > 0 ? (Math.max(signals.bullish, signals.bearish) / totalSignals) * 100 : 50;
    
    // More balanced confidence calculation
    const confluenceBoost = Math.min(signals.confluenceScore * 2, 25);
    confidence = Math.min(confidence + confluenceBoost, 95);

    // Ensure minimum confidence for any signal
    if (signals.confluenceScore >= 5) {
      confidence = Math.max(confidence, 60);
    }

    return {
      bullish: signals.bullish,
      bearish: signals.bearish,
      confidence,
      reasons: signals.reasons,
      confluenceScore: signals.confluenceScore
    };
  }

  private determineSmartMoneySignal(
    confluenceAnalysis: any,
    advancedAnalysis: AdvancedAnalysisResult,
    microstructure: string
  ): EnhancedSignalType {
    const { bullish, bearish, confidence, confluenceScore } = confluenceAnalysis;
    
    // Much more lenient thresholds
    if (confidence < this.config.minConfidence) {
      return 'HOLD';
    }

    // Lower confluence requirement
    if (confluenceScore < 4) {
      return 'HOLD';
    }

    const signalStrength = Math.abs(bullish - bearish);
    const isVeryStrongSignal = confluenceScore >= 12 && signalStrength >= 6 && confidence >= 85;
    const isStrongSignal = confluenceScore >= 8 && signalStrength >= 4 && confidence >= 75;

    if (bullish > bearish) {
      if (isVeryStrongSignal) return 'STRONG_BUY';
      if (isStrongSignal) return 'BUY';
      return 'WEAK_BUY';
    } else if (bearish > bullish) {
      if (isVeryStrongSignal) return 'STRONG_SELL';
      if (isStrongSignal) return 'SELL';
      return 'WEAK_SELL';
    }

    return 'HOLD';
  }

  private calculateSmartStopLoss(
    currentPrice: number, 
    atr: number, 
    signal: EnhancedSignalType,
    orderBlocks: OrderBlock[],
    liquidityZones: LiquidityZone[]
  ): number | undefined {
    if (signal === 'HOLD') return undefined;

    const isBuy = signal.includes('BUY');
    let stopLoss: number;

    if (isBuy) {
      const relevantBlock = orderBlocks
        .filter(b => b.type === 'demand' && b.high < currentPrice)
        .sort((a, b) => b.high - a.high)[0];

      if (relevantBlock) {
        stopLoss = relevantBlock.low - (atr * 0.3);
      } else {
        stopLoss = currentPrice - (atr * this.config.atrMultiplierSL);
      }
    } else {
      const relevantBlock = orderBlocks
        .filter(b => b.type === 'supply' && b.low > currentPrice)
        .sort((a, b) => a.low - b.low)[0];

      if (relevantBlock) {
        stopLoss = relevantBlock.high + (atr * 0.3);
      } else {
        stopLoss = currentPrice + (atr * this.config.atrMultiplierSL);
      }
    }

    return stopLoss;
  }

  private calculateSmartTakeProfit(
    currentPrice: number, 
    atr: number, 
    signal: EnhancedSignalType,
    fvgs: FairValueGap[],
    liquidityZones: LiquidityZone[]
  ): number | undefined {
    if (signal === 'HOLD') return undefined;

    const isBuy = signal.includes('BUY');
    let takeProfit: number;

    if (isBuy) {
      const targetFVG = fvgs
        .filter(g => g.type === 'bearish' && !g.filled && g.low > currentPrice)
        .sort((a, b) => a.low - b.low)[0];

      const targetLiquidity = liquidityZones
        .filter(z => z.type === 'sell_liquidity' && !z.swept && z.price > currentPrice)
        .sort((a, b) => a.price - b.price)[0];

      if (targetFVG && (!targetLiquidity || targetFVG.low < targetLiquidity.price)) {
        takeProfit = targetFVG.low;
      } else if (targetLiquidity) {
        takeProfit = targetLiquidity.price;
      } else {
        const multiplier = signal.includes('STRONG') ? 2.5 : 2.0;
        takeProfit = currentPrice + (atr * multiplier);
      }
    } else {
      const targetFVG = fvgs
        .filter(g => g.type === 'bullish' && !g.filled && g.high < currentPrice)
        .sort((a, b) => b.high - a.high)[0];

      const targetLiquidity = liquidityZones
        .filter(z => z.type === 'buy_liquidity' && !z.swept && z.price < currentPrice)
        .sort((a, b) => b.price - a.price)[0];

      if (targetFVG && (!targetLiquidity || targetFVG.high > targetLiquidity.price)) {
        takeProfit = targetFVG.high;
      } else if (targetLiquidity) {
        takeProfit = targetLiquidity.price;
      } else {
        const multiplier = signal.includes('STRONG') ? 2.5 : 2.0;
        takeProfit = currentPrice - (atr * multiplier);
      }
    }

    return takeProfit;
  }

  generateAdvancedPineScript(): string {
    return `//@version=5
strategy("Advanced Smart Money Concept Strategy v5", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=1, commission_type=strategy.commission.percent, commission_value=0.1)

// Strategy Configuration - Refined Parameters
min_confidence = input.int(70, title="Minimum Confidence %", minval=60, maxval=90, tooltip="Minimum confidence required for a signal to be valid")
min_confluence = input.int(5, title="Minimum Confluence Score", minval=3, maxval=15, tooltip="Minimum number of confirming factors required")
atr_length = input.int(14, title="ATR Length", minval=7, maxval=21)
atr_sl_mult = input.float(1.0, title="ATR Stop Loss Multiplier", minval=0.5, maxval=1.5, step=0.1)
atr_tp_mult = input.float(2.5, title="ATR Take Profit Multiplier", minval=1.5, maxval=4.0, step=0.1)
risk_reward_min = input.float(1.5, title="Minimum Risk-Reward Ratio", minval=1.2, maxval=3.0, step=0.1)
max_trades_per_day = input.int(2, title="Maximum Trades Per Day", minval=1, maxval=5)

// Fair Value Gap Settings
fvg_lookback = input.int(10, title="FVG Lookback Bars", minval=3, maxval=20)
fvg_min_size = input.float(0.0003, title="FVG Minimum Size", minval=0.0001, maxval=0.001, step=0.0001)
fvg_valid_time = input.int(50, title="FVG Valid Bars", minval=10, maxval=100)

// Order Block Settings
ob_lookback = input.int(20, title="Order Block Lookback", minval=5, maxval=50)
ob_min_volume = input.float(1.5, title="OB Min Volume Multiplier", minval=1.1, maxval=3.0, step=0.1)
ob_min_body_percent = input.float(60, title="OB Min Body %", minval=50, maxval=80)

// Market Structure Settings
ms_pivot_length = input.int(5, title="Market Structure Pivot Length", minval=3, maxval=10)
use_smart_money_concepts = input.bool(true, title="Use Smart Money Concepts")
use_market_structure = input.bool(true, title="Use Market Structure Analysis")
use_liquidity_analysis = input.bool(true, title="Use Liquidity Analysis")

// Advanced Filtering
use_session_filter = input.bool(true, title="Use Session Filters")
use_trend_filter = input.bool(true, title="Use Trend Filter")
use_volatility_filter = input.bool(true, title="Use Volatility Filter")
reduce_noise = input.bool(true, title="Reduce Noise (Higher Quality Signals)")
confirm_bos = input.bool(true, title="Confirm Breakout of Structure")

// Advanced Session Filters
london_session = input.bool(true, title="Trade London Session")
ny_session = input.bool(true, title="Trade NY Session") 
asian_session = input.bool(false, title="Trade Asian Session")
avoid_news = input.bool(true, title="Avoid High Impact News Periods")

// High-quality session filtering
london_time = time(timeframe.period, "0730-1600", "GMT")
ny_time = time(timeframe.period, "1300-2000", "GMT")
asian_time = time(timeframe.period, "2300-0800", "GMT")
optimal_fx_time = time(timeframe.period, "0800-1600", "GMT") // London-NY overlap
session_filter = not use_session_filter or 
                 (london_session and not na(london_time)) or 
                 (ny_session and not na(ny_time)) or
                 (asian_session and not na(asian_time))

// High-quality overlap identification
major_session_overlap = london_session and ny_session and not na(optimal_fx_time)
high_quality_time = major_session_overlap

// Technical Indicators - Core
ema12 = ta.ema(close, 12)
ema26 = ta.ema(close, 26)
ema50 = ta.ema(close, 50)
ema200 = ta.ema(close, 200)
rsi = ta.rsi(close, 14)
[macd_line, signal_line, macd_hist] = ta.macd(close, 12, 26, 9)
atr_value = ta.atr(atr_length)

// Volatility Analysis
atr_percent = atr_value / close * 100
high_volatility = atr_percent > ta.sma(atr_percent, 20) * 1.2
low_volatility = atr_percent < ta.sma(atr_percent, 20) * 0.8
volatility_filter = not use_volatility_filter or not high_volatility

// Trend Analysis - Multi-timeframe
higher_tf_bullish = request.security(syminfo.tickerid, timeframe.multiply(timeframe.period, 4), ema50 > ema200 and close > ema50)
higher_tf_bearish = request.security(syminfo.tickerid, timeframe.multiply(timeframe.period, 4), ema50 < ema200 and close < ema50)
trend_filter = not use_trend_filter or (higher_tf_bullish and ema12 > ema26) or (higher_tf_bearish and ema12 < ema26)

// Advanced Volume Analysis
vol_sma = ta.sma(volume, 10)
vol_std = ta.stdev(volume, 20)
high_volume = volume > vol_sma + vol_std
very_high_volume = volume > vol_sma + (vol_std * 1.5)
decreasing_volume = volume < volume[1] and volume[1] < volume[2]
increasing_volume = volume > volume[1] and volume[1] > volume[2]

// ===== ADVANCED SMART MONEY CONCEPTS =====

// 1. Enhanced Fair Value Gap Detection with Mitigation Tracking
// FVGs represent institutional order blocks and are key SMC elements
detect_advanced_fvg(lookback, min_size) =>
    var bull_fvgs = array.new_float(0)  // [price, bar_idx, status]
    var bear_fvgs = array.new_float(0)
    
    // Detect new FVGs
    for i = 1 to math.min(lookback, bar_index)
        if low[i] > high[i+1] and (low[i] - high[i+1]) >= min_size
            array.push(bull_fvgs, low[i])       // price
            array.push(bull_fvgs, bar_index-i)  // bar created
            array.push(bull_fvgs, 0)            // 0=active, 1=filled
    
        if high[i] < low[i+1] and (low[i+1] - high[i]) >= min_size
            array.push(bear_fvgs, high[i])      // price
            array.push(bear_fvgs, bar_index-i)  // bar created
            array.push(bear_fvgs, 0)            // 0=active, 1=filled
    
    // Check for FVG mitigation
    if array.size(bull_fvgs) > 0
        for i = 0 to array.size(bull_fvgs) / 3 - 1
            idx = i * 3
            if array.get(bull_fvgs, idx+2) == 0 and low <= array.get(bull_fvgs, idx) 
                array.set(bull_fvgs, idx+2, 1)  // Mark as filled
    
    if array.size(bear_fvgs) > 0
        for i = 0 to array.size(bear_fvgs) / 3 - 1
            idx = i * 3
            if array.get(bear_fvgs, idx+2) == 0 and high >= array.get(bear_fvgs, idx)
                array.set(bear_fvgs, idx+2, 1)  // Mark as filled
    
    // Remove old FVGs (beyond valid time)
    if array.size(bull_fvgs) > 0
        i = 0
        while i < array.size(bull_fvgs) / 3
            idx = i * 3
            if bar_index - array.get(bull_fvgs, idx+1) > fvg_valid_time
                array.remove(bull_fvgs, idx)
                array.remove(bull_fvgs, idx)
                array.remove(bull_fvgs, idx)
            else
                i += 1
    
    if array.size(bear_fvgs) > 0
        i = 0
        while i < array.size(bear_fvgs) / 3
            idx = i * 3
            if bar_index - array.get(bear_fvgs, idx+1) > fvg_valid_time
                array.remove(bear_fvgs, idx)
                array.remove(bear_fvgs, idx)
                array.remove(bear_fvgs, idx)
            else
                i += 1
    
    // Find closest active FVGs
    float bull_fvg_price = na
    float bear_fvg_price = na
    float bull_fvg_distance = 999999
    float bear_fvg_distance = 999999
    bool recent_bull_fvg = false
    bool recent_bear_fvg = false
    
    if array.size(bull_fvgs) > 0
        for i = 0 to array.size(bull_fvgs) / 3 - 1
            idx = i * 3
            if array.get(bull_fvgs, idx+2) == 0  // If active
                price_diff = math.abs(close - array.get(bull_fvgs, idx))
                if price_diff < bull_fvg_distance
                    bull_fvg_distance = price_diff
                    bull_fvg_price = array.get(bull_fvgs, idx)
                    recent_bull_fvg = bar_index - array.get(bull_fvgs, idx+1) < 5
    
    if array.size(bear_fvgs) > 0
        for i = 0 to array.size(bear_fvgs) / 3 - 1
            idx = i * 3
            if array.get(bear_fvgs, idx+2) == 0  // If active
                price_diff = math.abs(close - array.get(bear_fvgs, idx))
                if price_diff < bear_fvg_distance
                    bear_fvg_distance = price_diff
                    bear_fvg_price = array.get(bear_fvgs, idx)
                    recent_bear_fvg = bar_index - array.get(bear_fvgs, idx+1) < 5
    
    [bull_fvg_price, bear_fvg_price, recent_bull_fvg, recent_bear_fvg]

// 2. Premium Order Block Detection with Volume Confirmation
// Order blocks represent strong institutional entries and represent high-probability reversal zones
detect_premium_ob(lookback) =>
    var ob_demand_zones = array.new_float(0)  // [high, low, strength]
    var ob_supply_zones = array.new_float(0)  // [high, low, strength]
    
    // Detect new order blocks
    for i = 1 to math.min(lookback, bar_index - 1)
        body_size = math.abs(close[i] - open[i])
        candle_range = high[i] - low[i]
        body_percent = body_size / candle_range * 100
        
        // Premium demand OB: Strong bullish candle followed by bearish move
        if close[i] > open[i] and body_percent >= ob_min_body_percent and 
           volume[i] > vol_sma[i] * ob_min_volume and
           low[i-1] < low[i]  // Preceding bearish move
            
            // Check if price moved away significantly after this candle
            if low < low[i]
                array.push(ob_demand_zones, high[i])
                array.push(ob_demand_zones, low[i])
                array.push(ob_demand_zones, body_percent * (volume[i] / vol_sma[i]))  // Strength metric
        
        // Premium supply OB: Strong bearish candle followed by bullish move
        if close[i] < open[i] and body_percent >= ob_min_body_percent and 
           volume[i] > vol_sma[i] * ob_min_volume and
           high[i-1] > high[i]  // Preceding bullish move
            
            // Check if price moved away significantly after this candle
            if high > high[i]
                array.push(ob_supply_zones, high[i])
                array.push(ob_supply_zones, low[i])
                array.push(ob_supply_zones, body_percent * (volume[i] / vol_sma[i]))  // Strength metric
    
    // Determine if we're near a premium order block
    float demand_ob_high = na
    float demand_ob_low = na
    float supply_ob_high = na
    float supply_ob_low = na
    float demand_strength = 0
    float supply_strength = 0
    
    if array.size(ob_demand_zones) > 0
        for i = 0 to array.size(ob_demand_zones) / 3 - 1
            idx = i * 3
            ob_high = array.get(ob_demand_zones, idx)
            ob_low = array.get(ob_demand_zones, idx+1)
            strength = array.get(ob_demand_zones, idx+2)
            
            if low <= ob_high and low >= ob_low and strength > demand_strength
                demand_ob_high = ob_high
                demand_ob_low = ob_low
                demand_strength = strength
    
    if array.size(ob_supply_zones) > 0
        for i = 0 to array.size(ob_supply_zones) / 3 - 1
            idx = i * 3
            ob_high = array.get(ob_supply_zones, idx)
            ob_low = array.get(ob_supply_zones, idx+1)
            strength = array.get(ob_supply_zones, idx+2)
            
            if high >= ob_low and high <= ob_high and strength > supply_strength
                supply_ob_high = ob_high
                supply_ob_low = ob_low
                supply_strength = strength
    
    [demand_ob_high, demand_ob_low, supply_ob_high, supply_ob_low, demand_strength > 0, supply_strength > 0]

// 3. Advanced Market Structure Analysis
// Market structure shifts are critical for identifying trends and reversals
detect_market_structure() =>
    // Higher timeframe structure
    var bullish_structure = false
    var bearish_structure = false
    var last_swing_high = 0.0
    var last_swing_low = 0.0
    var higher_highs = 0
    var higher_lows = 0
    var lower_highs = 0
    var lower_lows = 0
    
    // Detect swings using pivot points
    swing_high = ta.pivothigh(high, ms_pivot_length, ms_pivot_length)
    swing_low = ta.pivotlow(low, ms_pivot_length, ms_pivot_length)
    
    if not na(swing_high)
        if swing_high > last_swing_high and last_swing_high > 0
            higher_highs := higher_highs + 1
            lower_highs := 0
        else if swing_high < last_swing_high and last_swing_high > 0
            lower_highs := lower_highs + 1
            higher_highs := 0
        last_swing_high := swing_high
    
    if not na(swing_low)
        if swing_low > last_swing_low and last_swing_low > 0
            higher_lows := higher_lows + 1
            lower_lows := 0
        else if swing_low < last_swing_low and last_swing_low > 0
            lower_lows := lower_lows + 1
            higher_lows := 0
        last_swing_low := swing_low
    
    // Structure change detection
    bullish_structure := higher_highs >= 1 and higher_lows >= 1
    bearish_structure := lower_highs >= 1 and lower_lows >= 1
    
    // Breakout of structure (BOS)
    bullish_bos = not na(swing_low) and close > last_swing_high and not bullish_structure
    bearish_bos = not na(swing_high) and close < last_swing_low and not bearish_structure
    
    // Change of character (CHoCH)
    bullish_choch = bullish_structure and not na(swing_low) and close < last_swing_low and higher_lows > 1
    bearish_choch = bearish_structure and not na(swing_high) and close > last_swing_high and lower_highs > 1
    
    [bullish_structure, bearish_structure, bullish_bos, bearish_bos, bullish_choch, bearish_choch]

// 4. Liquidity Analysis (Institutional Stop Hunting)
// Liquidity analysis helps identify where institutional traders might push price to trigger retail stops
detect_liquidity_zones() =>
    var liquidity_highs = array.new_float(0)  // [price, strength, swept]
    var liquidity_lows = array.new_float(0)   // [price, strength, swept]
    
    // Detect swing point clusters that indicate liquidity
    if not na(swing_high)
        // Check for clustered highs (indicating stop placement)
        high_cluster = false
        for i = 1 to 5
            if math.abs(high[i] - swing_high) < atr_value * 0.5
                high_cluster := true
        
        if high_cluster
            array.push(liquidity_highs, swing_high)
            array.push(liquidity_highs, 1.0)  // Strength
            array.push(liquidity_highs, 0.0)  // 0=not swept, 1=swept
    
    if not na(swing_low)
        // Check for clustered lows (indicating stop placement)
        low_cluster = false
        for i = 1 to 5
            if math.abs(low[i] - swing_low) < atr_value * 0.5
                low_cluster := true
        
        if low_cluster
            array.push(liquidity_lows, swing_low)
            array.push(liquidity_lows, 1.0)  // Strength
            array.push(liquidity_lows, 0.0)  // 0=not swept, 1=swept
    
    // Check for liquidity sweeps
    if array.size(liquidity_highs) > 0
        for i = 0 to array.size(liquidity_highs) / 3 - 1
            idx = i * 3
            liq_price = array.get(liquidity_highs, idx)
            if high >= liq_price and array.get(liquidity_highs, idx+2) == 0
                array.set(liquidity_highs, idx+2, 1.0)  // Mark as swept
    
    if array.size(liquidity_lows) > 0
        for i = 0 to array.size(liquidity_lows) / 3 - 1
            idx = i * 3
            liq_price = array.get(liquidity_lows, idx)
            if low <= liq_price and array.get(liquidity_lows, idx+2) == 0
                array.set(liquidity_lows, idx+2, 1.0)  // Mark as swept
    
    // Look for recent liquidity sweeps followed by rejection
    recent_high_sweep = false
    recent_low_sweep = false
    
    if array.size(liquidity_highs) > 0
        for i = 0 to array.size(liquidity_highs) / 3 - 1
            idx = i * 3
            if array.get(liquidity_highs, idx+2) == 1.0  // If swept
                sweep_bar = bar_index - array.get(liquidity_highs, idx+1)
                if sweep_bar <= 3 and close < array.get(liquidity_highs, idx)
                    recent_high_sweep := true
    
    if array.size(liquidity_lows) > 0
        for i = 0 to array.size(liquidity_lows) / 3 - 1
            idx = i * 3
            if array.get(liquidity_lows, idx+2) == 1.0  // If swept
                sweep_bar = bar_index - array.get(liquidity_lows, idx+1)
                if sweep_bar <= 3 and close > array.get(liquidity_lows, idx)
                    recent_low_sweep := true
    
    [recent_high_sweep, recent_low_sweep]

// Call the detection functions
[bull_fvg_price, bear_fvg_price, recent_bull_fvg, recent_bear_fvg] = detect_advanced_fvg(fvg_lookback, fvg_min_size)
[demand_ob_high, demand_ob_low, supply_ob_high, supply_ob_low, near_demand_ob, near_supply_ob] = detect_premium_ob(ob_lookback)
[bullish_structure, bearish_structure, bullish_bos, bearish_bos, bullish_choch, bearish_choch] = detect_market_structure()
[recent_high_sweep, recent_low_sweep] = detect_liquidity_zones()

// Smart Money Bias Calculation
smart_money_bullish = bullish_structure and (ema12 > ema26 or bullish_bos) and (not na(bull_fvg_price) or near_demand_ob)
smart_money_bearish = bearish_structure and (ema12 < ema26 or bearish_bos) and (not na(bear_fvg_price) or near_supply_ob)
smart_money_bias = smart_money_bullish ? 1 : smart_money_bearish ? -1 : 0

// Near critical levels detection 
near_bull_fvg = not na(bull_fvg_price) and close >= bull_fvg_price * 0.999 and close <= bull_fvg_price * 1.001
near_bear_fvg = not na(bear_fvg_price) and close <= bear_fvg_price * 1.001 and close >= bear_fvg_price * 0.999

// Enhanced Confluence Analysis (More Balanced)
confluence_score = 0
bullish_signals = 0
bearish_signals = 0
signal_reasons = ""

// Traditional Technical Analysis (Higher Weight)
if rsi < 30
    bullish_signals := bullish_signals + 4
    confluence_score := confluence_score + 4
    signal_reasons := signal_reasons + "RSI Oversold | "
else if rsi < 40
    bullish_signals := bullish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "RSI Bullish | "

if rsi > 70
    bearish_signals := bearish_signals + 4
    confluence_score := confluence_score + 4
    signal_reasons := signal_reasons + "RSI Overbought | "
else if rsi > 60
    bearish_signals := bearish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "RSI Bearish | "

// MACD Signals (Higher Weight)
if ta.crossover(macd_hist, 0)
    bullish_signals := bullish_signals + 5
    confluence_score := confluence_score + 5
    signal_reasons := signal_reasons + "MACD Bull Cross | "
else if macd_hist > 0
    bullish_signals := bullish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "MACD Above Zero | "

if ta.crossunder(macd_hist, 0)
    bearish_signals := bearish_signals + 5
    confluence_score := confluence_score + 5
    signal_reasons := signal_reasons + "MACD Bear Cross | "
else if macd_hist < 0
    bearish_signals := bearish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "MACD Below Zero | "

// EMA Trend
if ema12 > ema26 and close > ema12
    bullish_signals := bullish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Bull EMA Trend | "

if ema12 < ema26 and close < ema12
    bearish_signals := bearish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Bear EMA Trend | "

// Smart Money Concepts (Reduced Weight)
near_bull_fvg = is_bull_fvg and close >= fvg_bull_price * 0.998 and close <= fvg_bull_price * 1.002
near_bear_fvg = is_bear_fvg and close <= fvg_bear_price * 1.002 and close >= fvg_bear_price * 0.998

if near_bull_fvg
    bullish_signals := bullish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Near Bull FVG | "

if near_bear_fvg
    bearish_signals := bearish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Near Bear FVG | "

// Order Block Signals
near_demand = is_demand_ob and close >= ob_dem_low * 0.998 and close <= ob_dem_high * 1.002
near_supply = is_supply_ob and close >= ob_sup_low * 0.998 and close <= ob_sup_high * 1.002

if near_demand
    bullish_signals := bullish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Near Demand OB | "

if near_supply
    bearish_signals := bearish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Near Supply OB | "

// Market Structure
if bullish_structure
    bullish_signals := bullish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "Bull Structure | "

if bearish_structure
    bearish_signals := bearish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "Bear Structure | "

// Volume Confirmation
if high_volume
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "High Volume | "

// Session Filter (Reduced Impact)
if session_filter
    confluence_score := confluence_score + 1
    signal_reasons := signal_reasons + "Active Session | "
else
    confluence_score := confluence_score - 1
    signal_reasons := signal_reasons + "Inactive Session | "

// Calculate Confidence (More Balanced)
total_signals = bullish_signals + bearish_signals
raw_confidence = total_signals > 0 ? (math.max(bullish_signals, bearish_signals) / total_signals) * 100 : 50
confluence_boost = math.min(confluence_score * 2, 25)
final_confidence = math.min(raw_confidence + confluence_boost, 95)

// Ensure minimum confidence for any signal
if confluence_score >= 5
    final_confidence := math.max(final_confidence, 60)

// Signal Determination (More Lenient)
signal_strength = math.abs(bullish_signals - bearish_signals)
is_very_strong = confluence_score >= 12 and signal_strength >= 6 and final_confidence >= 85
is_strong = confluence_score >= 8 and signal_strength >= 4 and final_confidence >= 75

// Entry Conditions (More Lenient)
long_condition = session_filter and bullish_signals > bearish_signals and final_confidence >= min_confidence and confluence_score >= min_confluence and (not use_smart_money_bias or smart_money_bias >= 0)
short_condition = session_filter and bearish_signals > bullish_signals and final_confidence >= min_confidence and confluence_score >= min_confluence and (not use_smart_money_bias or smart_money_bias <= 0)

// Enhanced Stop Loss and Take Profit Logic
long_sl = strategy.position_size > 0 ? (not na(ob_dem_low) and close > ob_dem_low ? ob_dem_low - atr_value * 0.3 : close - atr_value * atr_sl_mult) : na
short_sl = strategy.position_size < 0 ? (not na(ob_sup_high) and close < ob_sup_high ? ob_sup_high + atr_value * 0.3 : close + atr_value * atr_sl_mult) : na

// Take Profit
tp_multiplier = is_very_strong ? 2.5 : is_strong ? 2.0 : atr_tp_mult
long_tp = strategy.position_size > 0 ? close + atr_value * tp_multiplier : na
short_tp = strategy.position_size < 0 ? close - atr_value * tp_multiplier : na

// Plot Smart Money Levels
plot(fvg_bull_price, color=color.new(color.green, 70), style=plot.style_linebr, linewidth=2, title="Bullish FVG")
plot(fvg_bear_price, color=color.new(color.red, 70), style=plot.style_linebr, linewidth=2, title="Bearish FVG")

plotshape(is_demand_ob, title="Demand OB", location=location.belowbar, color=color.new(color.blue, 30), style=shape.square, size=size.small)
plotshape(is_supply_ob, title="Supply OB", location=location.abovebar, color=color.new(color.orange, 30), style=shape.square, size=size.small)

plotshape(swing_high, title="Sell Liquidity", location=location.abovebar, color=color.new(color.red, 50), style=shape.triangledown, size=size.tiny)
plotshape(swing_low, title="Buy Liquidity", location=location.belowbar, color=color.new(color.green, 50), style=shape.triangleup, size=size.tiny)

// Enhanced Signal Plots
plotshape(long_condition and is_very_strong, title="VERY STRONG BUY", location=location.belowbar, color=color.lime, style=shape.labelup, text="💎 BUY", textcolor=color.white, size=size.large)
plotshape(long_condition and is_strong and not is_very_strong, title="STRONG BUY", location=location.belowbar, color=color.green, style=shape.labelup, text="🔥 BUY", textcolor=color.white, size=size.normal)
plotshape(long_condition and not is_strong, title="BUY", location=location.belowbar, color=color.new(color.green, 30), style=shape.labelup, text="BUY", textcolor=color.white, size=size.small)

plotshape(short_condition and is_very_strong, title="VERY STRONG SELL", location=location.abovebar, color=color.maroon, style=shape.labeldown, text="💎 SELL", textcolor=color.white, size=size.large)
plotshape(short_condition and is_strong and not is_very_strong, title="STRONG SELL", location=location.abovebar, color=color.red, style=shape.labeldown, text="🔥 SELL", textcolor=color.white, size=size.normal)
plotshape(short_condition and not is_strong, title="SELL", location=location.abovebar, color=color.new(color.red, 30), style=shape.labeldown, text="SELL", textcolor=color.white, size=size.small)

// Strategy Execution
if long_condition
    strategy.entry("Long", strategy.long, comment="Balanced Long: " + str.tostring(final_confidence, "#.#") + "% | Score: " + str.tostring(confluence_score))
    strategy.exit("Long Exit", "Long", stop=long_sl, limit=long_tp, comment="Long Exit")

if short_condition
    strategy.entry("Short", strategy.short, comment="Balanced Short: " + str.tostring(final_confidence, "#.#") + "% | Score: " + str.tostring(confluence_score))
    strategy.exit("Short Exit", "Short", stop=short_sl, limit=short_tp, comment="Short Exit")

// Enhanced Information Table
if barstate.islast
    var table info_table = table.new(position.top_right, 3, 12, bgcolor=color.white, border_width=1)
    
    table.cell(info_table, 0, 0, "Balanced Strategy", text_color=color.black, bgcolor=color.gray, text_size=size.normal)
    table.cell(info_table, 1, 0, "Value", text_color=color.black, bgcolor=color.gray, text_size=size.normal)
    table.cell(info_table, 2, 0, "Status", text_color=color.black, bgcolor=color.gray, text_size=size.normal)
    
    table.cell(info_table, 0, 1, "Confidence", text_color=color.black, text_size=size.small)
    table.cell(info_table, 1, 1, str.tostring(final_confidence, "#.#") + "%", text_color=color.black, text_size=size.small)
    table.cell(info_table, 2, 1, final_confidence >= min_confidence ? "✅" : "❌", text_color=color.black, text_size=size.small)
    
    table.cell(info_table, 0, 2, "Confluence", text_color=color.black, text_size=size.small)
    table.cell(info_table, 1, 2, str.tostring(confluence_score), text_color=color.black, text_size=size.small)
    table.cell(info_table, 2, 2, confluence_score >= min_confluence ? "✅" : "❌", text_color=color.black, text_size=size.small)
    
    table.cell(info_table, 0, 3, "Bullish Signals", text_color=color.black, text_size=size.small)
    table.cell(info_table, 1, 3, str.tostring(bullish_signals), text_color=color.black, text_size=size.small)
    table.cell(info_table, 2, 3, bullish_signals > bearish_signals ? "🟢" : "⚪", text_color=color.black, text_size=size.small)
    
    table.cell(info_table, 0, 4, "Bearish Signals", text_color=color.black, text_size=size.small)
    table.cell(info_table, 1, 4, str.tostring(bearish_signals), text_color=color.black, text_size=size.small)
    table.cell(info_table, 2, 4, bearish_signals > bullish_signals ? "🔴" : "⚪", text_color=color.black, text_size=size.small)
    
    table.cell(info_table, 0, 5, "Smart Money Bias", text_color=color.black, text_size=size.small)
    table.cell(info_table, 1, 5, smart_money_bias > 0 ? "Bullish" : smart_money_bias < 0 ? "Bearish" : "Neutral", text_color=color.black, text_size=size.small)
    table.cell(info_table, 2, 5, smart_money_bias > 0 ? "🟢" : smart_money_bias < 0 ? "🔴" : "⚪", text_color=color.black, text_size=size.small)
    
    table.cell(info_table, 0, 6, "Session", text_color=color.black, text_size=size.small)
    table.cell(info_table, 1, 6, session_filter ? "Active" : "Inactive", text_color=color.black, text_size=size.small)
    table.cell(info_table, 2, 6, session_filter ? "🟢" : "🔴", text_color=color.black, text_size=size.small)
    
    table.cell(info_table, 0, 7, "Volume", text_color=color.black, text_size=size.small)
    table.cell(info_table, 1, 7, high_volume ? "High" : "Normal", text_color=color.black, text_size=size.small)
    table.cell(info_table, 2, 7, high_volume ? "🟢" : "⚪", text_color=color.black, text_size=size.small)
    
    table.cell(info_table, 0, 8, "RSI", text_color=color.black, text_size=size.small)
    table.cell(info_table, 1, 8, str.tostring(rsi, "#.#"), text_color=color.black, text_size=size.small)
    table.cell(info_table, 2, 8, rsi < 30 ? "🟢" : rsi > 70 ? "🔴" : "⚪", text_color=color.black, text_size=size.small)
    
    table.cell(info_table, 0, 9, "ATR", text_color=color.black, text_size=size.small)
    table.cell(info_table, 1, 9, str.tostring(atr_value, "#.####"), text_color=color.black, text_size=size.small)
    table.cell(info_table, 2, 9, "📊", text_color=color.black, text_size=size.small)
    
    table.cell(info_table, 0, 10, "Signal Strength", text_color=color.black, text_size=size.small)
    table.cell(info_table, 1, 10, is_very_strong ? "Very Strong" : is_strong ? "Strong" : "Weak", text_color=color.black, text_size=size.small)
    table.cell(info_table, 2, 10, is_very_strong ? "💎" : is_strong ? "🔥" : "⚪", text_color=color.black, text_size=size.small)
    
    // Use proper string length calculation instead of str.sub
    signal_reasons_short = str.length(signal_reasons) > 30 ? str.tostring(confluence_score) + " signals" : signal_reasons
    table.cell(info_table, 0, 11, "Last Signal", text_color=color.black, text_size=size.small)
    table.cell(info_table, 1, 11, signal_reasons_short, text_color=color.black, text_size=size.tiny)
    table.cell(info_table, 2, 11, long_condition ? "🟢" : short_condition ? "🔴" : "⚪", text_color=color.black, text_size=size.small)

// Plot EMAs for trend context
plot(ema12, color=color.blue, title="EMA 12", linewidth=1)
plot(ema26, color=color.orange, title="EMA 26", linewidth=1)`;
  }
}
