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
  "version": "V1.51",
  "timestamp": "22 Nov 2026, 11:28 PM IST",
  "formatted": "V1.51, 22 Nov 2026, 11:28 PM IST",
  "type": "minor",
  "summary": "Minor general update (Screen appearance and layout improved)",
  "requiresReinstall": false,
  "history": [
    {
      "version": "V1.51",
      "timestamp": "22 Nov 2026, 11:28 PM IST",
      "formatted": "V1.51, 22 Nov 2026, 11:28 PM IST",
      "type": "minor",
      "summary": "Minor general update (Screen appearance and layout improved)",
      "requiresReinstall": false
    },
    {
      "version": "V1.50",
      "timestamp": "22 Nov 2026, 11:26 PM IST",
      "formatted": "V1.50, 22 Nov 2026, 11:26 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor task creation and add audit items)",
      "requiresReinstall": false
    },
    {
      "version": "V1.49",
      "timestamp": "22 Nov 2026, 11:25 PM IST",
      "formatted": "V1.49, 22 Nov 2026, 11:25 PM IST",
      "type": "minor",
      "summary": "Minor general update (Notification alerts updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.48",
      "timestamp": "22 Nov 2026, 09:50 PM IST",
      "formatted": "V1.48, 22 Nov 2026, 09:50 PM IST",
      "type": "minor",
      "summary": "Minor general update (Update print statement from 'Hello' to 'Goodbye')",
      "requiresReinstall": false
    },
    {
      "version": "V1.47",
      "timestamp": "22 Nov 2026, 09:49 PM IST",
      "formatted": "V1.47, 22 Nov 2026, 09:49 PM IST",
      "type": "minor",
      "summary": "Minor general update (Notification alerts updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.46",
      "timestamp": "22 Nov 2026, 09:47 PM IST",
      "formatted": "V1.46, 22 Nov 2026, 09:47 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor celebrations to use structured objects)",
      "requiresReinstall": false
    },
    {
      "version": "V1.45",
      "timestamp": "22 Nov 2026, 09:46 PM IST",
      "formatted": "V1.45, 22 Nov 2026, 09:46 PM IST",
      "type": "minor",
      "summary": "Minor general update (Handle errors in syncArchivedNotificationsForUser)",
      "requiresReinstall": false
    },
    {
      "version": "V1.44",
      "timestamp": "21 Nov 2026, 03:33 AM IST",
      "formatted": "V1.44, 21 Nov 2026, 03:33 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor one-tap install logic and UI updates)",
      "requiresReinstall": false
    },
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
    }
  ]
}
