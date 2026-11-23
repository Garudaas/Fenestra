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
  "version": "V2.06",
  "timestamp": "23 Nov 2026, 09:56 PM IST",
  "formatted": "V2.06, 23 Nov 2026, 09:56 PM IST",
  "type": "minor",
  "summary": "Minor technical update (Add ShareTargetPage component for sharing content)",
  "requiresReinstall": false,
  "history": [
    {
      "version": "V2.06",
      "timestamp": "23 Nov 2026, 09:56 PM IST",
      "formatted": "V2.06, 23 Nov 2026, 09:56 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Add ShareTargetPage component for sharing content)",
      "requiresReinstall": false
    },
    {
      "version": "V2.05",
      "timestamp": "23 Nov 2026, 09:55 PM IST",
      "formatted": "V2.05, 23 Nov 2026, 09:55 PM IST",
      "type": "minor",
      "summary": "Minor technical update (Add report exporter with CSV and HTML export functions)",
      "requiresReinstall": false
    },
    {
      "version": "V2.04",
      "timestamp": "23 Nov 2026, 09:54 PM IST",
      "formatted": "V2.04, 23 Nov 2026, 09:54 PM IST",
      "type": "minor",
      "summary": "Minor general update (Implement biometric authentication functions)",
      "requiresReinstall": false
    },
    {
      "version": "V2.03",
      "timestamp": "23 Nov 2026, 09:53 PM IST",
      "formatted": "V2.03, 23 Nov 2026, 09:53 PM IST",
      "type": "minor",
      "summary": "Minor general update (App icon appearance updated)",
      "requiresReinstall": false
    },
    {
      "version": "V2.02",
      "timestamp": "23 Nov 2026, 04:47 AM IST",
      "formatted": "V2.02, 23 Nov 2026, 04:47 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor officerPrefixMap state initialization)",
      "requiresReinstall": false
    },
    {
      "version": "V2.01",
      "timestamp": "23 Nov 2026, 04:46 AM IST",
      "formatted": "V2.01, 23 Nov 2026, 04:46 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor MemberProfilePage with hooks and imports)",
      "requiresReinstall": false
    },
    {
      "version": "V2.00",
      "timestamp": "23 Nov 2026, 04:42 AM IST",
      "formatted": "V2.00, 23 Nov 2026, 04:42 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add newline at end of taskAuditService.ts)",
      "requiresReinstall": false
    },
    {
      "version": "V1.99",
      "timestamp": "23 Nov 2026, 04:41 AM IST",
      "formatted": "V1.99, 23 Nov 2026, 04:41 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor taskAuditService for clarity and type safety)",
      "requiresReinstall": false
    },
    {
      "version": "V1.98",
      "timestamp": "23 Nov 2026, 04:39 AM IST",
      "formatted": "V1.98, 23 Nov 2026, 04:39 AM IST",
      "type": "minor",
      "summary": "Minor general update (Member profile details updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.97",
      "timestamp": "23 Nov 2026, 04:37 AM IST",
      "formatted": "V1.97, 23 Nov 2026, 04:37 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor MaintenanceTab by removing comments and updating imports)",
      "requiresReinstall": false
    },
    {
      "version": "V1.96",
      "timestamp": "23 Nov 2026, 04:35 AM IST",
      "formatted": "V1.96, 23 Nov 2026, 04:35 AM IST",
      "type": "minor",
      "summary": "Minor general update (Implement admin role management for President and GenSec)",
      "requiresReinstall": false
    },
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
    }
  ]
}
