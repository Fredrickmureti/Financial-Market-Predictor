
import { CandlestickData } from './forexService';
import { AnalysisResult, TechnicalAnalysis } from './technicalAnalysis';

export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface TradingSignal {
  signal: SignalType;
  confidence: number; // 0-100
  timestamp: string;
  price: number;
  reasons: string[];
  stopLoss?: number;
  takeProfit?: number;
  riskReward?: number;
}

export interface StrategyConfig {
  riskPercentage: number;
  stopLossPoints: number;
  takeProfitRatio: number;
  minConfidence: number;
}

export class TradingStrategy {
  private config: StrategyConfig;

  constructor(config: StrategyConfig = {
    riskPercentage: 2,
    stopLossPoints: 50,
    takeProfitRatio: 2,
    minConfidence: 70
  }) {
    this.config = config;
  }

  generateSignal(data: CandlestickData[], analysis: AnalysisResult): TradingSignal {
    const currentPrice = data[data.length - 1].close;
    const timestamp = data[data.length - 1].timestamp;
    
    const signals = this.analyzeIndicators(analysis, currentPrice);
    const confidence = this.calculateConfidence(signals);
    const signal = this.determineSignal(signals, confidence);
    
    const stopLoss = signal === 'BUY' 
      ? currentPrice - (this.config.stopLossPoints * 0.0001)
      : signal === 'SELL' 
      ? currentPrice + (this.config.stopLossPoints * 0.0001)
      : undefined;

    const takeProfit = signal === 'BUY'
      ? currentPrice + (this.config.stopLossPoints * 0.0001 * this.config.takeProfitRatio)
      : signal === 'SELL'
      ? currentPrice - (this.config.stopLossPoints * 0.0001 * this.config.takeProfitRatio)
      : undefined;

    return {
      signal,
      confidence,
      timestamp,
      price: currentPrice,
      reasons: signals.reasons,
      stopLoss,
      takeProfit,
      riskReward: this.config.takeProfitRatio
    };
  }

  private analyzeIndicators(analysis: AnalysisResult, currentPrice: number) {
    const signals = {
      bullish: 0,
      bearish: 0,
      reasons: [] as string[]
    };

    // Moving Average Analysis
    const sma20 = analysis.sma20[analysis.sma20.length - 1]?.value;
    const sma50 = analysis.sma50[analysis.sma50.length - 1]?.value;
    const ema12 = analysis.ema12[analysis.ema12.length - 1]?.value;
    const ema26 = analysis.ema26[analysis.ema26.length - 1]?.value;

    if (sma20 && sma50) {
      if (sma20 > sma50 && currentPrice > sma20) {
        signals.bullish += 2;
        signals.reasons.push('Price above rising SMA20 > SMA50');
      } else if (sma20 < sma50 && currentPrice < sma20) {
        signals.bearish += 2;
        signals.reasons.push('Price below falling SMA20 < SMA50');
      }
    }

    // EMA Crossover
    if (ema12 && ema26) {
      if (ema12 > ema26) {
        signals.bullish += 1;
        signals.reasons.push('EMA12 > EMA26 (bullish crossover)');
      } else {
        signals.bearish += 1;
        signals.reasons.push('EMA12 < EMA26 (bearish crossover)');
      }
    }

    // RSI Analysis
    const rsi = analysis.rsi[analysis.rsi.length - 1]?.value;
    if (rsi) {
      if (rsi < 30) {
        signals.bullish += 2;
        signals.reasons.push(`RSI oversold at ${rsi.toFixed(1)}`);
      } else if (rsi > 70) {
        signals.bearish += 2;
        signals.reasons.push(`RSI overbought at ${rsi.toFixed(1)}`);
      } else if (rsi < 45) {
        signals.bullish += 1;
        signals.reasons.push('RSI showing bullish momentum');
      } else if (rsi > 55) {
        signals.bearish += 1;
        signals.reasons.push('RSI showing bearish momentum');
      }
    }

    // MACD Analysis
    const macd = analysis.macd.macd[analysis.macd.macd.length - 1]?.value;
    const macdSignal = analysis.macd.signal[analysis.macd.signal.length - 1]?.value;
    const macdHist = analysis.macd.histogram[analysis.macd.histogram.length - 1]?.value;

    if (macd && macdSignal && macdHist) {
      if (macd > macdSignal && macdHist > 0) {
        signals.bullish += 1;
        signals.reasons.push('MACD bullish crossover');
      } else if (macd < macdSignal && macdHist < 0) {
        signals.bearish += 1;
        signals.reasons.push('MACD bearish crossover');
      }
    }

    // Bollinger Bands Analysis
    const bbUpper = analysis.bollingerBands.upper[analysis.bollingerBands.upper.length - 1]?.value;
    const bbLower = analysis.bollingerBands.lower[analysis.bollingerBands.lower.length - 1]?.value;
    const bbMiddle = analysis.bollingerBands.middle[analysis.bollingerBands.middle.length - 1]?.value;

    if (bbUpper && bbLower && bbMiddle) {
      if (currentPrice <= bbLower) {
        signals.bullish += 2;
        signals.reasons.push('Price at lower Bollinger Band (oversold)');
      } else if (currentPrice >= bbUpper) {
        signals.bearish += 2;
        signals.reasons.push('Price at upper Bollinger Band (overbought)');
      } else if (currentPrice > bbMiddle) {
        signals.bullish += 1;
        signals.reasons.push('Price above BB middle line');
      } else {
        signals.bearish += 1;
        signals.reasons.push('Price below BB middle line');
      }
    }

    return signals;
  }

