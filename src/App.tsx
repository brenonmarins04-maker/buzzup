import { lazy, Suspense } from "react";
import { carregarTela } from "@/lib/carregarTela";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Outlet, Navigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AREAS, isCustomAreaKey } from "@/lib/areas";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { useIsMobile } from "@/hooks/use-mobile";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import PointerGuard from "@/components/PointerGuard";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import WelcomePage from "./pages/WelcomePage";
import AuthLayout from "./layouts/AuthLayout";
import { AuthTransitionProvider } from "./contexts/AuthTransitionContext";

/**
 * Cada tela vira um arquivo próprio, buscado só quando a rota abre.
 *
 * Antes tudo ia num pacote de 1,5 MB: quem só queria ver as demandas baixava
 * o calendário, os relatórios e o portal do moderador antes de a tela
 * aparecer. Início e login ficam no pacote principal porque são a porta de
 * entrada — atrasar esses dois só trocaria um problema por outro.
 */
const CalendarPage = lazy(() => carregarTela(() => import("./pages/CalendarPage")));
const DemandRequestsPage = lazy(() => carregarTela(() => import("./pages/DemandRequestsPage")));
const PeoplePage = lazy(() => carregarTela(() => import("./pages/PeoplePage")));
const MembersPage = lazy(() => carregarTela(() => import("./pages/MembersPage")));
const SettingsPage = lazy(() => carregarTela(() => import("./pages/SettingsPage")));
const ReportsPage = lazy(() => carregarTela(() => import("./pages/ReportsPage")));
const AreaPage = lazy(() => carregarTela(() => import("./pages/AreaPage")));
const TeamAreaPage = lazy(() => carregarTela(() => import("./pages/TeamAreaPage")));
const ResetPasswordPage = lazy(() => carregarTela(() => import("./pages/ResetPasswordPage")));
const EmailConfirmedPage = lazy(() => carregarTela(() => import("./pages/EmailConfirmedPage")));
const LandingPage = lazy(() => carregarTela(() => import("./pages/LandingPage")));
const AreasTeamsPage = lazy(() => carregarTela(() => import("./pages/AreasTeamsPage")));
const ConfigHubPage = lazy(() => carregarTela(() => import("./pages/ConfigHubPage")));
const GamificationAdminPage = lazy(() => carregarTela(() => import("./pages/GamificationAdminPage")));
const SecretAdminPage = lazy(() => carregarTela(() => import("./pages/SecretAdminPage")));
const NotFound = lazy(() => carregarTela(() => import("./pages/NotFound")));
const GeneralShortcutsSettings = lazy(() => carregarTela(() => import("@/components/GeneralShortcutsSettings")));

const queryClient = new QueryClient();

/** Enquanto o arquivo da tela chega. */
function TelaCarregando() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

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
        <RouteErrorBoundary>
          {/* A espera pelo arquivo da tela fica AQUI DENTRO, de propósito.
              Com ela acima do DataProvider, abrir uma área suspendia o app
              inteiro: o contexto de dados desmontava, perdia tudo e refazia
              as 30+ consultas ao voltar. */}
          <Suspense fallback={<TelaCarregando />}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </AppLayout>
    </DataProvider>
  </ProtectedRoute>
);

const AreaRoute = () => {
  const { area } = useParams<{ area: string }>();
  // Aceita as 4 áreas padrão e as criadas pelo owner (chave com prefixo custom)
  const isKnownArea = !!area && (AREAS.some(a => a.key === area) || isCustomAreaKey(area));
  if (!isKnownArea) return <NotFound />;
  // key forces internal state reset per area while the layout stays mounted
  return <AreaPage key={area} area={area} />;
};

// Durante a recuperação de senha o link do e-mail cria uma sessão temporária.
// Sem este guard, o app trataria como login normal e levaria ao workspace.
// Ele força a tela de redefinição até a senha ser trocada.
const RecoveryGate = () => {
  const { isRecovering } = useAuth();
  const location = useLocation();
  if (isRecovering && location.pathname !== "/reset-password") {
    // Preserva o hash/query (onde vêm os tokens do link) ao redirecionar, para
    // a sessão de recuperação não se perder se o link cair na raiz.
    return <Navigate to={`/reset-password${location.search}${location.hash}`} replace />;
  }
  return null;
};

// Hash capturado no boot do app — antes de o client do Supabase processar os
// tokens e limpar a URL. Se o link de confirmação de cadastro cair em qualquer
// rota (ex.: raiz, quando o redirect_to não está na allow-list), este gate
// leva para a página "E-mail confirmado" em vez de entrar direto no app.
const BOOT_HASH = typeof window !== "undefined" ? window.location.hash : "";
const isSignupLanding = BOOT_HASH.includes("access_token") && BOOT_HASH.includes("type=signup");
let signupLandingHandled = false;

const SignupConfirmGate = () => {
  const location = useLocation();
  if (isSignupLanding && !signupLandingHandled && location.pathname !== "/email-confirmado") {
    signupLandingHandled = true;
    return <Navigate to={`/email-confirmado${BOOT_HASH}`} replace />;
  }
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <ResponsiveSonner />
        <AuthTransitionProvider>
        <BrowserRouter>
          <PointerGuard />
          <RecoveryGate />
          <SignupConfirmGate />
          {/* Só para as telas públicas; as internas têm a sua, dentro do layout */}
          <Suspense fallback={<TelaCarregando />}>
          <Routes>
            {/* Landing pública — primeira coisa que o visitante vê (antes de criar conta) */}
            <Route path="/home" element={<LandingPage />} />
            {/* AuthLayout persiste entre /login e /welcome — painel azul nunca desmonta */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/welcome" element={<WelcomePage />} />
            </Route>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            {/* Destino do link de confirmação de e-mail do cadastro */}
            <Route path="/email-confirmado" element={<EmailConfirmedPage />} />
            <Route element={<ProtectedApp />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/demandas" element={<DemandRequestsPage />} />
              <Route path="/gamification" element={<GamificationAdminPage />} />
              <Route path="/configuracoes" element={<ConfigHubPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/areas-times" element={<AreasTeamsPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/shortcuts" element={<GeneralShortcutsSettings />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/time/:teamId" element={<TeamAreaPage />} />
              <Route path="/:area" element={<AreaRoute />} />
            </Route>
            {/* Portal restrito — o código na URL é validado por hash; acesso real exige login + checagem no servidor */}
            <Route path="/p/:k" element={<SecretAdminPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        </AuthTransitionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
