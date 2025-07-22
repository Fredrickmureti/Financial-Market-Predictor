
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
// Using string-based timeframe instead of timeframe.multiply which is not supported in some Pine Script versions
higher_timeframe = timeframe.period == "D" ? "W" : 
                  timeframe.period == "240" ? "D" : 
                  timeframe.period == "60" ? "240" : 
                  timeframe.period == "30" ? "60" : 
                  timeframe.period == "15" ? "30" : 
                  timeframe.period == "5" ? "15" : "30"
                  
higher_tf_bullish = request.security(syminfo.tickerid, higher_timeframe, ema50 > ema200 and close > ema50)
higher_tf_bearish = request.security(syminfo.tickerid, higher_timeframe, ema50 < ema200 and close < ema50)
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
    
    // Detect swings using pivot points - now defined outside the function and passed in
    // Using global swing_high and swing_low from the outer scope
    
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
detect_liquidity_zones(swing_high, swing_low, atr_value) =>
    var liq_highs = array.new_float(0)  // [price, strength, swept]
    var liq_lows = array.new_float(0)   // [price, strength, swept]
    var recent_high_sweep = false
    var recent_low_sweep = false
    
    // Detect swing point clusters that indicate liquidity
    if not na(swing_high)
        // Check for clustered highs (indicating stop placement)
        high_cluster = false
        for i = 1 to 5
            if math.abs(high[i] - swing_high) < atr_value * 0.5
                high_cluster := true
        
        if high_cluster
            array.push(liq_highs, swing_high)
            array.push(liq_highs, 1.0)  // Strength
            array.push(liq_highs, 0.0)  // 0=not swept, 1=swept
    
    if not na(swing_low)
        // Check for clustered lows (indicating stop placement)
        low_cluster = false
        for i = 1 to 5
            if math.abs(low[i] - swing_low) < atr_value * 0.5
                low_cluster := true
        
        if low_cluster
            array.push(liq_lows, swing_low)
            array.push(liq_lows, 1.0)  // Strength
            array.push(liq_lows, 0.0)  // 0=not swept, 1=swept
            
    [recent_high_sweep, recent_low_sweep, liq_highs, liq_lows]
    
    // Check for liquidity sweeps
    if array.size(liq_highs) > 0
        for i = 0 to array.size(liq_highs) / 3 - 1
            idx = i * 3
            liq_price = array.get(liq_highs, idx)
            if high >= liq_price and array.get(liq_highs, idx+2) == 0
                array.set(liq_highs, idx+2, 1.0)  // Mark as swept
    
    if array.size(liq_lows) > 0
        for i = 0 to array.size(liq_lows) / 3 - 1
            idx = i * 3
            liq_price = array.get(liq_lows, idx)
            if low <= liq_price and array.get(liq_lows, idx+2) == 0
                array.set(liq_lows, idx+2, 1.0)  // Mark as swept
    
    // Look for recent liquidity sweeps followed by rejection
    recent_high_sweep := false
    recent_low_sweep := false
    
    if array.size(liq_highs) > 0
        for i = 0 to array.size(liq_highs) / 3 - 1
            idx = i * 3
            if array.get(liq_highs, idx+2) == 1.0  // If swept
                sweep_bar = bar_index - array.get(liq_highs, idx+1)
                if sweep_bar <= 3 and close < array.get(liq_highs, idx)
                    recent_high_sweep := true
    
    if array.size(liq_lows) > 0
        for i = 0 to array.size(liq_lows) / 3 - 1
            idx = i * 3
            if array.get(liq_lows, idx+2) == 1.0  // If swept
                sweep_bar = bar_index - array.get(liq_lows, idx+1)
                if sweep_bar <= 3 and close > array.get(liq_lows, idx)
                    recent_low_sweep := true
    
    [recent_high_sweep, recent_low_sweep, liq_highs, liq_lows]

