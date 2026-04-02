import { useState, useEffect, useCallback } from 'react';
import SalesforceClient from '../SalesforceClient.jsx';

const useSalesforceMetrics = (client) => {
  const [metrics, setMetrics] = useState([]);
  const [overallScore, setOverallScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);

    try {
      // Helper for resilient fetching
      const tryFetch = async (id, group, title, description, maxPoints, fetchFn, transformFn) => {
        try {
          const rawData = await fetchFn();
          const metric = transformFn(rawData);
          return { id, group, title, description, maxPoints, ...metric };
        } catch (err) {
          console.warn(`Metric ${id} failed:`, err.message);
          return {
            id, group, title, description, maxPoints,
            value: 'N/A', status: 'Healthy', points: maxPoints, 
            error: err.message
          };
        }
      };

      const results = await Promise.all([
        // 1. Failed Login Rate
        tryFetch('fail-rate', 'Identity & Access', 'Failed Login Rate', 'Measures brute-force or credential risk.', 7,
          () => client.query("SELECT Status, COUNT(Id) cnt FROM LoginHistory WHERE LoginTime = LAST_N_DAYS:30 GROUP BY Status"),
          (res) => {
            const total = res.records.reduce((acc, r) => acc + r.cnt, 0);
            const failed = res.records.filter(r => r.Status !== 'Success').reduce((acc, r) => acc + r.cnt, 0);
            const rate = total > 0 ? (failed / total) * 100 : 0;
            let pts = 0; let status = 'Healthy';
            if (rate < 5) pts = 7; else if (rate < 15) { pts = 5; status = 'Moderate'; } else if (rate < 30) { pts = 2; status = 'At Risk'; } else { pts = 0; status = 'Critical'; }
            return { value: `${rate.toFixed(1)}%`, status, points: pts };
          }
        ),

        // 2. Never Logged In
        tryFetch('never-login', 'Identity & Access', 'Users Never Logged In', 'Active users who never accessed the system.', 6,
          () => client.query("SELECT Id, Name, Email, CreatedDate, Profile.Name FROM User WHERE IsActive = true AND LastLoginDate = null AND UserType = 'Standard'"),
          (res) => {
            const count = res.totalSize;
            let pts = 0; let status = 'Healthy';
            if (count === 0) pts = 6; else if (count <= 3) { pts = 4; status = 'Moderate'; } else if (count <= 9) { pts = 2; status = 'At Risk'; } else { pts = 0; status = 'Critical'; }
            return { value: count, status, points: pts, drillDownData: res.records };
          }
        ),

        // 3. Stale Passwords
        tryFetch('stale-passwords', 'Identity & Access', 'Stale Passwords', 'Users who haven\'t changed password in 90+ days.', 6,
          () => client.query("SELECT Id, Name, LastPasswordChangeDate, Profile.Name FROM User WHERE IsActive = true AND UserType = 'Standard' AND LastPasswordChangeDate < LAST_N_DAYS:90"),
          (res) => {
            const count = res.totalSize;
            let pts = 0; let status = 'Healthy';
            if (count === 0) pts = 6; else if (count <= 5) { pts = 4; status = 'Moderate'; } else if (count <= 15) { pts = 2; status = 'At Risk'; } else { pts = 0; status = 'Critical'; }
            return { value: count, status, points: pts, drillDownData: res.records };
          }
        ),

        // 4. External Users
        tryFetch('external-users', 'Identity & Access', 'External Users', 'Community or external users with access.', 6,
          () => client.query("SELECT Id, Name, Email, Profile.Name, UserType, LastLoginDate FROM User WHERE IsActive = true AND UserType NOT IN ('Standard', 'AutomatedProcess', 'CloudIntegrationUser') LIMIT 100"),
          (res) => {
            const count = res.totalSize;
            return { value: count, status: count > 30 ? 'At Risk' : count > 0 ? 'Moderate' : 'Healthy', points: count > 0 ? 4 : 6, drillDownData: res.records };
          }
        ),

        // 5. Privileged Concentration
        tryFetch('priv-conc', 'Identity & Access', 'Privileged Access Concentration', 'Percentage of users with global permissions.', 10,
          async () => {
            const [p, t] = await Promise.all([
              client.query("SELECT COUNT_DISTINCT(AssigneeId) cnt FROM PermissionSetAssignment WHERE (PermissionSet.PermissionsModifyAllData = true OR PermissionSet.PermissionsViewAllData = true) AND Assignee.IsActive = true"),
              client.query("SELECT COUNT(Id) cnt FROM User WHERE IsActive = true AND UserType = 'Standard'")
            ]);
            return { priv: p.records[0].cnt, total: t.records[0].cnt };
          },
          (data) => {
            const conc = data.total > 0 ? (data.priv / data.total) * 100 : 0;
            let pts = conc < 10 ? 10 : conc < 25 ? 7 : conc < 50 ? 4 : 0;
            return { value: `${conc.toFixed(1)}%`, status: conc < 25 ? 'Healthy' : conc < 50 ? 'Moderate' : 'Critical', points: pts };
          }
        ),

        // 5b. Multi-IP Logins (Moved to Network)
        tryFetch('multi-ip-logins', 'Network & Integrations', 'Multi-IP Logins (30d)', 'Users accessing from multiple unique IP addresses.', 6,
          () => client.query("SELECT UserId, SourceIp, User.Name, LoginTime FROM LoginHistory WHERE LoginTime = LAST_N_DAYS:30 LIMIT 10000"),
          (res) => {
            const userIps = {};
            res.records.forEach(r => {
              if (!userIps[r.UserId]) userIps[r.UserId] = { name: r.User.Name, ips: new Set() };
              userIps[r.UserId].ips.add(r.SourceIp);
            });
            const riskyUsers = Object.entries(userIps)
              .filter(([id, data]) => data.ips.size > 1)
              .map(([id, data]) => ({ UserId: id, Name: data.name, UniqueIPs: data.ips.size }));
            
            const count = riskyUsers.length;
            let pts = 0; let status = 'Healthy';
            if (count === 0) pts = 6; else if (count <= 2) { pts = 4; status = 'Moderate'; } else if (count <= 5) { pts = 2; status = 'At Risk'; } else { pts = 0; status = 'Critical'; }
            return { value: count, status, points: pts, drillDownData: riskyUsers };
          }
        ),

        // 6. Setup Audit Trail
        tryFetch('setup-volatility', 'Auditability & Monitoring', 'Setup Activity (30d)', 'Measures configuration changes.', 10,
          () => client.query("SELECT Id, CreatedDate, Display, DelegateUser, Action, Section FROM SetupAuditTrail WHERE CreatedDate = LAST_N_DAYS:30 LIMIT 5"),
          (res) => ({ value: res.totalSize, status: res.totalSize > 100 ? 'Moderate' : 'Healthy', points: res.totalSize > 100 ? 5 : 10, drillDownData: res.records })
        ),

        // 6b. Admin Impersonation
        tryFetch('admin-impersonation', 'Auditability & Monitoring', 'Login-As Events', 'Admins impersonating users.', 5,
          () => client.query("SELECT Id, CreatedDate, CreatedById, Display, Action, Section, DelegateUser FROM SetupAuditTrail WHERE Action LIKE 'suOrgAdminLogin%' LIMIT 50"),
          (res) => {
            const count = res.records.length;
            return { value: count, status: count === 0 ? 'Healthy' : count <= 5 ? 'Moderate' : 'At Risk', points: count === 0 ? 5 : count <= 5 ? 3 : 0, drillDownData: res.records };
          }
        ),

        // 6c. Password Lockouts
        tryFetch('password-lockouts', 'Auditability & Monitoring', 'Password Lockouts (7d)', 'Recent lockout events.', 5,
          () => client.query("SELECT Id, UserId, LoginTime, SourceIp, Browser, Status FROM LoginHistory WHERE LoginTime = LAST_N_DAYS:7 ORDER BY LoginTime DESC LIMIT 2000"),
          (res) => {
            const records = res.records.filter(r => r.Status && r.Status.includes('Password Lockout'));
            const count = records.length;
            return { value: count, status: count === 0 ? 'Healthy' : count <= 10 ? 'Moderate' : 'Critical', points: count === 0 ? 5 : count <= 10 ? 2 : 0, drillDownData: records };
          }
        ),

        // 7b. Data Storage
        tryFetch('data-storage', 'Governance & Utilization', 'Data Storage Usage', 'Allocated data storage usage and availability.', 5,
          () => client.getLimits(),
          (limits) => {
            if (!limits.DataStorageMB) return { value: 'N/A', status: 'Healthy', points: 5 };
            const { Max, Remaining } = limits.DataStorageMB;
            const used = Max - Remaining;
            const pct = (used / Max) * 100;
            const free = Remaining >= 1024 ? `${(Remaining / 1024).toFixed(1)} GB` : `${Remaining} MB`;
            let pts = 5; let st = 'Healthy';
            if (pct > 90) { pts = 0; st = 'Critical'; } else if (pct > 75) { pts = 2; st = 'At Risk'; }
            return { value: `${pct.toFixed(0)}% (${free} Free)`, status: st, points: pts };
          }
        ),

        // 7f. File Storage
        tryFetch('file-storage', 'Governance & Utilization', 'File Storage Usage', 'Allocated file storage usage and availability.', 5,
          async () => {
            const [limits, oldestFiles] = await Promise.all([
              client.getLimits(),
              client.query("SELECT Id, Title, ContentSize, LastModifiedDate FROM ContentVersion WHERE IsLatest = true ORDER BY LastModifiedDate ASC LIMIT 5")
            ]);
            return { limits, oldestFiles: oldestFiles.records };
          },
          (data) => {
            const { limits, oldestFiles } = data;
            if (!limits.FileStorageMB) return { value: 'N/A', status: 'Healthy', points: 5 };
            const { Max, Remaining } = limits.FileStorageMB;
            const used = Max - Remaining;
            const pct = (used / Max) * 100;
            const free = Remaining >= 1024 ? `${(Remaining / 1024).toFixed(1)} GB` : `${Remaining} MB`;
            let pts = 5; let st = 'Healthy';
            if (pct > 90) { pts = 0; st = 'Critical'; } else if (pct > 75) { pts = 2; st = 'At Risk'; }
            return { 
              value: `${pct.toFixed(0)}% (${free} Free)`, 
              status: st, 
              points: pts,
              drillDownData: oldestFiles,
              showCleanupIcon: true,
              metadataType: 'ContentDocument'
            };
          }
        ),

        // 7c. Installed Packages
        tryFetch('installed-packages', 'Governance & Utilization', 'Installed Packages', '3rd-party managed packages.', 5,
          () => client.toolingQuery("SELECT Id, SubscriberPackageId, SubscriberPackage.Name FROM InstalledSubscriberPackage"),
          (res) => {
            const count = res.totalSize || 0;
            let pts = 5; let st = 'Healthy';
            if (count > 50) { pts = 1; st = 'At Risk'; } else if (count > 20) { pts = 3; st = 'Moderate'; }
            return { value: count, status: st, points: pts, drillDownData: res.records };
          }
        ),

        // 7d. Roles with No Users
        tryFetch('empty-roles', 'Governance & Utilization', 'Roles with No Users', 'Empty hierarchy roles.', 5,
          () => client.query("SELECT Id, Name FROM UserRole WHERE Id NOT IN (SELECT UserRoleId FROM User WHERE IsActive = true) LIMIT 100"),
          (res) => {
            const count = res.totalSize;
            let pts = 5; let st = 'Healthy';
            if (count > 25) { pts = 1; st = 'At Risk'; } else if (count > 0) { pts = 3; st = 'Moderate'; }
            return { value: count, status: st, points: pts, drillDownData: res.records };
          }
        ),

        // 8. API Only Accounts
        tryFetch('api-users', 'Network & Integrations', 'API-Only Accounts', 'Dedicated API integration users.', 5,
          () => client.query("SELECT Id, Name, Email, Profile.Name, LastLoginDate FROM User WHERE Profile.PermissionsApiUserOnly = true AND IsActive = true"),
          (res) => {
            const count = res.totalSize;
            return { value: count, status: count > 10 ? 'Moderate' : 'Healthy', points: count > 10 ? 2 : 5, drillDownData: res.records };
          }
        ),

        // 9. Active OAuth Sessions
        tryFetch('oauth-sessions', 'Network & Integrations', 'Active OAuth Apps', 'Current active OAuth 2.0 sessions.', 5,
          () => client.query("SELECT Id, Users.Name, SessionType, SourceIp, CreatedDate FROM AuthSession WHERE SessionType = 'Oauth2' LIMIT 50"),
          (res) => {
            const count = res.totalSize || res.records.length;
            return { value: count, status: count > 20 ? 'At Risk' : 'Healthy', points: count > 20 ? 2 : 5, drillDownData: res.records };
          }
        ),
        
        // 10. Remote Site Settings Hygiene
        tryFetch('outbound-security', 'Network & Integrations', 'Remote Site Hygiene', 'Active outbound endpoints allowed in this Org.', 5,
          () => client.query("SELECT Id, SiteName, Endpoint, IsActive FROM RemoteProxy WHERE IsActive = true LIMIT 100"),
          (res) => {
            const count = res.totalSize || res.records.length;
            let pts = 5; let st = 'Healthy';
            if (count > 20) { pts = 2; st = 'At Risk'; } else if (count > 10) { pts = 4; st = 'Moderate'; }
            return { value: count, status: st, points: pts, drillDownData: res.records };
          }
        ),

        // Toxic Privilege Accumulation (B-2)
        tryFetch('toxic-privilege', 'Identity & Access', 'Toxic Privilege Accumulation', 'Users with overlapping Modify/View All or Manage Users perms.', 10,
          () => client.query("SELECT Assignee.Name, COUNT(Id) cnt FROM PermissionSetAssignment WHERE (PermissionSet.PermissionsModifyAllData = true OR PermissionSet.PermissionsViewAllData = true OR PermissionSet.PermissionsManageUsers = true) AND Assignee.IsActive = true GROUP BY Assignee.Name HAVING COUNT(Id) > 1"),
          (res) => ({ value: res.records.length, status: res.records.length > 0 ? 'Critical' : 'Healthy', points: res.records.length > 0 ? 0 : 10, drillDownData: res.records.map(r => ({ Name: r.Name, Count: r.cnt })) })
        ),

        // Orphan Permission Sets (B-4)
        tryFetch('orphan-permsets', 'Governance & Utilization', 'Orphan Permission Sets', 'Permission sets that are assigned to zero users.', 5,
          async () => {
            const [allSets, assignments] = await Promise.all([
              client.query("SELECT Id, Name, Label, LastModifiedDate FROM PermissionSet WHERE IsOwnedByProfile = false"),
              client.query("SELECT PermissionSetId FROM PermissionSetAssignment")
            ]);
            const assignedIds = new Set(assignments.records.map(a => a.PermissionSetId));
            return allSets.records.filter(s => !assignedIds.has(s.Id));
          },
          (orphans) => ({ 
            value: orphans.length, 
            status: orphans.length > 50 ? 'At Risk' : 'Healthy', 
            points: orphans.length > 50 ? 2 : 5, 
            drillDownData: orphans,
            showCleanupIcon: true,
            metadataType: 'PermissionSet'
          })
        ),

        // Identity Governance Gap (E-3)
        tryFetch('manager-gap', 'Governance & Utilization', 'Identity Governance Gap', 'Active standard users with no Manager assigned.', 5,
          () => client.query("SELECT Id, Name, Email, Title FROM User WHERE IsActive = true AND UserType = 'Standard' AND ManagerId = null"),
          (res) => ({ value: res.totalSize, status: res.totalSize > 2 ? 'At Risk' : 'Healthy', points: res.totalSize > 2 ? 2 : 5, drillDownData: res.records })
        )
      ]);

      const totalPts = results.reduce((acc, r) => acc + (r.points || 0), 0);
      const currentMax = 7 + 6 + 6 + 6 + 10 + 6 + 10 + 10 + 5 + 5 + 5 + 5 + 5 + 5 + 5 + 5 + 10 + 5 + 5 + 5; 
      const normalizedScore = (totalPts / currentMax) * 100;

      setMetrics(results);
      setOverallScore(normalizedScore);
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, overallScore, loading, error, refresh: fetchMetrics };
};

export default useSalesforceMetrics;
