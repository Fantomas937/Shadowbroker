'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bot,
  Network,
  KeyRound,
  Shield,
  Plane,
  Bug,
  Heart,
  MessageSquare,
  Radar,
  Factory,
  Anchor,
  Search,
} from 'lucide-react';

const CURRENT_VERSION = '0.9.82';
const STORAGE_KEY = `shadowbroker_changelog_v${CURRENT_VERSION}`;
const RELEASE_TITLE = 'Telegram OSINT + Osiris Intel Ports + OpenClaw Recon';

const HEADLINE_FEATURES = [
  {
    icon: <MessageSquare size={20} className="text-cyan-400" />,
    accent: 'cyan' as const,
    title: 'Telegram OSINT Map Layer',
    subtitle:
      'Public war/conflict Telegram channels scraped hourly, risk-scored, geoparsed to metro anchors, and plotted as clickable map pins with inline photo/video.',
    details: [
      'Incremental merge — only new posts are fetched; known links stop the parser early so channels are not re-scraped redundantly.',
      'Metro-anchor geocoding (Tel Aviv, Kyiv, NYC, Beijing, etc.) keeps Telegram pins off news/threat-alert centroids so pins stay clickable above the threat intercept overlays.',
      'Threat-intercept styled popups with inline media via `/api/telegram/media` proxy. Configure channels via `TELEGRAM_OSINT_CHANNELS` (see `.env.example`).',
    ],
    callToAction: 'TOGGLE TELEGRAM OSINT IN DATA LAYERS',
  },
  {
    icon: <Radar size={20} className="text-purple-400" />,
    accent: 'purple' as const,
    title: 'Osiris-Derived Intel Ports (Recon, SCM, Entity Graph)',
    subtitle:
      'Server-side recon toolkit, supply-chain risk overlay, entity relationship graphs, malware/C2 hotspots, CISA KEV cyber feed, sanctions index, and submarine cable routes — all SSRF-guarded and local-operator proxied.',
    details: [
      'Recon Toolkit panel: IP geolocation, DNS, WHOIS, certs, BGP/ASN, OFAC sanctions, CVE, MAC vendor, GitHub profile, breach checks, and InternetDB subnet sweeps.',
      'SCM panel cross-references Tier 1/2 fabs (TSMC, Samsung, CATL, etc.) against earthquakes, wildfires, and GDELT conflict proximity.',
      'Entity Graph expands aircraft, vessels, companies, persons, IPs, and countries via Wikidata + OFAC + live telemetry store. Attribution: `backend/third_party/osiris/NOTICE.md`.',
      'Malware C2 (abuse.ch Feodo + URLhaus) and Cyber Threats (CISA KEV) layers opt-in on the slow tier. Submarine cables overlay from static TeleGeography-derived GeoJSON.',
    ],
    callToAction: 'OPEN RECON • SCM • ENTITY GRAPH IN LEFT SIDEBAR',
  },
  {
    icon: <Bot size={20} className="text-amber-400" />,
    accent: 'cyan' as const,
    title: 'OpenClaw Agent — Full Telemetry + Recon Parity',
    subtitle:
      'AI agents on the HMAC command channel now search, slice, and investigate the same data the operator sees — including Telegram, malware, cyber, SCM, and the full recon toolkit.',
    details: [
      '`search_telemetry` and `search_news` index Telegram OSINT posts alongside news, GDELT, and CrowdThreat. `get_slow_telemetry` and `get_layer_slice` include `telegram_osint`, `malware_threats`, `cyber_threats`, and `scm_suppliers`.',
      'New commands: `osint_lookup` (IP/DNS/WHOIS/sanctions/CVE/etc.), `entity_expand` (relationship graph), `osint_tools` (discovery), and `osint_sweep` (subnet scan — full access tier).',
      'Layer aliases: `telegram`, `malware`/`botnet`, `cyber`/`cisa`/`kev`, `scm`/`suppliers`, `gfw`/`fishing`. Skill package: `openclaw-skills/shadowbroker/SKILL.md`.',
    ],
    callToAction: 'AI INTEL PANEL → CONNECT AGENT → COPY HMAC SECRET',
  },
];

