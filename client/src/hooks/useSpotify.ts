import { useState, useEffect, useCallback } from "react";
import { spotifyApi } from "../lib/spotify";

export type SpotifyTrack = {
  name: string;
  artist: string;
  albumArt: string;
  uri: string;
};

export function useSpotify() {
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Initiera och hantera callback vid mount
  useEffect(() => {
    const init = async () => {
      // Kolla om vi har en kod i URL (från inloggning)
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const success = await spotifyApi.handleCallback(code);
        if (success) setIsAuthenticated(true);
      } else {
        setIsAuthenticated(spotifyApi.isAuthenticated());
      }
      setIsLoading(false);
    };
    init();
  }, []);

  // 2. Polling för att hämta status (var 5:e sekund)
  const fetchState = useCallback(async () => {
    if (!isAuthenticated) return;

    const state = await spotifyApi.getPlaybackState();
    if (state && state.item) {
      setTrack({
        name: state.item.name,
        artist: state.item.artists.map((a: any) => a.name).join(", "),
        albumArt: state.item.album.images[0]?.url,
        uri: state.item.uri,
      });
      setIsPlaying(state.is_playing);
    } else {
      // Inget spelas eller Spotify är inte aktivt
      setIsPlaying(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchState(); // Hämta direkt
      const interval = setInterval(fetchState, 5000); // Polla var 5:e sek
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchState]);

  // 3. Actions
  const togglePlay = async () => {
    if (isPlaying) await spotifyApi.pause();
    else await spotifyApi.play();
    setTimeout(fetchState, 500); // Uppdatera UI snabbt
  };

  const next = async () => {
    await spotifyApi.next();
    setTimeout(fetchState, 500);
  };

  const previous = async () => {
    await spotifyApi.previous();
    setTimeout(fetchState, 500);
  };

  const setVolume = async (volume: number) => {
    await spotifyApi.setVolume(volume);
  };

  return {
    track,
    isPlaying,
    isAuthenticated,
    isLoading,
    login: spotifyApi.login,
    logout: () => {
      spotifyApi.logout();
      setIsAuthenticated(false);
      setTrack(null);
    },
    togglePlay,
    next,
    previous,
    setVolume,
    refreshState: fetchState,
  };
}
