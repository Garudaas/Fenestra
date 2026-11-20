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
  version: 'V1.00',
  timestamp: '20 Nov 2026, 11:10 PM IST',
  formatted: 'V1.00, 20 Nov 2026, 11:10 PM IST',
  type: 'major',
  summary: 'App update checker and automatic version tracking added.',
  requiresReinstall: false,
  history: [
    {
      version: 'V1.00',
      timestamp: '20 Nov 2026, 11:10 PM IST',
      formatted: 'V1.00, 20 Nov 2026, 11:10 PM IST',
      type: 'major',
      summary: 'App update checker and automatic version tracking added.',
      requiresReinstall: false,
    },
  ],
}
