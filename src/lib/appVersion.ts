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
  "version": "V1.95",
  "timestamp": "23 Nov 2026, 04:34 AM IST",
  "formatted": "V1.95, 23 Nov 2026, 04:34 AM IST",
  "type": "minor",
  "summary": "Minor general update (Add Tasks tab and update badge synchronization)",
  "requiresReinstall": false,
  "history": [
    {
      "version": "V1.95",
      "timestamp": "23 Nov 2026, 04:34 AM IST",
      "formatted": "V1.95, 23 Nov 2026, 04:34 AM IST",
      "type": "minor",
      "summary": "Minor general update (Add Tasks tab and update badge synchronization)",
      "requiresReinstall": false
    },
    {
      "version": "V1.94",
      "timestamp": "23 Nov 2026, 04:32 AM IST",
      "formatted": "V1.94, 23 Nov 2026, 04:32 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add TasksTab component for task management)",
      "requiresReinstall": false
    },
    {
      "version": "V1.93",
      "timestamp": "23 Nov 2026, 04:30 AM IST",
      "formatted": "V1.93, 23 Nov 2026, 04:30 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor date formatting and task handling in NotificationsPage)",
      "requiresReinstall": false
    },
    {
      "version": "V1.92",
      "timestamp": "23 Nov 2026, 04:28 AM IST",
      "formatted": "V1.92, 23 Nov 2026, 04:28 AM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance AuthContext with executive role checks)",
      "requiresReinstall": false
    },
    {
      "version": "V1.91",
      "timestamp": "23 Nov 2026, 04:27 AM IST",
      "formatted": "V1.91, 23 Nov 2026, 04:27 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor notification service and clean up comments)",
      "requiresReinstall": false
    },
    {
      "version": "V1.90",
      "timestamp": "23 Nov 2026, 04:24 AM IST",
      "formatted": "V1.90, 23 Nov 2026, 04:24 AM IST",
      "type": "minor",
      "summary": "Minor general update (Add taskAuditService with auditing functions)",
      "requiresReinstall": false
    },
    {
      "version": "V1.89",
      "timestamp": "23 Nov 2026, 04:23 AM IST",
      "formatted": "V1.89, 23 Nov 2026, 04:23 AM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance date formatting with IST support)",
      "requiresReinstall": false
    },
    {
      "version": "V1.88",
      "timestamp": "23 Nov 2026, 03:53 AM IST",
      "formatted": "V1.88, 23 Nov 2026, 03:53 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor notification date formatting and clean up comments)",
      "requiresReinstall": false
    },
    {
      "version": "V1.87",
      "timestamp": "23 Nov 2026, 03:52 AM IST",
      "formatted": "V1.87, 23 Nov 2026, 03:52 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor MaintenanceTab for audit task management)",
      "requiresReinstall": false
    },
    {
      "version": "V1.86",
      "timestamp": "23 Nov 2026, 03:05 AM IST",
      "formatted": "V1.86, 23 Nov 2026, 03:05 AM IST",
      "type": "minor",
      "summary": "Minor general update (Update print statement from 'Hello' to 'Goodbye')",
      "requiresReinstall": false
    },
    {
      "version": "V1.85",
      "timestamp": "23 Nov 2026, 02:59 AM IST",
      "formatted": "V1.85, 23 Nov 2026, 02:59 AM IST",
      "type": "minor",
      "summary": "Minor general update (Update print statement from 'Hello' to 'Goodbye')",
      "requiresReinstall": false
    },
    {
      "version": "V1.84",
      "timestamp": "23 Nov 2026, 02:58 AM IST",
      "formatted": "V1.84, 23 Nov 2026, 02:58 AM IST",
      "type": "minor",
      "summary": "Minor general update (Update print statement from 'Hello' to 'Goodbye')",
      "requiresReinstall": false
    },
    {
      "version": "V1.83",
      "timestamp": "23 Nov 2026, 02:39 AM IST",
      "formatted": "V1.83, 23 Nov 2026, 02:39 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor Alumni Association Home component)",
      "requiresReinstall": false
    },
    {
      "version": "V1.82",
      "timestamp": "23 Nov 2026, 02:26 AM IST",
      "formatted": "V1.82, 23 Nov 2026, 02:26 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Remove unused import for readFileAsDataURL)",
      "requiresReinstall": false
    },
    {
      "version": "V1.81",
      "timestamp": "23 Nov 2026, 02:22 AM IST",
      "formatted": "V1.81, 23 Nov 2026, 02:22 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor MemberDashboard and update tab logic)",
      "requiresReinstall": false
    },
    {
      "version": "V1.80",
      "timestamp": "23 Nov 2026, 02:15 AM IST",
      "formatted": "V1.80, 23 Nov 2026, 02:15 AM IST",
      "type": "minor",
      "summary": "Minor general update (Implement draggable position for NotificationQuickBar)",
      "requiresReinstall": false
    },
    {
      "version": "V1.79",
      "timestamp": "23 Nov 2026, 02:14 AM IST",
      "formatted": "V1.79, 23 Nov 2026, 02:14 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor SettingsTab component and state management)",
      "requiresReinstall": false
    },
    {
      "version": "V1.78",
      "timestamp": "23 Nov 2026, 02:13 AM IST",
      "formatted": "V1.78, 23 Nov 2026, 02:13 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor phone number handling and date formatting)",
      "requiresReinstall": false
    },
    {
      "version": "V1.77",
      "timestamp": "23 Nov 2026, 02:11 AM IST",
      "formatted": "V1.77, 23 Nov 2026, 02:11 AM IST",
      "type": "minor",
      "summary": "Minor general update (Enhance DirectoryTab with support requests and phone formatting)",
      "requiresReinstall": false
    },
    {
      "version": "V1.76",
      "timestamp": "23 Nov 2026, 02:09 AM IST",
      "formatted": "V1.76, 23 Nov 2026, 02:09 AM IST",
      "type": "minor",
      "summary": "Minor general update (Remove unnecessary closing braces and empty lines)",
      "requiresReinstall": false
    },
    {
      "version": "V1.75",
      "timestamp": "23 Nov 2026, 02:06 AM IST",
      "formatted": "V1.75, 23 Nov 2026, 02:06 AM IST",
      "type": "minor",
      "summary": "Minor general update (Update print statement from 'Hello' to 'Goodbye')",
      "requiresReinstall": false
    },
    {
      "version": "V1.74",
      "timestamp": "23 Nov 2026, 02:04 AM IST",
      "formatted": "V1.74, 23 Nov 2026, 02:04 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add new line at the end of MediaArchiveTab.tsx)",
      "requiresReinstall": false
    },
    {
      "version": "V1.73",
      "timestamp": "23 Nov 2026, 02:03 AM IST",
      "formatted": "V1.73, 23 Nov 2026, 02:03 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add Media Archive Tab component for file management)",
      "requiresReinstall": false
    },
    {
      "version": "V1.72",
      "timestamp": "23 Nov 2026, 02:02 AM IST",
      "formatted": "V1.72, 23 Nov 2026, 02:02 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add Media Archive Tab component for file management)",
      "requiresReinstall": false
    },
    {
      "version": "V1.71",
      "timestamp": "23 Nov 2026, 02:00 AM IST",
      "formatted": "V1.71, 23 Nov 2026, 02:00 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add CallsTab component for voice and video calls)",
      "requiresReinstall": false
    }
  ]
}
