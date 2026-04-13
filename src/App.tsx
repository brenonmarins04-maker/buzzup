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
import TasksPage from "./pages/TasksPage";
import ContentPage from "./pages/ContentPage";
import TeamsPage from "./pages/TeamsPage";
import ProjectsPage from "./pages/ProjectsPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
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
            <Route path="/" element={<ProtectedApp><DashboardPage /></ProtectedApp>} />
            <Route path="/calendar" element={<ProtectedApp><CalendarPage /></ProtectedApp>} />
            <Route path="/tasks" element={<ProtectedApp><TasksPage /></ProtectedApp>} />
            <Route path="/content" element={<ProtectedApp><ContentPage /></ProtectedApp>} />
            <Route path="/teams" element={<ProtectedApp><TeamsPage /></ProtectedApp>} />
            <Route path="/projects" element={<ProtectedApp><ProjectsPage /></ProtectedApp>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
