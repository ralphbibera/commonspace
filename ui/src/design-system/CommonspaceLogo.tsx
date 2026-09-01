import commonspaceLogo from '@/assets/commonspace-logo.png'
import { cn } from '@/lib/utils'

interface CommonspaceLogoProps {
  className?: string
  decorative?: boolean
}

export function CommonspaceLogo({ className, decorative = false }: CommonspaceLogoProps) {
  return (
    <img
      src={commonspaceLogo}
      alt={decorative ? '' : 'Commonspace'}
      aria-hidden={decorative || undefined}
      className={cn('block object-contain', className)}
    />
  )
}
