import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthTransition } from "@/contexts/AuthTransitionContext";
import { LogOut } from "lucide-react";

export default function AuthLayout() {
  const location = useLocation();
  const { user, displayName, signOut } = useAuth();
  const { leaving } = useAuthTransition();

  const isLogin = location.pathname === "/login";
  const firstName = displayName?.split(" ")[0] ?? "";

  // 240 = w-60 (AppLayout sidebar expanded width) — creates the morphing illusion
  const panelWidth = leaving ? 240 : isLogin ? "47vw" : 380;

  return (
    <div className="h-screen overflow-hidden flex bg-background">

      {/* ── Painel azul — montado UMA vez, nunca desmonta ──────────────── */}
      <motion.aside
        className="login-blue-panel hidden lg:flex shrink-0 overflow-hidden"
        animate={{ width: panelWidth }}
        transition={{ duration: leaving ? 0.38 : 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Conteúdo faz fade-out ao encolher para o dashboard */}
        <motion.div
          className="flex flex-col justify-between h-full w-full p-10"
          animate={{ opacity: leaving ? 0 : 1 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {/* Logo */}
          <Link to="/home" className="flex items-center gap-3 shrink-0 transition-opacity hover:opacity-90" aria-label="Voltar para a home do BuzzUp">
            <div className="h-11 w-11 rounded-xl bg-white/16 flex items-center justify-center font-extrabold text-2xl shadow-lg shadow-black/10 shrink-0">
              B
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-white whitespace-nowrap">
              BuzzUp
            </span>
          </Link>

          {/* Texto — crossfade entre login e welcome */}
          <AnimatePresence mode="wait" initial={false}>
            {isLogin ? (
              <motion.div
                key="login-text"
                className="shrink-0 max-w-lg"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[0.98] text-white">
                  Gestão de times,<br />sem nenhum ruído.
                </h1>
                <p className="mt-6 text-lg leading-relaxed text-white/84">
                  Workspaces, pedidos e demandas em um só lugar, feito para assessores e diretores que precisam de clareza.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="welcome-text"
                className="shrink-0"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <p className="text-white/50 text-sm font-semibold uppercase tracking-widest mb-3">
                  Bem-vindo de volta
                </p>
                <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Olá{firstName ? `, ${firstName}` : ""}!
                </h1>
                {user?.email && (
                  <p className="text-white/55 mt-3 text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                    {user.email}
                  </p>
                )}
                <p className="text-white/40 mt-5 text-sm leading-relaxed" style={{ maxWidth: 260 }}>
                  Escolha um workspace para continuar ou crie um novo.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="flex items-center justify-between shrink-0">
            <p className="text-white/30 text-xs">© 2026 BuzzUp</p>
            {!isLogin && (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            )}
          </div>
        </motion.div>
      </motion.aside>

      {/* ── Área direita — troca com AnimatePresence mode="wait" ───────── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="absolute inset-0 overflow-y-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
