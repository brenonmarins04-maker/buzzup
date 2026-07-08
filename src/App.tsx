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
import LandingPage from "./pages/LandingPage";
import AreasTeamsPage from "./pages/AreasTeamsPage";
import GamificationAdminPage from "./pages/GamificationAdminPage";
import SecretAdminPage from "./pages/SecretAdminPage";
import NotFound from "./pages/NotFound";
import AuthLayout from "./layouts/AuthLayout";
import { AuthTransitionProvider } from "./contexts/AuthTransitionContext";

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
        <AuthTransitionProvider>
        <BrowserRouter>
          <Routes>
            {/* Landing pública — primeira coisa que o visitante vê (antes de criar conta) */}
            <Route path="/home" element={<LandingPage />} />
            {/* AuthLayout persiste entre /login e /welcome — painel azul nunca desmonta */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/welcome" element={<WelcomePage />} />
            </Route>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<ProtectedApp />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/gamification" element={<GamificationAdminPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/areas-times" element={<AreasTeamsPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/time/:teamId" element={<TeamAreaPage />} />
              <Route path="/:area" element={<AreaRoute />} />
            </Route>
            {/* Portal restrito — o código na URL é validado por hash; acesso real exige login + checagem no servidor */}
            <Route path="/p/:k" element={<SecretAdminPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </AuthTransitionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