// Define swing points first so we can use them in multiple detectors
swing_high = ta.pivothigh(high, ms_pivot_length, ms_pivot_length)
swing_low = ta.pivotlow(low, ms_pivot_length, ms_pivot_length)

// Call the detection functions
[bull_fvg_price, bear_fvg_price, recent_bull_fvg, recent_bear_fvg] = detect_advanced_fvg(fvg_lookback, fvg_min_size)
[demand_ob_high, demand_ob_low, supply_ob_high, supply_ob_low, near_demand_ob, near_supply_ob] = detect_premium_ob(ob_lookback)
[bullish_structure, bearish_structure, bullish_bos, bearish_bos, bullish_choch, bearish_choch] = detect_market_structure()
[recent_high_sweep, recent_low_sweep, liquidity_highs, liquidity_lows] = detect_liquidity_zones(swing_high, swing_low, atr_value)

// Smart Money Bias Calculation
smart_money_bullish = bullish_structure and (ema12 > ema26 or bullish_bos) and (not na(bull_fvg_price) or near_demand_ob)
smart_money_bearish = bearish_structure and (ema12 < ema26 or bearish_bos) and (not na(bear_fvg_price) or near_supply_ob)
smart_money_bias = smart_money_bullish ? 1 : smart_money_bearish ? -1 : 0

// Near critical levels detection 
near_bull_fvg = not na(bull_fvg_price) and close >= bull_fvg_price * 0.999 and close <= bull_fvg_price * 1.001
near_bear_fvg = not na(bear_fvg_price) and close <= bear_fvg_price * 1.001 and close >= bear_fvg_price * 0.999

// ===== ADVANCED SIGNAL GENERATION SYSTEM =====

// Professional signal generation with precise reasons
var confluence_score = 0
var bullish_signals = 0
var bearish_signals = 0
var signal_reasons = ""
var signal_quality = 0.0

// Initialize counters
confluence_score := 0
bullish_signals := 0
bearish_signals := 0
signal_reasons := ""

// --- SMART MONEY CONCEPTS (HIGHEST WEIGHT) ---

// 1. Fair Value Gap Entries (Premium Institutional Entry Points)
if near_bull_fvg and recent_bull_fvg
    bullish_signals := bullish_signals + 6
    confluence_score := confluence_score + 6
    signal_reasons := signal_reasons + "Fresh Bull FVG | "
    signal_quality := signal_quality + 0.6
else if near_bull_fvg
    bullish_signals := bullish_signals + 4
    confluence_score := confluence_score + 4
    signal_reasons := signal_reasons + "Bull FVG | "
    signal_quality := signal_quality + 0.4

if near_bear_fvg and recent_bear_fvg
    bearish_signals := bearish_signals + 6
    confluence_score := confluence_score + 6
    signal_reasons := signal_reasons + "Fresh Bear FVG | "
    signal_quality := signal_quality + 0.6
else if near_bear_fvg
    bearish_signals := bearish_signals + 4
    confluence_score := confluence_score + 4
    signal_reasons := signal_reasons + "Bear FVG | "
    signal_quality := signal_quality + 0.4

// 2. Premium Order Block Entries
if near_demand_ob and demand_ob_low <= close and close <= demand_ob_high
    bullish_signals := bullish_signals + 5
    confluence_score := confluence_score + 5
    signal_reasons := signal_reasons + "Premium Demand OB | "
    signal_quality := signal_quality + 0.5

if near_supply_ob and supply_ob_low <= close and close <= supply_ob_high
    bearish_signals := bearish_signals + 5
    confluence_score := confluence_score + 5
    signal_reasons := signal_reasons + "Premium Supply OB | "
    signal_quality := signal_quality + 0.5

// 3. Liquidity Sweeps (Stop Hunting)
if recent_low_sweep
    bullish_signals := bullish_signals + 4
    confluence_score := confluence_score + 4
    signal_reasons := signal_reasons + "Liquidity Swept Low | "
    signal_quality := signal_quality + 0.5

