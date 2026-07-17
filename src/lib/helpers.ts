export function getOrdinalSuffix(i: number): string {
  if (i <= 0) return 'Initial'
  const j = i % 10
  const k = i % 100
  if (j === 1 && k !== 11) return i + 'st'
  if (j === 2 && k !== 12) return i + 'nd'
  if (j === 3 && k !== 13) return i + 'rd'
  return i + 'th'
}

export function getDmRoomId(id1: number, id2: number): string {
  const a = Math.min(id1, id2)
  const b = Math.max(id1, id2)
  return `dm_${a}_${b}`
}

export function generateMapLinkHTML(locationString: string | null): string {
  if (!locationString) return ''
  const cleanStr = locationString.trim()
  if (cleanStr.startsWith('http://') || cleanStr.startsWith('https://')) {
    return cleanStr
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanStr)}`
}

export function playMentionTone() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.5, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // Audio feedback not supported
  }
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function translateText(text: string, targetLang: string): Promise<string> {
  let textToTranslate = text

  const englishWords = textToTranslate.match(/[a-zA-Z]+/g)
  if (englishWords) {
    for (const word of englishWords) {
      try {
        const inputRes = await fetch(`https://inputtools.google.com/request?text=${word}&itc=ta-t-i0-und&num=1`)
        const inputData = await inputRes.json()
        if (inputData[0] === 'SUCCESS' && inputData[1][0][1][0]) {
          textToTranslate = textToTranslate.replace(word, inputData[1][0][1][0])
        }
      } catch {
        // Skip
      }
    }
  }

  const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(textToTranslate)}`)
  const data = await res.json()
  let translated = ''
  data[0].forEach((item: any) => { translated += item[0] })
  return translated
}
