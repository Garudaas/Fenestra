export interface VersionEntry {
  version: string
  timestamp: string
  formatted: string
  type: 'major' | 'minor'
  summary: string
  requiresReinstall: boolean
}

export interface AppVersionData extends VersionEntry {
  history: VersionEntry[]
}

export const APP_VERSION_INFO: AppVersionData = {
  "version": "V2.43",
  "timestamp": "24 Nov 2026, 11:05 PM IST",
  "formatted": "V2.43, 24 Nov 2026, 11:05 PM IST",
  "type": "minor",
  "summary": "Minor general update (Implement contact method handling in MemberProfilePage)",
  "requiresReinstall": false,
  "history": [
    {
      "version": "V2.43",
      "timestamp": "24 Nov 2026, 11:05 PM IST",
      "formatted": "V2.43, 24 Nov 2026, 11:05 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement contact method handling in MemberProfilePage)",
      "requiresReinstall": false
    },
    {
      "version": "V2.42",
      "timestamp": "24 Nov 2026, 11:04 PM IST",
      "formatted": "V2.42, 24 Nov 2026, 11:04 PM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance MemberProfilePage with association role feature)",
      "requiresReinstall": false
    },
    {
      "version": "V2.41",
      "timestamp": "24 Nov 2026, 11:02 PM IST",
      "formatted": "V2.41, 24 Nov 2026, 11:02 PM IST",
      "type": "minor",
      "summary": "Minor general update (Add committee roles mapping and display logic)",
      "requiresReinstall": false
    },
    {
      "version": "V2.40",
      "timestamp": "24 Nov 2026, 11:01 PM IST",
      "formatted": "V2.40, 24 Nov 2026, 11:01 PM IST",
      "type": "minor",
      "summary": "Minor general update (Add CommitteeRolesMap and AssociationRoleBadgeInfo types)",
      "requiresReinstall": false
    },
    {
      "version": "V2.39",
      "timestamp": "24 Nov 2026, 09:59 PM IST",
      "formatted": "V2.39, 24 Nov 2026, 09:59 PM IST",
      "type": "minor",
      "summary": "Minor general update (Button appearance or behavior updated)",
      "requiresReinstall": false
    },
    {
      "version": "V2.38",
      "timestamp": "24 Nov 2026, 04:45 PM IST",
      "formatted": "V2.38, 24 Nov 2026, 04:45 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Enhance index.html with meta tags for social sharing)",
      "requiresReinstall": false
    },
    {
      "version": "V2.37",
      "timestamp": "24 Nov 2026, 04:41 PM IST",
      "formatted": "V2.37, 24 Nov 2026, 04:41 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Fix missing newline at end of taskAuditService.ts)",
      "requiresReinstall": false
    },
    {
      "version": "V2.36",
      "timestamp": "24 Nov 2026, 04:36 PM IST",
      "formatted": "V2.36, 24 Nov 2026, 04:36 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement copy functionality for Smart App Launcher link)",
      "requiresReinstall": false
    },
    {
      "version": "V2.35",
      "timestamp": "24 Nov 2026, 04:25 PM IST",
      "formatted": "V2.35, 24 Nov 2026, 04:25 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement checkIsOfficeBearer function)",
      "requiresReinstall": false
    },
    {
      "version": "V2.34",
      "timestamp": "24 Nov 2026, 04:24 PM IST",
      "formatted": "V2.34, 24 Nov 2026, 04:24 PM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance TreasuryPage with receipt handling and refactoring)",
      "requiresReinstall": false
    },
    {
      "version": "V2.33",
      "timestamp": "24 Nov 2026, 04:21 PM IST",
      "formatted": "V2.33, 24 Nov 2026, 04:21 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement receipt PDF generation and download functions)",
      "requiresReinstall": false
    },
    {
      "version": "V2.32",
      "timestamp": "24 Nov 2026, 04:02 PM IST",
      "formatted": "V2.32, 24 Nov 2026, 04:02 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Link the Treasury Tab in src/pages/AlumniAssociationHome.tsx to /treasury)",
      "requiresReinstall": false
    },
    {
      "version": "V2.31",
      "timestamp": "24 Nov 2026, 04:01 PM IST",
      "formatted": "V2.31, 24 Nov 2026, 04:01 PM IST",
      "type": "minor",
      "summary": "Minor technical update (ink the Treasury Tab in src/pages/AlumniAssociationHome.tsx to /treasury)",
      "requiresReinstall": false
    },
    {
      "version": "V2.30",
      "timestamp": "24 Nov 2026, 03:58 PM IST",
      "formatted": "V2.30, 24 Nov 2026, 03:58 PM IST",
      "type": "minor",
      "summary": "Minor general update (Add treasury tab to MemberDashboard)",
      "requiresReinstall": false
    },
    {
      "version": "V2.29",
      "timestamp": "24 Nov 2026, 03:57 PM IST",
      "formatted": "V2.29, 24 Nov 2026, 03:57 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Add TreasuryPage route to App component)",
      "requiresReinstall": false
    },
    {
      "version": "V2.28",
      "timestamp": "24 Nov 2026, 03:55 PM IST",
      "formatted": "V2.28, 24 Nov 2026, 03:55 PM IST",
      "type": "minor",
      "summary": "Minor general update (Create Treasury Page)",
      "requiresReinstall": false
    },
    {
      "version": "V2.27",
      "timestamp": "24 Nov 2026, 03:52 PM IST",
      "formatted": "V2.27, 24 Nov 2026, 03:52 PM IST",
      "type": "minor",
      "summary": "Minor general update (Treasurer Account Management + Read-Only View for All Members)",
      "requiresReinstall": false
    },
    {
      "version": "V2.26",
      "timestamp": "24 Nov 2026, 03:50 PM IST",
      "formatted": "V2.26, 24 Nov 2026, 03:50 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement checkCanManageTreasury function)",
      "requiresReinstall": false
    },
    {
      "version": "V2.25",
      "timestamp": "23 Nov 2026, 10:40 PM IST",
      "formatted": "V2.25, 23 Nov 2026, 10:40 PM IST",
      "type": "minor",
      "summary": "Minor general update (Add admin audit log functionality to MaintenanceTab)",
      "requiresReinstall": false
    },
    {
      "version": "V2.24",
      "timestamp": "23 Nov 2026, 10:39 PM IST",
      "formatted": "V2.24, 23 Nov 2026, 10:39 PM IST",
      "type": "minor",
      "summary": "Minor general update (Chat and calling screen updated)",
      "requiresReinstall": false
    },
    {
      "version": "V2.23",
      "timestamp": "23 Nov 2026, 10:38 PM IST",
      "formatted": "V2.23, 23 Nov 2026, 10:38 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Update SupportTab.tsx)",
      "requiresReinstall": false
    },
    {
      "version": "V2.22",
      "timestamp": "23 Nov 2026, 10:37 PM IST",
      "formatted": "V2.22, 23 Nov 2026, 10:37 PM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance DirectoryTab with travel alerts and SOS features)",
      "requiresReinstall": false
    },
    {
      "version": "V2.21",
      "timestamp": "23 Nov 2026, 10:28 PM IST",
      "formatted": "V2.21, 23 Nov 2026, 10:28 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Clean up comments in NotificationsPage component)",
      "requiresReinstall": false
    },
    {
      "version": "V2.20",
      "timestamp": "23 Nov 2026, 10:27 PM IST",
      "formatted": "V2.20, 23 Nov 2026, 10:27 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Remove unused import for formatISTDateTime)",
      "requiresReinstall": false
    },
    {
      "version": "V2.19",
      "timestamp": "23 Nov 2026, 10:22 PM IST",
      "formatted": "V2.19, 23 Nov 2026, 10:22 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Add recurrence rule and export/print functionality)",
      "requiresReinstall": false
    }
  ]
}