if recent_high_sweep
    bearish_signals := bearish_signals + 4
    confluence_score := confluence_score + 4
    signal_reasons := signal_reasons + "Liquidity Swept High | "
    signal_quality := signal_quality + 0.5

// 4. Market Structure - Critical for Smart Money Analysis
if bullish_structure
    bullish_signals := bullish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Bullish Structure | "
    signal_quality := signal_quality + 0.2

if bullish_bos and confirm_bos
    bullish_signals := bullish_signals + 5
    confluence_score := confluence_score + 5
    signal_reasons := signal_reasons + "Bullish BOS | "
    signal_quality := signal_quality + 0.5

if bullish_choch
    bearish_signals := bearish_signals + 4  // Contrarian signal
    confluence_score := confluence_score + 4
    signal_reasons := signal_reasons + "Bullish CHoCH | "
    signal_quality := signal_quality + 0.4

if bearish_structure
    bearish_signals := bearish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Bearish Structure | "
    signal_quality := signal_quality + 0.2

if bearish_bos and confirm_bos
    bearish_signals := bearish_signals + 5
    confluence_score := confluence_score + 5
    signal_reasons := signal_reasons + "Bearish BOS | "
    signal_quality := signal_quality + 0.5

if bearish_choch
    bullish_signals := bullish_signals + 4  // Contrarian signal
    confluence_score := confluence_score + 4
    signal_reasons := signal_reasons + "Bearish CHoCH | "
    signal_quality := signal_quality + 0.4

// --- TECHNICAL INDICATORS (MEDIUM WEIGHT) ---

// 1. RSI - Momentum Indicator
if rsi < 25
    bullish_signals := bullish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Strong RSI Oversold | "
    signal_quality := signal_quality + 0.3
else if rsi < 35
    bullish_signals := bullish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "RSI Bullish | "
    signal_quality := signal_quality + 0.1

if rsi > 75
    bearish_signals := bearish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Strong RSI Overbought | "
    signal_quality := signal_quality + 0.3
else if rsi > 65
    bearish_signals := bearish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "RSI Bearish | "
    signal_quality := signal_quality + 0.1

// 2. MACD - Trend Momentum
if ta.crossover(macd_line, signal_line)
    bullish_signals := bullish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "MACD Bull Cross | "
    signal_quality := signal_quality + 0.2
else if macd_line > signal_line and macd_hist > 0 and macd_hist > macd_hist[1]
    bullish_signals := bullish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "MACD Bullish | "
    signal_quality := signal_quality + 0.1

if ta.crossunder(macd_line, signal_line)
    bearish_signals := bearish_signals + 3
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "MACD Bear Cross | "
    signal_quality := signal_quality + 0.2
else if macd_line < signal_line and macd_hist < 0 and macd_hist < macd_hist[1]
    bearish_signals := bearish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "MACD Bearish | "
    signal_quality := signal_quality + 0.1

// 3. EMA Analysis - Trend Direction
if ema12 > ema26 and ema26 > ema50 and close > ema12
    bullish_signals := bullish_signals + 4
    confluence_score := confluence_score + 4
    signal_reasons := signal_reasons + "Strong Bull Trend | "
    signal_quality := signal_quality + 0.3
else if ema12 > ema26 and close > ema12
    bullish_signals := bullish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "Bull Trend | "
    signal_quality := signal_quality + 0.1

if ema12 < ema26 and ema26 < ema50 and close < ema12
    bearish_signals := bearish_signals + 4
    confluence_score := confluence_score + 4
    signal_reasons := signal_reasons + "Strong Bear Trend | "
    signal_quality := signal_quality + 0.3
else if ema12 < ema26 and close < ema12
    bearish_signals := bearish_signals + 2
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "Bear Trend | "
    signal_quality := signal_quality + 0.1
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

// --- ADDITIONAL FILTERS & QUALITY FACTORS (LOW WEIGHT) ---

