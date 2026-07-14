import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { trackPlatformEvent } from "@/lib/platformAnalytics";
import BrandLogo from "@/components/BrandLogo";
import "./LandingPage.css";

const SIGNUP = "/login?mode=signup";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  const upwardScrollRef = useRef(0);
  const [scrolled, setScrolled] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signupTransition, setSignupTransition] = useState(false);

  // Header shrink + hide on scroll down, reveal quickly on scroll up.
  useEffect(() => {
    const onScroll = () => {
      const currentY = Math.max(window.scrollY, 0);
      const delta = currentY - lastScrollYRef.current;

      setScrolled(currentY > 10);

      if (menuOpen || currentY < 80) {
        setHeaderHidden(false);
        upwardScrollRef.current = 0;
      } else if (delta > 6) {
        setHeaderHidden(true);
        upwardScrollRef.current = 0;
      } else if (delta < -2) {
        upwardScrollRef.current += Math.abs(delta);
        if (upwardScrollRef.current >= 10) setHeaderHidden(false);
      }

      lastScrollYRef.current = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuOpen]);

  // Reveal-on-scroll (staggered)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal")).filter(
      (el) => el.classList.contains("section-slide") || !el.closest(".section-slide")
    );
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            const sibs = el.parentElement
              ? Array.from(el.parentElement.children).filter((c) => c.classList.contains("reveal"))
              : [el];
            el.style.transitionDelay = `${Math.min(Math.max(0, sibs.indexOf(el)) * 80, 320)}ms`;
            el.classList.add("in");
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (loading || user) return;
    trackPlatformEvent("landing_view", {
      metadata: { path: window.location.pathname },
    });
  }, [loading, user]);

  useEffect(() => {
    if (!signupTransition) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      navigate(SIGNUP);
    }, reducedMotion ? 180 : 2450);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [navigate, signupTransition]);

  const goTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setMenuOpen(false);
    rootRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startSignupTransition = (e: React.MouseEvent, source: string) => {
    e.preventDefault();
    if (signupTransition) return;
    setMenuOpen(false);
    trackPlatformEvent("signup_cta_click", { metadata: { source } });
    setSignupTransition(true);
  };

  return (
    <div className="buzz-lp" ref={rootRef}>
      {signupTransition && <SignupTransitionOverlay />}

      <a className="skip" href="#main">Pular para o conteúdo</a>

      <header className={[scrolled ? "shrink" : "", headerHidden ? "nav-hidden" : ""].filter(Boolean).join(" ")}>
        <div className="wrap nav">
          <a className="brand" href="#" onClick={(e) => goTo(e, "main")} aria-label="BuzzUp, início">
            <BrandLogo markClassName="h-9 w-9" textClassName="text-[19px]" />
          </a>
          <nav className={`nav-links${menuOpen ? " open" : ""}`} aria-label="Principal">
            <a href="#recursos" onClick={(e) => goTo(e, "recursos")}>Como funciona</a>
            <a href="#ranking" onClick={(e) => goTo(e, "ranking")}>Gameficação</a>
            <a href="#planos" onClick={(e) => goTo(e, "planos")}>Grátis vitalício</a>
          </nav>
          <Link className="btn btn-login-link nav-login" to="/login">
            Entrar
          </Link>
          <Link
            className="btn btn-green nav-cta"
            to={SIGNUP}
            onClick={(e) => startSignupTransition(e, "landing_nav")}
          >
            Criar conta
          </Link>
          <button className="menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Abrir menu" aria-expanded={menuOpen}>☰</button>
        </div>
      </header>

      <main id="main">

        <section className="hero pad">
          <div className="hero-announce-wrap">
            <PromoMarquee />
          </div>
          <div className="wrap hero-grid">
            <div>
              <h1 className="reveal">Gestão da sua entidade na faculdade no seu celular.</h1>
              <div className="hero-cta reveal">
                <div className="hero-actions">
                  <Link
                    className="btn btn-green pulse"
                    to={SIGNUP}
                    onClick={(e) => startSignupTransition(e, "landing_hero")}
                  >
                    Criar conta <span aria-hidden="true">→</span>
                  </Link>
                  <Link className="btn btn-login-ghost" to="/login">
                    Entrar
                  </Link>
                </div>
                <span className="hero-sub">Crie sua conta, compartilhe seu código e pronto! Fácil assim.</span>
              </div>
            </div>
            <div className="app-phone reveal" aria-hidden="true">
              <div className="app-screen">
                <div className="app-status"><span>9:41</span><span>●●●</span></div>
                <div className="app-topbar"><b>BuzzUp</b><span className="app-role">Owner</span></div>
                <div className="app-body">
                  <div className="app-card">
                    <div className="app-card-title" style={{ color: "#00B4D8" }}>Minhas Demandas</div>
                    <div className="app-demand">
                      <div className="d-area">MARKETING</div>
                      <div className="d-title">Post no insta</div>
                      <div className="d-meta"><span className="d-date">02/07</span><span className="d-chip">● Em andamento</span></div>
                      <div className="d-done">✓ Marcar como concluída</div>
                    </div>
                  </div>
                  <div className="app-card">
                    <div className="app-card-title" style={{ color: "#BA7517" }}>🏆 Gameficação</div>
                    <div className="app-rankrow"><span className="pos" style={{ background: "#EF9F27" }}>1</span><b style={{ flex: 1 }}>Duda</b><span className="pts">340 pts</span></div>
                    <div className="app-rankrow"><span className="pos" style={{ background: "#B4B2A9" }}>2</span><span style={{ flex: 1 }}>Léo</span><span className="pts" style={{ color: "var(--muted)" }}>290 pts</span></div>
                    <div className="app-rankrow"><span className="pos" style={{ background: "#B45309" }}>3</span><span style={{ flex: 1 }}>Bibi</span><span className="pts" style={{ color: "var(--muted)" }}>275 pts</span></div>
                  </div>
                </div>
                <div className="app-nav"><span>Calendário</span><span className="on">Início</span><span>Áreas</span></div>
              </div>
            </div>
          </div>
          <div className="wrap hero-trust">
            <p className="reveal">Feito por universitários, para universitários</p>
            <div className="tags reveal">
              <span className="tag">Empresas Juniores</span>
              <span className="tag">Atléticas</span>
              <span className="tag">Centros Acadêmicos</span>
              <span className="tag">Ligas</span>
            </div>
          </div>
        </section>

        <section className="sec-soft pad">
          <div className="wrap center reveal section-slide slide-right">
            <h2 className="reveal mx">Toda gestão começa do zero.</h2>
            <p className="lead reveal mx" style={{ color: "var(--muted)", marginTop: 14 }}>As demandas moram no WhatsApp. O planejamento numa planilha que ninguém abre. Aí chega a reunião semanal e o diretor vira cobrador — não gestor.</p>
            <div className="pain-grid">
              <div className="pain reveal"><span className="dot"></span><span>Falta de comunicação entre as áreas</span></div>
              <div className="pain reveal"><span className="dot"></span><span>Membro é preguiçoso ou não sabe o que fazer</span></div>
              <div className="pain reveal"><span className="dot"></span><span>Membro desanima de fazer as tarefas fáceis</span></div>
              <div className="pain reveal"><span className="dot"></span><span>Passagem de conhecimento difícil</span></div>
            </div>
          </div>
        </section>

        <section className="sec-blue pad">
          <div className="wrap split reveal section-slide slide-left">
            <div>
              <span className="eyebrow on-blue reveal">Feito para sua gestão</span>
              <h2 className="reveal">Tudo que importa, de um jeito fácil de ver.</h2>
              <p className="lead reveal" style={{ color: "rgba(255,255,255,.88)", marginTop: 14 }}>Seus membros <strong>abrem o celular</strong> e veem <strong>na hora</strong>, de forma simples, o que precisam entregar na semana.</p>
              <p className="lead reveal" style={{ color: "rgba(255,255,255,.88)", marginTop: 12 }}>Nada de grupo de WhatsApp caótico ou "não sabia que tinha que fazer", como não? Estava no BuzzUp!</p>
            </div>
            <div className="phone reveal" aria-hidden="true">
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.78)", marginBottom: 10 }}>Minhas demandas</div>
              <div className="demand" style={{ borderColor: "var(--area-mkt)" }}><div className="cat" style={{ color: "#993C1D" }}>Marketing</div><div className="ttl">Post no insta</div></div>
              <div className="demand" style={{ borderColor: "var(--area-geral)" }}><div className="cat" style={{ color: "#0C447C" }}>Geral</div><div className="ttl">Terminar ata</div></div>
              <div className="demand" style={{ borderColor: "var(--area-fin)", marginBottom: 0 }}><div className="cat" style={{ color: "#0F6E56" }}>Financeiro</div><div className="ttl">fechar fluxo de caixa</div></div>
            </div>
          </div>
        </section>

        <section className="pad" id="recursos">
          <div className="wrap center reveal section-slide slide-right">
            <span className="eyebrow on-light reveal">Como funciona</span>
            <h2 className="reveal mx">Uma plataforma. A entidade inteira em sincronia.</h2>
            <div className="feat-grid">
              <div className="feat reveal">
                <div className="ic" style={{ background: "rgba(239,159,39,.12)", color: "#BA7517" }}>★</div>
                <h3>Gameficação automática</h3>
                <p>Cada demanda vira ponto. O ranking da empresa mostra quem realmente faz.</p>
              </div>
              <div className="feat reveal">
                <div className="ic" style={{ background: "rgba(16,185,129,.12)", color: "#0F6E56" }}>▣</div>
                <h3>Calendário integrado</h3>
                <p>Calendário do marketing, reuniões marcadas, todo mundo vê, mais organização visual.</p>
              </div>
              <div className="feat reveal">
                <div className="ic" style={{ background: "rgba(0,180,216,.12)", color: "#00B4D8" }}>☰</div>
                <h3>Demandas arrastáveis</h3>
                <p>Visualize a sobrecarga da sua equipe, balanceie as tarefas.</p>
              </div>
              <div className="feat reveal">
                <div className="ic" style={{ background: "rgba(139,92,246,.12)", color: "#6D28D9" }}>▧</div>
                <h3>Conexão entre áreas.</h3>
                <p>As áreas da sua entidade vão se conectar ao perceber quais são as demandas da empresa.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sec-soft pad" id="ranking">
          <div className="wrap split rev reveal section-slide slide-left">
            <div className="rankcard-light reveal" aria-hidden="true">
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 12 }}>🏆 Ranking da semana</div>
              <div className="rankrow"><span className="pos" style={{ background: "#EF9F27" }}>1</span><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Duda</span><span className="pts">340 pts</span></div>
              <div className="rankrow"><span className="pos" style={{ background: "#B4B2A9" }}>2</span><span style={{ flex: 1, fontSize: 14 }}>Léo</span><span className="pts" style={{ color: "var(--muted)" }}>290 pts</span></div>
              <div className="rankrow"><span className="pos" style={{ background: "#B45309" }}>3</span><span style={{ flex: 1, fontSize: 14 }}>Bibi</span><span className="pts" style={{ color: "var(--muted)" }}>275 pts</span></div>
            </div>
            <div>
              <span className="eyebrow on-light reveal">Engajamento</span>
              <h2 className="reveal">O segredo não é cobrar mais. É fazer sua base querer entregar.</h2>
              <p className="lead reveal" style={{ color: "var(--muted)", marginTop: 14 }}>Cada tarefa concluída vira ponto. Cada ponto vira posição. Toda semana o ranking mostra quem está puxando a entidade pra frente — e transforma tarefa obrigatória em competição saudável. Você para de empurrar; sua base começa a puxar.</p>
            </div>
          </div>
        </section>

        <section className="sec-blue pad" id="planos">
          <div className="wrap center reveal section-slide slide-right">
            <span className="eyebrow on-blue reveal">Free forever</span>
            <h2 className="reveal mx">Entre até 30 de setembro. Use o BuzzUp para sempre.</h2>
            <p className="lead reveal mx" style={{ color: "rgba(255,255,255,.86)", marginTop: 14 }}>Estamos abrindo o BuzzUp para as entidades que querem organizar a gestão de verdade. Quem chegar primeiro entra sem pagar e permanece com tudo liberado.</p>
            <div className="steps">
              <div className="step reveal"><div className="num">1</div><div className="ic" aria-hidden="true">⏱</div><h3>Crie sua conta até 30/09</h3><p>O prazo termina em 30 de setembro de 2026, às 23:59.</p></div>
              <div className="step reveal"><div className="num">2</div><div className="ic" aria-hidden="true">∞</div><h3>Garanta acesso vitalício</h3><p>Todas as funcionalidades do BuzzUp, sem mensalidade e sem cartão.</p></div>
              <div className="step reveal"><div className="num">3</div><div className="ic" aria-hidden="true">→</div><h3>Depois de 1º de outubro</h3><p>Novas contas terão limites. Quem chegou antes continua com tudo liberado.</p></div>
            </div>
            <div className="reveal" style={{ marginTop: 30 }}>
              <Link className="btn btn-white pulse" to={SIGNUP} onClick={(e) => startSignupTransition(e, "landing_lifetime")}>
                Garantir acesso vitalício <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="sec-soft pad" id="faq">
          <div className="wrap center reveal section-slide slide-left">
            <span className="eyebrow on-light reveal">Dúvidas</span>
            <h2 className="reveal mx">Perguntas frequentes</h2>
            <div className="faq">
              <details className="reveal"><summary>É realmente de graça? <span className="plus" aria-hidden="true">+</span></summary><p>Sim, você não paga absolutamente nada se criar uma conta até 30 de setembro de 2026, às 23:59. Se você criar uma conta até esse horário, terá acesso vitalício ao BuzzUp e a todas as funcionalidades.</p></details>
              <details className="reveal"><summary>Quantas pessoas o BuzzUp consegue organizar? <span className="plus" aria-hidden="true">+</span></summary><p>O recomendado é para entidades de 10 até 50 membros. Menos que isso é exagero de organização e, mais que isso, vira bagunça.</p></details>
              <details className="reveal"><summary>Precisa instalar alguma coisa? <span className="plus" aria-hidden="true">+</span></summary><p>Não. Funciona direto no navegador do computador e do celular. A diretoria organiza no PC e a gestão acompanha pelo celular.</p></details>
              <details className="reveal"><summary>Meus dados ficam seguros? <span className="plus" aria-hidden="true">+</span></summary><p>Cada entidade tem um espaço isolado. Só quem você convida com o código consegue ver e participar.</p></details>
              <details className="reveal"><summary>O que acontece quando a gestão troca? <span className="plus" aria-hidden="true">+</span></summary><p>Tudo fica registrado: demandas, áreas, histórico e ranking. A próxima gestão herdará organização, não bagunça.</p></details>
            </div>
          </div>
        </section>

        <section className="sec-blue pad final">
          <div className="wrap center reveal section-slide slide-right">
            <h2 className="reveal mx">Sua próxima gestão pode herdar um legado — não uma bagunça.</h2>
            <p className="lead reveal mx" style={{ color: "rgba(255,255,255,.86)", marginTop: 14 }}>Crie sua conta até 30 de setembro de 2026, às 23:59, e garanta acesso vitalício ao BuzzUp.</p>
            <div className="reveal" style={{ marginTop: 30 }}>
              <Link
                className="btn btn-white pulse"
                to={SIGNUP}
                onClick={(e) => startSignupTransition(e, "landing_final")}
              >
                Garantir acesso vitalício <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

      </main>

      <footer>
        <div className="wrap">
          <div className="footer-brand">
            <BrandLogo markClassName="h-8 w-8" textClassName="text-[17px] text-white" />
          </div>
          <div>© 2026 BuzzUp · Feito por universitários, para universitários</div>
        </div>
      </footer>
    </div>
  );
}

