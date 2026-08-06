import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { registerServiceWorker, setupPWAInstall } from "@/lib/pwa";
import { DebugProvider } from "@/lib/debug-context";
import { ThemeProvider } from "@/components/theme-provider";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Initialize PWA features
    registerServiceWorker();
    setupPWAInstall();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DebugProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<Index />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            </BrowserRouter>
          </TooltipProvider>
        </DebugProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