// 1. Volume Analysis (High volume confirms moves)
if very_high_volume and increasing_volume
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Very High Vol | "
    signal_quality := signal_quality + 0.2
else if high_volume
    confluence_score := confluence_score + 2
    signal_reasons := signal_reasons + "High Vol | "
    signal_quality := signal_quality + 0.1

// 2. Session Quality
if high_quality_time
    confluence_score := confluence_score + 3
    signal_reasons := signal_reasons + "Premium Session | "
    signal_quality := signal_quality + 0.2
else if session_filter
    confluence_score := confluence_score + 1
    signal_reasons := signal_reasons + "Good Session | "
    signal_quality := signal_quality + 0.1
else
    signal_quality := signal_quality - 0.2

// 3. Filters Application
if not trend_filter
    signal_quality := signal_quality - 0.2
    confluence_score := math.max(confluence_score - 2, 0)

if not volatility_filter
    signal_quality := signal_quality - 0.1
    confluence_score := math.max(confluence_score - 1, 0)

// Calculate Advanced Confidence Score
total_signals = bullish_signals + bearish_signals
raw_confidence = total_signals > 0 ? (math.max(bullish_signals, bearish_signals) / total_signals) * 100 : 50
confidence_boost = math.min(confluence_score * 1.5, 30)
final_confidence = math.min(math.max(raw_confidence + confidence_boost, 50), 95)

// Filter by quality if noise reduction is enabled
if reduce_noise and signal_quality < 0.7
    final_confidence := final_confidence * 0.8
    confluence_score := math.max(confluence_score - 2, 0)

// Signal Strength Classification
signal_strength = math.abs(bullish_signals - bearish_signals)
is_elite = confluence_score >= 15 and signal_strength >= 8 and final_confidence >= 88 and signal_quality >= 1.2
is_very_strong = confluence_score >= 12 and signal_strength >= 6 and final_confidence >= 82 and signal_quality >= 1.0
is_strong = confluence_score >= 8 and signal_strength >= 4 and final_confidence >= 75 and signal_quality >= 0.8

// Risk management calculation - Dynamic ATR
risk_multiplier = is_elite ? 0.8 : is_very_strong ? 0.9 : atr_sl_mult
reward_multiplier = is_elite ? 3.0 : is_very_strong ? 2.7 : is_strong ? 2.4 : atr_tp_mult

// Apply trade count management (avoid overtrading)
var int trades_today = 0
if dayofweek != dayofweek[1]
    trades_today := 0

// Entry Conditions
primary_filters = session_filter and trend_filter and volatility_filter and trades_today < max_trades_per_day
risk_reward_check = reward_multiplier / risk_multiplier >= risk_reward_min

long_condition = primary_filters and bullish_signals > bearish_signals and final_confidence >= min_confidence and 
                 confluence_score >= min_confluence and risk_reward_check and 
                 (not use_smart_money_concepts or smart_money_bias >= 0)

short_condition = primary_filters and bearish_signals > bullish_signals and final_confidence >= min_confidence and 
                  confluence_score >= min_confluence and risk_reward_check and 
                  (not use_smart_money_concepts or smart_money_bias <= 0)

// Institutional Smart Money Stop Loss Placement
// For bulls, SL is below demand OB or recent swing low, never just fixed ATR
long_sl = close - atr_value * risk_multiplier
if not na(demand_ob_low) and near_demand_ob
    long_sl := math.min(demand_ob_low - atr_value * 0.2, long_sl)
if not na(swing_low) and swing_low < close
    long_sl := math.min(swing_low - atr_value * 0.1, long_sl)

// For bears, SL is above supply OB or recent swing high, never just fixed ATR
short_sl = close + atr_value * risk_multiplier
if not na(supply_ob_high) and near_supply_ob
    short_sl := math.max(supply_ob_high + atr_value * 0.2, short_sl)
if not na(swing_high) and swing_high > close
    short_sl := math.max(swing_high + atr_value * 0.1, short_sl)

