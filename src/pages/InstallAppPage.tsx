import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Smartphone, Download, Copy, Check, ArrowLeft, Camera, ExternalLink } from 'lucide-react'

type LangCode = 'en' | 'ta' | 'ml'

const INSTALL_GUIDE_TEXT: Record<LangCode, {
  title: string
  subtitle: string
  screenshotTitle: string
  screenshotBody: string
  linkHeading: string
  stepsHeading: string
  androidTitle: string
  androidSteps: string[]
  iphoneTitle: string
  iphoneSteps: string[]
  copyBtn: string
  copiedBtn: string
  autoInstallBtn: string
  installedDoneMsg: string
  manualFallbackAlert: string
  backBtn: string
}> = {
  en: {
    title: 'Install Fenestrians App',
    subtitle: 'Add Fenestrians to your phone home screen for one-tap access and instant alerts.',
    screenshotTitle: 'Important: Take a Screenshot Now',
    screenshotBody: 'Please take a screenshot of this page before you begin, so you can easily read the steps while opening your phone browser menu.',
    linkHeading: 'Official App Web Link (Tap to Open)',
    stepsHeading: 'How to Install on Your Phone',
    androidTitle: 'For Android Phones (Chrome)',
    androidSteps: [
      'Open the clickable link below in your Chrome browser.',
      'Tap the "Install Fenestrians App Automatically" button at the top of this page.',
      'If no pop-up appears, tap the three dots (⋮) at the top-right corner of Chrome and tap "Install app" or "Add to Home screen".',
      'Tap "Install" or "Add" to place the Fenestrians icon on your home screen.',
    ],
    iphoneTitle: 'For iPhones (Safari)',
    iphoneSteps: [
      'Open the clickable link below in the Safari browser.',
      'Tap the Share button (square with an upward arrow) at the bottom of the screen.',
      'Scroll down the menu and tap "Add to Home Screen".',
      'Tap "Add" at the top-right corner to place the Fenestrians icon on your home screen.',
    ],
    copyBtn: 'Copy Instructions & Web Link',
    copiedBtn: 'Instructions & Link Copied!',
    autoInstallBtn: 'Install Fenestrians App Automatically',
    installedDoneMsg: 'Fenestrians is now installed on your device! You can open it from your home screen.',
    manualFallbackAlert: 'Your browser requires using its menu button to finish installing. Please follow the 4 steps shown below on this page (or use the screenshot you took).',
    backBtn: 'Back to App',
  },
  ta: {
    title: 'Fenestrians செயலியை நிறுவவும்',
    subtitle: 'எளிதாகப் பயன்படுத்தவும் உடனடி அறிவிப்புகளைப் பெறவும் உங்கள் கைபேசி முகப்புத் திரையில் Fenestrians செயலியைச் சேர்க்கவும்.',
    screenshotTitle: 'முக்கியம்: இப்போதே ஸ்கிரீன்ஷாட் (Screenshot) எடுக்கவும்',
    screenshotBody: 'தொடங்குவதற்கு முன் இந்தப் பக்கத்தை ஸ்கிரீன்ஷாட் எடுத்து வைத்துக்கொள்ளவும். அப்போதுதான் உலாவியின் (Browser) மெனுவைத் திறக்கும்போது வழிமுறைகளைப் பார்த்துச் செய்ய முடியும்.',
    linkHeading: 'செயலியின் இணைய இணைப்பு (திறக்கத் தொடவும்)',
    stepsHeading: 'கைபேசியில் நிறுவும் வழிமுறைகள்',
    androidTitle: 'ஆண்ட்ராய்டு கைபேசிகளுக்கு (Chrome)',
    androidSteps
