import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import CalendarPage from "./pages/CalendarPage";
import PeoplePage from "./pages/PeoplePage";
import MembersPage from "./pages/MembersPage";
import AreaPage from "./pages/AreaPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import WelcomePage from "./pages/WelcomePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedApp = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DataProvider>
      <AppLayout>{children}</AppLayout>
    </DataProvider>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/" element={<ProtectedApp><DashboardPage /></ProtectedApp>} />
            <Route path="/calendar" element={<ProtectedApp><CalendarPage /></ProtectedApp>} />
            <Route path="/people" element={<ProtectedApp><PeoplePage /></ProtectedApp>} />
            <Route path="/members" element={<ProtectedApp><MembersPage /></ProtectedApp>} />
            <Route path="/projetos"    element={<ProtectedApp><AreaPage area="projetos" /></ProtectedApp>} />
            <Route path="/mercado"     element={<ProtectedApp><AreaPage area="mercado" /></ProtectedApp>} />
            <Route path="/gg"          element={<ProtectedApp><AreaPage area="gg" /></ProtectedApp>} />
            <Route path="/presidencia" element={<ProtectedApp><AreaPage area="presidencia" /></ProtectedApp>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