const NEW_FEATURES = [
  {
    icon: <Anchor size={18} className="text-cyan-400" />,
    title: 'Global Fishing Watch in Settings',
    desc: 'GFW API token exposed in onboarding and Settings → Maritime. Fishing activity layer backed by GFW when `GFW_API_TOKEN` is configured.',
  },
  {
    icon: <Factory size={18} className="text-orange-400" />,
    title: 'Supply-Chain Risk Map Layer',
    desc: 'SCM suppliers render as map markers with seismic, wildfire, and conflict proximity scoring. Panel alerts for CRITICAL/HIGH fabs.',
  },
  {
    icon: <Shield size={18} className="text-red-400" />,
    title: 'Malware C2 + CISA KEV Overlays',
    desc: 'abuse.ch botnet C2 and URLhaus distribution URLs geolocated by country; CISA Known Exploited Vulnerabilities surfaced in cyber threats feed and slow-tier payload.',
  },
  {
    icon: <Search size={18} className="text-green-400" />,
    title: 'OpenClaw Compact Search Path',
    desc: 'Agents prefer `get_summary` → SSE `layer_changed` → `get_layer_slice` with per-layer versions. `brief_area`, `correlate_entity`, and `entities_near` include Telegram and malware context.',
  },
  {
    icon: <Network size={18} className="text-purple-400" />,
    title: 'Submarine Cable Overlay',
    desc: 'Opt-in undersea cable routes from static TeleGeography-derived GeoJSON for infrastructure context on the map.',
  },
];

const BUG_FIXES = [
  'Telegram map pins are now HTML markers above threat-alert overlays — pins are clickable even when sharing a city grid with news intercept boxes.',
  'Telegram geocoding uses metro anchors (not national centroids) and a small NE offset only when news alerts share the same city cell — pins stay on land.',
  'Hourly Telegram scheduler with incremental post merge — no redundant full-channel re-scrape every cycle.',
  'OpenClaw `get_slow_telemetry` previously omitted telegram_osint, malware_threats, cyber_threats, and scm_suppliers — now included in slow-tier and universal search.',
  'OpenClaw agents can invoke the Recon panel backends via `osint_lookup` without raw `/api/osint/*` HTTP calls or local-operator browser auth.',
];

type ChangelogContributor = {
  name: string;
  desc: string;
  pr?: string;
};

const CONTRIBUTORS: ChangelogContributor[] = [
  {
    name: 'OSIRIS (simplifaisoul/osiris)',
    desc: 'MIT-licensed recon stack — adapted for ShadowBroker proxy model (see backend/third_party/osiris/NOTICE.md)',
  },
];

export function useChangelog() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setShow(true);
  }, []);
  return { showChangelog: show, setShowChangelog: setShow };
}

interface ChangelogModalProps {
  onClose: () => void;
}

