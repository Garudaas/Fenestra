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
  "version": "V1.62",
  "timestamp": "22 Nov 2026, 11:59 PM IST",
  "formatted": "V1.62, 22 Nov 2026, 11:59 PM IST",
  "type": "minor",
  "summary": "Minor general update (Implement PersistentSessionRedirect for user navigation)",
  "requiresReinstall": false,
  "history": [
    {
      "version": "V1.62",
      "timestamp": "22 Nov 2026, 11:59 PM IST",
      "formatted": "V1.62, 22 Nov 2026, 11:59 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement PersistentSessionRedirect for user navigation)",
      "requiresReinstall": false
    },
    {
      "version": "V1.61",
      "timestamp": "22 Nov 2026, 11:58 PM IST",
      "formatted": "V1.61, 22 Nov 2026, 11:58 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor AuthContext to improve session handling)",
      "requiresReinstall": false
    },
    {
      "version": "V1.60",
      "timestamp": "22 Nov 2026, 11:54 PM IST",
      "formatted": "V1.60, 22 Nov 2026, 11:54 PM IST",
      "type": "minor",
      "summary": "Minor general update (Photo gallery updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.59",
      "timestamp": "22 Nov 2026, 11:53 PM IST",
      "formatted": "V1.59, 22 Nov 2026, 11:53 PM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance file sorting and admin quota features)",
      "requiresReinstall": false
    },
    {
      "version": "V1.58",
      "timestamp": "22 Nov 2026, 11:52 PM IST",
      "formatted": "V1.58, 22 Nov 2026, 11:52 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement search and filter features in DirectoryTab)",
      "requiresReinstall": false
    },
    {
      "version": "V1.57",
      "timestamp": "22 Nov 2026, 11:51 PM IST",
      "formatted": "V1.57, 22 Nov 2026, 11:51 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement real-time listener for header badges)",
      "requiresReinstall": false
    },
    {
      "version": "V1.56",
      "timestamp": "22 Nov 2026, 11:50 PM IST",
      "formatted": "V1.56, 22 Nov 2026, 11:50 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor video call notifications and messages)",
      "requiresReinstall": false
    },
    {
      "version": "V1.55",
      "timestamp": "22 Nov 2026, 11:48 PM IST",
      "formatted": "V1.55, 22 Nov 2026, 11:48 PM IST",
      "type": "minor",
      "summary": "Minor general update (Notification alerts updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.54",
      "timestamp": "22 Nov 2026, 11:47 PM IST",
      "formatted": "V1.54, 22 Nov 2026, 11:47 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Implement Supabase Realtime for notifications)",
      "requiresReinstall": false
    },
    {
      "version": "V1.53",
      "timestamp": "22 Nov 2026, 11:46 PM IST",
      "formatted": "V1.53, 22 Nov 2026, 11:46 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement sendDevicePushNotification function)",
      "requiresReinstall": false
    },
    {
      "version": "V1.52",
      "timestamp": "22 Nov 2026, 11:29 PM IST",
      "formatted": "V1.52, 22 Nov 2026, 11:29 PM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance ProfileTab with new user fields and task features)",
      "requiresReinstall": false
    },
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
    }
  ]
}
