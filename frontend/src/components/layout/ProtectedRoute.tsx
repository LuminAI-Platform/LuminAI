import React, { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '../../stores/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, checkUser } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    // Attempt to load current user session on mount
    checkUser()
  }, [checkUser])

  useEffect(() => {
    // If checking user finishes and they are not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/login', replace: true })
    }
  }, [isLoading, isAuthenticated, navigate])

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-grid-dots opacity-40 pointer-events-none" />
        
        {/* Glowing backdrop elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="flex flex-col items-center gap-6 relative z-10">
          {/* Futuristic loading ring */}
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-zinc-800/80" />
            <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 border-r-blue-500/30 animate-spin" />
            <div className="absolute inset-2 rounded-full border border-zinc-900 bg-zinc-950/80 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-1.5">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-zinc-400 font-mono">Authenticating</h3>
            <p className="text-[11px] text-zinc-500">Establishing secure connection to LuminAI...</p>
          </div>
        </div>
      </div>
    )
  }

  // Render children only when authenticated
  return isAuthenticated ? <>{children}</> : null
}
