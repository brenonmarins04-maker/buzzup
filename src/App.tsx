import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Outlet, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { useIsMobile } from "@/hooks/use-mobile";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import CalendarPage from "./pages/CalendarPage";
import PeoplePage from "./pages/PeoplePage";
import MembersPage from "./pages/MembersPage";
import SettingsPage from "./pages/SettingsPage";
import ReportsPage from "./pages/ReportsPage";
import AreaPage from "./pages/AreaPage";
import TeamAreaPage from "./pages/TeamAreaPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import WelcomePage from "./pages/WelcomePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Sonner toaster: mobile shows at top, desktop at bottom-left
function ResponsiveSonner() {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <Sonner position="top-center" offset={{ top: 12 }} mobileOffset={{ top: 12 }} />;
  }
  return <Sonner position="bottom-left" offset={{ left: 96, bottom: 24 }} mobileOffset={{ left: 80, bottom: 16 }} />;
}

// Layout route: keeps DataProvider + AppLayout mounted across page navigations,
// so switching between areas doesn't trigger a full data re-fetch.
const ProtectedApp = () => (
  <ProtectedRoute>
    <DataProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </DataProvider>
  </ProtectedRoute>
);

const AREA_KEYS = ["projetos", "mercado", "gg", "presidencia"] as const;
type AreaSlug = typeof AREA_KEYS[number];
const AreaRoute = () => {
  const { area } = useParams<{ area: string }>();
  if (!area || !AREA_KEYS.includes(area as AreaSlug)) return <NotFound />;
  // key forces internal state reset per area while the layout stays mounted
  return <AreaPage key={area} area={area as AreaSlug} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <ResponsiveSonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route element={<ProtectedApp />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/time/:teamId" element={<TeamAreaPage />} />
              <Route path="/:area" element={<AreaRoute />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
