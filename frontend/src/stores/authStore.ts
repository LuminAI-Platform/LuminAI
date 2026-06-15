import { create } from 'zustand'
import type { User } from 'oidc-client-ts'
import { userManager } from '../lib/auth'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: () => Promise<void>
  loginMock: (email: string, name: string) => Promise<void>
  logout: () => Promise<void>
  handleCallback: () => Promise<User | null>
  checkUser: () => Promise<User | null>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async () => {
    try {
      set({ isLoading: true, error: null })
      await userManager.signinRedirect()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initiate login flow'
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  loginMock: async (email: string, name: string) => {
    try {
      set({ isLoading: true, error: null })
      const mockUser = {
        profile: {
          sub: 'mock-sub-12345',
          name: name,
          preferred_username: name.toLowerCase().replace(' ', '.'),
          email: email,
          email_verified: true,
        },
        access_token: 'mock-access-token-123',
        refresh_token: 'mock-refresh-token-123',
        id_token: 'mock-id-token-123',
        token_type: 'Bearer',
        scope: 'openid profile email',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }

      // Store in session storage so userManager.getUser() finds it on refresh
      sessionStorage.setItem(
        'oidc.user:http://localhost:8180/realms/luminai:luminai-spa',
        JSON.stringify(mockUser)
      )

      set({ user: mockUser as unknown as User, isAuthenticated: true, isLoading: false })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Mock login failed'
      set({ error: errorMsg, isLoading: false })
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true, error: null })
      
      const sessionKey = 'oidc.user:http://localhost:8180/realms/luminai:luminai-spa'
      const sessionData = sessionStorage.getItem(sessionKey)
      const isMock = sessionData?.includes('mock-access-token-123')

      // Clear local state and session storage
      set({ user: null, isAuthenticated: false })
      sessionStorage.removeItem(sessionKey)

      if (!isMock) {
        await userManager.signoutRedirect()
      }
      
      set({ isLoading: false })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to sign out'
      set({ error: errorMsg, isLoading: false })
    }
  },

  handleCallback: async () => {
    try {
      set({ isLoading: true, error: null })
      const user = await userManager.signinRedirectCallback()
      set({ user, isAuthenticated: !!user, isLoading: false })
      return user
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Callback handling failed'
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  checkUser: async () => {
    try {
      set({ isLoading: true, error: null })
      const user = await userManager.getUser()
      set({ user, isAuthenticated: !!user, isLoading: false })
      return user
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve active session'
      set({ error: errorMsg, isLoading: false })
      return null
    }
  },

  clearError: () => set({ error: null }),
}))
