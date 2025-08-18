import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Helper function to make authenticated requests
const fetchWithAuth = async (
  url: string,
  accessToken: string,
  options?: RequestInit
) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

// Query Keys
export const queryKeys = {
  planets: ["planets"] as const,
  planet: (id: string) => ["planet", id] as const,
  planetBuildings: (planetId: string) =>
    ["planet", planetId, "buildings"] as const,
  planetRobots: (planetId: string) => ["planet", planetId, "robots"] as const,
  planetLocations: (planetId: string) =>
    ["planet", planetId, "locations"] as const,
  travelGroups: (planetId: string) =>
    ["planet", planetId, "travelGroups"] as const,
};

// Planets
export const usePlanets = (accessToken: string | null) => {
  return useQuery({
    queryKey: queryKeys.planets,
    queryFn: () => fetchWithAuth("/api/game/planets", accessToken!),
    enabled: !!accessToken,
  });
};

// Planet Buildings
export const usePlanetBuildings = (
  planetId: string | null,
  accessToken: string | null
) => {
  return useQuery({
    queryKey: queryKeys.planetBuildings(planetId!),
    queryFn: () =>
      fetchWithAuth(`/api/game/planets/${planetId}/buildings`, accessToken!),
    enabled: !!planetId && !!accessToken,
  });
};

// Planet Robots
export const usePlanetRobots = (
  planetId: string | null,
  accessToken: string | null
) => {
  return useQuery({
    queryKey: queryKeys.planetRobots(planetId!),
    queryFn: () =>
      fetchWithAuth(`/api/game/planets/${planetId}/robots`, accessToken!),
    enabled: !!planetId && !!accessToken,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

// Planet Locations
export const usePlanetLocations = (
  planetId: string | null,
  accessToken: string | null
) => {
  return useQuery({
    queryKey: queryKeys.planetLocations(planetId!),
    queryFn: () =>
      fetchWithAuth(`/api/game/planets/${planetId}/locations`, accessToken!),
    enabled: !!planetId && !!accessToken,
    refetchInterval: 60000, // Refetch every minute
  });
};

// Travel Groups
export const useTravelGroups = (
  planetId: string | null,
  accessToken: string | null
) => {
  return useQuery({
    queryKey: queryKeys.travelGroups(planetId!),
    queryFn: () =>
      fetchWithAuth(
        `/api/game/explore/groups?planetId=${planetId}`,
        accessToken!
      ),
    enabled: !!planetId && !!accessToken,
    refetchInterval: 10000, // Refetch every 10 seconds for travel updates
  });
};

// Mutations
export const useInitializeGame = (accessToken: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchWithAuth("/api/game/init", accessToken!, { method: "POST" }),
    onSuccess: () => {
      // Invalidate planets query to refetch after initialization
      queryClient.invalidateQueries({ queryKey: queryKeys.planets });
    },
  });
};

export const useStartExploration = (
  planetId: string | null,
  accessToken: string | null
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      robotIds: string[];
      targetX: number;
      targetY: number;
    }) =>
      fetchWithAuth("/api/game/explore/start", accessToken!, {
        method: "POST",
        body: JSON.stringify({ ...data, planetId }),
      }),
    onSuccess: () => {
      // Invalidate related queries
      if (planetId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.planetRobots(planetId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.travelGroups(planetId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.planetLocations(planetId),
        });
      }
    },
  });
};

export const useBuildAction = (accessToken: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      action: string;
      buildingTypeId?: string;
      robotTypeId?: string;
      targetId?: string;
      planetId: string;
    }) =>
      fetchWithAuth("/api/game/action", accessToken!, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.planetBuildings(variables.planetId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.planetRobots(variables.planetId),
      });
    },
  });
};
