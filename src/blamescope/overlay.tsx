import React, { useEffect, useState } from "react";

type BlameInfo = {
  file: string;
  latestCommit: string;
  latestAuthor: string;
  latestDate: string;
  commitHash: string;
  latestEmail: string;
  totalCommits: number;
  contributors: { commits: number; author: string }[];
};

type ActiveTarget = {
  file: string;
  component: string;
  x: number;
  y: number;
};

const SERVER_URL = "http://localhost:4317";
const cache = new Map<string, BlameInfo>();

async function fetchBlame(file: string): Promise<BlameInfo | null> {
  if (cache.has(file)) return cache.get(file)!;
  try {
    const res = await fetch(
      `${SERVER_URL}/ownership?file=${encodeURIComponent(file)}`
    );
    if (!res.ok) return null;
    const data: BlameInfo = await res.json();
    cache.set(file, data);
    return data;
  } catch {
    return null;
  }
}

export function BlameOverlay() {
  const [active, setActive] = useState<ActiveTarget | null>(null);
  const [blame, setBlame] = useState<BlameInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [pinned, setPinned] = useState(false);
  const pinnedRef = React.useRef(false);

  // Alt key → pin overlay so text can be selected/copied
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        e.preventDefault();
        setPinned(true);
        pinnedRef.current = true;
      }
      if (e.key === "Escape") {
        setPinned(false);
        pinnedRef.current = false;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setPinned(false);
        pinnedRef.current = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (pinnedRef.current) return; // frozen while Alt held
      const el = (e.target as HTMLElement).closest("[data-blamescope]");

      if (!el) {
        setActive(null);
        return;
      }

      try {
        const parsed = JSON.parse(el.getAttribute("data-blamescope")!);
        setActive({
          file: parsed.file ?? "",
          component: parsed.component ?? "Unknown",
          x: e.clientX + 16,
          y: e.clientY + 16,
        });
      } catch {
        setActive(null);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (!active) {
      setBlame(null);
      setLoading(false);
      return;
    }

    if (cache.has(active.file)) {
      setBlame(cache.get(active.file)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setBlame(null);

    fetchBlame(active.file).then((data) => {
      if (cancelled) return;
      setBlame(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [active?.file]);

  if (!active) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: active.y,
        left: active.x,
        background: "#0f0f1a",
        color: "#e0e0e0",
        padding: "12px 14px",
        borderRadius: 10,
        zIndex: 999999,
        fontSize: 12,
        pointerEvents: pinned ? "auto" : "none",
        maxWidth: 320,
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.5)",
        fontFamily: "monospace",
        border: pinned ? "1px solid #f0b429" : "1px solid #2a2a3e",
        lineHeight: 1.6,
        userSelect: pinned ? "text" : "none",
      }}
    >
      {/* Component name + file */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: "#7ec8e3", fontWeight: "bold", fontSize: 13 }}>
          ⬡ {active.component}
        </div>
        <div style={{ color: "#555", fontSize: 11 }}>{active.file}</div>
      </div>

      {loading && (
        <div style={{ color: "#555", fontSize: 11 }}>Loading blame…</div>
      )}

      {!loading && blame && (
        <>
          {/* Last commit */}
          <div
            style={{
              borderTop: "1px solid #2a2a3e",
              paddingTop: 8,
              marginBottom: 8,
            }}
          >
            <div style={{ color: "#c8c8c8", marginBottom: 2 }}>
              "{blame.latestCommit}"
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#666" }}>
                {blame.latestAuthor} · {blame.latestDate}
              </div>
              <span
                style={{
                  color: "#7ec8e3",
                  background: "#1a1a2e",
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontSize: 11,
                  letterSpacing: "0.04em",
                }}
              >
                {blame.commitHash}
              </span>
            </div>
            {blame.latestEmail && (
              <div style={{ color: "#444", fontSize: 11, marginTop: 2 }}>
                {blame.latestEmail}
              </div>
            )}
          </div>

          {/* Total commits */}
          <div
            style={{
              borderTop: "1px solid #2a2a3e",
              paddingTop: 6,
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              color: "#555",
              fontSize: 11,
            }}
          >
            <span>Total commits</span>
            <span style={{ color: "#7ec8e3" }}>{blame.totalCommits}</span>
          </div>

          {/* Contributors */}
          {blame.contributors.length > 0 && (
            <div style={{ borderTop: "1px solid #2a2a3e", paddingTop: 8 }}>
              <div style={{ color: "#444", fontSize: 11, marginBottom: 4 }}>
                CONTRIBUTORS
              </div>
              {blame.contributors.slice(0, 3).map((c) => (
                <div
                  key={c.author}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    color: "#999",
                  }}
                >
                  <span>{c.author}</span>
                  <span style={{ color: "#555" }}>{c.commits}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Pin hint */}
      <div
        style={{
          borderTop: "1px solid #2a2a3e",
          marginTop: 8,
          paddingTop: 6,
          color: pinned ? "#f0b429" : "#333",
          fontSize: 10,
          textAlign: "center",
        }}
      >
        {pinned ? "📌 pinned — select to copy" : "hold ⌥ Alt to pin & copy"}
      </div>
    </div>
  );
}