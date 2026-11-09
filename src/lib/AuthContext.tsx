import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  email: string
  name: string
  avatarUrl?: string
  provider: 'google' | 'discord' | 'email' | 'demo'
}

interface AuthContextType {
  user: UserProfile | null
  session: Session | null
  loading: boolean
  isConfigured: boolean
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithDiscord: () => Promise<{ error: Error | null }>
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  demoLogin: (provider: 'google' | 'discord') => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const LOCAL_STORAGE_USER_KEY = 'sixtysix_auth_user'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const mapSupabaseUser = (su: SupabaseUser): UserProfile => {
    const meta = su.user_metadata || {}
    const appProvider = su.app_metadata?.provider
    const identityProvider = su.identities?.[0]?.provider

    let provider: UserProfile['provider'] = 'email'

    // Detecção robusta para não confundir Google com Discord
    if (
      appProvider === 'google' ||
      identityProvider === 'google' ||
      meta.iss?.includes('google') ||
      (meta.avatar_url && meta.avatar_url.includes('googleusercontent.com')) ||
      (meta.picture && meta.picture.includes('googleusercontent.com'))
    ) {
      provider = 'google'
    } else if (
      appProvider === 'discord' ||
      identityProvider === 'discord' ||
      (meta.avatar_url && (meta.avatar_url.includes('discordapp.com') || meta.avatar_url.includes('discord.com')))
    ) {
      provider = 'discord'
    } else if (appProvider === 'email' || su.email) {
      provider = 'email'
    }

    return {
      id: su.id,
      email: su.email || '',
      name: meta.full_name || meta.name || meta.user_name || (su.email ? su.email.split('@')[0] : 'Desenvolvedor'),
      avatarUrl: meta.avatar_url || meta.picture || '',
      provider,
    }
  }

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setLoading(false)
      return
    }

    // Obtém sessão ativa
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        const profile = mapSupabaseUser(session.user)
        setUser(profile)
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile))
      }
      setLoading(false)
    })

    // Listener de mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      if (currentSession?.user) {
        const profile = mapSupabaseUser(currentSession.user)
        setUser(profile)
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile))
      } else if (!currentSession && user?.provider !== 'demo') {
        setUser(null)
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    if (!supabase || !isSupabaseConfigured) {
      return {
        error: new Error('CONFIG_NEEDED: As credenciais do Supabase precisam ser configuradas.'),
      }
    }
    const redirectUrl = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    return { error: error ? new Error(error.message) : null }
  }

  const signInWithDiscord = async () => {
    if (!supabase || !isSupabaseConfigured) {
      return {
        error: new Error('CONFIG_NEEDED: As credenciais do Supabase precisam ser configuradas.'),
      }
    }
    const redirectUrl = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: redirectUrl,
      },
    })
    return { error: error ? new Error(error.message) : null }
  }

  const signInWithEmail = async (email: string) => {
    if (!supabase || !isSupabaseConfigured) {
      return {
        error: new Error('CONFIG_NEEDED: As credenciais do Supabase precisam ser configuradas.'),
      }
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error ? new Error(error.message) : null }
  }

  const verifyEmailOtp = async (email: string, token: string) => {
    if (!supabase || !isSupabaseConfigured) {
      return {
        error: new Error('CONFIG_NEEDED: As credenciais do Supabase precisam ser configuradas.'),
      }
    }
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })
    return { error: error ? new Error(error.message) : null }
  }

  const signOut = async () => {
    if (supabase && isSupabaseConfigured) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setSession(null)
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY)
  }

  const demoLogin = (provider: 'google' | 'discord') => {
    const demoUser: UserProfile = {
      id: 'demo-user-123',
      email: provider === 'google' ? 'dev.alysson@gmail.com' : 'alysson#6666',
      name: 'Alysson Developer',
      avatarUrl: provider === 'google' 
        ? 'https://lh3.googleusercontent.com/a/default-user' 
        : 'https://cdn.discordapp.com/embed/avatars/0.png',
      provider,
    }
    setUser(demoUser)
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(demoUser))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: isSupabaseConfigured,
        signInWithGoogle,
        signInWithDiscord,
        signInWithEmail,
        verifyEmailOtp,
        signOut,
        demoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider')
  }
  return context
}

