"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type Props = {
  id: string
  name: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
  allowCustom?: boolean
  inputClassName?: string
}

export default function SchoolCombobox({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  allowCustom = false,
  inputClassName = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20",
}: Props) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const lastEmittedValue = useRef(value)
  const closeTimer = useRef<number | null>(null)

  useEffect(() => {
    if (value !== lastEmittedValue.current) {
      setQuery(value)
      lastEmittedValue.current = value
    }
  }, [value])

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (normalizedQuery.length < 2) return []
    return options
      .filter((option) => option.toLocaleLowerCase().includes(normalizedQuery))
      .slice(0, 60)
  }, [options, query])

  function emit(nextValue: string) {
    lastEmittedValue.current = nextValue
    onChange(nextValue)
  }

  function select(option: string) {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    setQuery(option)
    emit(option)
    setOpen(false)
    setHighlightedIndex(0)
  }

  const listboxId = `${id}-options`

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="text"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && filteredOptions.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={open && filteredOptions[highlightedIndex]
          ? `${id}-option-${highlightedIndex}`
          : undefined}
        onChange={(event) => {
          const nextQuery = event.target.value
          setQuery(nextQuery)
          emit(allowCustom ? nextQuery : "")
          setHighlightedIndex(0)
          setOpen(true)
        }}
        onFocus={() => {
          if (query.trim().length >= 2) setOpen(true)
        }}
        onBlur={() => {
          closeTimer.current = window.setTimeout(() => {
            if (allowCustom) {
              const trimmedQuery = query.trim()
              setQuery(trimmedQuery)
              emit(trimmedQuery)
            }
            setOpen(false)
          }, 150)
        }}
        onKeyDown={(event) => {
          if (!open || filteredOptions.length === 0) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setHighlightedIndex((index) => (index + 1) % filteredOptions.length)
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setHighlightedIndex((index) => (index - 1 + filteredOptions.length) % filteredOptions.length)
          } else if (event.key === "Enter") {
            event.preventDefault()
            select(filteredOptions[highlightedIndex])
          } else if (event.key === "Escape") {
            setOpen(false)
          }
        }}
        className={inputClassName}
      />
      {open && filteredOptions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {filteredOptions.map((option, index) => (
            <li key={option} role="presentation">
              <button
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => select(option)}
                className={`w-full px-3 py-2 text-left text-sm text-zinc-900 ${
                  index === highlightedIndex ? "bg-ipn-light" : "hover:bg-zinc-50"
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