function PromoMarquee() {
  return (
    <div className="announce" aria-label="Free forever">
      <div className="announce-track">
        {[0, 1].map((group) => (
          <div className="announce-group" key={group}>
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={`${group}-${i}`}>FREE FOREVER</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SignupTransitionOverlay() {
  return (
    <div className="signup-transition" aria-hidden="true">
      <div className="signup-phone-stage">
        <div className="signup-phone">
          <div className="signup-screen">
            <div className="signup-status"><span>9:41</span><span>•••</span></div>
            <div className="signup-topbar"><b>BuzzUp</b><span>Owner</span></div>
            <div className="signup-body">
              <div className="signup-mini-card">
                <p className="signup-mini-label">Minhas Demandas</p>
                <div className="signup-mini-task">
                  <span>MARKETING</span>
                  <strong>Post no insta</strong>
                  <small>02/07</small>
                </div>
              </div>
              <div className="signup-mini-card">
                <p className="signup-mini-label gold">Gameficação</p>
                <div className="signup-rank-line"><b>1</b><span>Duda</span><strong>340 pts</strong></div>
                <div className="signup-rank-line muted"><b>2</b><span>Léo</span><strong>290 pts</strong></div>
              </div>
            </div>
            <div className="signup-nav">
              <span>Calendário</span>
              <span className="active">Início</span>
              <span>Áreas</span>
            </div>
            <div className="signup-touch" />
          </div>
        </div>
      </div>

      <div className="signup-login-reveal">
        <div className="signup-login-panel">
          <BrandLogo showText={false} markClassName="signup-login-logo" />
          <div className="signup-login-copy">
            <strong>Bem-vindo ao BuzzUp</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
