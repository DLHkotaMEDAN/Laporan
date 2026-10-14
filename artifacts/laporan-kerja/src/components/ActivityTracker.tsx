import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auditLogService } from "@/services/auditLogService";

const ActivityTracker = () => {
  const location = useLocation();
  const { session, profile } = useAuth();
  const lastPath = useRef<string | null>(null);
  const lastInteraction = useRef<{ key: string; time: number }>({ key: '', time: 0 });

  useEffect(() => {
    if (!session?.user || !profile || location.pathname === '/login') return;
    const path = `${location.pathname}${location.search}`;
    if (lastPath.current === path) return;
    lastPath.current = path;
    void auditLogService.logAction({
      action: 'VIEW',
      entityType: 'PAGE',
      details: {
        path,
        title: document.title || path,
        referrer: document.referrer || null,
      },
      userId: session.user.id,
      username: profile.username || session.user.email,
      userEmail: session.user.email,
      role: (profile.roles ?? []).join(',') || profile.role,
    });
  }, [location.pathname, location.search, profile, session]);

  useEffect(() => {
    if (!session?.user || !profile || location.pathname === '/login') return;

    const handleInteraction = (event: MouseEvent) => {
      const rawTarget = event.target as HTMLElement | null;
      const target = rawTarget?.closest<HTMLElement>('button, a, [role="button"], [role="menuitem"]');
      if (!target || target.closest('[data-audit-ignore="true"]')) return;

      const label = (target.innerText || target.getAttribute('aria-label') || target.getAttribute('title') || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
      if (!label) return;

      const key = `${location.pathname}|${label}`;
      const now = Date.now();
      if (lastInteraction.current.key === key && now - lastInteraction.current.time < 800) return;
      lastInteraction.current = { key, time: now };

      const normalized = label.toLowerCase();
      // Hanya catat aksi yang bernilai forensik: cetak dan export.
      // Klik biasa (INTERACT) tidak dicatat — volume tinggi tanpa nilai investigasi.
      const action = /cetak|print/.test(normalized)
        ? 'PRINT'
        : /export|excel|pdf|download|unduh/.test(normalized)
          ? 'EXPORT'
          : null;

      if (!action) return;

      void auditLogService.logAction({
        action,
        entityType: 'UI',
        details: {
          path: `${location.pathname}${location.search}`,
          target: label,
          element: target.tagName.toLowerCase(),
          href: target.getAttribute('href'),
        },
        userId: session.user.id,
        username: profile.username || session.user.email,
        userEmail: session.user.email,
        role: (profile.roles ?? []).join(',') || profile.role,
      });
    };

    document.addEventListener('click', handleInteraction, true);
    return () => document.removeEventListener('click', handleInteraction, true);
  }, [location.pathname, location.search, profile, session]);

  return null;
};

export default ActivityTracker;
