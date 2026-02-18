import { useState, useEffect, lazy, Suspense } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth";

const Canvas = lazy(() => import("./canvas/Canvas"));

function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.log("Session ogiltig, loggar ut...", error);
        supabase.auth.signOut();
        setSession(null);
        return;
      }
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Om vi loggar in via länk, rensa URL:en så vi inte återanvänder den vid refresh
      if (_event === "SIGNED_IN" && window.location.hash) {
        window.history.replaceState(null, "", " ");
      }
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Auth />;
  }

  return (
    <>
      <div style={{ position: "absolute", top: 60, right: 10, zIndex: 10 }}>
        <button onClick={() => supabase.auth.signOut()}>Logga ut</button>
      </div>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0,
        }}
      >
        <Suspense
          fallback={
            <div style={{ color: "#888", padding: 20 }}>
              Laddar BrainBoard...
            </div>
          }
        >
          <Canvas />
        </Suspense>
      </div>
    </>
  );
}

export default App;
