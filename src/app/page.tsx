'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { User } from '@supabase/supabase-js'

interface Planet {
  id: string;
  name: string;
}

interface UserPlanet {
  planet_id: string;
  planets: Planet; // Assuming the join brings in planet details
}

interface BuildingType {
  name: string;
}

interface UserBuilding {
  id: string;
  building_type_id: string;
  location_x: number;
  location_y: number;
  building_types: BuildingType; // Assuming the join brings in building_type details
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasLanded, setHasLanded] = useState(false)
  const [userPlanets, setUserPlanets] = useState<UserPlanet[]>([])
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null)
  const [planetBuildings, setPlanetBuildings] = useState<UserBuilding[]>([])
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // State to hold the Supabase access token
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const fetchUserPlanets = useCallback(async (userId: string, token: string) => {
    try {
      const response = await fetch('/api/game/planets', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user planets')
      }

      if (data && data.length > 0) {
        setHasLanded(true)
        setUserPlanets(data)
      } else {
        setHasLanded(false)
      }
    } catch (err: any) {
      console.error('Error fetching user planets:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [setHasLanded, setUserPlanets, setError, setLoading]); // Add dependencies

  const handleLandOnPlanet = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/game/land', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to land on planet')
      }

      // After landing, re-fetch user planets
      if (user && accessToken) {
        await fetchUserPlanets(user.id, accessToken)
      }
      alert('Successfully landed on a new planet!')
    } catch (err: any) {
      console.error('Error landing on planet:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, accessToken, fetchUserPlanets, setError, setLoading]); // Add dependencies

  const handleSelectPlanet = useCallback(async (planetId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/game/planets/${planetId}/buildings`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch planet buildings')
      }
      setSelectedPlanetId(planetId)
      setPlanetBuildings(data)
    } catch (err: any) {
      console.error('Error fetching planet buildings:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [accessToken, setSelectedPlanetId, setPlanetBuildings, setError, setLoading]); // Add dependencies

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUser(session.user)
          setAccessToken(session.access_token); // Set the access token
          if (session.user && session.access_token) { // Ensure access_token exists here
            await fetchUserPlanets(session.user.id, session.access_token); // Pass token here
          }
        } else {
          setUser(null)
          setAccessToken(null); // Clear access token on logout
          router.push('/auth') // Redirect to auth page if not logged in
        }
        setLoading(false)
      }
    )

    // Initial check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && session.user && session.access_token) { // Ensure access_token exists here
        setUser(session.user)
        setAccessToken(session.access_token); // Set the access token on initial load
        await fetchUserPlanets(session.user.id, session.access_token); // Pass token here
      } else {
        router.push('/auth')
      }
      setLoading(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router, fetchUserPlanets]) // Removed accessToken from useEffect dependencies

  const handleLogout = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error logging out:', error.message)
      setLoading(false)
    } else {
      setUser(null) // Clear user state immediately
      setAccessToken(null); // Clear access token immediately
      router.push('/auth') // Ensure redirect
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
      {user ? (
        <div className="w-full max-w-2xl bg-gray-800 p-8 rounded-lg shadow-lg text-center">
          <h1 className="text-4xl font-bold mb-4">
            Welcome, {user.email || user.id}!
          </h1>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="mb-8 py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            {loading ? 'Logging out...' : 'Logout'}
          </button>

          {error && <p className="text-red-500 mb-4">Error: {error}</p>}

          {!hasLanded ? (
            <div className="mt-8">
              <p className="text-lg mb-4">You haven't landed on any planets yet.</p>
              <button
                onClick={handleLandOnPlanet}
                disabled={loading}
                className="py-3 px-6 bg-green-600 text-white rounded-lg text-xl font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                {loading ? 'Landing...' : 'Land on Planet'}
              </button>
            </div>
          ) : (
            <div>
              {!selectedPlanetId ? (
                <div className="mt-8">
                  <h2 className="text-3xl font-bold mb-6">Your Landed Planets</h2>
                  <ul className="list-none p-0">
                    {userPlanets.map((userPlanet) => (
                      <li key={userPlanet.planet_id} className="mb-3">
                        <button
                          onClick={() => handleSelectPlanet(userPlanet.planet_id)}
                          className="text-xl text-blue-400 hover:text-blue-200 focus:outline-none"
                        >
                          {userPlanet.planets.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-8">
                  <h2 className="text-3xl font-bold mb-6">Buildings on Selected Planet</h2>
                  <button
                    onClick={() => setSelectedPlanetId(null)} // Go back to planet list
                    className="mb-4 py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    ← Back to Planets
                  </button>
                  {planetBuildings.length > 0 ? (
                    <ul className="list-disc list-inside p-0">
                      {planetBuildings.map((building) => (
                        <li key={building.id} className="mb-2 text-lg">
                          {building.building_types.name} at ({building.location_x}, {building.location_y})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-lg">No buildings found on this planet yet.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </main>
  )
}
