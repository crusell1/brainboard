import { useState, useEffect, useRef } from "react";
import { useSpotify } from "../hooks/useSpotify";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music,
  LogOut,
  Volume2,
  ListMusic,
  Shuffle,
} from "lucide-react";

export default function SpotifyPlayer() {
  const {
    track,
    playlists,
    isPlaying,
    isAuthenticated,
    isLoading,
    login,
    logout,
    togglePlay,
    next,
    previous,
    setVolume,
    playPlaylist,
    isShuffling,
    toggleShuffle,
  } = useSpotify();

  const [isMinimized, setIsMinimized] = useState(true); // Starta minimerad
  const [showVolume, setShowVolume] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);

  // 🔥 Refs för att hantera klick utanför
  const playerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        playerRef.current &&
        !playerRef.current.contains(event.target as Node) &&
        toggleRef.current &&
        !toggleRef.current.contains(event.target as Node)
      ) {
        setIsMinimized(true);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (isLoading) return null;

  // 1. Ej inloggad state - Visa "Connect"-knapp
  if (!isAuthenticated) {
    return (
      <div
        className="nodrag"
        style={{
          position: "absolute",
          top: 12, // 🔥 Flyttad till toppen
          right: 220, // 🔥 Flyttad lite närmare de andra knapparna
          zIndex: 50,
        }}
      >
        <button
          onClick={login}
          style={{
            background: "#1DB954",
            color: "white",
            border: "none",
            borderRadius: "24px",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            transition: "transform 0.2s",
            fontSize: "14px",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "scale(1.05)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <img
            src="/SpotifyLogo.png"
            alt="Spotify"
            style={{ width: 20, height: 20, objectFit: "contain" }}
          />
          Connect Spotify
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 2. Toggle-knapp (Alltid synlig) */}
      <div
        ref={toggleRef}
        className="nodrag"
        style={{
          position: "absolute",
          top: 12,
          right: 220, // 🔥 Flyttad lite närmare de andra knapparna
          zIndex: 51, // Ligg över spelaren
          background: "rgba(30, 30, 35, 0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "50%",
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          transition: "all 0.2s",
        }}
        onClick={() => setIsMinimized(!isMinimized)}
        title={isMinimized ? "Visa Spotify" : "Dölj Spotify"}
      >
        <img
          src="/SpotifyLogo.png"
          alt="Spotify"
          style={{ width: 28, height: 28, objectFit: "contain" }}
        />
        {isPlaying && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 10,
              height: 10,
              background: "#1DB954",
              borderRadius: "50%",
              border: "2px solid #1e1e24",
            }}
          />
        )}
      </div>

      {/* 3. Spelare (Dropdown) */}
      {!isMinimized && (
        <div
          ref={playerRef}
          className="nodrag"
          style={{
            position: "absolute",
            top: 70, // Öppnas under knappen
            right: 10, // 🔥 Ligger nu dikt an mot högerkanten (under de andra knapparna)
            zIndex: 50,
            width: 300,
            background: "rgba(30, 30, 35, 0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            color: "white",
            transition: "all 0.3s ease",
          }}
        >
          {/* Playlist Popup */}
          {showPlaylists && (
            <div
              style={{
                position: "absolute",
                top: "100%", // 🔥 Öppna listan NEDÅT istället för uppåt
                left: 0,
                width: "100%",
                maxHeight: "250px", // 🔥 Lite mindre maxhöjd för att inte ta över skärmen
                overflowY: "auto",
                background: "rgba(30, 30, 35, 0.95)",
                backdropFilter: "blur(16px)",
                borderRadius: "12px",
                marginTop: "8px", // 🔥 Lite marginal från spelaren
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ fontSize: 12, color: "#888", padding: "4px 8px" }}>
                DINA SPELLISTOR
              </div>
              {playlists.length > 0 ? (
                playlists.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      playPlaylist(p.uri);
                      setShowPlaylists(false);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "white",
                      textAlign: "left",
                      padding: "8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "13px",
                      whiteSpace: "normal", // 🔥 Tillåt radbrytning
                      lineHeight: "1.4",
                      display: "block",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.1)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {p.name}
                  </button>
                ))
              ) : (
                <div
                  style={{ padding: "8px", fontSize: "12px", color: "#666" }}
                >
                  Inga spellistor hittades.
                </div>
              )}
            </div>
          )}

          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: "#1DB954",
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              <img
                src="/SpotifyLogo.png"
                alt="Spotify"
                style={{ width: 14, height: 14, objectFit: "contain" }}
              />{" "}
              SPOTIFY
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={logout}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#666",
                  padding: 0,
                }}
                title="Logga ut"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>

          {/* Track Info */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {track?.albumArt ? (
              <img
                src={track.albumArt}
                alt="Album Art"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "8px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "8px",
                  background: "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Music size={24} color="#555" />
              </div>
            )}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {track?.name || "Inget spelas"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#aaa",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {track?.artist || "Välj musik i Spotify"}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "4px",
            }}
          >
            {/* Shuffle Toggle */}
            <button
              onClick={toggleShuffle}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: isShuffling ? "#1DB954" : "#888",
                padding: 4,
              }}
              title="Blanda"
            >
              <Shuffle size={18} />
            </button>

            {/* Playlist Toggle */}
            <button
              onClick={() => setShowPlaylists(!showPlaylists)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: showPlaylists ? "#1DB954" : "#888",
                padding: 4,
              }}
              title="Spellistor"
            >
              <ListMusic size={18} />
            </button>

            {/* Volym Toggle */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowVolume(!showVolume)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: showVolume ? "#1DB954" : "#888",
                  padding: 4,
                }}
              >
                <Volume2 size={18} />
              </button>
              {showVolume && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    left: 0,
                    marginBottom: 8,
                    background: "#222",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid #444",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                  }}
                >
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="50"
                    onChange={(e) => setVolume(parseInt(e.target.value))}
                    style={{
                      width: "100px",
                      cursor: "pointer",
                      accentColor: "#1DB954",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Playback Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button
                onClick={previous}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#ddd",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#ddd")}
              >
                <SkipBack size={20} fill="currentColor" />
              </button>

              <button
                onClick={togglePlay}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "white",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "black",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  transition: "transform 0.1s",
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = "scale(0.95)")
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                {isPlaying ? (
                  <Pause size={20} fill="currentColor" />
                ) : (
                  <Play
                    size={20}
                    fill="currentColor"
                    style={{ marginLeft: 2 }}
                  />
                )}
              </button>

              <button
                onClick={next}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#ddd",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#ddd")}
              >
                <SkipForward size={20} fill="currentColor" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
