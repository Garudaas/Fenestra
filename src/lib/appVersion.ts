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
  "version": "V1.82",
  "timestamp": "23 Nov 2026, 02:26 AM IST",
  "formatted": "V1.82, 23 Nov 2026, 02:26 AM IST",
  "type": "minor",
  "summary": "Minor technical update (Remove unused import for readFileAsDataURL)",
  "requiresReinstall": false,
  "history": [
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
    },
    {
      "version": "V1.70",
      "timestamp": "23 Nov 2026, 01:59 AM IST",
      "formatted": "V1.70, 23 Nov 2026, 01:59 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add SmartPhoneInput component for phone number input)",
      "requiresReinstall": false
    },
    {
      "version": "V1.69",
      "timestamp": "23 Nov 2026, 01:58 AM IST",
      "formatted": "V1.69, 23 Nov 2026, 01:58 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add SmartDateInput component for flexible date input)",
      "requiresReinstall": false
    },
    {
      "version": "V1.68",
      "timestamp": "23 Nov 2026, 01:57 AM IST",
      "formatted": "V1.68, 23 Nov 2026, 01:57 AM IST",
      "type": "minor",
      "summary": "Minor general update (Add date formatting and phone number utilities)",
      "requiresReinstall": false
    },
    {
      "version": "V1.67",
      "timestamp": "23 Nov 2026, 12:25 AM IST",
      "formatted": "V1.67, 23 Nov 2026, 12:25 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add MemberProfilePage route to App component)",
      "requiresReinstall": false
    },
    {
      "version": "V1.66",
      "timestamp": "23 Nov 2026, 12:24 AM IST",
      "formatted": "V1.66, 23 Nov 2026, 12:24 AM IST",
      "type": "minor",
      "summary": "Minor general update (Chat and calling screen updated)",
      "requiresReinstall": false
    },
    {
      "version": "V1.65",
      "timestamp": "23 Nov 2026, 12:23 AM IST",
      "formatted": "V1.65, 23 Nov 2026, 12:23 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Refactor DirectoryTab by removing family data logic)",
      "requiresReinstall": false
    },
    {
      "version": "V1.64",
      "timestamp": "23 Nov 2026, 12:22 AM IST",
      "formatted": "V1.64, 23 Nov 2026, 12:22 AM IST",
      "type": "minor",
      "summary": "Minor technical update (Add MemberProfilePage component)",
      "requiresReinstall": false
    },
    {
      "version": "V1.63",
      "timestamp": "23 Nov 2026, 12:07 AM IST",
      "formatted": "V1.63, 23 Nov 2026, 12:07 AM IST",
      "type": "minor",
      "summary": "Minor general update (Update print statement from 'Hello' to 'Goodbye')",
      "requiresReinstall": false
    },
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
    }
  ]
}
