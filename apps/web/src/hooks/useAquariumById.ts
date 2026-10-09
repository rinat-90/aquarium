
import { useEffect, useState } from 'react';
import { aquariumApi, type ApiAquarium } from '../lib/aquarium-api';

export function useAquariumById(id: string | undefined) {
  const [aquarium, setAquarium] = useState<ApiAquarium | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setAquarium(null);
      setLoading(false);
      setError('Aquarium ID is missing');
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      setAquarium(null);

      try {
        const result = await aquariumApi.get(id!);

        if (!cancelled) {
          setAquarium(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load aquarium',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { aquarium, loading, error };
}
