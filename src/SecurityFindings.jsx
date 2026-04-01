import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, ChevronRight, AlertCircle, ShieldAlert, CheckCircle, Info, MoreHorizontal } from 'lucide-react';
import * as XLSX from 'xlsx';

const SecurityFindings = ({ metrics, instanceUrl }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [severityFilters, setSeverityFilters] = useState([]);

  const toggleFilter = (current, item, setFn) => {
    if (item === 'All') {
      setFn([]);
    } else {
      setFn(current.includes(item) ? current.filter(i => i !== item) : [...current, item]);
    }
  };

  const SETUP_MAPPING = {
    'fail-rate': 'lightning/setup/LoginHistory/home',
    'never-login': 'lightning/setup/ManageUsers/home',
    'stale-passwords': 'lightning/setup/SecurityPolicies/home',
    'external-users': 'lightning/setup/ManageUsers/home',
    'priv-conc': 'lightning/setup/PermSets/home',
    'setup-volatility': 'lightning/setup/SecurityAuditTrail/home',
    'data-storage': 'lightning/setup/CompanyResourceStatus/home',
    'installed-packages': 'lightning/setup/ImportedPackage/home',
    'empty-roles': 'lightning/setup/Roles/home',
    'api-users': 'lightning/setup/ManageUsers/home',
    'oauth-sessions': 'lightning/setup/OauthConnectedApps/home',
    'multi-ip-logins': 'lightning/setup/LoginHistory/home',
    'toxic-privilege': 'lightning/setup/PermSets/home',
    'orphan-permsets': 'lightning/setup/PermSets/home',
    'manager-gap': 'lightning/setup/ManageUsers/home',
    'outbound-security': 'lightning/setup/SecurityRemoteProxy/home',
    'password-lockouts': 'lightning/setup/LoginHistory/home',
    'admin-impersonation': 'lightning/setup/SecurityAuditTrail/home'
  };

  const handleAction = (id) => {
    if (!instanceUrl) return;
    const path = SETUP_MAPPING[id] || 'lightning/setup/SetupOneHome/home';
    const finalUrl = `${instanceUrl}/${path}`;
    window.open(finalUrl, '_blank');
  };

  const findings = useMemo(() => {
    return metrics.map((m, index) => {
      let severity = 'LOW';
      let sevColor = 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      
      if (m.status === 'Critical') {
        severity = 'CRITICAL';
        sevColor = 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      } else if (m.status === 'At Risk') {
        severity = 'HIGH';
        sevColor = 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      } else if (m.status === 'Moderate') {
        severity = 'MEDIUM';
        sevColor = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      }

      const status = (m.status === 'Critical' || m.status === 'At Risk') ? 'Fail' : 
                     (m.status === 'Moderate') ? 'Warning' : 'Pass';

      return {
        id: `F-${100 + index + 1}`,
        name: m.title,
        severity,
        sevColor,
        category: m.group,
        impact: typeof m.value === 'number' ? `${m.value} items` : m.value,
        status,
        rawMetric: m,
        timeAgo: '2 mins ago' // Static for design parity
      };
    });
  }, [metrics]);

  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            f.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(f.category);
      const matchesSeverity = severityFilters.length === 0 || severityFilters.includes(f.severity);
      return matchesSearch && matchesCategory && matchesSeverity;
    });
  }, [findings, searchTerm, categoryFilters, severityFilters]);

  // Exclude 'All' from raw categories list
  const categories = [...new Set(findings.map(f => f.category))];

  const handleExport = () => {
    const exportData = filteredFindings.map(f => ({
      ID: f.id,
      Finding: f.name,
      Severity: f.severity,
      Category: f.category,
      Impact: f.impact,
      Status: f.status
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Security Findings");
    XLSX.writeFile(wb, "Salesforce_Security_Findings.xlsx");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Security Findings</h2>
          <p className="text-slate-400 font-medium">Prioritized list of risks detected in your org.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-900/50 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/50 w-64 transition-all"
            />
          </div>
          {/* Category Filter */}
          <div className="relative group">
            <button className={`flex items-center gap-2 px-4 py-2.5 bg-slate-900/50 border rounded-xl text-[13px] font-black transition-all duration-300 ${categoryFilters.length > 0 ? 'text-indigo-400 border-indigo-500/50 shadow-[0_0_15px_-5px_rgba(99,102,241,0.3)] hover:border-indigo-400' : 'text-slate-400 border-white/5 hover:text-white hover:bg-slate-800'}`}>
              <Filter className="w-3.5 h-3.5" />
              CATEGORY {categoryFilters.length > 0 && <span className="bg-indigo-500/20 px-1.5 py-0.5 rounded-md text-[10px] ml-1">{categoryFilters.length}</span>}
            </button>
            <div className="absolute right-0 top-[calc(100%+8px)] w-72 bg-slate-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-50 overflow-hidden">
              <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Select Domains</span>
                <button onClick={() => setCategoryFilters([])} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase letter-spacing-widest">Reset</button>
              </div>
              <div className="p-2 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <button
                  onClick={() => toggleFilter(categoryFilters, 'All', setCategoryFilters)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all mb-1 ${categoryFilters.length === 0 ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                >
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${categoryFilters.length === 0 ? 'bg-indigo-600 border-indigo-500' : 'border-white/10 bg-slate-900'}`}>
                    {categoryFilters.length === 0 && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  All Categories
                </button>
                {categories.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleFilter(categoryFilters, c, setCategoryFilters)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all mb-0.5 ${categoryFilters.includes(c) ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                  >
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${categoryFilters.includes(c) ? 'bg-indigo-600 border-indigo-500' : 'border-white/10 bg-slate-900'}`}>
                      {categoryFilters.includes(c) && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Severity Filter */}
          <div className="relative group">
            <button className={`flex items-center gap-2 px-4 py-2.5 bg-slate-900/50 border rounded-xl text-[13px] font-black transition-all duration-300 ${severityFilters.length > 0 ? 'text-amber-400 border-amber-500/50 shadow-[0_0_15px_-5px_rgba(251,191,36,0.3)] hover:border-amber-400' : 'text-slate-400 border-white/5 hover:text-white hover:bg-slate-800'}`}>
              <ShieldAlert className="w-3.5 h-3.5" />
              SEVERITY {severityFilters.length > 0 && <span className="bg-amber-500/20 px-1.5 py-0.5 rounded-md text-[10px] ml-1">{severityFilters.length}</span>}
            </button>
            <div className="absolute right-0 top-[calc(100%+8px)] w-60 bg-slate-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-50 overflow-hidden">
               <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Prioritize</span>
                <button onClick={() => setSeverityFilters([])} className="text-[10px] font-black text-amber-400 hover:text-amber-300 uppercase letter-spacing-widest">Reset</button>
              </div>
              <div className="p-2">
                <button
                  onClick={() => toggleFilter(severityFilters, 'All', setSeverityFilters)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all mb-1 ${severityFilters.length === 0 ? 'bg-amber-600/10 text-amber-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                >
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${severityFilters.length === 0 ? 'bg-amber-600 border-amber-500' : 'border-white/10 bg-slate-900'}`}>
                    {severityFilters.length === 0 && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  All Severities
                </button>
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
                  <button
                    key={s}
                    onClick={() => toggleFilter(severityFilters, s, setSeverityFilters)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all mb-0.5 ${severityFilters.includes(s) ? 'bg-amber-600/10 text-amber-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                  >
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${severityFilters.includes(s) ? 'bg-amber-600 border-amber-500' : 'border-white/10 bg-slate-900'}`}>
                      {severityFilters.includes(s) && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <span className={s === 'CRITICAL' ? 'text-rose-400' : s === 'HIGH' ? 'text-orange-400' : s === 'MEDIUM' ? 'text-amber-400' : 'text-blue-400'}>{s}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-white/5 rounded-xl text-sm font-bold text-slate-300 hover:text-white transition-all"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 uppercase text-[10px] font-black text-slate-500 tracking-wider">
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Finding Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Impact</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredFindings.map((f) => (
                <tr key={f.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${f.sevColor}`}>
                      {f.severity}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-white font-bold group-hover:text-indigo-400 transition-colors">{f.name}</span>
                      <span className="text-slate-500 text-[11px] font-medium tracking-wide">
                        {f.id} • {f.timeAgo}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-3 py-1 bg-slate-900/50 border border-white/5 text-slate-400 rounded-lg text-[10px] font-bold">
                      {f.category}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-slate-300 font-bold text-sm tracking-tight">{f.impact}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg w-fit border font-black text-[10px] ${
                      f.status === 'Pass' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
                      f.status === 'Fail' ? 'text-rose-400 bg-rose-400/10 border-rose-400/20' :
                      'text-amber-400 bg-amber-400/10 border-amber-400/20'
                    }`}>
                      {f.status === 'Pass' ? <CheckCircle size={12} /> : 
                       f.status === 'Fail' ? <AlertCircle size={12} /> : 
                       <ShieldAlert size={12} />}
                      {f.status}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <button 
                      onClick={() => handleAction(f.rawMetric.id)}
                      className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all active:scale-90"
                      title="View in Salesforce Setup"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SecurityFindings;
