import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Brain, Mail, Lock, Loader2, ArrowRight } from "lucide-react";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false); // 🔥 NY: Toggle för registrering

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      // 🔥 Registrering
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        alert(error.message);
      } else if (data.session) {
        // Om email confirmation är avstängt loggas man in direkt
        // Inget alert behövs, App.tsx hanterar sessionen automatiskt
      } else {
        alert(
          "Konto skapat! Kolla din e-post för bekräftelselänk (om aktiverat) eller logga in.",
        );
      }
    } else {
      // 🔥 Inloggning
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        alert(error.message);
      }
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-circle">
            <Brain size={32} color="#6366f1" />
          </div>
          <h1>BrainBoard</h1>
          <p>
            {isSignUp
              ? "Skapa ditt tankeutrymme"
              : "Välkommen tillbaka till ditt flöde"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="auth-form">
          <div className="input-group">
            <Mail size={18} className="input-icon" />
            <input
              type="email"
              placeholder="E-postadress"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input
              type="password"
              placeholder="Lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {isSignUp ? "Skapa konto" : "Logga in"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <button onClick={() => setIsSignUp(!isSignUp)} className="toggle-btn">
          {isSignUp
            ? "Har du redan ett konto? Logga in"
            : "Inget konto? Registrera dig"}
        </button>
      </div>

      <style>{`
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          width: 100vw;
          background: radial-gradient(circle at top right, #1e1b4b, #0f0f10);
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .auth-card {
          background: rgba(30, 30, 35, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 40px;
          border-radius: 24px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: fadeIn 0.5s ease-out;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .logo-circle {
          width: 64px;
          height: 64px;
          background: rgba(99, 102, 241, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
        }

        h1 {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
          background: linear-gradient(to right, #fff, #a5b4fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        p {
          color: #94a3b8;
          font-size: 14px;
          margin: 0;
        }

        .auth-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-group {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          color: #64748b;
        }

        input {
          width: 100%;
          padding: 12px 12px 12px 40px;
          background: #0f0f10;
          border: 1px solid #333;
          border-radius: 12px;
          color: white;
          font-size: 15px;
          outline: none;
          transition: all 0.2s;
        }

        input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }

        .submit-btn {
          margin-top: 8px;
          padding: 12px;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.2s;
        }

        .submit-btn:hover:not(:disabled) {
          background: #4f46e5;
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .toggle-btn {
          margin-top: 24px;
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 14px;
          cursor: pointer;
          transition: color 0.2s;
        }

        .toggle-btn:hover {
          color: #fff;
          text-decoration: underline;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
