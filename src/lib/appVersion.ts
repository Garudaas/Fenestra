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
  "version": "V1.28",
  "timestamp": "21 Nov 2026, 02:17 AM IST",
  "formatted": "V1.28, 21 Nov 2026, 02:17 AM IST",
  "type": "minor",
  "summary": "Minor general update (Notification alerts updated)",
  "requiresReinstall": false,
  "history": [
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
    },
    {
      "version": "V1.18",
      "timestamp": "21 Nov 2026, 01:56 AM IST",
      "formatted": "V1.18, 21 Nov 2026, 01:56 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add MaintenanceTab component for admin tasks)",
      "requiresReinstall": false
    },
    {
      "version": "V1.17",
      "timestamp": "21 Nov 2026, 01:55 AM IST",
      "formatted": "V1.17, 21 Nov 2026, 01:55 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add SupportTab component for family support requests)",
      "requiresReinstall": false
    },
    {
      "version": "V1.16",
      "timestamp": "21 Nov 2026, 01:54 AM IST",
      "formatted": "V1.16, 21 Nov 2026, 01:54 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add FolderTab component for file management)",
      "requiresReinstall": false
    },
    {
      "version": "V1.15",
      "timestamp": "21 Nov 2026, 01:53 AM IST",
      "formatted": "V1.15, 21 Nov 2026, 01:53 AM IST",
      "type": "minor",
      "summary": "Minor general update (Notification alerts updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.14",
      "timestamp": "21 Nov 2026, 01:52 AM IST",
      "formatted": "V1.14, 21 Nov 2026, 01:52 AM IST",
      "type": "minor",
      "summary": "Minor general update (Implement privacy controls in SettingsTab)",
      "requiresReinstall": false
    },
    {
      "version": "V1.13",
      "timestamp": "21 Nov 2026, 01:49 AM IST",
      "formatted": "V1.13, 21 Nov 2026, 01:49 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add SplashScreen component to App)",
      "requiresReinstall": false
    },
    {
      "version": "V1.12",
      "timestamp": "21 Nov 2026, 01:48 AM IST",
      "formatted": "V1.12, 21 Nov 2026, 01:48 AM IST",
      "type": "minor",
      "summary": "Minor general update (Add constants and functions for family and blood group management)",
      "requiresReinstall": false
    },
    {
      "version": "V1.11",
      "timestamp": "21 Nov 2026, 01:47 AM IST",
      "formatted": "V1.11, 21 Nov 2026, 01:47 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Create fenestriansCore.ts)",
      "requiresReinstall": false
    },
    {
      "version": "V1.10",
      "timestamp": "21 Nov 2026, 01:46 AM IST",
      "formatted": "V1.10, 21 Nov 2026, 01:46 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add SplashScreen component with session storage logic)",
      "requiresReinstall": false
    },
    {
      "version": "V1.09",
      "timestamp": "21 Nov 2026, 12:46 AM IST",
      "formatted": "V1.09, 21 Nov 2026, 12:46 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor headers in auto-version workflow)",
      "requiresReinstall": false
    },
    {
      "version": "V1.08",
      "timestamp": "21 Nov 2026, 12:44 AM IST",
      "formatted": "V1.08, 21 Nov 2026, 12:44 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add NotificationsPage and OneSignalUserSync component)",
      "requiresReinstall": false
    },
    {
      "version": "V1.07",
      "timestamp": "21 Nov 2026, 12:43 AM IST",
      "formatted": "V1.07, 21 Nov 2026, 12:43 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add NotificationQuickBar component for alerts and chats)",
      "requiresReinstall": false
    },
    {
      "version": "V1.06",
      "timestamp": "21 Nov 2026, 12:42 AM IST",
      "formatted": "V1.06, 21 Nov 2026, 12:42 AM IST",
      "type": "minor",
      "summary": "Minor general update (Add Notifications listing Page for user notifications)",
      "requiresReinstall": false
    },
    {
      "version": "V1.05",
      "timestamp": "21 Nov 2026, 12:40 AM IST",
      "formatted": "V1.05, 21 Nov 2026, 12:40 AM IST",
      "type": "minor",
      "summary": "Minor general update (Notification alerts updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.04",
      "timestamp": "21 Nov 2026, 12:06 AM IST",
      "formatted": "V1.04, 21 Nov 2026, 12:06 AM IST",
      "type": "minor",
      "summary": "Minor general update (V2 of Add detailed installation steps for Android and iPhone)",
      "requiresReinstall": false
    }
  ]
}
