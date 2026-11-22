import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import {
  parseFlexibleDateInput,
  formatIsoToTypedDDMMYYYY,
  formatFullDate,
} from '@/lib/formatters'
import { CalendarDays } from 'lucide-react'

interface SmartDateInputProps {
  value: string // Stored ISO YYYY-MM-DD
  onChange: (isoDate: string) => void
  placeholder?: string
  className?: string
}

export default function SmartDateInput({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY or DDMMYY',
  className = '',
}: SmartDateInputProps) {
  const [textValue, setTextValue] = useState(() => formatIsoToTypedDDMMYYYY(value))
  const [errorMsg, setErrorMsg] = useState('')
  const nativePickerRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setTextValue(formatIsoToTypedDDMMYYYY(value))
    setErrorMsg('')
  }, [value])

  const commitTypedText = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setErrorMsg('')
      onChange('')
      return
    }

    const parsed = parseFlexibleDateInput(trimmed)
    if (parsed) {
      setErrorMsg('')
      setTextValue(parsed.typed)
      onChange(parsed.iso)
    } else {
      setErrorMsg('Enter valid date as DD/MM/YYYY or DDMMYY')
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setTextValue(next)
    setErrorMsg('')

    // Auto-resolve immediately when user finishes typing 6 or 8 digits or full DD/MM/YYYY
    if (/^\d{6}$/.test(next.trim()) || /^\d{8}$/.test(next.trim()) || /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}$/.test(next.trim())) {
      const parsed = parseFlexibleDateInput(next)
      if (parsed) {
        setTextValue(parsed.typed)
        onChange(parsed.iso)
      }
    }
  }

  const openNativeCalendar = () => {
    const picker = nativePickerRef.current
    if (!picker) return
    if (typeof (picker as any).showPicker === 'function') {
      try {
        ;(picker as any).showPicker()
        return
      } catch {
        // Fallback to click
      }
    }
    picker.click()
  }

  const fullFormatted = value ? formatFullDate(value) : ''

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="relative flex items-center">
        <Input
          type="text"
          value={textValue}
          onChange={handleTextChange}
          onBlur={() => commitTypedText(textValue)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitTypedText(textValue)
            }
          }}
          placeholder={placeholder}
          className="pr-9 text-xs"
        />

        {/* Hidden native date picker triggered by the calendar button */}
        <input
          ref={nativePickerRef}
          type="date"
          value={value || ''}
          onChange={e => {
            setErrorMsg('')
            onChange(e.target.value)
          }}
          tabIndex={-1}
          className="sr-only"
        />

        <button
          type="button"
          onClick={openNativeCalendar}
          title="Choose from Calendar"
          className="absolute right-2 flex h-6 w-6 items-center justify-center rounded text-primary hover:bg-primary/15"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>

      {errorMsg ? (
        <p className="text-[10px] font-medium text-red-400">{errorMsg}</p>
      ) : fullFormatted ? (
        <p className="text-[10px] font-medium text-primary/90">{fullFormatted}</p>
      ) : null}
    </div>
  )
}
