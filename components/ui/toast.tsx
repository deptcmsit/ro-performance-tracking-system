'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  title?: string
  description?: string
  type?: ToastType
}

interface ToastContextType {
  toast: (options: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
  toasts: Toast[]
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(({ title, description, type = 'info' }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, title, description, type }])
    
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      dismiss(id)
    }, 4000)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast, dismiss, toasts }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => {
          let Icon = Info
          let iconColor = 'text-blue-500'
          let borderColor = 'border-blue-200 dark:border-blue-800'
          
          if (t.type === 'success') {
            Icon = CheckCircle
            iconColor = 'text-emerald-500'
            borderColor = 'border-emerald-200 dark:border-emerald-800'
          } else if (t.type === 'error') {
            Icon = AlertCircle
            iconColor = 'text-red-500'
            borderColor = 'border-red-200 dark:border-red-800'
          } else if (t.type === 'warning') {
            Icon = AlertTriangle
            iconColor = 'text-amber-500'
            borderColor = 'border-amber-200 dark:border-amber-800'
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 bg-white dark:bg-neutral-900 border ${borderColor} rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-5 duration-200`}
            >
              <Icon className={`h-5 w-5 ${iconColor} shrink-0 mt-0.5`} />
              <div className="flex-1 flex flex-col gap-0.5">
                {t.title && <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{t.title}</p>}
                {t.description && <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.description}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