// Smart Take Profit Placement
// For bulls, target the nearest bear FVG, liquidity level, or ATR multiple
long_tp = close + atr_value * reward_multiplier
if not na(bear_fvg_price) and bear_fvg_price > close
    long_tp := math.min(bear_fvg_price, long_tp)
else 
    // Look for resistance or liquidity zone
    if array.size(liquidity_highs) > 0
        for i = 0 to math.min(array.size(liquidity_highs) / 3 - 1, 2)
            idx = i * 3
            liq_price = array.get(liquidity_highs, idx)
            if liq_price > close
                long_tp := math.min(liq_price, long_tp)

// For bears, target the nearest bull FVG, liquidity level, or ATR multiple
short_tp = close - atr_value * reward_multiplier
if not na(bull_fvg_price) and bull_fvg_price < close
    short_tp := math.max(bull_fvg_price, short_tp)
else
    // Look for support or liquidity zone
    if array.size(liquidity_lows) > 0
        for i = 0 to math.min(array.size(liquidity_lows) / 3 - 1, 2)
            idx = i * 3
            liq_price = array.get(liquidity_lows, idx)
            if liq_price < close
                short_tp := math.max(liq_price, short_tp)

// Visualization of Premium Smart Money Concepts
// Fair Value Gaps
plot(bull_fvg_price, title="Bull FVG", color=color.new(color.lime, 60), style=plot.style_circles, linewidth=2)
plot(bear_fvg_price, title="Bear FVG", color=color.new(color.maroon, 60), style=plot.style_circles, linewidth=2)

// Order Blocks
plotbox(near_demand_ob and not na(demand_ob_high) and not na(demand_ob_low), demand_ob_high, demand_ob_low, 
       extend.right, color.new(color.blue, 80), bgcolor=color.new(color.blue, 90))
plotbox(near_supply_ob and not na(supply_ob_high) and not na(supply_ob_low), supply_ob_high, supply_ob_low, 
       extend.right, color.new(color.red, 80), bgcolor=color.new(color.red, 90))

// Liquidity Zones
plotshape(not na(swing_high), title="Sell Liquidity", location=location.abovebar, color=color.new(color.red, 40), 
         style=shape.triangledown, size=size.tiny)
plotshape(not na(swing_low), title="Buy Liquidity", location=location.belowbar, color=color.new(color.green, 40), 
         style=shape.triangleup, size=size.tiny)

// Market Structure Breaks
plotshape(bullish_bos, title="Bullish BOS", location=location.belowbar, color=color.new(color.green, 0), 
         style=shape.triangleup, size=size.small)
plotshape(bearish_bos, title="Bearish BOS", location=location.abovebar, color=color.new(color.red, 0), 
         style=shape.triangledown, size=size.small)

// Enhanced Signal Visualization
plotshape(long_condition and is_elite, title="ELITE BUY", location=location.belowbar, color=color.new(color.lime, 0), 
         style=shape.labelup, text="⭐ ELITE BUY", textcolor=color.white, size=size.large)
plotshape(long_condition and is_very_strong and not is_elite, title="PREMIUM BUY", location=location.belowbar, 
         color=color.new(color.green, 0), style=shape.labelup, text="💎 BUY", textcolor=color.white, size=size.large)
plotshape(long_condition and is_strong and not is_very_strong, title="STRONG BUY", location=location.belowbar, 
         color=color.new(color.green, 20), style=shape.labelup, text="🔥 BUY", textcolor=color.white, size=size.normal)
plotshape(long_condition and not is_strong, title="BUY", location=location.belowbar, 
         color=color.new(color.green, 40), style=shape.labelup, text="BUY", textcolor=color.white, size=size.small)

plotshape(short_condition and is_elite, title="ELITE SELL", location=location.abovebar, color=color.new(color.purple, 0), 
         style=shape.labeldown, text="⭐ ELITE SELL", textcolor=color.white, size=size.large)
