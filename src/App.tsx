import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./hooks/useAuth";
import { ModelProvider } from "./contexts/ModelContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import { Chat } from "./pages/Chat";
import { Pricing } from "./pages/Pricing";
import NotFound from "./pages/NotFound";

/* SDK Auth */
import { GoogleOAuthProvider } from '@react-oauth/google';
const clientId = "YOUR_FUCKING_ID_OAuth";


const queryClient = new QueryClient();

const App = () => (
  <GoogleOAuthProvider clientId={clientId}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ModelProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ModelProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </GoogleOAuthProvider>
);

export default App;
