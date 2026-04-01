import React from 'react';
import { Shield, ExternalLink, Settings, X, ChevronRight, AlertTriangle, Key, Lock, Globe, RefreshCw, User, Mail, Zap } from 'lucide-react';

const LoginView = ({ 
  env, 
  setEnv, 
  ENVS, 
  handleGenerateUrl, 
  customUrl, 
  setCustomUrl, 
  manualCode, 
  setManualCode, 
  handleManualExchange, 
  isExchanging, 
  authError, 
  setShowSetup, 
  showSetup,
  clientId,
  setClientId,
  clientSecret,
  setClientSecret,
  redirectUri,
  setRedirectUri,
  username,
  setUsername,
  password,
  setPassword,
  handleDirectConnect
}) => {
  const activeEnv = ENVS[env];

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden">
      {/* Animated Background Orbs */}


      <div className="z-10 max-w-md w-full text-center space-y-8 animate-fade-in-up">
        {/* Logo */}
        <div className="flex justify-center">
          <div className={`p-4 rounded-3xl ${activeEnv.color} ${activeEnv.shadow} shadow-2xl transition-all duration-500 transform hover:scale-105`}>
            <Shield size={64} className="text-white drop-shadow-lg" />
          </div>
        </div>

        <div>
          <h1 className="text-5xl font-black tracking-tight mb-3 text-white drop-shadow-sm">Org Guardian</h1>
          <p className="text-slate-400 text-lg font-medium">Secure your Salesforce environment with real-time health monitoring.</p>
        </div>

        <div className="glass-panel rounded-3xl p-6 space-y-6">
          {/* Environment Selector */}
          <div className="bg-white/5 rounded-2xl p-1 flex gap-1 border border-white/10">
            {Object.entries(ENVS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setEnv(key)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  env === key
                    ? 'bg-slate-800 text-white shadow-lg border border-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {val.label}
              </button>
            ))}
          </div>

          <div className="space-y-4 pt-2">
            <div className="text-left">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-2">
                <Key size={12} className="text-indigo-500" /> Connected App Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter Client ID"
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium text-sm"
              />
            </div>

            <div className="text-left">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-2">
                <Lock size={12} className="text-purple-500" /> Client Secret
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Enter Client Secret"
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all font-medium text-sm"
              />
            </div>

            <div className="text-left">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-2">
                <Globe size={12} className="text-blue-500" /> Redirect URI
              </label>
              <input
                type="text"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2.5 text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-white/5">
            <div className="text-left">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-2">
                <Mail size={12} className="text-emerald-500" /> Username / Email
              </label>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@company.com"
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium text-sm"
              />
            </div>

            <div className="text-left">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-2">
                <Lock size={12} className="text-rose-500" /> Salesforce Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 transition-all font-medium text-sm"
              />
              <p className="mt-1.5 ml-1 text-[9px] text-slate-500 leading-tight">
                Append your **Security Token** if logging in from an untrusted IP.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 gap-3 pt-2">
            <button
              onClick={handleDirectConnect}
              disabled={isExchanging}
              className={`w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl py-4 font-black transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50`}
            >
              {isExchanging ? <RefreshCw className="animate-spin" size={20} /> : <Zap size={20} />}
              Direct Connect
            </button>

            <button
              onClick={handleGenerateUrl}
              className={`w-full bg-white/5 hover:bg-white/10 text-slate-200 rounded-2xl py-3 font-bold transition-all border border-white/10 flex items-center justify-center gap-3 active:scale-95`}
            >
              Authenticate with OAuth
              <ExternalLink size={18} />
            </button>
          </div>

          <button 
            onClick={() => setShowSetup(!showSetup)}
            className="w-full bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl py-3 font-bold transition-all flex items-center justify-center gap-2 border border-white/10"
          >
            {showSetup ? <X size={18} /> : <Settings size={18} />}
            {showSetup ? 'Hide Advanced' : 'Manual Code Exchange'}
          </button>

          {showSetup && (
            <div className="pt-4 space-y-4 border-t border-white/5 animate-fade-in-up">
              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Auth Code</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Paste code here..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-xs"
                  />
                  <button
                    onClick={handleManualExchange}
                    disabled={isExchanging}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 rounded-xl transition-all active:scale-95"
                  >
                    {isExchanging ? <RefreshCw className="animate-spin w-5 h-5 mx-auto" /> : <ChevronRight />}
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-slate-500 font-medium">Use this if automatic redirection fails.</p>
              </div>
            </div>
          )}

          {authError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm flex items-center gap-3 animate-pulse">
              <AlertTriangle className="flex-shrink-0" size={18} />
              <p className="font-bold">{authError}</p>
            </div>
          )}
        </div>

        <p className="text-slate-500 text-sm font-medium">
          Guardian uses OAuth 2.0 PKCE. Your credentials are never stored.
        </p>
      </div>
    </div>
  );
};

export default LoginView;
