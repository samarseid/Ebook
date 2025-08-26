import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoSearch, IoReorderThree, IoSunny, IoMoon } from "react-icons/io5";

// Lokal coverlar (sening papkang bilan mos)
import coverIkkiEshik from "../assets/ikki-eshik-orasi.jpg";
import coverYaxshiyam from "../assets/yaxshiyam-sen-borsan.jpg";
import coverAtomic from "../assets/81ANaVZk5LL._SL1500_.jpg"
import cover1984 from "../assets/9780452262935_p0_v6_s600x595.jpg"
import coverSapiens from "../assets/713jIoMO3UL.jpg"
const BOOKS = [
  {
    id: "test.pdf",
    title: "Икки Эшик Ораси",
    author: "O'. Hoshimov",
    pages: 639,
    tag: "roman",
    cover: coverIkkiEshik,
    type: "pdf",
    route: "/reader",
  },
  {
    id: "test2.epub",
    title: "Yaxshiyam Sen Borsan",
    author: "Ulug'bek Hamdam",
    pages: 300,
    tag: "hikoya",
    cover: coverYaxshiyam,
    type: "epub",
    route: "/reader-epub",
  },
  // demo kartalar (rasm yo‘q bo‘lsa shimmer fon chiqadi)
  { id: "atomic-habits.pdf", 
    title: "Atomic Habits", 
    author: "James Clear", 
    pages: 514, tag: "self-help", 
    cover: coverAtomic, 
    type: "pdf", 
    route: "/reader1" 
  },

  { id: "1984.pdf", 
    title: "1984", 
    author: "George Orwell", 
    pages: 688, 
    tag: "roman", 
    cover: cover1984, 
    type: "pdf", 
    route: "/reader2" 
  },
  { id: "sapiens.pdf", 
    title: "Sapiens", 
    author: "Yuval Noah Harari", 
    pages: 945, tag: "history", 
    cover: coverSapiens, 
    type: "pdf", 
    route: "/reader3" 
  },
  { id: "d", 
    title: "Deep Work", 
    author: "Cal Newport", 
    pages: 280, 
    tag: "productivity", 
    cover: "", 
    type: "pdf", 
    route: "/reader" 
  },
  { id: "e", 
    title: "Zero to One", 
    author: "Peter Thiel", 
    pages: 210, 
    tag: "startup", 
    cover: "", 
    type: "pdf", 
    route: "/reader" 
  },
  { id: "f", 
    title: "Clean Code", 
    author: "Robert C. Martin", 
    pages: 430, 
    tag: "programming", 
    cover: "", 
    type: "pdf", 
    route: "/reader" 
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(() => {
    const ls = localStorage.getItem("ui-theme");
    return ls ? ls === "dark" : true;
  });

  // Theme vars (barchasi shu komponent ichida)
  const themeVars = useMemo(
    () =>
      dark
        ? {
            "--bg": "#0d1116",
            "--bg-soft": "#121821",
            "--card": "#121820",
            "--card-2": "#0f151d",
            "--text": "#f3f4f6",
            "--text-soft": "#aeb6c2",
            "--muted": "#202834",
            "--border": "rgba(255,255,255,.08)",
            "--shadow": "rgba(0,0,0,.5)",
            "--brand": "#f9761a",         // olov
            "--brand-2": "#f18a3c",
            "--brand-3": "#b5530f",
            "--chip": "rgba(255,255,255,.06)",
          }
        : {
            "--bg": "#f5f7fb",
            "--bg-soft": "#eef2f7",
            "--card": "#ffffff",
            "--card-2": "#fbfbfd",
            "--text": "#0f172a",
            "--text-soft": "#475569",
            "--muted": "#e9eef5",
            "--border": "rgba(15,23,42,.08)",
            "--shadow": "rgba(16,24,40,.08)",
            "--brand": "#f9761a",
            "--brand-2": "#f18a3c",
            "--brand-3": "#b5530f",
            "--chip": "rgba(0,0,0,.045)",
          },
    [dark]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BOOKS;
    return BOOKS.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.tag.toLowerCase().includes(q)
    );
  }, [query]);

  const go = (b) => {
    localStorage.setItem("bookId", b.id);
    navigate(b.route);
  };

  return (
    <div style={{ ...styles.page, ...themeVars }}>
      {/* local styles – global etkazmaslik uchun */}
      <style>{css}</style>

      {/* TOP BAR */}
      <header style={styles.topbar}>
        <h1 style={styles.title}>Kitoblar</h1>

        <div style={styles.searchWrap}>
          <IoSearch size={18} style={{ opacity: 0.7 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Qidirish: sarlavha, muallif, teg…"
            style={styles.searchInput}
          />
        </div>

        <button
          aria-label="Kun/Tun"
          onClick={() => {
            const next = !dark;
            setDark(next);
            localStorage.setItem("ui-theme", next ? "dark" : "light");
          }}
          style={styles.themeBtn}
        >
          {dark ? <IoSunny size={18} /> : <IoMoon size={18} />}
        </button>
      </header>

      {/* GRID */}
      <main style={styles.grid}>
        {filtered.map((b) => (
          <article key={b.id} style={styles.card}>
            <div style={styles.coverWrap}>
              {/* uch chiziqcha menyu */}
              <button
                aria-label="Karta menyusi"
                style={styles.menuBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  alert(`Menyu: ${b.title}`);
                }}
              >
                <IoReorderThree size={18} />
              </button>

              {/* cover yoki skeleton */}
              {b.cover ? (
                <img
                  src={b.cover}
                  alt={b.title}
                  style={styles.cover}
                  loading="lazy"
                />
              ) : (
                <div style={styles.skeleton} />
              )}
            </div>

            <div style={styles.cardBody}>
              <div style={styles.titleLine}>{b.title}</div>
              <div style={styles.author}>{b.author}</div>
              <div style={styles.meta}>
                <span style={styles.chip}>{b.pages} bet</span>
                <span style={styles.dot} />
                <span style={styles.chip}>{b.tag}</span>
              </div>

              <button style={styles.cta} onClick={() => go(b)}>
                O‘qishni boshlash
              </button>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}

/* ===================== STYLES ===================== */

const styles = {
  page: {
    // global reset (faqat shu sahifa ichida)
    boxSizing: "border-box",
    width: "100%",
    minHeight: "100vh",
    background: "var(--bg)",
    color: "var(--text)",
    paddingBottom: "24px",
    overflowX: "hidden",
  },

  topbar: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: "12px",
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "clamp(12px, 2vw, 18px) clamp(10px, 3vw, 22px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "var(--bg)",
    WebkitBackdropFilter: "saturate(180%) blur(6px)",
    backdropFilter: "saturate(180%) blur(6px)",
    borderBottom: "1px solid var(--border)",
  },

  title: {
    margin: 0,
    fontSize: "clamp(18px, 2.2vw, 24px)",
    fontWeight: 800,
    letterSpacing: "0.2px",
  },

  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--card)",
    border: "1px solid var(--border)",
    padding: "10px 12px",
    borderRadius: 12,
    boxShadow: "0 4px 16px var(--shadow)",
  },

  searchInput: {
    appearance: "none",
    border: "none",
    outline: "none",
    flex: 1,
    fontSize: 14,
    color: "var(--text)",
    background: "transparent",
  },

  themeBtn: {
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    width: 38,
    height: 38,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    boxShadow: "0 4px 16px var(--shadow)",
    paddingInline: `max(0px, env(safe-area-inset-right))`,
  },

  grid: {
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "24px clamp(10px, 3vw, 22px) 40px",
    display: "grid",
    gap: "18px",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(clamp(220px, 26vw, 280px), 1fr))",
  },

  card: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    boxShadow: "0 8px 30px var(--shadow)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  coverWrap: {
    position: "relative",
    aspectRatio: "3 / 4",
    background:
      "radial-gradient(120px 120px at 20% 10%, rgba(255,255,255,.08), transparent), linear-gradient(180deg, var(--card-2), var(--card))",
    overflow: "hidden",
  },

  menuBtn: {
    position: "absolute",
    top: "10px",
    right: "10px",
    zIndex: 2,
    background: "rgba(15,23,42,.28)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    width: 32,
    height: 32,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  },

  cover: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  skeleton: {
    width: "100%",
    height: "100%",
    background:
      "radial-gradient(160px 160px at 25% 15%, rgba(255,255,255,.12), transparent), linear-gradient(180deg, var(--muted), var(--card-2))",
  },

  cardBody: {
    display: "grid",
    gap: 8,
    padding: "14px 14px 16px",
  },

  titleLine: {
    fontWeight: 800,
    fontSize: 16,
    lineHeight: 1.25,
  },

  author: {
    fontSize: 13,
    color: "var(--text-soft)",
  },

  meta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  chip: {
    fontSize: 12,
    background: "var(--chip)",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
  },

  dot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    background: "var(--brand)",
    opacity: 0.9,
  },

  cta: {
    marginTop: 4,
    background:
      "linear-gradient(180deg, var(--brand), var(--brand-2) 70%, var(--brand-3))",
    color: "#fff",
    border: "none",
    fontWeight: 700,
    fontSize: 14,
    padding: "12px 14px",
    borderRadius: 12,
    boxShadow: "0 10px 20px rgba(249, 118, 26, .25)",
    cursor: "pointer",
  },
};

// Sahifa ichidagi minimal reset + media rules
const css = `
  *,
  *::before,
  *::after { box-sizing: border-box; }
  html, body, #root { height: 100%; background: var(--bg); }
  body { margin: 0; overflow-x: hidden; color: var(--text); }

  /* grid breakpoints (telefon uchun 1 ustun) */
  @media (max-width: 480px) {
    main { grid-template-columns: 1fr !important; padding-left: max(10px, env(safe-area-inset-left)); padding-right: max(10px, env(safe-area-inset-right)); }
    header { grid-template-columns: 1fr auto; gap: 10px; }
    header h1 { grid-column: 1 / -1; }
  }
`;
