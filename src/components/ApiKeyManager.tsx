
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, ExternalLink, Save, Trash2 } from 'lucide-react';

interface ApiKeyManagerProps {
  onKeysUpdated: () => void;
}

export const ApiKeyManager = ({ onKeysUpdated }: ApiKeyManagerProps) => {
  const [alphaVantageKey, setAlphaVantageKey] = useState('');
  const [exchangeRateKey, setExchangeRateKey] = useState('');
  const [currencyApiKey, setCurrencyApiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('alphavantage');

  useEffect(() => {
    // Load saved keys from localStorage
    setAlphaVantageKey(localStorage.getItem('alphaVantageKey') || '');
    setExchangeRateKey(localStorage.getItem('exchangeRateKey') || '');
    setCurrencyApiKey(localStorage.getItem('currencyApiKey') || '');
    setSelectedProvider(localStorage.getItem('forexProvider') || 'alphavantage');
  }, []);

  const saveKeys = () => {
    if (selectedProvider === 'alphavantage' && alphaVantageKey) {
      localStorage.setItem('alphaVantageKey', alphaVantageKey);
    } else if (selectedProvider === 'exchangerate' && exchangeRateKey) {
      localStorage.setItem('exchangeRateKey', exchangeRateKey);
    } else if (selectedProvider === 'currencyapi' && currencyApiKey) {
      localStorage.setItem('currencyApiKey', currencyApiKey);
    }
    
    localStorage.setItem('forexProvider', selectedProvider);
    onKeysUpdated();
  };

  const clearKeys = () => {
    localStorage.removeItem('alphaVantageKey');
    localStorage.removeItem('exchangeRateKey');
    localStorage.removeItem('currencyApiKey');
    localStorage.removeItem('forexProvider');
    setAlphaVantageKey('');
    setExchangeRateKey('');
    setCurrencyApiKey('');
    onKeysUpdated();
  };

  const getCurrentKey = () => {
    switch (selectedProvider) {
      case 'alphavantage': return alphaVantageKey;
      case 'exchangerate': return exchangeRateKey;
      case 'currencyapi': return currencyApiKey;
      default: return '';
    }
  };

  const setCurrentKey = (value: string) => {
    switch (selectedProvider) {
      case 'alphavantage': setAlphaVantageKey(value); break;
      case 'exchangerate': setExchangeRateKey(value); break;
      case 'currencyapi': setCurrencyApiKey(value); break;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Key Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription className="font-medium">
            ⚠️ Real-time forex data requires an API key. The application is currently using mock data.
          </AlertDescription>
        </Alert>
        
        <div className="mb-4 text-sm text-muted-foreground">
          <p className="mb-2">Select one of the following free API providers to get real-time market data:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Alpha Vantage <ExternalLink className="h-3 w-3" /></a> - Provides real-time forex rates and historical data</li>
            <li><a href="https://www.exchangerate-api.com/docs/free" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">ExchangeRate-API <ExternalLink className="h-3 w-3" /></a> - Simple currency conversion API</li>
            <li><a href="https://currencyapi.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">CurrencyAPI <ExternalLink className="h-3 w-3" /></a> - Reliable exchange rates API</li>
          </ul>
        </div>

        <Tabs value={selectedProvider} onValueChange={setSelectedProvider}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="alphavantage">Alpha Vantage</TabsTrigger>
            <TabsTrigger value="exchangerate">ExchangeRate-API</TabsTrigger>
            <TabsTrigger value="currencyapi">CurrencyAPI</TabsTrigger>
          </TabsList>

          <TabsContent value="alphavantage" className="space-y-4">
            <div>
              <Label htmlFor="alphavantage-key">Alpha Vantage API Key</Label>
              <Input
                id="alphavantage-key"
                type="password"
                placeholder="Enter your Alpha Vantage API key"
                value={alphaVantageKey}
                onChange={(e) => setAlphaVantageKey(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Get your free API key at{' '}
                <a 
                  href="https://www.alphavantage.co/support/#api-key" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Alpha Vantage <ExternalLink className="h-3 w-3" />
                </a>
                {' '}(500 requests/day free)
              </p>
            </div>
          </TabsContent>

          <TabsContent value="exchangerate" className="space-y-4">
            <div>
              <Label htmlFor="exchangerate-key">ExchangeRate-API Key</Label>
              <Input
                id="exchangerate-key"
                type="password"
                placeholder="Enter your ExchangeRate-API key"
                value={exchangeRateKey}
                onChange={(e) => setExchangeRateKey(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Get your free API key at{' '}
                <a 
                  href="https://app.exchangerate-api.com/sign-up" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  ExchangeRate-API <ExternalLink className="h-3 w-3" />
                </a>
                {' '}(1,500 requests/month free)
              </p>
            </div>
          </TabsContent>

          <TabsContent value="currencyapi" className="space-y-4">
            <div>
              <Label htmlFor="currencyapi-key">CurrencyAPI Key</Label>
              <Input
                id="currencyapi-key"
                type="password"
                placeholder="Enter your CurrencyAPI key"
                value={currencyApiKey}
                onChange={(e) => setCurrencyApiKey(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Get your free API key at{' '}
                <a 
                  href="https://currencyapi.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  CurrencyAPI <ExternalLink className="h-3 w-3" />
                </a>
                {' '}(300 requests/month free)
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="bg-muted/50 p-4 rounded-md border mt-4">
          <h4 className="font-medium mb-2">Current Status:</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium">Alpha Vantage:</div>
              <div className={alphaVantageKey ? "text-green-600" : "text-red-600"}>
                {alphaVantageKey ? "✓ Configured" : "✗ Not configured"}
              </div>
            </div>
            <div>
              <div className="font-medium">ExchangeRate-API:</div>
              <div className={exchangeRateKey ? "text-green-600" : "text-red-600"}>
                {exchangeRateKey ? "✓ Configured" : "✗ Not configured"}
              </div>
            </div>
            <div>
              <div className="font-medium">CurrencyAPI:</div>
              <div className={currencyApiKey ? "text-green-600" : "text-red-600"}>
                {currencyApiKey ? "✓ Configured" : "✗ Not configured"}
              </div>
            </div>
          </div>
          <div className={`mt-3 ${getCurrentKey() ? "text-green-600" : "text-red-600"} font-medium`}>
            {getCurrentKey() 
              ? `✓ ${selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} is selected and configured. Real-time data will be used.`
              : `✗ ${selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} is selected but not configured. Mock data will be used.`
            }
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={saveKeys} 
            disabled={!getCurrentKey()}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save & Use Real Data
          </Button>
          <Button 
            variant="outline" 
            onClick={clearKeys}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear Keys
          </Button>
        </div>

        {getCurrentKey() && (
          <Alert>
            <AlertDescription>
              API key saved for {selectedProvider}. The app will now use real forex data.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
