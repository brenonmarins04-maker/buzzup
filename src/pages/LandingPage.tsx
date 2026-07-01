import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import "./LandingPage.css";

const SIGNUP = "/login?mode=signup";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Header shrink on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Reveal-on-scroll (staggered)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
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

  // Logged-in users skip the landing
  if (!loading && user) return <Navigate to="/" replace />;

  const goTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setMenuOpen(false);
    rootRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="buzz-lp" ref={rootRef}>
      <a className="skip" href="#main">Pular para o conteúdo</a>

      <div className="announce">Grátis por 3 meses para toda entidade que entrar até o final de 2026 · Sem cartão</div>

      <header className={scrolled ? "shrink" : ""}>
        <div className="wrap nav">
          <a className="brand" href="#" onClick={(e) => goTo(e, "main")} aria-label="BuzzUp, início"><span className="logo">B</span>BuzzUp</a>
          <nav className={`nav-links${menuOpen ? " open" : ""}`} aria-label="Principal">
            <a href="#recursos" onClick={(e) => goTo(e, "recursos")}>Recursos</a>
            <a href="#ranking" onClick={(e) => goTo(e, "ranking")}>Ranking</a>
            <a href="#planos" onClick={(e) => goTo(e, "planos")}>Planos</a>
            <a href="#faq" onClick={(e) => goTo(e, "faq")}>FAQ</a>
          </nav>
          <Link className="btn btn-green nav-cta" to={SIGNUP}>Criar conta grátis</Link>
          <button className="menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Abrir menu" aria-expanded={menuOpen}>☰</button>
        </div>
      </header>

      <main id="main">

        <section className="hero pad">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow badge-red reveal">3 meses de graça · sem cartão</span>
              <h1 className="reveal">Gestão da sua entidade na faculdade no seu celular.</h1>
              <div className="hero-cta reveal" style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
                <Link className="btn btn-green pulse" to={SIGNUP}>Criar conta grátis <span aria-hidden="true">→</span></Link>
                <span className="hero-sub">Crie sua conta, compartilhe seu código e pronto! Fácil assim.</span>
              </div>
            </div>
            <div className="app-phone reveal" aria-hidden="true">
              <div className="app-screen">
                <div className="app-status"><span>9:41</span><span>●●●</span></div>
                <div className="app-topbar"><b>BuzzUp</b><span className="app-role">Owner</span></div>
                <div className="app-body">
                  <div className="app-card">
                    <div className="app-card-title" style={{ color: "#2563EB" }}>Minhas Demandas</div>
                    <div className="app-demand">
                      <div className="d-area">MARKETING</div>
                      <div className="d-title">Post de recrutamento</div>
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
        </section>

        <div className="trust">
          <div className="wrap">
            <p className="reveal">Feito sob medida para o ecossistema universitário</p>
            <div className="tags reveal">
              <span className="tag">Empresas Juniores</span>
              <span className="tag">Atléticas</span>
              <span className="tag">Centros Acadêmicos</span>
              <span className="tag">Ligas</span>
            </div>
          </div>
        </div>

        <section className="sec-soft pad">
          <div className="wrap center">
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
          <div className="wrap split">
            <div>
              <span className="eyebrow on-blue reveal">Para a base</span>
              <h2 className="reveal">Tudo que importa cabe na palma da mão.</h2>
              <p className="lead reveal" style={{ color: "rgba(255,255,255,.88)", marginTop: 14 }}>Seus membros abrem o celular e veem na hora, de forma simples, o que precisam entregar na semana — e onde estão no ranking de quem mais faz acontecer.</p>
              <p className="lead reveal" style={{ color: "rgba(255,255,255,.88)", marginTop: 12 }}>Nada de grupo de WhatsApp caótico ou "não sabia que era comigo". Clareza total para a base e competição saudável para todo mundo.</p>
            </div>
            <div className="phone reveal" aria-hidden="true">
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.78)", marginBottom: 10 }}>Minhas demandas</div>
              <div className="demand" style={{ borderColor: "var(--area-mkt)" }}><div className="cat" style={{ color: "#993C1D" }}>Marketing</div><div className="ttl">Post de recrutamento</div></div>
              <div className="demand" style={{ borderColor: "var(--area-geral)" }}><div className="cat" style={{ color: "#0C447C" }}>Geral</div><div className="ttl">Ata da reunião</div></div>
              <div className="demand" style={{ borderColor: "var(--area-fin)", marginBottom: 0 }}><div className="cat" style={{ color: "#0F6E56" }}>Financeiro</div><div className="ttl">Fechar caixa</div></div>
            </div>
          </div>
        </section>

        <section className="pad" id="recursos">
          <div className="wrap center">
            <span className="eyebrow on-light reveal">Como funciona</span>
            <h2 className="reveal mx">Uma plataforma. A entidade inteira em sincronia.</h2>
            <div className="feat-grid">
              <div className="feat reveal">
                <div className="ic" style={{ background: "rgba(37,99,235,.1)", color: "#2563EB" }}>☰</div>
                <h3>Demandas arrastáveis</h3>
                <p>A diretoria distribui e reorganiza tarefas entre áreas e pessoas arrastando, direto do computador.</p>
              </div>
              <div className="feat reveal">
                <div className="ic" style={{ background: "rgba(239,159,39,.12)", color: "#BA7517" }}>★</div>
                <h3>Ranking de quem faz mais</h3>
                <p>Cada tarefa vira ponto. O ranking semanal transforma entrega em competição saudável.</p>
              </div>
              <div className="feat reveal">
                <div className="ic" style={{ background: "rgba(16,185,129,.12)", color: "#0F6E56" }}>▣</div>
                <h3>Calendário integrado</h3>
                <p>Demandas, publicações e eventos de todas as áreas num só calendário visual.</p>
              </div>
              <div className="feat reveal">
                <div className="ic" style={{ background: "rgba(139,92,246,.12)", color: "#6D28D9" }}>▧</div>
                <h3>Áreas que se conversam</h3>
                <p>Marketing, Projetos, Gestão e Financeiro finalmente enxergam o que cada um está fazendo.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sec-soft pad" id="ranking">
          <div className="wrap split rev">
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

        <section className="sec-blue pad">
          <div className="wrap center">
            <span className="eyebrow on-blue reveal">Cresçam juntas</span>
            <h2 className="reveal mx">Recomende uma entidade. Ganhem 30 dias juntas.</h2>
            <p className="lead reveal mx" style={{ color: "rgba(255,255,255,.86)", marginTop: 14 }}>A melhor forma de organizar sua entidade é ter todo mundo dentro. A segunda é fazer isso valer mais 30 dias grátis — pra você e pra quem indicar.</p>
            <div className="steps">
              <div className="step reveal"><div className="num">1</div><div className="ic" aria-hidden="true">✉</div><h3>Indique uma entidade</h3><p>Aquela EJ, atlética ou liga amiga.</p></div>
              <div className="step reveal"><div className="num">2</div><div className="ic" aria-hidden="true">👥</div><h3>Ela ativa 15 membros</h3><p>Time no ar no workspace dela.</p></div>
              <div className="step reveal"><div className="num">3</div><div className="ic" aria-hidden="true">🎁</div><h3>+30 dias pra vocês dois</h3><p>Todo mundo sai no lucro.</p></div>
            </div>
          </div>
        </section>

        <section className="pad" id="planos">
          <div className="wrap center">
            <span className="eyebrow on-light reveal">Planos</span>
            <h2 className="reveal mx">Comece grátis. Cresça de graça.</h2>
            <div className="price-grid">
              <div className="price feat-price reveal">
                <div className="k">Plano completo</div>
                <div className="big">3 meses grátis</div>
                <p>Tudo liberado, sem cartão. Válido para toda entidade que entrar até o final de 2026.</p>
                <Link className="btn btn-solid" to={SIGNUP} style={{ width: "100%", justifyContent: "center" }}>Criar minha entidade</Link>
              </div>
              <div className="price reveal">
                <div className="k">Bônus por indicação</div>
                <div className="big">+30 dias grátis</div>
                <p>Indique uma entidade. Quando ela tiver 15 membros no workspace dela, vocês dois ganham 30 dias.</p>
                <div className="chk"><span aria-hidden="true" style={{ color: "#639922" }}>✓</span> Acumulável a cada indicação</div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec-soft pad" id="faq">
          <div className="wrap center">
            <span className="eyebrow on-light reveal">Dúvidas</span>
            <h2 className="reveal mx">Perguntas frequentes</h2>
            <div className="faq">
              <details className="reveal"><summary>É realmente de graça? <span className="plus" aria-hidden="true">+</span></summary><p>Sim. Toda entidade que entrar até o final de 2026 ganha 3 meses no plano completo, sem cartão de crédito.</p></details>
              <details className="reveal"><summary>Minha entidade é pequena, vale a pena? <span className="plus" aria-hidden="true">+</span></summary><p>Vale. O BuzzUp funciona pra qualquer tamanho — de um núcleo de 5 pessoas a uma entidade com dezenas de membros e várias áreas.</p></details>
              <details className="reveal"><summary>Como funcionam os +30 dias grátis? <span className="plus" aria-hidden="true">+</span></summary><p>Indique outra entidade. Quando ela colocar 15 membros no workspace dela, as duas ganham 30 dias grátis. É acumulável a cada indicação.</p></details>
              <details className="reveal"><summary>Precisa instalar alguma coisa? <span className="plus" aria-hidden="true">+</span></summary><p>Não. Funciona direto no navegador do computador e do celular. A diretoria organiza no PC e a base acompanha pelo celular.</p></details>
              <details className="reveal"><summary>Meus dados ficam seguros? <span className="plus" aria-hidden="true">+</span></summary><p>Cada entidade tem um espaço isolado. Só quem você convida com o código consegue ver e participar.</p></details>
              <details className="reveal"><summary>O que acontece quando a gestão troca? <span className="plus" aria-hidden="true">+</span></summary><p>Tudo fica registrado: demandas, áreas, histórico e ranking. A próxima gestão herda um legado organizado — não uma bagunça.</p></details>
            </div>
          </div>
        </section>

        <section className="sec-blue pad final">
          <div className="wrap center">
            <h2 className="reveal mx">Sua próxima gestão pode herdar um legado — não uma bagunça.</h2>
            <p className="lead reveal mx" style={{ color: "rgba(255,255,255,.86)", marginTop: 14 }}>Coloque sua entidade no ritmo certo hoje. Leva 5 minutos e os primeiros 3 meses são por nossa conta.</p>
            <div className="reveal" style={{ marginTop: 30 }}>
              <Link className="btn btn-white" to={SIGNUP}>Criar minha entidade grátis <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

      </main>

      <footer>
        <div className="wrap">
          <div className="footer-brand"><span className="logo">B</span>BuzzUp</div>
          <div>© 2026 BuzzUp · Feito por universitários, para universitários</div>
        </div>
      </footer>
    </div>
  );
}
