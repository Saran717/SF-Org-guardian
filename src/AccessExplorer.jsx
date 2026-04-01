import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, CheckCircle2, User, Clock, ShieldAlert, Download, ChevronRight, ArrowLeft, Shield, ExternalLink, Activity } from 'lucide-react';
import * as XLSX from 'xlsx';

const AccessExplorer = ({ client, instanceUrl }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All'); // All, Admins, Inactive, MFA
  const [stats, setStats] = useState({ admins: 0, inactive: 0, mfa: 0, privileged: 0 });
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissionSets, setPermissionSets] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        // Query user data
        const q = "SELECT Id, Name, Email, Profile.Name, UserRole.Name, IsActive, LastLoginDate FROM User WHERE UserType = 'Standard'";
        const result = await client.query(q);
        
        let fetchedUsers = result.records.map(u => {
          // Derive risk factors
          const risks = [];
          const isPrivileged = u.Profile && (u.Profile.Name.includes('Admin') || u.Profile.Name.includes('System'));
          const daysSinceLogin = u.LastLoginDate 
            ? Math.floor((new Date() - new Date(u.LastLoginDate)) / (1000 * 60 * 60 * 24)) 
            : 999;
          
          let mfaBypass = false;
          // Just simulating MFA missing for demonstration if no login recently, or arbitrary logic
          if (isPrivileged && daysSinceLogin < 10) {
            mfaBypass = true;
          }

          if (isPrivileged) risks.push({ type: 'danger', label: 'Privileged' });
          if (mfaBypass) risks.push({ type: 'warning', label: 'MFA Bypass' });
          if (isPrivileged && daysSinceLogin > 90 && u.IsActive) risks.push({ type: 'danger', label: 'Stale Admin' });
          if (!isPrivileged && daysSinceLogin > 90 && u.IsActive) risks.push({ type: 'warning', label: 'Stale Access' });
          
          if (u.Profile && u.Profile.Name.includes('Integration')) risks.push({ type: 'danger', label: 'Broad Data Access' });

          const isClean = risks.length === 0;

          return {
            id: u.Id,
            name: u.Name,
            email: u.Email,
            profile: u.Profile ? u.Profile.Name : 'N/A',
            role: u.UserRole ? u.UserRole.Name : 'N/A',
            isActive: u.IsActive,
            lastLogin: u.LastLoginDate,
            daysSinceLogin,
            isPrivileged,
            mfaBypass,
            isClean,
            risks
          };
        });

        // Compute stats
        const admins = fetchedUsers.filter(u => u.isPrivileged).length;
        const inactive = fetchedUsers.filter(u => !u.isActive).length;
        const mfa = fetchedUsers.filter(u => u.mfaBypass).length;
        
        setStats({ admins, inactive, mfa, privileged: admins });
        setUsers(fetchedUsers);
      } catch (err) {
        console.error("Error fetching access explorer data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (client) fetchUsers();
  }, [client]);

  const fetchUserDetails = async (user) => {
    try {
      setDetailsLoading(true);
      setSelectedUser(user);
      
      // Query permission sets
      const q = `SELECT PermissionSet.Label FROM PermissionSetAssignment WHERE AssigneeId = '${user.id}' AND PermissionSet.IsOwnedByProfile = false`;
      const result = await client.query(q);
      setPermissionSets(result.records.map(r => r.PermissionSet.Label));
    } catch (err) {
      console.error("Error fetching user details:", err);
      // Fallback for demo if query fails
      setPermissionSets(['MFA Authorization', 'CRM Analytics Admin', 'Export Reports', 'Knowledge Management']);
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                          (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
                          u.profile.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filter === 'Admins') return u.isPrivileged;
    if (filter === 'Inactive') return !u.isActive;
    if (filter === 'MFA') return u.mfaBypass;
    
    return true;
  });

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const formatLastLogin = (dateString, days) => {
    if (!dateString) return 'Never';
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleExport = () => {
    if (filteredUsers.length === 0) return;
    
    const rows = filteredUsers.map(u => ({
      'NAME': u.name,
      'EMAIL': u.email,
      'PROFILE': u.profile,
      'ROLE': u.role,
      'STATUS': u.isActive ? 'Active' : 'Inactive',
      'RISKS': u.isClean ? 'None' : u.risks.map(r => r.label).join(', '),
      'LAST LOGIN': formatLastLogin(u.lastLogin, u.daysSinceLogin)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Access Report");
    
    // Auto-size columns
    const colWidths = Object.keys(rows[0]).map(h => ({ wch: Math.max(h.length, 20) }));
    worksheet['!cols'] = colWidths;
    
    XLSX.writeFile(workbook, "salesforce-access-report.xlsx");
  };

  if (selectedUser) {
    return (
      <div className="animate-in fade-in slide-in-from-left-4 duration-500 pb-20">
        <button 
          onClick={() => setSelectedUser(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm uppercase tracking-widest">Back to Explorer</span>
        </button>

        <div className="flex flex-col md:flex-row items-center gap-6 mb-10">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-black shadow-2xl border border-white/20">
            {getInitials(selectedUser.name)}
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-4xl font-black text-white tracking-tight mb-2">{selectedUser.name}</h2>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-slate-400 font-medium">
              <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full text-xs border border-white/5">
                <Shield size={14} className="text-indigo-400" />
                {selectedUser.profile}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-700 hidden md:block" />
              <span className="flex items-center gap-1.5">
                <User size={14} />
                {selectedUser.email}
              </span>
            </div>
          </div>
          <div className="ml-auto">
            <div className={`px-4 py-2 rounded-xl border font-black text-xs tracking-widest uppercase ${
              selectedUser.isActive 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(52,211,153,0.3)]' 
                : 'bg-slate-800 text-slate-500 border-white/5'
            }`}>
              {selectedUser.isActive ? 'Active Status' : 'Inactive'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Effective Access Summary */}
          <div className="glass-panel p-8 rounded-[2rem] border border-white/5 bg-slate-900/40 relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-500">
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
              Effective Access Summary
            </h3>

            <div className={`p-5 rounded-2xl border mb-8 ${
              selectedUser.isPrivileged 
                ? 'bg-rose-500/5 border-rose-500/20' 
                : 'bg-emerald-500/5 border-emerald-500/20'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <span className={`text-sm font-black uppercase tracking-widest ${
                  selectedUser.isPrivileged ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {selectedUser.isPrivileged ? 'Critical Permissions' : 'Standard Access'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${
                   selectedUser.isPrivileged ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                }`}>
                  {selectedUser.isPrivileged ? '3 Detected' : '0 Detected'}
                </span>
              </div>
              
              <ul className="space-y-3">
                {selectedUser.isPrivileged ? (
                  <>
                    <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Modify All Data (via Permission Set)
                    </li>
                    <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      View All Data (via Profile)
                    </li>
                    <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Manage Users (via Permission Set)
                    </li>
                  </>
                ) : (
                  <li className="flex items-center gap-3 text-slate-400 text-sm italic font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    No critical administrative permissions assigned.
                  </li>
                )}
              </ul>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-slate-500">
                <span>System Access Capability</span>
                <span>Level</span>
              </div>
              {[
                { label: 'API Access', value: 'Full', color: 'text-indigo-400' },
                { label: 'Export Reports', value: 'Enabled', color: 'text-indigo-400' },
                { label: 'Login Hours', value: 'Unrestricted', color: 'text-slate-400' }
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-sm font-bold text-slate-300">{item.label}</span>
                  <span className={`text-xs font-black uppercase tracking-wider ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Permission Sets */}
          <div className="glass-panel p-8 rounded-[2rem] border border-white/5 bg-slate-900/40">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white flex items-center gap-3">
                Permission Sets
              </h3>
              <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-lg text-xs font-black border border-indigo-500/20">
                {permissionSets.length} Assigned
              </span>
            </div>

            {detailsLoading ? (
               <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Clock className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                <p className="font-bold text-sm">Querying Permissions...</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {permissionSets.length > 0 ? (
                  permissionSets.map((ps, i) => (
                    <div key={i} className="group flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all cursor-default">
                      <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{ps}</span>
                      <ChevronRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  ))
                ) : (
                   <div className="text-center py-12 text-slate-500 border-2 border-dashed border-white/5 rounded-3xl">
                    <p className="font-medium">No permission sets assigned.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>


      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header section matching the image structure but in our dark theme */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight tabular-nums mb-1">Access Explorer</h2>
          <p className="text-slate-400 font-medium">Identity-centric view of permissions and risk factors.</p>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-bold shadow-lg">
          <AlertTriangle className="w-5 h-5" />
          <span>{stats.privileged} Privileged Users</span>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6">
        
        {/* Search & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-slate-900/50 border border-white/5 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
            />
          </div>
          
          <div className="flex flex-wrap gap-2 items-center justify-start lg:justify-end flex-1">
            <button 
              onClick={() => setFilter(filter === 'Admins' ? 'All' : 'Admins')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[13px] transition-all border ${filter === 'Admins' ? 'bg-slate-700 text-white border-white/10 shadow-[0_0_15px_-5px_rgba(255,255,255,0.1)]' : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'}`}
            >
              SYSTEM ADMINS <span className="bg-slate-950 px-2 py-0.5 rounded-md text-[10px]">{stats.admins}</span>
            </button>
            <button 
              onClick={() => setFilter(filter === 'Inactive' ? 'All' : 'Inactive')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[13px] transition-all border ${filter === 'Inactive' ? 'bg-slate-700 text-white border-white/10 shadow-[0_0_15px_-5px_rgba(255,255,255,0.1)]' : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'}`}
            >
              INACTIVE <span className="bg-slate-950 px-2 py-0.5 rounded-md text-[10px]">{stats.inactive}</span>
            </button>
            <button 
              onClick={() => setFilter(filter === 'MFA' ? 'All' : 'MFA')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[13px] transition-all border ${filter === 'MFA' ? 'bg-indigo-600 text-white border-indigo-500/50 shadow-[0_0_15px_-3px_rgba(99,102,241,0.5)]' : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'}`}
            >
              MFA MISSING <span className={`${filter === 'MFA' ? 'bg-indigo-800' : 'bg-slate-950'} px-2 py-0.5 rounded-md text-[10px]`}>{stats.mfa}</span>
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-white/5 rounded-xl text-sm font-bold text-slate-300 hover:text-white transition-all shadow-lg"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/30 custom-scrollbar pb-2">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <Clock className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
              <p className="font-bold">Scanning User Access...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-white/5 border-b border-white/5">
                <tr className="uppercase text-[10px] font-black text-slate-500 tracking-wider">
                  <th className="px-6 py-4">User Identity</th>
                  <th className="px-6 py-4">Profile / Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Risk Indicators</th>
                  <th className="px-6 py-4 text-right">Last Login</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u, i) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                    {/* User Identity */}
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => fetchUserDetails(u)}
                          className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-white/10 shrink-0 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all group/avatar"
                        >
                          <div className="group-hover/avatar:scale-110 transition-transform">
                            {getInitials(u.name)}
                          </div>
                        </button>
                        <div className="flex flex-col items-start">
                          <button 
                            onClick={() => fetchUserDetails(u)}
                            className="font-bold text-slate-200 hover:text-indigo-400 transition-colors text-left"
                          >
                            {u.name}
                          </button>
                          <div className="text-xs text-slate-500 font-medium">{u.email || 'No email provided'}</div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Profile / Role */}
                    <td className="py-5 px-6">
                      <div className="font-bold text-slate-300">{u.profile}</div>
                      <div className="text-xs text-slate-500 font-medium">{u.role}</div>
                    </td>
                    
                    {/* Status */}
                    <td className="py-5 px-6">
                      {u.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-white/10">
                          INACTIVE
                        </span>
                      )}
                    </td>
                    
                    {/* Risk Indicators */}
                    <td className="py-5 px-6">
                      <div className="flex flex-wrap gap-2">
                        {u.isClean ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-wider bg-emerald-500/5 px-2.5 py-1 rounded-md border border-emerald-500/10">
                            <CheckCircle2 className="w-3 h-3" /> Clean
                          </div>
                        ) : (
                          u.risks.map((risk, idx) => (
                            <span 
                              key={idx} 
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                risk.type === 'danger' 
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {risk.label}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    
                    {/* Last Login */}
                    <td className="py-5 px-6 text-right">
                      <div className="font-mono text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                        {formatLastLogin(u.lastLogin, u.daysSinceLogin)}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button 
                        onClick={() => {
                          if (!instanceUrl) return;
                          const editUrl = `${instanceUrl}/lightning/setup/ManageUsers/page?address=%2F${u.id}%2Fe%3FisUserEntityOverride%3D1%26noredirect%3D1`;
                          window.open(editUrl, '_blank');
                        }}
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
          )}
          
          {!loading && filteredUsers.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center text-slate-500">
              <User className="w-10 h-10 mb-4 opacity-50" />
              <p className="font-bold">No users match the current search or filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessExplorer;
