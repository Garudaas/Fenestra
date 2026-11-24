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
  "version": "V2.55",
  "timestamp": "25 Nov 2026, 12:25 AM IST",
  "formatted": "V2.55, 25 Nov 2026, 12:25 AM IST",
  "type": "minor",
  "summary": "Minor general update (Add notifications and tasks tabs to MemberDashboard)",
  "requiresReinstall": false,
  "history": [
    {
      "version": "V2.55",
      "timestamp": "25 Nov 2026, 12:25 AM IST",
      "formatted": "V2.55, 25 Nov 2026, 12:25 AM IST",
      "type": "minor",
      "summary": "Minor general update (Add notifications and tasks tabs to MemberDashboard)",
      "requiresReinstall": false
    },
    {
      "version": "V2.54",
      "timestamp": "25 Nov 2026, 12:08 AM IST",
      "formatted": "V2.54, 25 Nov 2026, 12:08 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor MemberDashboard and enhance admin navigation)",
      "requiresReinstall": false
    },
    {
      "version": "V2.53",
      "timestamp": "25 Nov 2026, 12:07 AM IST",
      "formatted": "V2.53, 25 Nov 2026, 12:07 AM IST",
      "type": "minor",
      "summary": "Minor general update (Remove isAdmin check from PersistentSessionRedirect)",
      "requiresReinstall": false
    },
    {
      "version": "V2.52",
      "timestamp": "24 Nov 2026, 11:59 PM IST",
      "formatted": "V2.52, 24 Nov 2026, 11:59 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Remove FundItem interface and funds state)",
      "requiresReinstall": false
    },
    {
      "version": "V2.51",
      "timestamp": "24 Nov 2026, 11:56 PM IST",
      "formatted": "V2.51, 24 Nov 2026, 11:56 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Update src/pages/AlumniAssociationHome.tsx for Tabs behaviour)",
      "requiresReinstall": false
    },
    {
      "version": "V2.50",
      "timestamp": "24 Nov 2026, 11:55 PM IST",
      "formatted": "V2.50, 24 Nov 2026, 11:55 PM IST",
      "type": "minor",
      "summary": "Minor general update (Update print statement from 'Hello' to 'Goodbye')",
      "requiresReinstall": false
    },
    {
      "version": "V2.49",
      "timestamp": "24 Nov 2026, 11:52 PM IST",
      "formatted": "V2.49, 24 Nov 2026, 11:52 PM IST",
      "type": "minor",
      "summary": "Minor general update (Remove unused constant SCOPE_DASHBOARD_HUB)",
      "requiresReinstall": false
    },
    {
      "version": "V2.48",
      "timestamp": "24 Nov 2026, 11:49 PM IST",
      "formatted": "V2.48, 24 Nov 2026, 11:49 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Update src/pages/MemberDashboard.tsx)",
      "requiresReinstall": false
    },
    {
      "version": "V2.47",
      "timestamp": "24 Nov 2026, 11:47 PM IST",
      "formatted": "V2.47, 24 Nov 2026, 11:47 PM IST",
      "type": "minor",
      "summary": "Minor general update (Add multiple routes to MemberDashboard)",
      "requiresReinstall": false
    },
    {
      "version": "V2.46",
      "timestamp": "24 Nov 2026, 11:46 PM IST",
      "formatted": "V2.46, 24 Nov 2026, 11:46 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement navigation state management functions)",
      "requiresReinstall": false
    },
    {
      "version": "V2.45",
      "timestamp": "24 Nov 2026, 11:16 PM IST",
      "formatted": "V2.45, 24 Nov 2026, 11:16 PM IST",
      "type": "minor",
      "summary": "Minor general update (Association page)",
      "requiresReinstall": false
    },
    {
      "version": "V2.44",
      "timestamp": "24 Nov 2026, 11:08 PM IST",
      "formatted": "V2.44, 24 Nov 2026, 11:08 PM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance ProfileTab with association role feature)",
      "requiresReinstall": false
    },
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
    }
  ]
}