  private calculateConfidence(signals: { bullish: number; bearish: number; reasons: string[] }): number {
    const totalSignals = signals.bullish + signals.bearish;
    if (totalSignals === 0) return 0;

    const strongerSignal = Math.max(signals.bullish, signals.bearish);
    const confidence = (strongerSignal / totalSignals) * 100;
    
    // Boost confidence if multiple indicators align
    const indicatorCount = signals.reasons.length;
    const confidenceBoost = Math.min(indicatorCount * 5, 20);
    
    return Math.min(confidence + confidenceBoost, 100);
  }

  private determineSignal(signals: { bullish: number; bearish: number }, confidence: number): SignalType {
    if (confidence < this.config.minConfidence) {
      return 'HOLD';
    }

    if (signals.bullish > signals.bearish) {
      return 'BUY';
    } else if (signals.bearish > signals.bullish) {
      return 'SELL';
    }

    return 'HOLD';
  }

  generatePineScript(): string {
    return `//@version=5
strategy("Lovable Forex Strategy", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=2)

// Inputs
sma20_length = input.int(20, title="SMA 20 Length")
sma50_length = input.int(50, title="SMA 50 Length")
ema12_length = input.int(12, title="EMA 12 Length")
ema26_length = input.int(26, title="EMA 26 Length")
rsi_length = input.int(14, title="RSI Length")
bb_length = input.int(20, title="Bollinger Bands Length")
bb_mult = input.float(2.0, title="Bollinger Bands Multiplier")
stop_loss_pips = input.int(50, title="Stop Loss (Pips)")
take_profit_ratio = input.float(2.0, title="Take Profit Ratio")

// Calculations
sma20 = ta.sma(close, sma20_length)
sma50 = ta.sma(close, sma50_length)
ema12 = ta.ema(close, ema12_length)
ema26 = ta.ema(close, ema26_length)
rsi = ta.rsi(close, rsi_length)
[bb_middle, bb_upper, bb_lower] = ta.bb(close, bb_length, bb_mult)
[macd_line, signal_line, _] = ta.macd(close, 12, 26, 9)

// Signal Logic
bullish_signals = 0
bearish_signals = 0

// Moving Average Signals
if sma20 > sma50 and close > sma20
    bullish_signals := bullish_signals + 2
if sma20 < sma50 and close < sma20
    bearish_signals := bearish_signals + 2

// EMA Crossover
if ema12 > ema26
    bullish_signals := bullish_signals + 1
else
    bearish_signals := bearish_signals + 1

// RSI Signals
if rsi < 30
    bullish_signals := bullish_signals + 2
if rsi > 70
    bearish_signals := bearish_signals + 2

// MACD Signals
if macd_line > signal_line
    bullish_signals := bullish_signals + 1
else
    bearish_signals := bearish_signals + 1

// Bollinger Bands
if close <= bb_lower
    bullish_signals := bullish_signals + 2
if close >= bb_upper
    bearish_signals := bearish_signals + 2

// Entry Conditions
long_condition = bullish_signals > bearish_signals and bullish_signals >= 4
short_condition = bearish_signals > bullish_signals and bearish_signals >= 4

// Plot signals
plotshape(long_condition, title="Buy Signal", location=location.belowbar, color=color.green, style=shape.labelup, text="BUY")
plotshape(short_condition, title="Sell Signal", location=location.abovebar, color=color.red, style=shape.labeldown, text="SELL")

// Strategy Execution
if long_condition
    strategy.entry("Long", strategy.long)
    strategy.exit("Long Exit", "Long", stop=close - stop_loss_pips * syminfo.mintick * 10, limit=close + stop_loss_pips * syminfo.mintick * 10 * take_profit_ratio)

if short_condition
    strategy.entry("Short", strategy.short)
    strategy.exit("Short Exit", "Short", stop=close + stop_loss_pips * syminfo.mintick * 10, limit=close - stop_loss_pips * syminfo.mintick * 10 * take_profit_ratio)

// Plot indicators
plot(sma20, color=color.blue, title="SMA 20")
plot(sma50, color=color.red, title="SMA 50")
plot(ema12, color=color.green, title="EMA 12")
plot(ema26, color=color.orange, title="EMA 26")`;
  }
}
