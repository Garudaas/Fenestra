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
  "version": "V2.89",
  "timestamp": "26 Nov 2026, 03:37 PM IST",
  "formatted": "V2.89, 26 Nov 2026, 03:37 PM IST",
  "type": "minor",
  "summary": "Minor general update (Fix missing newline at end of manifest.json)",
  "requiresReinstall": false,
  "history": [
    {
      "version": "V2.89",
      "timestamp": "26 Nov 2026, 03:37 PM IST",
      "formatted": "V2.89, 26 Nov 2026, 03:37 PM IST",
      "type": "minor",
      "summary": "Minor general update (Fix missing newline at end of manifest.json)",
      "requiresReinstall": false
    },
    {
      "version": "V2.88",
      "timestamp": "26 Nov 2026, 03:36 PM IST",
      "formatted": "V2.88, 26 Nov 2026, 03:36 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor MemberDashboard layout and accessibility)",
      "requiresReinstall": false
    },
    {
      "version": "V2.87",
      "timestamp": "26 Nov 2026, 03:34 PM IST",
      "formatted": "V2.87, 26 Nov 2026, 03:34 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor map handling and update input placeholders)",
      "requiresReinstall": false
    },
    {
      "version": "V2.86",
      "timestamp": "26 Nov 2026, 03:33 PM IST",
      "formatted": "V2.86, 26 Nov 2026, 03:33 PM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance location input and map functionality)",
      "requiresReinstall": false
    },
    {
      "version": "V2.85",
      "timestamp": "26 Nov 2026, 02:08 PM IST",
      "formatted": "V2.85, 26 Nov 2026, 02:08 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Modify theme color and app title in index.html)",
      "requiresReinstall": false
    },
    {
      "version": "V2.84",
      "timestamp": "26 Nov 2026, 02:07 PM IST",
      "formatted": "V2.84, 26 Nov 2026, 02:07 PM IST",
      "type": "minor",
      "summary": "Minor general update (App icon display changed)",
      "requiresReinstall": false
    },
    {
      "version": "V2.83",
      "timestamp": "25 Nov 2026, 10:44 PM IST",
      "formatted": "V2.83, 25 Nov 2026, 10:44 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement preset coordinates functionality)",
      "requiresReinstall": false
    },
    {
      "version": "V2.82",
      "timestamp": "25 Nov 2026, 05:59 AM IST",
      "formatted": "V2.82, 25 Nov 2026, 05:59 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor coordinate picking logic into a function)",
      "requiresReinstall": false
    },
    {
      "version": "V2.81",
      "timestamp": "25 Nov 2026, 05:55 AM IST",
      "formatted": "V2.81, 25 Nov 2026, 05:55 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor location handling and update UI elements)",
      "requiresReinstall": false
    },
    {
      "version": "V2.80",
      "timestamp": "25 Nov 2026, 05:45 AM IST",
      "formatted": "V2.80, 25 Nov 2026, 05:45 AM IST",
      "type": "minor",
      "summary": "Minor general update (App icon appearance updated)",
      "requiresReinstall": false
    },
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
    }
  ]
}
