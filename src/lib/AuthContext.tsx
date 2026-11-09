import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { normalizeDisplayName, savedDisplayName } from './displayName'

export interface UserProfile {
  id: string
  email: string
  name: string // Nome preferido escolhido pelo usuário para ser chamado
  rawName?: string // Nome original retornado pelo Google/Discord
  customName?: string
  hasCompletedOnboarding: boolean // Se já passou pela tela de escolha de nome
  avatarUrl?: string
  provider: 'google' | 'discord' | 'email' | 'demo'
  hasActivePlan: boolean // Se tem plano ativo (Pro) ou gratuito
  planName: string // 'Pro Dev' | 'Gratuito'
}

interface AuthContextType {
  user: UserProfile | null
  session: Session | null
  loading: boolean
  isConfigured: boolean
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithDiscord: () => Promise<{ error: Error | null }>
  signInWithEmail: (email: string, createAccount?: boolean) => Promise<{ error: Error | null }>
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  demoLogin: (provider: 'google' | 'discord', asNewUser?: boolean) => void
  updateDisplayName: (chosenName: string) => Promise<void>
  toggleSubscriptionPlan: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const LOCAL_STORAGE_USER_KEY = 'sixtysix_auth_user'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null)
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

    const rawName = meta.full_name || meta.name || meta.user_name || (su.email ? su.email.split('@')[0] : 'Desenvolvedor')
    const hasPlanSaved = localStorage.getItem(`sixtysix_has_plan_${su.id}`) === 'true'
    const customName = savedDisplayName(meta)
    const hasCompletedOnboarding = Boolean(customName)

    const finalName = hasCompletedOnboarding && customName.trim() ? customName.trim() : rawName

    return {
      id: su.id,
      email: su.email || '',
      name: finalName,
      rawName,
      customName: customName || undefined,
      hasCompletedOnboarding,
      avatarUrl: meta.avatar_url || meta.picture || '',
      provider,
      hasActivePlan: meta.has_active_plan ?? hasPlanSaved,
      planName: (meta.has_active_plan ?? hasPlanSaved) ? 'Pro Dev' : 'Gratuito',
    }
  }

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setLoading(false)
      return
    }

    // Obtém sessão ativa
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        const { data, error } = await supabase!.auth.getUser()
        if (error && (error.status === 401 || error.status === 403)) {
          setSession(null)
          setUser(null)
          setLoading(false)
          return
        }
        const profile = mapSupabaseUser(data.user || session.user)
        setUser(profile)
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile))
      } else {
        setUser(null)
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY)
      }
      setLoading(false)
    }).catch(() => {
      setSession(null)
      setUser(null)
      setLoading(false)
    })

    // Listener de mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (event === 'INITIAL_SESSION') return
      setSession(currentSession)
      if (currentSession?.user) {
        const profile = mapSupabaseUser(currentSession.user)
        setUser(profile)
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile))
      } else if (!currentSession) {
        setUser(null)
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const updateDisplayName = async (chosenName: string) => {
    const cleanName = normalizeDisplayName(chosenName)
    if (!supabase || !session?.user) throw new Error('Entre na sua conta para salvar seu nome.')
    const { data, error } = await supabase.auth.updateUser({
      data: { custom_name: cleanName, has_completed_onboarding: true },
    })
    if (error || !data.user) throw new Error('Não foi possível salvar seu nome na conta. Tente novamente.')
    const updated = mapSupabaseUser(data.user)
    setUser(updated)
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updated))
  }

  const toggleSubscriptionPlan = () => {
    if (!user) return
    const nextState = !user.hasActivePlan
    const updated: UserProfile = {
      ...user,
      hasActivePlan: nextState,
      planName: nextState ? 'Pro Dev' : 'Gratuito',
    }
    setUser(updated)
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updated))
    localStorage.setItem(`sixtysix_has_plan_${user.id}`, String(nextState))
  }

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

  const signInWithEmail = async (email: string, createAccount = false) => {
    if (!supabase || !isSupabaseConfigured) {
      return {
        error: new Error('CONFIG_NEEDED: As credenciais do Supabase precisam ser configuradas.'),
      }
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: createAccount,
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

  const demoLogin = (provider: 'google' | 'discord', asNewUser: boolean = false) => {
    const rawName = provider === 'google' ? 'Alysson Medeiros' : 'alysson_dev'
    const savedName = localStorage.getItem('sixtysix_custom_name_demo-user-123')
    const hasCompleted = asNewUser ? false : (localStorage.getItem('sixtysix_onboarding_demo-user-123') === 'true')
    const hasPlanSaved = localStorage.getItem('sixtysix_has_plan_demo-user-123') === 'true'

    const demoUser: UserProfile = {
      id: 'demo-user-123',
      email: provider === 'google' ? 'alyssonmedeiros02007@gmail.com' : 'alysson#6666',
      name: (hasCompleted && savedName) ? savedName : rawName,
      rawName,
      customName: (hasCompleted && savedName) ? savedName : undefined,
      hasCompletedOnboarding: hasCompleted,
      avatarUrl: provider === 'google' 
        ? 'https://lh3.googleusercontent.com/a/default-user' 
        : 'https://cdn.discordapp.com/embed/avatars/0.png',
      provider,
      hasActivePlan: hasPlanSaved,
      planName: hasPlanSaved ? 'Pro Dev' : 'Gratuito',
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
        updateDisplayName,
        toggleSubscriptionPlan,
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
