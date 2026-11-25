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
  "version": "V2.79",
  "timestamp": "25 Nov 2026, 05:43 AM IST",
  "formatted": "V2.79, 25 Nov 2026, 05:43 AM IST",
  "type": "minor",
  "summary": "Minor general update (Enhance extractMapQuery with fallback address handling)",
  "requiresReinstall": false,
  "history": [
    {
      "version": "V2.79",
      "timestamp": "25 Nov 2026, 05:43 AM IST",
      "formatted": "V2.79, 25 Nov 2026, 05:43 AM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance extractMapQuery with fallback address handling)",
      "requiresReinstall": false
    },
    {
      "version": "V2.78",
      "timestamp": "25 Nov 2026, 05:41 AM IST",
      "formatted": "V2.78, 25 Nov 2026, 05:41 AM IST",
      "type": "minor",
      "summary": "Minor general update (Remove commented-out state variable descriptions)",
      "requiresReinstall": false
    },
    {
      "version": "V2.77",
      "timestamp": "25 Nov 2026, 05:07 AM IST",
      "formatted": "V2.77, 25 Nov 2026, 05:07 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Fix import statement for Label component)",
      "requiresReinstall": false
    },
    {
      "version": "V2.76",
      "timestamp": "25 Nov 2026, 05:02 AM IST",
      "formatted": "V2.76, 25 Nov 2026, 05:02 AM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance address fields with map picker functionality)",
      "requiresReinstall": false
    },
    {
      "version": "V2.75",
      "timestamp": "25 Nov 2026, 04:58 AM IST",
      "formatted": "V2.75, 25 Nov 2026, 04:58 AM IST",
      "type": "minor",
      "summary": "Minor general update (Update navigation logic in NotificationsPage)",
      "requiresReinstall": false
    },
    {
      "version": "V2.74",
      "timestamp": "25 Nov 2026, 04:58 AM IST",
      "formatted": "V2.74, 25 Nov 2026, 04:58 AM IST",
      "type": "minor",
      "summary": "Minor general update (Implement task editing and withdrawal features)",
      "requiresReinstall": false
    },
    {
      "version": "V2.73",
      "timestamp": "25 Nov 2026, 04:56 AM IST",
      "formatted": "V2.73, 25 Nov 2026, 04:56 AM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance DirectoryTab with location handling and guidance)",
      "requiresReinstall": false
    },
    {
      "version": "V2.72",
      "timestamp": "25 Nov 2026, 04:53 AM IST",
      "formatted": "V2.72, 25 Nov 2026, 04:53 AM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance support request functionality and descriptions)",
      "requiresReinstall": false
    },
    {
      "version": "V2.71",
      "timestamp": "25 Nov 2026, 04:52 AM IST",
      "formatted": "V2.71, 25 Nov 2026, 04:52 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Update src/pages/MemberDashboard.tsx)",
      "requiresReinstall": false
    },
    {
      "version": "V2.70",
      "timestamp": "25 Nov 2026, 04:43 AM IST",
      "formatted": "V2.70, 25 Nov 2026, 04:43 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Executive Committee Election & President Guardrails (AlumniAssociationHome.tsx))",
      "requiresReinstall": false
    },
    {
      "version": "V2.69",
      "timestamp": "25 Nov 2026, 04:41 AM IST",
      "formatted": "V2.69, 25 Nov 2026, 04:41 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Treasury Governance & QR Upload (TreasuryPage.tsx))",
      "requiresReinstall": false
    },
    {
      "version": "V2.68",
      "timestamp": "25 Nov 2026, 04:36 AM IST",
      "formatted": "V2.68, 25 Nov 2026, 04:36 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Update src/pages/MemberDashboard.tsx (WhatsApp Group Call, Google Meet & Zoom Schedule in Communication + Post an Event Sub-Tab))",
      "requiresReinstall": false
    },
    {
      "version": "V2.67",
      "timestamp": "25 Nov 2026, 04:33 AM IST",
      "formatted": "V2.67, 25 Nov 2026, 04:33 AM IST",
      "type": "minor",
      "summary": "Minor general update (WhatsApp Group Setup & Instructions, Bulk WhatsApp, and Bulk Email)",
      "requiresReinstall": false
    },
    {
      "version": "V2.66",
      "timestamp": "25 Nov 2026, 02:07 AM IST",
      "formatted": "V2.66, 25 Nov 2026, 02:07 AM IST",
      "type": "minor",
      "summary": "Minor general update (Implement class event posting feature)",
      "requiresReinstall": false
    },
    {
      "version": "V2.65",
      "timestamp": "25 Nov 2026, 02:05 AM IST",
      "formatted": "V2.65, 25 Nov 2026, 02:05 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor DirectoryTab component and update props)",
      "requiresReinstall": false
    },
    {
      "version": "V2.64",
      "timestamp": "25 Nov 2026, 02:03 AM IST",
      "formatted": "V2.64, 25 Nov 2026, 02:03 AM IST",
      "type": "minor",
      "summary": "Minor general update (Chat and calling screen updated)",
      "requiresReinstall": false
    },
    {
      "version": "V2.63",
      "timestamp": "25 Nov 2026, 02:01 AM IST",
      "formatted": "V2.63, 25 Nov 2026, 02:01 AM IST",
      "type": "minor",
      "summary": "Minor general update (Add mode prop to SupportTab for dynamic section handling)",
      "requiresReinstall": false
    },
    {
      "version": "V2.62",
      "timestamp": "25 Nov 2026, 01:59 AM IST",
      "formatted": "V2.62, 25 Nov 2026, 01:59 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Update src/pages/CalendarTab.tsx (Remove \"Post Class Event\" and \"Assign Task\" from Calendar))",
      "requiresReinstall": false
    },
    {
      "version": "V2.61",
      "timestamp": "25 Nov 2026, 12:56 AM IST",
      "formatted": "V2.61, 25 Nov 2026, 12:56 AM IST",
      "type": "minor",
      "summary": "Minor general update (Track previous routes on navigation actions)",
      "requiresReinstall": false
    },
    {
      "version": "V2.60",
      "timestamp": "25 Nov 2026, 12:50 AM IST",
      "formatted": "V2.60, 25 Nov 2026, 12:50 AM IST",
      "type": "minor",
      "summary": "Minor general update (Implement previous route tracking on NotificationsPage)",
      "requiresReinstall": false
    },
    {
      "version": "V2.59",
      "timestamp": "25 Nov 2026, 12:48 AM IST",
      "formatted": "V2.59, 25 Nov 2026, 12:48 AM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance task management with sub-item updates)",
      "requiresReinstall": false
    },
    {
      "version": "V2.58",
      "timestamp": "25 Nov 2026, 12:45 AM IST",
      "formatted": "V2.58, 25 Nov 2026, 12:45 AM IST",
      "type": "minor",
      "summary": "Minor general update (Notification alerts updated)",
      "requiresReinstall": false
    },
    {
      "version": "V2.57",
      "timestamp": "25 Nov 2026, 12:43 AM IST",
      "formatted": "V2.57, 25 Nov 2026, 12:43 AM IST",
      "type": "minor",
      "summary": "Minor general update (Chat and calling screen updated)",
      "requiresReinstall": false
    },
    {
      "version": "V2.56",
      "timestamp": "25 Nov 2026, 12:33 AM IST",
      "formatted": "V2.56, 25 Nov 2026, 12:33 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add route for tasks in App component)",
      "requiresReinstall": false
    },
    {
      "version": "V2.55",
      "timestamp": "25 Nov 2026, 12:25 AM IST",
      "formatted": "V2.55, 25 Nov 2026, 12:25 AM IST",
      "type": "minor",
      "summary": "Minor general update (Add notifications and tasks tabs to MemberDashboard)",
      "requiresReinstall": false
    }
  ]
}
