import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'stone' | 'seal' | 'ethereal'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'stone', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles = 'font-[family-name:var(--font-title)] tracking-[0.15em] rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border-2 cursor-pointer hover:scale-105 active:scale-95'

    const variantStyles = {
      stone: 'bg-[var(--obsidian-light)] text-[var(--ivory)] border-[var(--ivory)] border-opacity-60 hover:bg-[var(--obsidian)] hover:border-opacity-80 hover:shadow-[0_0_20px_rgba(229,225,216,0.2)] stone-texture',
      seal: 'bg-[var(--burnt-amber)] text-[var(--ivory)] hover:bg-[var(--burnt-amber-light)] hover:shadow-[0_0_30px_rgba(179,123,52,0.4)] stone-texture border-[var(--burnt-amber)] hover:border-[var(--burnt-amber-light)]',
      ethereal: 'vellum-effect text-[var(--ivory)] hover:bg-[var(--ivory)]/10 border-[var(--ivory)] border-opacity-40 hover:border-opacity-70 hover:shadow-[0_0_20px_rgba(229,225,216,0.15)]'
    }

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    }

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Chargement...
          </span>
        ) : children}
      </button>
    )
  }
)

Button.displayName = 'Button'
