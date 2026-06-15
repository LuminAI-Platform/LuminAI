import React, { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '../../stores/authStore'

export const CallbackPage: React.FC = () => {
  const { handleCallback, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const hasTriggered = useRef(false)

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (hasTriggered.current) return
    hasTriggered.current = true

    const processCallback = async () => {
      try {
        await handleCallback()
        navigate({ to: '/', replace: true })
      } catch (err) {
        console.error('Authentication callback error:', err)
      }
    }

    processCallback()
  }, [handleCallback, navigate])

  const handleRetry = () => {
    clearError()
    navigate({ to: '/login', replace: true })
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 bg-grid-dots opacity-40 pointer-events-none" />

      {/* Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex flex-col items-center gap-6 relative z-10 max-w-md text-center px-6">
        {error ? (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-red-950/40 border border-red-500/30 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-red-500/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold tracking-tight text-zinc-100">Authentication Failed</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {error || 'An error occurred while validating the security token. Please try again.'}
              </p>
            </div>

            <button
              onClick={handleRetry}
              className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <>
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-zinc-800/80" />
              <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 border-r-blue-500/30 animate-spin" />
              <div className="absolute inset-2 rounded-full border border-zinc-900 bg-zinc-950/80 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold tracking-wider uppercase text-zinc-400 font-mono">Finalizing Session</h3>
              <p className="text-[11px] text-zinc-500">Exchanging authorization codes for cryptographic tokens...</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
