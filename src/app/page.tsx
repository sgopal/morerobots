'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { User } from '@supabase/supabase-js'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUser(session.user)
        } else {
          setUser(null)
          router.push('/auth') // Redirect to auth page if not logged in
        }
        setLoading(false)
      }
    )

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user)
      } else {
        router.push('/auth')
      }
      setLoading(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  const handleLogout = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error logging out:', error.message)
      setLoading(false)
    } else {
      setUser(null) // Clear user state immediately
      router.push('/auth') // Ensure redirect
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      {user ? (
        <>
          <h1 className="text-4xl font-bold mb-8">
            Welcome, {user.email || user.id}!
          </h1>
          <p className="text-lg mb-4">You are logged in.</p>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="mt-4 py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            {loading ? 'Logging out...' : 'Logout'}
          </button>
          <p className="mt-8 text-gray-500">This is your game landing page.</p>
        </>
      ) : null}
    </main>
  )
}
