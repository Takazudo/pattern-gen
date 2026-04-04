import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/auth-context.js';
import { api } from '../lib/api-client.js';
import type { FontFavorite } from '../lib/api-types.js';

interface FontFavoritesResult {
  favorites: Set<string>;
  isLoading: boolean;
  isFavorite: (family: string) => boolean;
  toggleFavorite: (family: string) => Promise<void>;
  addFavorite: (family: string) => Promise<void>;
  removeFavorite: (family: string) => Promise<void>;
}

const EMPTY_SET = new Set<string>();
const noop = async () => {};
const returnFalse = () => false;

export function useFontFavorites(): FontFavoritesResult {
  const { isAuthenticated } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(EMPTY_SET);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setFavorites(EMPTY_SET);
      fetchedRef.current = false;
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;
    setIsLoading(true);

    api
      .get<{ items: FontFavorite[] }>('/api/font-favorites')
      .then((data) => {
        if (!cancelled) {
          setFavorites(new Set(data.items.map((item) => item.fontFamily)));
        }
      })
      .catch(() => {
        // silent — keep empty set
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const isFavorite = useCallback(
    (family: string) => favorites.has(family),
    [favorites],
  );

  const addFavorite = useCallback(
    async (family: string) => {
      if (!isAuthenticated) return;

      // Optimistic update
      setFavorites((prev) => {
        const next = new Set(prev);
        next.add(family);
        return next;
      });

      try {
        await api.post('/api/font-favorites', { fontFamily: family });
      } catch {
        // Revert on error
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(family);
          return next;
        });
      }
    },
    [isAuthenticated],
  );

  const removeFavorite = useCallback(
    async (family: string) => {
      if (!isAuthenticated) return;

      // Optimistic update
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(family);
        return next;
      });

      try {
        await api.delete(`/api/font-favorites/${encodeURIComponent(family)}`);
      } catch {
        // Revert on error
        setFavorites((prev) => {
          const next = new Set(prev);
          next.add(family);
          return next;
        });
      }
    },
    [isAuthenticated],
  );

  const toggleFavorite = useCallback(
    async (family: string) => {
      if (favorites.has(family)) {
        await removeFavorite(family);
      } else {
        await addFavorite(family);
      }
    },
    [favorites, addFavorite, removeFavorite],
  );

  if (!isAuthenticated) {
    return {
      favorites: EMPTY_SET,
      isLoading: false,
      isFavorite: returnFalse,
      toggleFavorite: noop,
      addFavorite: noop,
      removeFavorite: noop,
    };
  }

  return {
    favorites,
    isLoading,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
  };
}
