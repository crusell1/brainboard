import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Vi byter till lösenordsinloggning för att slippa e-poststrul
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      <h1>BrainBoard 🧠</h1>
      <p>Logga in med e-post och lösenord</p>
      <form
        onSubmit={handleLogin}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "300px",
        }}
      >
        <input
          type="email"
          placeholder="Din e-post"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: "10px", fontSize: "16px" }}
        />
        <input
          type="password"
          placeholder="Lösenord"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: "10px", fontSize: "16px" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px", fontSize: "16px", cursor: "pointer" }}
        >
          {loading ? "Loggar in..." : "Logga in"}
        </button>
      </form>
    </div>
  );
}
