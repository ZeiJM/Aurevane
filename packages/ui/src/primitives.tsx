import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from 'react'

export type SurfaceTone = 'default' | 'quiet' | 'elevated'
export type GameButtonVariant = 'primary' | 'quiet' | 'danger'

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: SurfaceTone
}

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant
}

interface KickerProps extends HTMLAttributes<HTMLParagraphElement> {
  marker?: ReactNode
}

export function Surface({ tone = 'default', className, ...props }: SurfaceProps) {
  return <div className={cx('av-surface', `av-surface--${tone}`, className)} {...props} />
}

export function GameButton({ variant = 'primary', className, ...props }: GameButtonProps) {
  return <button className={cx('av-button', `av-button--${variant}`, className)} {...props} />
}

export function Kicker({ marker, className, children, ...props }: PropsWithChildren<KickerProps>) {
  return (
    <p className={cx('av-kicker', className)} {...props}>
      {marker ? <span className="av-kicker__marker">{marker}</span> : null}
      <span>{children}</span>
    </p>
  )
}

export function StatusMark({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('av-status-mark', className)} aria-hidden="true" {...props} />
}

function cx(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(' ')
}
