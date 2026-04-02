import React, { useState, useEffect, useMemo } from 'react';
import SalesforceClient from './SalesforceClient.jsx';
import useSalesforceMetrics from './hooks/useSalesforceMetrics';
import MetricCard from './MetricCard.jsx';
import { 
  Shield, RefreshCw, LogOut, ChevronRight, Activity, Zap, 
  Server, X, Download, Moon, Sun, ShieldAlert, History, AlertTriangle, Sparkles, Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import AccessExplorer from './AccessExplorer.jsx';
import LoginView from './components/LoginView.jsx';
import SecurityFindings from './SecurityFindings.jsx';
import { formatCellValue, getScoreGradient, getScoreColor, getScoreBgColor, getGroupIcon, generateDestructiveXML } from './utils/formatters.jsx';

const DEFAULT_REDIRECT_URI = window.location.origin + '/callback';

const ENVS = {
  production: { label: 'Production', loginUrl: 'https://login.salesforce.com', color: 'bg-indigo-600 hover:bg-indigo-500', shadow: 'shadow-indigo-500/50' },
  sandbox:    { label: 'Sandbox',    loginUrl: 'https://test.salesforce.com',  color: 'bg-purple-600 hover:bg-purple-500', shadow: 'shadow-purple-500/50' },
  custom:     { label: 'Custom',     loginUrl: '',                              color: 'bg-emerald-600 hover:bg-emerald-500', shadow: 'shadow-emerald-500/50' },
};

function App() {
  const [client, setClient] = useState(null);
  const [instanceLabel, setInstanceLabel] = useState('');
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [env, setEnv] = useState('production');
  const [customUrl, setCustomUrl] = useState('');
  const [redirectUri, setRedirectUri] = useState(DEFAULT_REDIRECT_URI);
  const [authError, setAuthError] = useState(null);
  const [isExchanging, setIsExchanging] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [activeGroup, setActiveGroup] = useState(null);
  const [mainTab, setMainTab] = useState('Overview');
  const [isLightMode, setIsLightMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Custom Salesforce App Configuration
  const [clientId, setClientId] = useState(sessionStorage.getItem('sf_client_id') || '');
  const [clientSecret, setClientSecret] = useState(sessionStorage.getItem('sf_client_secret') || '');
  const [username, setUsername] = useState(sessionStorage.getItem('sf_username') || '');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [isLightMode]);

  const processExchange = async (code) => {
    if (!code) return;
    setIsExchanging(true);
    setAuthError(null);
    try {
      const loginUrl = sessionStorage.getItem('sf_login_url') || (env === 'custom' ? customUrl.trim() : ENVS[env].loginUrl);
      const storedRedirect = sessionStorage.getItem('sf_redirect_uri') || DEFAULT_REDIRECT_URI;
      const storedId = sessionStorage.getItem('sf_client_id') || clientId.trim();
      const storedSecret = sessionStorage.getItem('sf_client_secret') || clientSecret.trim();
      
      if (!storedId) {
        console.error("OAuth Error: No Client ID available.");
        throw new Error("Client ID required. Please enter it and try again.");
      }

      console.log(`Exchanging code for token with ${loginUrl}...`);
      const decodedCode = decodeURIComponent(code).replace("%3D", "=");
      const data = await SalesforceClient.exchangeCodeForToken(decodedCode, storedId, storedSecret, storedRedirect, loginUrl);
      
      console.log("Token exchange successful!");
      sessionStorage.setItem('sf_access_token', data.access_token);
      sessionStorage.setItem('sf_instance_url', data.instance_url);
      setClient(new SalesforceClient(decodeURIComponent(data.instance_url), data.access_token));
      setInstanceLabel(sessionStorage.getItem('sf_env_label') || 'Connected');
      
      window.history.replaceState(null, null, '/'); 
    } catch (err) {
      console.error("OAuth Exchange Error:", err);
      setAuthError(`OAuth Error: ${err.message}`);
    } finally {
      setIsExchanging(false);
    }
  };

  useEffect(() => {
    // 1. Check if we are the popup window that just got the code
    const urlParams = new URLSearchParams(window.location.search);
    const codeInUrl = urlParams.get('code');
    const errInUrl = urlParams.get('error');

    if (errInUrl) {
      if (window.opener) {
        window.opener.postMessage({ type: 'SF_AUTH_ERROR', error: errInUrl }, window.location.origin);
        window.close();
      } else {
        setAuthError(urlParams.get('error_description') || errInUrl);
        window.history.replaceState(null, null, window.location.pathname);
      }
      return;
    }

    if (codeInUrl) {
      if (window.opener) {
        // Send code back to main window and close this popup
        window.opener.postMessage({ type: 'SF_AUTH_CODE', code: codeInUrl }, window.location.origin);
        setTimeout(() => window.close(), 100);
        return;
      } else {
        // We are the main window and somehow got a code in URL (e.g. reload or no popup)
        processExchange(codeInUrl);
      }
    } else {
      // 2. Check for existing session
      const storedToken = sessionStorage.getItem('sf_access_token');
      const storedUrl = sessionStorage.getItem('sf_instance_url');
      if (storedToken && storedUrl) {
        setClient(new SalesforceClient(decodeURIComponent(storedUrl), storedToken));
        setInstanceLabel(sessionStorage.getItem('sf_env_label') || 'Connected');
      }
    }

    // 3. Listen for codes from potential popups
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'SF_AUTH_CODE') {
        processExchange(event.data.code);
      } else if (event.data?.type === 'SF_AUTH_ERROR') {
        setAuthError(event.data.error);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clientId, clientSecret, env, customUrl]);

  const { metrics, overallScore, loading, error, refresh } = useSalesforceMetrics(client);

  const groupData = useMemo(() => {
    const groups = {};
    metrics.forEach(m => {
      const gName = m.group || 'Other';
      if (!groups[gName]) {
        groups[gName] = { name: gName, points: 0, maxPoints: 0, metrics: [] };
      }
      groups[gName].points += (m.points || 0);
      groups[gName].maxPoints += (m.maxPoints || 0);
      groups[gName].metrics.push(m);
    });

    const order = ['Identity & Access', 'Auditability & Monitoring', 'Governance & Utilization', 'Network & Integrations'];
    return Object.values(groups)
      .map(g => ({
        ...g, score: g.maxPoints > 0 ? Math.min(100, (g.points / g.maxPoints) * 100) : 100
      }))
      .sort((a, b) => {
        const indexA = order.indexOf(a.name);
        const indexB = order.indexOf(b.name);
        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
      });
  }, [metrics]);

  const summary = useMemo(() => {
    const critical = metrics.filter(m => m.status === 'Critical').length;
    const privilegedMetric = metrics.find(m => m.id === 'priv-conc');
    const privilegedVal = privilegedMetric ? (typeof privilegedMetric.value === 'string' ? privilegedMetric.value.split('%')[0] : privilegedMetric.value) : '0';
    const setupActivity = metrics.find(m => m.id === 'setup-volatility');
    const lastChangeRecord = setupActivity?.drillDownData?.[0];
    const monitoringMetric = groupData.find(g => g.name === 'Auditability & Monitoring');
    let monitoringGap = 'High';
    if (monitoringMetric) {
      if (monitoringMetric.score >= 90) monitoringGap = 'Low';
      else if (monitoringMetric.score >= 70) monitoringGap = 'Med';
    }
    return { critical, privilegedUsers: privilegedVal, lastChangeRecord, monitoringGap };
  }, [metrics, groupData]);

  useEffect(() => {
    if (groupData.length > 0 && !activeGroup) {
      setActiveGroup(groupData[0].name);
    }
  }, [groupData, activeGroup]);

  useEffect(() => {
    setSearchTerm('');
    setSelectedIds([]);
  }, [selectedMetric]);

  const handleGenerateUrl = async () => {
    const loginUrl = env === 'custom' ? customUrl.trim() : ENVS[env].loginUrl;
    if (!loginUrl) { alert('Please enter a custom login URL.'); return; }
    if (!clientId.trim()) { alert('Please enter your Connected App Client ID.'); return; }
    
    const finalRedirect = redirectUri.trim() || DEFAULT_REDIRECT_URI;
    
    sessionStorage.setItem('sf_username', username.trim());
    sessionStorage.setItem('sf_client_id', clientId.trim());
    sessionStorage.setItem('sf_client_secret', clientSecret.trim());
    sessionStorage.setItem('sf_env_label', env === 'custom' ? customUrl : ENVS[env].label);
    sessionStorage.setItem('sf_login_url', loginUrl);
    sessionStorage.setItem('sf_redirect_uri', finalRedirect);
    
    const url = await SalesforceClient.generateAuthCodeUrl(clientId.trim(), finalRedirect, loginUrl, username.trim());
    
    // Open login in a centered popup window
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    
    window.open(url, 'SalesforceLogin', `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`);
  };

  const handleDirectConnect = async () => {
    if (!clientId.trim() || !clientSecret.trim() || !username.trim() || !password.trim()) {
      setAuthError("Client ID, Secret, Username and Password are all required for direct connection.");
      return;
    }
    setIsExchanging(true);
    setAuthError(null);
    try {
      const loginUrl = env === 'custom' ? customUrl.trim() : ENVS[env].loginUrl;
      const data = await SalesforceClient.loginWithPassword(
        username.trim(), password.trim(), clientId.trim(), clientSecret.trim(), loginUrl
      );
      
      sessionStorage.setItem('sf_username', username.trim());
      sessionStorage.setItem('sf_client_id', clientId.trim());
      sessionStorage.setItem('sf_client_secret', clientSecret.trim());
      sessionStorage.setItem('sf_env_label', env === 'custom' ? customUrl : ENVS[env].label);
      sessionStorage.setItem('sf_login_url', loginUrl);
      
      sessionStorage.setItem('sf_access_token', data.access_token);
      sessionStorage.setItem('sf_instance_url', data.instance_url);
      
      setClient(new SalesforceClient(decodeURIComponent(data.instance_url), data.access_token));
      setInstanceLabel(sessionStorage.getItem('sf_env_label') || 'Connected');
    } catch (err) {
      setAuthError(`Direct Login Error: ${err.message}`);
    } finally {
      setIsExchanging(false);
    }
  };

  const handleManualExchange = async () => {
    if (!manualCode.trim()) { setAuthError("Please paste the code first!"); return; }
    setIsExchanging(true);
    setAuthError(null);
    try {
      const loginUrl = sessionStorage.getItem('sf_login_url') || (env === 'custom' ? customUrl.trim() : ENVS[env].loginUrl);
      const storedRedirect = sessionStorage.getItem('sf_redirect_uri') || DEFAULT_REDIRECT_URI;
      const storedId = sessionStorage.getItem('sf_client_id') || clientId.trim();
      const storedSecret = sessionStorage.getItem('sf_client_secret') || clientSecret.trim();
      
      if (!storedId) throw new Error("Client ID required.");

      processExchange(manualCode.trim());
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsExchanging(false);
    }
  };

  const handleLogout = () => { sessionStorage.clear(); setClient(null); };

  const handleExportData = () => {
    if (!selectedMetric || !selectedMetric.drillDownData || selectedMetric.drillDownData.length === 0) return;
    const data = selectedMetric.drillDownData;
    const rawHeaders = Object.keys(data[0]).filter(k => k !== 'attributes');
    const formattedHeaders = rawHeaders.map(key => key.replace(/([A-Z])/g, ' $1').trim().toUpperCase());
    const rows = data.map(row => {
      const rowData = {};
      rawHeaders.forEach((header, index) => {
        const val = row[header];
        rowData[formattedHeaders[index]] = formatCellValue(header, val);
      });
      return rowData;
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Metric Data");
    worksheet['!cols'] = formattedHeaders.map(h => ({ wch: Math.max(h.length, 25) }));
    XLSX.writeFile(workbook, `${selectedMetric.id}-export.xlsx`);
  };

  const handleGenerateCleanup = () => {
    if (!selectedMetric || !selectedMetric.drillDownData || !selectedMetric.metadataType) return;
    
    // Only cleanup selected items
    const itemsToCleanup = selectedMetric.drillDownData.filter(item => selectedIds.includes(item.Id));
    
    if (itemsToCleanup.length === 0) {
      alert("Please select at least one item to cleanup.");
      return;
    }

    const xml = generateDestructiveXML(itemsToCleanup, selectedMetric.metadataType);
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `destructiveChanges-${selectedMetric.id}.xml`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!client) {
    return (
      <LoginView 
        env={env} setEnv={setEnv} ENVS={ENVS} handleGenerateUrl={handleGenerateUrl}
        customUrl={customUrl} setCustomUrl={setCustomUrl} manualCode={manualCode}
        setManualCode={setManualCode} handleManualExchange={handleManualExchange}
        isExchanging={isExchanging} authError={authError} setShowSetup={setShowSetup} showSetup={showSetup}
        clientId={clientId} setClientId={setClientId} clientSecret={clientSecret} setClientSecret={setClientSecret}
        redirectUri={redirectUri} setRedirectUri={setRedirectUri}
        username={username} setUsername={setUsername}
        password={password} setPassword={setPassword}
        handleDirectConnect={handleDirectConnect}
      />
    );
  }

  const activeGroupData = groupData.find(g => g.name === activeGroup);

  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-indigo-500/30">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-slate-950 transition-colors duration-500">
      </div>

      <header className="fixed top-0 inset-x-0 h-20 bg-slate-950/70 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <Shield className="w-6 h-6 text-[#ffffff]" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-white tracking-tight">Org Guardian</h1>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <p className="text-xs text-emerald-400/80 font-bold tracking-widest uppercase">{instanceLabel}</p>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center bg-white/5 p-1 rounded-2xl border border-white/5 backdrop-blur-md">
            {['Overview', 'Security Findings', 'Access Explorer'].map(t => (
              <button 
                key={t} onClick={() => setMainTab(t.replace(/ /g, ''))}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${mainTab === t.replace(/ /g, '') ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
              >
                {t}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-xl transition-all border border-transparent hover:border-indigo-500/20 bg-slate-900/50"
              title="Toggle Theme"
            >
              {isLightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button 
              onClick={refresh} disabled={loading}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all disabled:opacity-50 border border-transparent hover:border-white/10 bg-slate-900/50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl font-bold transition-all border border-transparent hover:border-rose-500/20 text-sm bg-slate-900/50"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          </div>
        </div>
      </header>

      {mainTab === 'Overview' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 relative z-10 space-y-12">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-6 rounded-3xl flex items-center justify-between gap-6 backdrop-blur-xl animate-fade-in mb-8">
              <div className="flex items-center gap-4 text-left">
                <div className="p-3 bg-rose-500/20 rounded-2xl flex-shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="text-white font-black text-lg">System Alert</h4>
                  <p className="text-sm font-medium text-rose-400/80 leading-relaxed">Some security metrics are inaccessible due to Salesforce permission limits. Most data will still be available. <span className="opacity-50">[{error}]</span></p>
                </div>
              </div>
              <button 
                onClick={refresh}
                className="px-6 py-3 bg-rose-500 hover:bg-rose-400 text-white rounded-2xl text-sm font-black transition-all shadow-lg active:scale-95 whitespace-nowrap"
              >
                Retry Assessment
              </button>
            </div>
          )}

          {loading && metrics.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
              <RefreshCw className="w-16 h-16 text-indigo-500 animate-spin opacity-50" />
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">Security Deep-Scan in Progress</h3>
                <p className="text-slate-400 text-sm font-medium">Analyzing your organization's security posture across all domains...</p>
              </div>
            </div>
          )}

          <div className={`${(loading && metrics.length === 0) ? 'hidden' : 'block'}`}>

          <div className="glass-panel rounded-3xl p-8 mb-12 border border-white/10 flex flex-col items-center gap-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row items-center gap-12 w-full pb-8 border-b border-white/5">
              <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
                <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 bg-gradient-to-br ${getScoreGradient(overallScore)} animate-pulse-slow`}></div>
                <svg viewBox="0 0 256 256" className="w-full h-full transform -rotate-90 relative z-10 drop-shadow-2xl">
                  <circle cx="128" cy="128" r="110" fill="none" stroke="currentColor" strokeWidth="16" className="text-slate-800/50" />
                  <defs>
                    <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className={overallScore >= 90 ? 'text-emerald-400' : overallScore >= 75 ? 'text-yellow-400' : overallScore >= 60 ? 'text-amber-500' : 'text-rose-500'} stopColor="currentColor" />
                      <stop offset="100%" className={overallScore >= 90 ? 'text-teal-500' : overallScore >= 75 ? 'text-amber-500' : overallScore >= 60 ? 'text-orange-500' : 'text-red-600'} stopColor="currentColor" />
                    </linearGradient>
                  </defs>
                  <circle cx="128" cy="128" r="110" fill="none" stroke="url(#score-gradient)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(overallScore * 691) / 100} 691`} className={`transition-all duration-1000 ease-out`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-20">
                  <span className={`text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br ${getScoreGradient(overallScore)} drop-shadow-sm`}>{Math.round(overallScore)}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Health</span>
                </div>
              </div>
              
              <div className="flex-1 space-y-4 text-center md:text-left">
                <div className="inline-flex px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-widest border border-indigo-500/20 backdrop-blur-md">
                  <Zap className="w-3 h-3 mr-1.5" /> Core Posture Analysis
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                  Security is <span className={`bg-clip-text text-transparent bg-gradient-to-r ${getScoreGradient(overallScore)}`}>{overallScore >= 90 ? 'Excellent' : overallScore >= 75 ? 'Good' : 'At Risk'}</span>
                </h2>
                <p className="text-slate-400 leading-relaxed text-sm max-w-2xl font-medium">
                  Comprehensive analysis across Identity, Access, Auditability, and Governance. 
                  {overallScore < 75 ? ' Critical vulnerabilities detected.' : ' Operating within acceptable thresholds.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              {[
                { label: 'Critical Findings', val: summary.critical, icon: <AlertTriangle />, color: summary.critical > 0 ? 'text-rose-500' : 'text-slate-200', bg: summary.critical > 0 ? 'bg-rose-500/[0.03] border-rose-500/20' : 'bg-slate-900/40 border-white/5' },
                { label: 'Privileged Accounts', val: summary.privilegedUsers + '%', icon: <ShieldAlert />, color: 'text-indigo-400', bg: 'bg-slate-900/40 border-white/5' },
                { label: 'Last Setup Activity', val: summary.lastChangeRecord ? formatCellValue('CreatedDate', summary.lastChangeRecord.CreatedDate).split(',')[0] : 'N/A', icon: <History />, color: 'text-slate-200', bg: 'bg-slate-900/40 border-white/5', sub: summary.lastChangeRecord ? `by ${summary.lastChangeRecord.DelegateUser || 'System Admin'}` : 'None', textSize: 'text-lg' },
                { label: 'Monitoring Risk', val: summary.monitoringGap, icon: <Activity />, color: summary.monitoringGap === 'High' ? 'text-amber-500' : 'text-emerald-500', bg: 'bg-slate-900/40 border-white/5' }
              ].map((s, i) => (
                <div key={i} className={`p-5 rounded-2xl border transition-all ${s.bg}`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{s.label}</span>
                    {React.cloneElement(s.icon, { className: `w-4 h-4 ${s.color}` })}
                  </div>
                  <div className={`${s.textSize || 'text-4xl'} font-black ${s.color} truncate`}>{s.val}</div>
                  <div className="text-[10px] font-bold text-slate-500 mt-2">{s.sub || 'Health Indicator'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Security Domains</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {groupData.map(group => (
                <button
                  key={group.name} onClick={() => setActiveGroup(group.name)}
                  className={`relative p-6 rounded-2xl border transition-all duration-500 text-left overflow-hidden group ${activeGroup === group.name ? 'bg-indigo-600/10 border-indigo-500/40 ring-1 ring-indigo-500/20' : 'glass-card border-white/5 hover:border-white/10'}`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-2 rounded-lg ${activeGroup === group.name ? 'bg-indigo-500/20' : 'bg-slate-900/50'}`}>
                      {getGroupIcon(group.name)}
                    </div>
                    <div className={`text-2xl font-black ${getScoreColor(group.score)}`}>{Math.round(group.score)}</div>
                  </div>
                  <div className="font-bold text-slate-200 mb-2 truncate">{group.name}</div>
                  <div className="w-full bg-slate-800/50 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${getScoreBgColor(group.score)}`} style={{ width: `${group.score}%` }}></div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <section className="mt-12 animate-fade-in-up">
            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
              <h3 className="text-2xl font-black text-white">{activeGroup} Metrics</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeGroupData?.metrics.map(metric => (
                <MetricCard 
                  key={metric.id} {...metric} 
                  onClick={() => metric.drillDownData && setSelectedMetric(metric)} 
                />
              ))}
            </div>
          </section>
          </div>
        </main>
      )}

      {mainTab === 'SecurityFindings' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 relative z-10">
          <SecurityFindings metrics={metrics} instanceUrl={client?.instanceUrl} />
        </main>
      )}

      {mainTab === 'AccessExplorer' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 relative z-10">
          <AccessExplorer client={client} instanceUrl={client?.instanceUrl} />
        </main>
      )}

      {selectedMetric && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-fade-in" onClick={() => setSelectedMetric(null)}></div>
          <div className="bg-slate-900 border border-white/10 w-full max-w-6xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl relative z-10 animate-fade-in-up flex flex-col">
            <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/50 backdrop-blur-md">
              <div className="flex-1">
                <h3 className="text-xl font-black text-white">{selectedMetric.title}</h3>
                <p className="text-slate-400 text-sm font-medium">{selectedMetric.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* Search Bar */}
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Filter results..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all w-64"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {selectedMetric.showCleanupIcon && (
                    <button 
                      onClick={handleGenerateCleanup} 
                      disabled={selectedIds.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                    >
                      <Sparkles size={16} /> Cleanup ({selectedIds.length})
                    </button>
                  )}
                  <button onClick={handleExportData} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all"><Download size={16} /> Export Excel</button>
                  <button onClick={() => setSelectedMetric(null)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"><X size={20} /></button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {selectedMetric.drillDownData && selectedMetric.drillDownData.length > 0 ? (() => {
                const filtered = selectedMetric.drillDownData.filter(row => 
                  Object.values(row).some(val => 
                    String(val).toLowerCase().includes(searchTerm.toLowerCase())
                  )
                );

                const allFilteredSelected = filtered.length > 0 && filtered.every(r => selectedIds.includes(r.Id));

                const toggleSelectAll = () => {
                  if (allFilteredSelected) {
                    setSelectedIds(prev => prev.filter(id => !filtered.some(f => f.Id === id)));
                  } else {
                    const newIds = filtered.map(f => f.Id).filter(id => !selectedIds.includes(id));
                    setSelectedIds(prev => [...prev, ...newIds]);
                  }
                };

                return (
                  <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-slate-400 text-[10px] uppercase tracking-widest font-black">
                        <th className="px-4 py-2 w-10">
                          <input 
                            type="checkbox" 
                            checked={allFilteredSelected}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-white/10 bg-white/5 checked:bg-indigo-500 transition-all cursor-pointer accent-indigo-500"
                          />
                        </th>
                        {Object.keys(selectedMetric.drillDownData[0]).filter(k => k !== 'attributes' && k !== 'Id').map(key => (
                          <th key={key} className="px-4 py-2">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium">
                      {filtered.map((row, i) => (
                        <tr key={i} className={`group border border-white/5 rounded-xl transition-colors ${selectedIds.includes(row.Id) ? 'bg-indigo-500/10' : 'bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                          <td className="px-4 py-4 first:rounded-l-xl border-y border-white/5 first:border-l">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.includes(row.Id)}
                              onChange={() => {
                                setSelectedIds(prev => 
                                  prev.includes(row.Id) ? prev.filter(id => id !== row.Id) : [...prev, row.Id]
                                );
                              }}
                              className="w-4 h-4 rounded border-white/10 bg-white/5 checked:bg-indigo-500 transition-all cursor-pointer accent-indigo-500"
                            />
                          </td>
                          {Object.keys(row).filter(k => k !== 'attributes' && k !== 'Id').map(col => (
                            <td key={col} className="px-4 py-4 text-slate-300 last:rounded-r-xl border-y border-white/5 last:border-r">
                              {formatCellValue(col, row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })() : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                    <Shield className="text-slate-500" size={32} />
                  </div>
                  <h4 className="text-white font-black text-lg">No Issues Detected</h4>
                  <p className="text-slate-500 max-w-xs mx-auto">All systems are clear in this domain. No specific records require your attention at this time.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
