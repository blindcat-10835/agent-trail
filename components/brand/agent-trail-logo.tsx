import type { SVGProps } from 'react'

export type AgentTrailLogoVariant = 'primary' | 'compact' | 'outline'

interface AgentTrailLogoProps extends SVGProps<SVGSVGElement> {
  variant?: AgentTrailLogoVariant
}

function PrimaryMark() {
  return (
    <>
      <path d="M4 14 14 4h11v15l-6 6v20l-9 9v6l-6-6V14Z" />
      <path d="M60 14 50 4H39v15l6 6v20l9 9v6l6-6V14Z" />
      <path d="m32 23 6 6-6 6-6-6 6-6Z" />
      <path d="M27 39h10l2 3H25l2-3Z" />
      <path d="M23 45h18l2 3H21l2-3Z" />
      <path d="M19 51h26l3 4H16l3-4Z" />
      <path d="M14 58h36l3 4H11l3-4Z" />
    </>
  )
}

function CompactMark() {
  return (
    <>
      <path d="M3 15 14 4h12v17l-7 7v19L8 58l-5-5V15Z" />
      <path d="M61 15 50 4H38v17l7 7v19l11 11 5-5V15Z" />
      <path d="m32 22 7 7-7 7-7-7 7-7Z" />
      <path d="M25 41h14l3 4H22l3-4Z" />
      <path d="M18 50h28l4 6H14l4-6Z" />
    </>
  )
}

function OutlineMark() {
  return (
    <>
      <path
        d="M24 6H14L6 14v38l6 6 10-10V25l5-5V6h-3ZM40 6h10l8 8v38l-6 6-10-10V25l-5-5V6h3Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth="4"
      />
      <path d="m32 22 6 6-6 6-6-6 6-6Z" />
      <path
        d="M27 40h10M23 47h18M18 55h28"
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="3"
      />
    </>
  )
}

export function AgentTrailLogo({
  variant = 'primary',
  className,
  ...props
}: AgentTrailLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      focusable="false"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {variant === 'primary' ? <PrimaryMark /> : null}
      {variant === 'compact' ? <CompactMark /> : null}
      {variant === 'outline' ? <OutlineMark /> : null}
    </svg>
  )
}
