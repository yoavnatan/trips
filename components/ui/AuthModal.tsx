'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { registerUser } from '@/app/actions/registerUser'
import type { ActionState } from '@/types'

interface AuthModalProps {
  onClose: () => void
}

const initialState: ActionState = {}

export function AuthModal({ onClose }: AuthModalProps) {
  const [tab, setTab] = useState<'signin' | 'register'>('signin')
  const [signInError, setSignInError] = useState<string | null>(null)
  const [signInLoading, setSignInLoading] = useState(false)
  const [registerState, registerAction, registerPending] = useActionState(registerUser, initialState)
  const router = useRouter()
  const regEmailRef = useRef('')
  const regPasswordRef = useRef('')

  // After successful registration auto sign-in
  useEffect(() => {
    if (!registerState.success) return
    const email = regEmailRef.current
    const password = regPasswordRef.current
    if (email && password) {
      void signIn('credentials', { email, password, redirect: false }).then(() => {
        router.refresh()
        onClose()
      })
    }
  }, [registerState.success]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setSignInError(null)
    setSignInLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      email: fd.get('email'),
      password: fd.get('password'),
      redirect: false,
    })
    setSignInLoading(false)
    if (result?.error) {
      setSignInError('Incorrect email or password.')
    } else {
      router.refresh()
      onClose()
    }
  }

  async function handleGoogleSignIn(): Promise<void> {
    await signIn('google', { callbackUrl: '/' })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal__tabs">
          <button
            className={`auth-modal__tab${tab === 'signin' ? ' auth-modal__tab--active' : ''}`}
            onClick={() => setTab('signin')}
          >Sign in</button>
          <button
            className={`auth-modal__tab${tab === 'register' ? ' auth-modal__tab--active' : ''}`}
            onClick={() => setTab('register')}
          >Create account</button>
        </div>

        {tab === 'signin' ? (
          <form className="auth-modal__form" onSubmit={(e) => void handleSignIn(e)}>
            <input className="auth-modal__input" name="email" type="email" placeholder="Email" required autoFocus />
            <input className="auth-modal__input" name="password" type="password" placeholder="Password" required />
            {signInError && <p className="auth-modal__error">{signInError}</p>}
            <button className="auth-modal__submit" type="submit" disabled={signInLoading}>
              {signInLoading ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="auth-modal__divider"><span>or</span></div>
            <button className="auth-modal__google" type="button" onClick={() => void handleGoogleSignIn()}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </form>
        ) : (
          <form className="auth-modal__form" action={registerAction}>
            <div className="auth-modal__row">
              <input className="auth-modal__input" name="firstName" type="text" placeholder="First name" required autoFocus />
              <input className="auth-modal__input" name="lastName" type="text" placeholder="Last name" required />
            </div>
            <input className="auth-modal__input" name="email" type="email" placeholder="Email" required onChange={(e) => { regEmailRef.current = e.target.value }} />
            <input className="auth-modal__input" name="password" type="password" placeholder="Password (min 6 chars)" required onChange={(e) => { regPasswordRef.current = e.target.value }} />
            {registerState.error && <p className="auth-modal__error">{registerState.error}</p>}
            <button className="auth-modal__submit" type="submit" disabled={registerPending}>
              {registerPending ? 'Creating account…' : 'Create account'}
            </button>
            <div className="auth-modal__divider"><span>or</span></div>
            <button className="auth-modal__google" type="button" onClick={() => void handleGoogleSignIn()}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.77c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
