import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { api } from "./api";
import { GameProvider } from "./GameContext";
import Layout from "./Layout";
import Login from "./pages/Login";
import SetPassword from "./pages/SetPassword";
import Dashboard from "./pages/Dashboard";
import Brief from "./pages/Brief";
import Upload from "./pages/Upload";
import Results from "./pages/Results";
import Archive from "./pages/Archive";
import Players from "./pages/Players";
import Settings from "./pages/Settings";

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    api
      .me()
      .then(({ user }) => setMe(user))
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return null;

  return (
    <Routes>
      <Route path="/set-password" element={<SetPassword />} />
      <Route
        path="/login"
        element={me ? <Navigate to="/" /> : <Login onLoggedIn={setMe} />}
      />
      <Route
        path="/*"
        element={
          me ? (
            <GameProvider>
              <Layout me={me} onLoggedOut={() => setMe(null)}>
                <Routes>
                  <Route path="/" element={<Dashboard me={me} />} />
                  <Route path="/brief" element={<Brief me={me} />} />
                  <Route path="/upload" element={<Upload me={me} />} />
                  <Route path="/reveal" element={<Results me={me} />} />
                  <Route path="/archive" element={<Archive me={me} />} />
                  <Route path="/players" element={<Players me={me} />} />
                  <Route path="/settings" element={<Settings me={me} onNameChanged={(name) => setMe({ ...me, name })} />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Layout>
            </GameProvider>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
}
