const CLIENT_ID = "13394eb2f4b4435eb0a325f2d1bcd4f1"; // ⚠️ VIKTIGT: Byt till ditt eget Client ID från Spotify Dashboard!
// Vi tar bort eventuella avslutande snedstreck för att matcha Spotify exakt
const REDIRECT_URI = window.location.origin.replace(/\/$/, "");

const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-private",
  "user-read-email",
].join(" ");

// --- PKCE Helpers ---

const generateRandomString = (length: number) => {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
};

const base64encode = (input: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

// --- API Helpers ---

const getAccessToken = () => localStorage.getItem("spotify_access_token");

const apiCall = async (endpoint: string, method = "GET", body?: any) => {
  const token = getAccessToken();
  if (!token) return null;

  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Token expired - här skulle vi kunna köra refresh logic automatiskt
    // För nu: logga ut eller låt UI hantera det
    console.warn("Spotify token expired");
    return null;
  }

  if (res.status === 204) return true; // Success, no content
  return res.json().catch(() => null);
};

export const spotifyApi = {
  // 1. Auth
  login: async () => {
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);

    console.log("🔐 Startar Spotify-inloggning...");
    console.log("👉 DITT CLIENT ID:", CLIENT_ID);
    console.log("👉 DIN REDIRECT URI:", REDIRECT_URI);
    console.log(
      "⚠️ Om du får 'INVALID_CLIENT' måste dessa matcha exakt i Spotify Dashboard!",
    );

    // Spara verifier för att använda efter redirect
    window.localStorage.setItem("spotify_code_verifier", codeVerifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      scope: SCOPES,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      redirect_uri: REDIRECT_URI,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  },

  handleCallback: async (code: string) => {
    const codeVerifier = localStorage.getItem("spotify_code_verifier");
    if (!codeVerifier) {
      console.error("Ingen code_verifier hittades!");
      return;
    }

    const payload = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    };

    const body = await fetch("https://accounts.spotify.com/api/token", payload);
    const response = await body.json();

    if (response.access_token) {
      localStorage.setItem("spotify_access_token", response.access_token);
      if (response.refresh_token) {
        localStorage.setItem("spotify_refresh_token", response.refresh_token);
      }
      // Rensa URL
      window.history.replaceState({}, document.title, "/");
      return true;
    } else {
      console.error("Kunde inte hämta token:", response);
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("spotify_access_token");
    localStorage.removeItem("spotify_refresh_token");
    localStorage.removeItem("spotify_code_verifier");
  },

  isAuthenticated: () => !!localStorage.getItem("spotify_access_token"),

  // 2. Player
  getPlaybackState: async () => {
    return apiCall("/me/player");
  },

  play: async () => {
    return apiCall("/me/player/play", "PUT");
  },

  pause: async () => {
    return apiCall("/me/player/pause", "PUT");
  },

  next: async () => {
    return apiCall("/me/player/next", "POST");
  },

  previous: async () => {
    return apiCall("/me/player/previous", "POST");
  },

  setVolume: async (volume: number) => {
    // Volume är 0-100
    return apiCall(`/me/player/volume?volume_percent=${volume}`, "PUT");
  },

  getUserPlaylists: async () => {
    return apiCall("/me/playlists?limit=20");
  },

  playPlaylist: async (contextUri: string) => {
    return apiCall("/me/player/play", "PUT", { context_uri: contextUri });
  },
};