plotshape(short_condition and is_very_strong and not is_elite, title="PREMIUM SELL", location=location.abovebar, 
         color=color.new(color.maroon, 0), style=shape.labeldown, text="💎 SELL", textcolor=color.white, size=size.large)
plotshape(short_condition and is_strong and not is_very_strong, title="STRONG SELL", location=location.abovebar, 
         color=color.new(color.red, 20), style=shape.labeldown, text="🔥 SELL", textcolor=color.white, size=size.normal)
plotshape(short_condition and not is_strong, title="SELL", location=location.abovebar, 
         color=color.new(color.red, 40), style=shape.labeldown, text="SELL", textcolor=color.white, size=size.small)

// Strategy Execution with Risk Management
if long_condition
    strategy.entry("Long", strategy.long, comment="Smart Long: " + str.tostring(final_confidence, "#.#") + "% | Q: " + 
                  str.tostring(signal_quality, "#.#"))
    strategy.exit("Long TP/SL", "Long", stop=long_sl, limit=long_tp)
    trades_today := trades_today + 1

if short_condition
    strategy.entry("Short", strategy.short, comment="Smart Short: " + str.tostring(final_confidence, "#.#") + "% | Q: " + 
                  str.tostring(signal_quality, "#.#"))
    strategy.exit("Short TP/SL", "Short", stop=short_sl, limit=short_tp)
    trades_today := trades_today + 1

