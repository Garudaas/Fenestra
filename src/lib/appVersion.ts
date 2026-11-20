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
  "version": "V1.43",
  "timestamp": "21 Nov 2026, 03:24 AM IST",
  "formatted": "V1.43, 21 Nov 2026, 03:24 AM IST",
  "type": "minor",
  "summary": "Minor technical update (Add SmartAppLauncher route to App component)",
  "requiresReinstall": false,
  "history": [
    {
      "version": "V1.43",
      "timestamp": "21 Nov 2026, 03:24 AM IST",
      "formatted": "V1.43, 21 Nov 2026, 03:24 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add SmartAppLauncher route to App component)",
      "requiresReinstall": false
    },
    {
      "version": "V1.42",
      "timestamp": "21 Nov 2026, 03:22 AM IST",
      "formatted": "V1.42, 21 Nov 2026, 03:22 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add SmartAppLauncher component for app installation)",
      "requiresReinstall": false
    },
    {
      "version": "V1.41",
      "timestamp": "21 Nov 2026, 03:22 AM IST",
      "formatted": "V1.41, 21 Nov 2026, 03:22 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Delete src/SmartAppLauncher.tsx)",
      "requiresReinstall": false
    },
    {
      "version": "V1.40",
      "timestamp": "21 Nov 2026, 03:20 AM IST",
      "formatted": "V1.40, 21 Nov 2026, 03:20 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add SmartAppLauncher route to App component)",
      "requiresReinstall": false
    },
    {
      "version": "V1.39",
      "timestamp": "21 Nov 2026, 03:19 AM IST",
      "formatted": "V1.39, 21 Nov 2026, 03:19 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add SmartAppLauncher component for app installation)",
      "requiresReinstall": false
    },
    {
      "version": "V1.38",
      "timestamp": "21 Nov 2026, 03:18 AM IST",
      "formatted": "V1.38, 21 Nov 2026, 03:18 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add SmartAppLauncher route to App component)",
      "requiresReinstall": false
    },
    {
      "version": "V1.37",
      "timestamp": "21 Nov 2026, 03:16 AM IST",
      "formatted": "V1.37, 21 Nov 2026, 03:16 AM IST",
      "type": "minor",
      "summary": "Minor general update (Update manifest.json with application ID)",
      "requiresReinstall": false
    },
    {
      "version": "V1.36",
      "timestamp": "21 Nov 2026, 03:02 AM IST",
      "formatted": "V1.36, 21 Nov 2026, 03:02 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor InvitePage layout and improve user prompts)",
      "requiresReinstall": false
    },
    {
      "version": "V1.35",
      "timestamp": "21 Nov 2026, 03:01 AM IST",
      "formatted": "V1.35, 21 Nov 2026, 03:01 AM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance app installation detection and link copying)",
      "requiresReinstall": false
    },
    {
      "version": "V1.34",
      "timestamp": "21 Nov 2026, 02:40 AM IST",
      "formatted": "V1.34, 21 Nov 2026, 02:40 AM IST",
      "type": "minor",
      "summary": "Minor general update (Member profile details updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.33",
      "timestamp": "21 Nov 2026, 02:31 AM IST",
      "formatted": "V1.33, 21 Nov 2026, 02:31 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Remove unnecessary comments in ChatTab component)",
      "requiresReinstall": false
    },
    {
      "version": "V1.32",
      "timestamp": "21 Nov 2026, 02:22 AM IST",
      "formatted": "V1.32, 21 Nov 2026, 02:22 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add notification badges and refactor tab handling)",
      "requiresReinstall": false
    },
    {
      "version": "V1.31",
      "timestamp": "21 Nov 2026, 02:21 AM IST",
      "formatted": "V1.31, 21 Nov 2026, 02:21 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor VideoTab component for improved functionality)",
      "requiresReinstall": false
    },
    {
      "version": "V1.30",
      "timestamp": "21 Nov 2026, 02:19 AM IST",
      "formatted": "V1.30, 21 Nov 2026, 02:19 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add extra line in VoiceTab component)",
      "requiresReinstall": false
    },
    {
      "version": "V1.29",
      "timestamp": "21 Nov 2026, 02:18 AM IST",
      "formatted": "V1.29, 21 Nov 2026, 02:18 AM IST",
      "type": "minor",
      "summary": "Minor general update (Notification alerts updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.28",
      "timestamp": "21 Nov 2026, 02:17 AM IST",
      "formatted": "V1.28, 21 Nov 2026, 02:17 AM IST",
      "type": "minor",
      "summary": "Minor general update (Notification alerts updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.27",
      "timestamp": "21 Nov 2026, 02:15 AM IST",
      "formatted": "V1.27, 21 Nov 2026, 02:15 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor ChatTab component for clarity and maintainability)",
      "requiresReinstall": false
    },
    {
      "version": "V1.26",
      "timestamp": "21 Nov 2026, 02:10 AM IST",
      "formatted": "V1.26, 21 Nov 2026, 02:10 AM IST",
      "type": "minor",
      "summary": "Minor general update (Update family member checks to use alumni_id)",
      "requiresReinstall": false
    },
    {
      "version": "V1.25",
      "timestamp": "21 Nov 2026, 02:09 AM IST",
      "formatted": "V1.25, 21 Nov 2026, 02:09 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor GalleryTab for improved media management)",
      "requiresReinstall": false
    },
    {
      "version": "V1.24",
      "timestamp": "21 Nov 2026, 02:08 AM IST",
      "formatted": "V1.24, 21 Nov 2026, 02:08 AM IST",
      "type": "minor",
      "summary": "Minor general update (Member profile details updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.23",
      "timestamp": "21 Nov 2026, 02:07 AM IST",
      "formatted": "V1.23, 21 Nov 2026, 02:07 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor CalendarTab component for readability)",
      "requiresReinstall": false
    },
    {
      "version": "V1.22",
      "timestamp": "21 Nov 2026, 02:06 AM IST",
      "formatted": "V1.22, 21 Nov 2026, 02:06 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor FamilyTab component state management)",
      "requiresReinstall": false
    },
    {
      "version": "V1.21",
      "timestamp": "21 Nov 2026, 02:05 AM IST",
      "formatted": "V1.21, 21 Nov 2026, 02:05 AM IST",
      "type": "minor",
      "summary": "Minor general update (Member profile details updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.20",
      "timestamp": "21 Nov 2026, 01:59 AM IST",
      "formatted": "V1.20, 21 Nov 2026, 01:59 AM IST",
      "type": "minor",
      "summary": "Minor general update (App icon appearance updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.19",
      "timestamp": "21 Nov 2026, 01:58 AM IST",
      "formatted": "V1.19, 21 Nov 2026, 01:58 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add MemberDashboard component with navigation and alerts)",
      "requiresReinstall": false
    }
  ]
}
