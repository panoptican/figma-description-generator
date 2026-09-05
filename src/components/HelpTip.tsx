import { h } from 'preact'
import { useState } from 'preact/hooks'

interface HelpTipProps {
  id: string
  label: string
  text: string
}

export function HelpTip({ id, label, text }: HelpTipProps) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            setOpen(false)
          }
        }}
        style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid var(--figma-color-border)', background: 'transparent', color: 'var(--figma-color-text-secondary)', cursor: 'help', padding: 0 }}>
        ?
      </button>
      {open && <span id={id} role="tooltip" style={{ position: 'absolute', right: 0, top: '24px', width: '280px', padding: '12px', borderRadius: '6px', background: 'var(--figma-color-bg-inverse, #fff)', color: 'var(--figma-color-text-oninverse, #222)', boxShadow: '0 2px 12px #0003', fontSize: '11px', lineHeight: '16px', zIndex: 10 }}>{text}</span>}
    </span>
  )
}