// Advanced Analytics Dashboard
if barstate.islast
    var table analytics = table.new(position.top_right, 3, 14, bgcolor=color.new(color.gray, 95), border_width=1, border_color=color.new(color.gray, 50))
    
    table.cell(analytics, 0, 0, "Smart Money Strategy", text_color=color.white, bgcolor=color.new(color.blue, 10), text_size=size.normal)
    table.cell(analytics, 1, 0, "Value", text_color=color.white, bgcolor=color.new(color.blue, 10), text_size=size.normal)
    table.cell(analytics, 2, 0, "Status", text_color=color.white, bgcolor=color.new(color.blue, 10), text_size=size.normal)
    
    table.cell(analytics, 0, 1, "Confidence", text_color=color.white, text_size=size.small)
    table.cell(analytics, 1, 1, str.tostring(final_confidence, "#.#") + "%", text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 1, final_confidence >= min_confidence ? "✅" : "❌", text_color=color.white, text_size=size.small)
    
    table.cell(analytics, 0, 2, "Confluence", text_color=color.white, text_size=size.small)
    table.cell(analytics, 1, 2, str.tostring(confluence_score), text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 2, confluence_score >= min_confluence ? "✅" : "❌", text_color=color.white, text_size=size.small)
    
    table.cell(analytics, 0, 3, "Signal Quality", text_color=color.white, text_size=size.small)
    table.cell(analytics, 1, 3, str.tostring(signal_quality, "#.##"), text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 3, signal_quality >= 0.8 ? "✅" : signal_quality >= 0.6 ? "⚠️" : "❌", text_color=color.white, text_size=size.small)
    
    table.cell(analytics, 0, 4, "Bullish Signals", text_color=color.white, text_size=size.small)
    table.cell(analytics, 1, 4, str.tostring(bullish_signals), text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 4, bullish_signals > bearish_signals ? "🟢" : "⚪", text_color=color.white, text_size=size.small)
    
    table.cell(analytics, 0, 5, "Bearish Signals", text_color=color.white, text_size=size.small)
    table.cell(analytics, 1, 5, str.tostring(bearish_signals), text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 5, bearish_signals > bullish_signals ? "🔴" : "⚪", text_color=color.white, text_size=size.small)
    
    table.cell(analytics, 0, 6, "Smart Money", text_color=color.white, text_size=size.small)
    table.cell(analytics, 1, 6, smart_money_bias > 0 ? "Bullish" : smart_money_bias < 0 ? "Bearish" : "Neutral", text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 6, smart_money_bias > 0 ? "🟢" : smart_money_bias < 0 ? "🔴" : "⚪", text_color=color.white, text_size=size.small)
    
    table.cell(analytics, 0, 7, "Market Structure", text_color=color.white, text_size=size.small)
    ms_status = bullish_structure ? "Bullish" : bearish_structure ? "Bearish" : "Neutral"
    ms_icon = bullish_structure ? "🟢" : bearish_structure ? "🔴" : "⚪"
    if bullish_bos
        ms_status := "Bullish BOS"
        ms_icon := "🔼"
    if bearish_bos
        ms_status := "Bearish BOS"
        ms_icon := "🔽"
    table.cell(analytics, 1, 7, ms_status, text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 7, ms_icon, text_color=color.white, text_size=size.small)
    
    table.cell(analytics, 0, 8, "Session", text_color=color.white, text_size=size.small)
    session_status = high_quality_time ? "Premium" : session_filter ? "Active" : "Inactive"
    table.cell(analytics, 1, 8, session_status, text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 8, high_quality_time ? "⭐" : session_filter ? "✅" : "❌", text_color=color.white, text_size=size.small)
    
    table.cell(analytics, 0, 9, "Volatility", text_color=color.white, text_size=size.small)
    vol_status = high_volatility ? "High" : low_volatility ? "Low" : "Normal"
    table.cell(analytics, 1, 9, vol_status, text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 9, high_volatility ? "⚠️" : volatility_filter ? "✅" : "❌", text_color=color.white, text_size=size.small)
    
    table.cell(analytics, 0, 10, "Risk:Reward", text_color=color.white, text_size=size.small)
    rr_ratio = reward_multiplier / risk_multiplier
    table.cell(analytics, 1, 10, str.tostring(rr_ratio, "#.#") + ":1", text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 10, rr_ratio >= risk_reward_min ? "✅" : "❌", text_color=color.white, text_size=size.small)
    
    table.cell(analytics, 0, 11, "Trend Filter", text_color=color.white, text_size=size.small)
    trend_status = higher_tf_bullish ? "Bullish" : higher_tf_bearish ? "Bearish" : "Neutral"
    table.cell(analytics, 1, 11, trend_status, text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 11, trend_filter ? "✅" : "❌", text_color=color.white, text_size=size.small)
    
    table.cell(analytics, 0, 12, "Trades Today", text_color=color.white, text_size=size.small)
    table.cell(analytics, 1, 12, str.tostring(trades_today) + "/" + str.tostring(max_trades_per_day), text_color=color.white, text_size=size.small)
    table.cell(analytics, 2, 12, trades_today < max_trades_per_day ? "✅" : "❌", text_color=color.white, text_size=size.small)
    
    signal_summary = long_condition ? "BUY " + str.tostring(final_confidence, "#.#") + "%" : 
                     short_condition ? "SELL " + str.tostring(final_confidence, "#.#") + "%" : "NO SIGNAL"
                     
    signal_strength_text = is_elite ? "ELITE" : is_very_strong ? "PREMIUM" : is_strong ? "STRONG" : "STANDARD"
    table.cell(analytics, 0, 13, signal_summary, text_color=color.white, bgcolor=color.new(color.gray, 0), text_size=size.small)
    table.cell(analytics, 1, 13, signal_strength_text, text_color=color.white, bgcolor=color.new(color.gray, 0), text_size=size.small)
    table.cell(analytics, 2, 13, long_condition ? "🟢" : short_condition ? "🔴" : "⚪", text_color=color.white, bgcolor=color.new(color.gray, 0), text_size=size.small)

// Plot key levels and trend indicators
plot(ema12, color=color.new(color.blue, 40), title="EMA 12", linewidth=1)
plot(ema26, color=color.new(color.orange, 40), title="EMA 26", linewidth=1)
plot(ema50, color=color.new(color.purple, 40), title="EMA 50", linewidth=2)
plot(ema200, color=color.new(color.white, 40), title="EMA 200", linewidth=2)`;
  }
}