const ChangelogModal = React.memo(function ChangelogModal({ onClose }: ChangelogModalProps) {
  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="changelog-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000]"
        onClick={handleDismiss}
      />
      <motion.div
        key="changelog-modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-none"
      >
        <div
          className="w-[700px] max-h-[90vh] bg-[var(--bg-secondary)]/98 border border-cyan-900/50 pointer-events-auto flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 pb-3 border-b border-[var(--border-primary)]/80">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="px-2.5 py-1 bg-cyan-500/15 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-400 tracking-widest">
                    v{CURRENT_VERSION}
                  </div>
                  <h2 className="text-base font-bold tracking-[0.15em] text-[var(--text-primary)] font-mono">
                    WHAT&apos;S NEW
                  </h2>
                </div>
                <p className="text-[11px] text-cyan-500/70 font-mono tracking-widest mt-1">
                  {RELEASE_TITLE.toUpperCase()}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="w-8 h-8 border border-[var(--border-primary)] hover:border-red-500/50 flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition-all hover:bg-red-950/20"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto styled-scrollbar p-5 space-y-5">
            {HEADLINE_FEATURES.map((h, idx) => {
              const isPurple = h.accent === 'purple';
              const cardClass = isPurple
                ? 'border border-purple-500/30 bg-purple-950/20 p-4 space-y-3'
                : 'border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3';
              const iconWrapClass = isPurple
                ? 'w-9 h-9 border border-purple-500/40 bg-purple-500/10 flex items-center justify-center flex-shrink-0'
                : 'w-9 h-9 border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center flex-shrink-0';
              const titleClass = isPurple
                ? 'text-sm font-mono text-purple-300 font-bold tracking-wide'
                : 'text-sm font-mono text-cyan-300 font-bold tracking-wide';
              const subtitleClass = isPurple
                ? 'text-xs font-mono text-purple-500/80 mt-0.5'
                : 'text-xs font-mono text-cyan-500/80 mt-0.5';
              const ctaClass = isPurple
                ? 'text-[11px] font-mono text-purple-400 tracking-[0.25em] font-bold'
                : 'text-[11px] font-mono text-cyan-400 tracking-[0.25em] font-bold';

              return (
                <div key={idx} className={cardClass}>
                  <div className="flex items-center gap-3">
                    <div className={iconWrapClass}>{h.icon}</div>
                    <div>
                      <div className={titleClass}>{h.title}</div>
                      <div className={subtitleClass}>{h.subtitle}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {h.details.map((para, i) => (
                      <p
                        key={i}
                        className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed"
                      >
                        {para}
                      </p>
                    ))}
                  </div>

                  <div className="text-center pt-1">
                    <span className={ctaClass}>{h.callToAction}</span>
                  </div>
                </div>
              );
            })}

            {/* Auto-update note for v0.9.81+ installs */}
            <div className="border border-green-500/30 bg-green-950/15 p-3 flex items-start gap-3">
              <KeyRound size={18} className="text-green-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <div className="text-xs font-mono text-green-300 font-bold tracking-wide uppercase">
                  One-click update from v0.9.81
                </div>
                <div className="text-xs font-mono text-green-200/80 leading-relaxed">
                  If you installed v0.9.81, the in-app Update button verifies this release via the
                  signed Tauri updater (`latest.json` + minisign). Desktop installs on v0.9.81 or
                  later should auto-apply v0.9.82 without a manual MSI hop.
                </div>
              </div>
            </div>

            {/* Required-config callout: OpenSky API */}
            <div className="border border-amber-500/40 bg-amber-950/20 p-3 flex items-start gap-3">
              <Plane size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <div className="text-xs font-mono text-amber-300 font-bold tracking-wide uppercase">
                  Required: OpenSky API credentials for airplane telemetry
                </div>
                <div className="text-xs font-mono text-amber-200/80 leading-relaxed">
                  Set <span className="text-amber-100 font-bold">OPENSKY_CLIENT_ID</span> and{' '}
                  <span className="text-amber-100 font-bold">OPENSKY_CLIENT_SECRET</span> in your{' '}
                  <span className="text-amber-100 font-bold">.env</span>. Free registration:{' '}
                  <a
                    href="https://opensky-network.org/index.php?option=com_users&view=registration"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-100 font-bold underline underline-offset-2 hover:text-amber-50"
                  >
                    opensky-network.org/register
                  </a>
                  .
                </div>
              </div>
            </div>

            {/* Other New Features */}
            <div>
              <div className="text-xs font-mono tracking-[0.2em] text-cyan-400 font-bold mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                NEW CAPABILITIES
              </div>
              <div className="space-y-2">
                {NEW_FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className="flex items-start gap-3 p-3 border border-[var(--border-primary)]/50 bg-[var(--bg-primary)]/30 hover:border-[var(--border-secondary)] transition-colors"
                  >
                    <div className="mt-0.5 flex-shrink-0">{f.icon}</div>
                    <div>
                      <div className="text-[13px] font-mono text-[var(--text-primary)] font-bold">
                        {f.title}
                      </div>
                      <div className="text-xs font-mono text-[var(--text-muted)] leading-relaxed mt-0.5">
                        {f.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bug Fixes */}
            <div>
              <div className="text-xs font-mono tracking-[0.2em] text-green-400 font-bold mb-3 flex items-center gap-2">
                <Bug size={14} className="text-green-400" />
                FIXES &amp; IMPROVEMENTS
              </div>
              <div className="space-y-1.5">
                {BUG_FIXES.map((fix, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5">
                    <span className="text-green-500 text-xs mt-0.5 flex-shrink-0">+</span>
                    <span className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed">
                      {fix}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contributors */}
            <div>
              <div className="text-xs font-mono tracking-[0.2em] text-pink-400 font-bold mb-3 flex items-center gap-2">
                <Heart size={14} className="text-pink-400" />
                CREDITS &amp; CONTRIBUTORS
              </div>
              <div className="space-y-1.5">
                {CONTRIBUTORS.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-3 py-2 border border-pink-500/20 bg-pink-500/5"
                  >
                    <span className="text-pink-400 text-xs mt-0.5 flex-shrink-0">&hearts;</span>
                    <div>
                      <span className="text-[13px] font-mono text-pink-300 font-bold">
                        {c.name}
                      </span>
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        {' '}
                        &mdash; {c.desc}
                      </span>
                      {c.pr && (
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">
                          {' '}
                          (PR {c.pr})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border-primary)]/80 flex items-center justify-center">
            <button
              onClick={handleDismiss}
              className="px-8 py-2.5 bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/25 text-xs font-mono tracking-[0.2em] transition-all"
            >
              ACKNOWLEDGED
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

export default ChangelogModal;
