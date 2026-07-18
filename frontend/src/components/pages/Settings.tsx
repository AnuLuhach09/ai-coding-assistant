import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import { ArrowLeft, Sparkles, Sliders, Save } from 'lucide-react';
import { motion } from 'framer-motion';

interface SettingsProps {
  onBackToDashboard: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBackToDashboard }) => {
  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('llama-3.1-8b-instant');
  const [temp, setTemp] = useState(0.7);
  const [tokens, setTokens] = useState(2048);
  const [stream, setStream] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        const settings = res.data.data.settings;
        setProvider(settings.aiProvider);
        setModel(settings.aiModel);
        setTemp(settings.temperature);
        setTokens(settings.maxTokens);
        setStream(settings.isStreaming);
      } catch (err) {
        console.error('Failed to load settings', err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      await api.put('/settings', {
        aiProvider: provider,
        aiModel: model,
        temperature: temp,
        maxTokens: tokens,
        isStreaming: stream,
      });
      setStatusMsg('Settings successfully updated.');
    } catch (err) {
      setStatusMsg('Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  // Model choices list depending on selected Provider
  const getModelsForProvider = (p: string) => {
    switch (p) {
      case 'groq':
        return [
          'llama-3.1-8b-instant',
          'llama-3.3-70b-versatile',
          'llama-3.1-70b-versatile',
          'mixtral-8x7b-32768',
          'gemma2-9b-it'
        ];
      case 'gemini':
        return ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];
      case 'openrouter':
        return [
          'meta-llama/llama-3.3-70b-instruct:free',
          'meta-llama/llama-3.2-3b-instruct:free',
          'nousresearch/hermes-3-llama-3.1-405b:free',
          'qwen/qwen3-coder:free',
          'google/gemma-2-9b-it:free'
        ];
      case 'ollama':
        return ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'qwen2.5-coder'];
      default:
        return [];
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <header className="mb-8 flex items-center space-x-4">
        <button
          onClick={onBackToDashboard}
          className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Sliders className="h-7 w-7 text-primary" /> Configuration Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure default AI intelligence providers, token limits, and parameters.
          </p>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6"
      >
        {statusMsg ? (
          <div className="rounded-lg bg-primary/10 p-3.5 text-sm text-primary border border-primary/20">
            {statusMsg}
          </div>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase tracking-wider">
              AI Provider
            </label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setModel(getModelsForProvider(e.target.value)[0] || '');
              }}
              className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            >
              <option value="groq">Groq (Free)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openrouter">OpenRouter (Free Models)</option>
              <option value="ollama">Ollama (Local / Free)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase tracking-wider">
              AI Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            >
              {getModelsForProvider(provider).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
              <span>Temperature</span>
              <span>{temp}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.1"
              value={temp}
              onChange={(e) => setTemp(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-[10px] text-muted-foreground">Lower values are focused, higher is creative.</span>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
              <span>Max Output Tokens</span>
              <span>{tokens}</span>
            </label>
            <input
              type="range"
              min="256"
              max="4096"
              step="128"
              value={tokens}
              onChange={(e) => setTokens(parseInt(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-[10px] text-muted-foreground">Maximum response token limit.</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 border-t border-border pt-6">
          <input
            type="checkbox"
            id="stream"
            checked={stream}
            onChange={(e) => setStream(e.target.checked)}
            className="h-4.5 w-4.5 rounded border-input bg-card text-primary focus:ring-primary"
          />
          <div>
            <label htmlFor="stream" className="text-sm font-semibold text-foreground cursor-pointer">
              Enable Token Streaming
            </label>
            <p className="text-xs text-muted-foreground">
              Characters stream live into the chat screen (SSE response model).
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button variant="primary" onClick={handleSave} isLoading={saving}>
            <Save className="mr-1.5 h-4 w-4" /> Save Settings
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
