import { useState, useEffect, useId } from 'react'
import { Input } from '@/components/ui/input'
import {
  COUNTRY_CODES,
  resolveCountryCodeInput,
  cleanPhoneNumber,
  splitPhoneForEditor,
} from '@/lib/formatters'

interface SmartPhoneInputProps {
  countryCode: string
  localNumber: string
  onChange: (nextCountryCode: string, nextLocalNumber: string, fullCleaned: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function SmartPhoneInput({
  countryCode,
  localNumber,
  onChange,
  disabled = false,
  placeholder = 'Phone number',
}: SmartPhoneInputProps) {
  const datalistId = useId()
  const [countryInput, setCountryInput] = useState(countryCode || '+91')

  useEffect(() => {
    setCountryInput(countryCode || '+91')
  }, [countryCode])

  const handleCountryBlurOrSelect = (rawCountry: string) => {
    const resolvedCode = resolveCountryCodeInput(rawCountry)
    setCountryInput(resolvedCode)
    const fullClean = cleanPhoneNumber(localNumber, resolvedCode)
    const { localNumber: cleanedLocal } = splitPhoneForEditor(fullClean)
    onChange(resolvedCode, cleanedLocal, fullClean)
  }

  const handleLocalChange = (rawNum: string) => {
    const resolvedCode = resolveCountryCodeInput(countryInput)
    const fullClean = cleanPhoneNumber(rawNum, resolvedCode)
    const { localNumber: cleanedLocal } = splitPhoneForEditor(fullClean)
    onChange(resolvedCode, cleanedLocal, fullClean)
  }

  const previewClean = cleanPhoneNumber(localNumber, resolveCountryCodeInput(countryInput))

  return (
    <div className={`space-y-1 ${disabled ? 'opacity-50 pointer-events-none select-none' : ''}`}>
      <div className="flex gap-1.5">
        <div className="w-[38%] min-w-[105px]">
          <Input
            type="text"
            list={datalistId}
            disabled={disabled}
            value={countryInput}
            onChange={e => {
              const val = e.target.value
              setCountryInput(val)
              if (/\(\+\d{1,4}\)/.test(val)) {
                handleCountryBlurOrSelect(val)
              }
            }}
            onBlur={() => handleCountryBlurOrSelect(countryInput)}
            placeholder="Country / +91"
            title="Type country name, country code, or choose from list"
            className="text-xs px-2 bg-background"
          />
          <datalist id={datalistId}>
            {COUNTRY_CODES.map(c => (
              <option key={`${c.name}-${c.code}`} value={`${c.name} (${c.code})`} />
            ))}
          </datalist>
        </div>

        <Input
          type="tel"
          disabled={disabled}
          value={localNumber}
          onChange={e => handleLocalChange(e.target.value)}
          onBlur={() => handleLocalChange(localNumber)}
          placeholder={placeholder}
          className="flex-1 text-xs"
        />
      </div>

      {previewClean && (
        <p className="text-[10px] font-mono text-muted-foreground">
          Dialable format: <span className="font-semibold text-primary">{previewClean}</span>
        </p>
      )}
    </div>
  )
}
