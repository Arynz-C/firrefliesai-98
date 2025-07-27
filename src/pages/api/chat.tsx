// This is a React component file, not an API endpoint
// For Supabase edge functions, we use supabase/functions/
// The ollama-proxy edge function already handles chat functionality

import { Navigate } from "react-router-dom";

export const ApiChat = () => {
  // Redirect to main chat page
  return <Navigate to="/chat" replace />;
};