import React from 'react';
import { Fingerprint, Lock, ShieldCheck, Database, Zap, Activity } from 'lucide-react';

export const formatCellValue = (key, val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return val.Name || JSON.stringify(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (key.toLowerCase().includes('date') && typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  }
  if (key.toLowerCase().includes('size') && typeof val === 'number') {
    if (val < 1024) return `${val} B`;
    if (val < 1024 * 1024) return `${(val / 1024).toFixed(1)} KB`;
    if (val < 1024 * 1024 * 1024) return `${(val / (1024 * 1024)).toFixed(1)} MB`;
    return `${(val / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return String(val);
};

export const getScoreGradient = (score) => {
  if (score >= 90) return 'from-emerald-400 to-teal-500';
  if (score >= 75) return 'from-emerald-400 to-amber-500';
  if (score >= 60) return 'from-amber-400 to-orange-500';
  return 'from-rose-500 to-red-600';
};

export const getScoreColor = (score) => {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 75) return 'text-yellow-400';
  if (score >= 60) return 'text-amber-500';
  return 'text-rose-500';
};

export const getScoreBgColor = (score) => {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 75) return 'bg-yellow-400';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
};

export const getGroupIcon = (name) => {
  if (name.includes('Identity')) return <Fingerprint className="w-5 h-5 text-indigo-400 opacity-90" />;
  if (name.includes('Privilege')) return <Lock className="w-5 h-5 text-purple-400 opacity-90" />;
  if (name.includes('Audit')) return <ShieldCheck className="w-5 h-5 text-emerald-400 opacity-90" />;
  if (name.includes('Govern')) return <Database className="w-5 h-5 text-blue-400 opacity-90" />;
  if (name.includes('Network')) return <Zap className="w-5 h-5 text-purple-400 opacity-90" />;
  return <Activity className="w-5 h-5 text-slate-400 opacity-90" />;
};

export const generateDestructiveXML = (items, metadataType) => {
  if (!items || items.length === 0) return null;
  
  // Standard members are the developer name (Name field for PermSets)
  // FALLBACK: Use Id if Name/DeveloperName is missing (common for Files, Users, etc.)
  const members = items.map(item => `    <members>${item.Name || item.DeveloperName || item.Id}</members>`).join('\n');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
${members}
        <name>${metadataType}</name>
    </types>
    <version>60.0</version>
</Package>`;
};
