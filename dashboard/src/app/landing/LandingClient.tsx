'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Poppins, JetBrains_Mono } from 'next/font/google';
import styles from './landing.module.css';

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-poppins' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

const TERMINAL_LINES = [
  { text: '$ git push origin main',                        cls: 'termPrompt' },
  { text: 'Enumerating objects: 5, done.',                 cls: 'termMuted'  },
  { text: 'Writing objects: 100% (3/3), done.',            cls: 'termMuted'  },
  { text: '',                                              cls: ''           },
  { text: 'VersionGate ▸ webhook received [nithin]',       cls: 'termInfo'   },
  { text: 'VersionGate ▸ pulling source...          ✓',    cls: 'termOk'     },
  { text: 'VersionGate ▸ building image...          ✓',    cls: 'termOk'     },
  { text: 'VersionGate ▸ starting nithin-green...   ✓',   cls: 'termOk'     },
  { text: 'VersionGate ▸ switching traffic → :3101  ✓',   cls: 'termOk'     },
  { text: 'VersionGate ▸ stopping nithin-blue...    ✓',   cls: 'termOk'     },
  { text: '',                                              cls: ''           },
  { text: 'nithin-green is live on :3101  [v2 · ACTIVE]', cls: 'termPrompt' },
] as const;

const CODE = {
  clone:     `git clone https://github.com/dinexh/VersionGate\ncd VersionGate\nbun install`,
  env:       `# Required\nDATABASE_URL=postgresql://user:pass@host/db\n\n# Optional\nPORT=9090\nDOCKER_NETWORK=bridge\nNGINX_CONFIG_PATH=/etc/nginx/conf.d/upstream.conf\nPROJECTS_ROOT_PATH=/var/versiongate/projects\nGEMINI_API_KEY=           # for AI pipeline generation`,
  prisma:    `bunx prisma db push`,
  dashboard: `cd dashboard && bun install && bun run build && cd ..`,
  devStart:  `bun --watch src/server.ts`,
  prodStart: `pm2 start ecosystem.config.cjs\npm2 save                 # persist across reboots`,
  deploy:    `# Create project\ncurl -X POST http://localhost:9090/api/v1/projects \\\n  -H 'Content-Type: application/json' \\\n  -d '{ "name": "myapp", "repoUrl": "https://github.com/you/myapp", "branch": "main", "appPort": 3000 }'\n\n# Trigger first deploy\ncurl -X POST http://localhost:9090/api/v1/deploy \\\n  -H 'Content-Type: application/json' \\\n  -d '{ "projectId": "<id>" }'`,
};

type Tab = 'deploy' | 'bluegreen' | 'rollback';
type SimState = 'blue-live' | 'green-live';

export default function LandingClient() {
  const [termLines, setTermLines] = useState<{ text: string; cls: string }[]>([]);
  const liRef = useRef(0);
  const ciRef = useRef(0);

  const [activeTab, setActiveTab]   = useState<Tab>('deploy');
  const [activeStep, setActiveStep] = useState(0);

  const [simState, setSimState]   = useState<SimState>('blue-live');
  const [simRunning, setSimRunning] = useState(false);
  const [simLog, setSimLog]       = useState<{ text: string; color: string }[]>([]);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── Terminal typewriter ──────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const li = liRef.current;
    const ci = ciRef.current;
    if (li >= TERMINAL_LINES.length) return;

    const { text, cls } = TERMINAL_LINES[li];

    if (ci < text.length) {
      const sliced = text.slice(0, ci + 1);
      setTermLines(prev => {
        const next = [...prev];
        if (next.length <= li) next.push({ text: sliced, cls });
        else next[li] = { text: sliced, cls };
        return next;
      });
      ciRef.current = ci + 1;
      const delay = text.startsWith('VersionGate') ? 18 : text.startsWith('$') ? 55 : 12;
      setTimeout(tick, delay);
    } else {
      if (text === '') {
        setTermLines(prev => {
          const next = [...prev];
          if (next.length <= li) next.push({ text: '', cls: '' });
          return next;
        });
      }
      liRef.current = li + 1;
      ciRef.current = 0;
      const delay = text === '' ? 80 : text.startsWith('$') ? 300 : text.startsWith('VersionGate') ? 220 : 60;
      setTimeout(tick, delay);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, [tick]);

  // ── Scroll reveal ────────────────────────────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(styles.visible);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll(`.${styles.reveal}`).forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // ── Smooth scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = ''; };
  }, []);

  const replayTerminal = () => {
    liRef.current = 0;
    ciRef.current = 0;
    setTermLines([]);
    setTimeout(tick, 300);
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  // ── Blue-green simulation ────────────────────────────────────────────────────
  const simulateDeploy = async () => {
    if (simRunning) return;
    setSimRunning(true);
    setSimLog([]);
    const next = simState === 'blue-live' ? 'green' : 'blue';
    const port = next === 'green' ? ':3101' : ':3100';
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    const addLog = (text: string, color: string) => setSimLog(prev => [...prev, { text, color }]);

    addLog('▸ deploy triggered', '#a1a1a1');                await wait(600);
    addLog('▸ pulling source from GitHub...', '#a1a1a1');   await wait(700);
    addLog('▸ building image...', '#a1a1a1');               await wait(900);
    addLog(`▸ starting myapp-${next} on ${port}`, '#a1a1a1'); await wait(500);
    setSimState(next === 'green' ? 'green-live' : 'blue-live');
    await wait(300);
    addLog(`✓ traffic → myapp-${next} ${port}`, '#818cf8'); await wait(300);
    addLog(`✓ myapp-${next === 'green' ? 'blue' : 'green'} stopped`, '#818cf8'); await wait(200);
    addLog(`✓ deploy complete — v${next === 'green' ? 2 : 3} active`, '#818cf8');
    setSimRunning(false);
  };

  const resetSim = () => {
    if (simRunning) return;
    setSimState('blue-live');
    setSimLog([]);
  };

  const blueLive = simState === 'blue-live';

  // ── Helper sub-components ────────────────────────────────────────────────────
  const Dots = () => (
    <>
      <div className={`${styles.dot} ${styles.dotRed}`} />
      <div className={`${styles.dot} ${styles.dotYellow}`} />
      <div className={`${styles.dot} ${styles.dotGreen}`} />
    </>
  );

  const CopyBtn = ({ codeKey, text }: { codeKey: string; text: string }) => (
    <button
      className={`${styles.copyBtn} ${copiedKey === codeKey ? styles.copyBtnCopied : ''}`}
      onClick={() => handleCopy(codeKey, text)}
    >
      {copiedKey === codeKey ? 'copied!' : 'copy'}
    </button>
  );

  const termClsMap: Record<string, string> = {
    termPrompt: styles.termPrompt,
    termOk:     styles.termOk,
    termInfo:   styles.termInfo,
    termMuted:  styles.termMuted,
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={`${styles.page} ${poppins.variable} ${mono.variable}`}>

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <a href="#" className={styles.navLogo}>
          VersionGate Engine
        </a>
        <ul className={styles.navLinks}>
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#setup">Setup</a></li>
        </ul>
        <a href="https://github.com/dinexh/VersionGate" target="_blank" rel="noreferrer" className={styles.navGh}>
          GitHub ↗
        </a>
      </nav>

      {/* ── HERO ── */}
      <div className={styles.hero}>
        <div className={styles.badge}>v1.0 — Self-hosted</div>
        <h1 className={styles.h1}>Deploy with <em>zero downtime.</em><br />Own your infra.</h1>
        <p className={styles.heroSub}>
          VersionGate is a self-hosted deployment engine that runs blue-green Docker deployments on your own server.
          Push to GitHub — VersionGate pulls the source, builds the image, starts the container,
          switches Nginx traffic, and tears down the old one. No downtime. No cloud lock-in.
        </p>
        <div className={styles.heroActions}>
          <a href="#setup" className={styles.btnPrimary}>Get started →</a>
          <a href="https://github.com/dinexh/VersionGate" className={styles.btnGhost} target="_blank" rel="noreferrer">View on GitHub</a>
        </div>

        <div className={styles.terminal}>
          <div className={styles.terminalBar}>
            <Dots />
            <span className={styles.terminalTitle}>versiongate — deploy log</span>
            <button className={styles.replayBtn} onClick={replayTerminal}>replay</button>
          </div>
          <div className={styles.terminalBody}>
            {termLines.map((line, i) => (
              <div
                key={i}
                className={`${styles.termLine} ${styles.visible} ${termClsMap[line.cls] ?? ''}`}
              >
                {line.text}
              </div>
            ))}
            <span className={styles.cursor} />
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <div className={styles.statNum}>0<span>s</span></div>
          <div className={styles.statLabel}>downtime per deploy</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>2</div>
          <div className={styles.statLabel}>live container slots (blue / green)</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>1<span>-click</span></div>
          <div className={styles.statLabel}>rollback to previous deployment</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>∞</div>
          <div className={styles.statLabel}>projects on a single server</div>
        </div>
      </div>

      {/* ── DASHBOARD PREVIEW ── */}
      <div className={`${styles.previewSection} ${styles.reveal}`}>
        <p className={styles.sectionLabel}>// dashboard</p>
        <h2 className={styles.h2} style={{ marginBottom: 32 }}>Everything in one view.</h2>
        <div className={styles.mockBrowser}>
          <div className={styles.mockBar}>
            <Dots />
            <span className={styles.mockUrl}>localhost:9090</span>
          </div>
          <div className={styles.mockBody}>
            <div className={styles.mockSidebar}>
              <div className={styles.mockLogo}>
                <span className={styles.mockLogoText}>VersionGate</span>
              </div>
              <div className={`${styles.mockNavItem} ${styles.mockNavItemActive}`}>◈ &nbsp;Overview</div>
              <div className={styles.mockNavItem}>⟳ &nbsp;Deployments</div>
              <div className={styles.mockNavItem}>▣ &nbsp;Server</div>
              <div className={styles.mockFooterBar}>
                <div className={styles.mockOnlineDot} />
                <span className={styles.mockOnlineTxt}>Engine online</span>
              </div>
            </div>
            <div className={styles.mockMain}>
              <div className={styles.mockStatsRow}>
                {[
                  { num: '4', label: 'Projects',  color: '#ededed' },
                  { num: '4', label: 'Running',   color: '#818cf8' },
                  { num: '0', label: 'Failed',    color: '#52525b' },
                  { num: '0', label: 'Deploying', color: '#52525b' },
                ].map(({ num, label, color }) => (
                  <div key={label} className={styles.mockStatCard}>
                    <div className={styles.mockStatNum} style={{ color }}>{num}</div>
                    <div className={styles.mockStatLabel}>{label}</div>
                  </div>
                ))}
              </div>
              <div className={styles.mockProjects}>
                <div className={styles.mockProjHeader}>
                  <span>Projects <span style={{ color: 'var(--muted)', fontWeight: 400 }}>4</span></span>
                  <span style={{ color: 'var(--muted)', fontSize: 10, border: '1px solid var(--border2)', padding: '2px 8px', borderRadius: 4 }}>+ New</span>
                </div>
                {[
                  { initials: 'SP', name: 'speedtype', repo: 'nithin2k5/speedtyper.git', ver: 'v2 · 1h ago' },
                  { initials: 'NI', name: 'nithin',    repo: 'nithin2k5/Portfolio',       ver: 'v3 · 2h ago' },
                  { initials: 'MO', name: 'monix',     repo: 'dinexh/monix.git',          ver: 'v4 · 3h ago' },
                ].map(p => (
                  <div key={p.name} className={styles.mockProjRow}>
                    <div className={styles.mockAvatar}>{p.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={styles.mockProjName}>{p.name}</div>
                      <div className={styles.mockProjSub}>{p.repo}</div>
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--muted)', marginRight: 8 }}>{p.ver}</span>
                    <span className={`${styles.mockBadge} ${styles.mockBadgeGreen}`}>ACTIVE</span>
                    <div className={styles.mockPulse} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className={`${styles.section} ${styles.reveal}`}>
        <p className={styles.sectionLabel}>// how it works</p>
        <h2 className={styles.h2}>Push. Build. Switch. Done.</h2>
        <p className={styles.sectionSub}>Every deploy targets the idle container slot. The live app is never touched until the new one is healthy.</p>

        <div className={styles.flowWrap}>
          <div className={styles.flowTabs}>
            {(['deploy', 'bluegreen', 'rollback'] as Tab[]).map((tab, i) => (
              <div
                key={tab}
                className={`${styles.flowTab} ${activeTab === tab ? styles.active : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {['Deploy pipeline', 'Blue / Green', 'Rollback'][i]}
              </div>
            ))}
          </div>

          {/* Deploy pipeline */}
          <div className={`${styles.flowPanel} ${activeTab === 'deploy' ? styles.active : ''}`}>
            <div className={styles.deploySteps}>
              {[
                { title: 'Acquire lock',    desc: 'Per-project in-memory lock prevents concurrent deploys on the same project. Other projects deploy in parallel.',                                                                          code: 'DeploymentService.locks.set(projectId, true)' },
                { title: 'Pull source',     desc: 'Git clone or fetch + reset to branch HEAD. Auto-generates a Dockerfile if one isn\'t present (detects Node, Bun, Python).',                                                              code: 'git fetch origin && git reset --hard origin/main' },
                { title: 'Build image',     desc: 'Runs docker build with the project\'s build context. Full stdout/stderr captured — build errors surface directly in the dashboard.',                                                      code: 'docker build -t versiongate-myapp:1740000000 ./myapp' },
                { title: 'Start container', desc: 'Pre-cleans stale containers by name and frees the target port before starting. Injects project env vars.',                                                                              code: 'docker run -d --name myapp-green -p 3101:3000 versiongate-myapp:...' },
                { title: 'Switch traffic',  desc: 'Rewrites the Nginx upstream config to point to the new container\'s port. Reloads Nginx with zero dropped connections.',                                                                code: 'nginx -s reload  # upstream localhost:3101' },
                { title: 'Retire old slot', desc: 'Previous ACTIVE deployment is stopped, removed, and marked ROLLED_BACK — ready for the next rollback.',                                                                                code: 'docker stop myapp-blue && docker rm myapp-blue' },
              ].map((step, i) => (
                <div
                  key={i}
                  className={`${styles.deployStep} ${activeStep === i ? styles.active : ''}`}
                  onClick={() => setActiveStep(i)}
                >
                  <div className={styles.stepNum}>{i + 1}</div>
                  <div className={styles.stepContent}>
                    <div className={styles.stepTitle}>{step.title}</div>
                    <div className={styles.stepDesc}>{step.desc}</div>
                    <div className={styles.stepCode}>{step.code}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Blue-green */}
          <div className={`${styles.flowPanel} ${activeTab === 'bluegreen' ? styles.active : ''}`}>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.7 }}>
              Each project has two container slots — <span style={{ color: '#3b82f6', fontWeight: 600 }}>BLUE</span> on{' '}
              <code>basePort</code> and <span style={{ color: '#818cf8', fontWeight: 600 }}>GREEN</span> on{' '}
              <code>basePort+1</code>. One is always live. Every deploy targets the idle one. Click the buttons to simulate.
            </p>
            <div className={styles.bgViz}>
              <div className={`${styles.bgSlot} ${blueLive ? styles.bgSlotBlueLive : ''}`}>
                <div className={styles.slotHeader}>
                  <span className={`${styles.slotName} ${styles.slotNameBlue}`}>BLUE</span>
                  <span className={`${styles.livePill} ${styles.livePillBlue} ${blueLive ? styles.livePillShow : ''}`}>LIVE</span>
                </div>
                <div className={styles.slotRow}><span>port</span><span className={styles.slotRowVal}>:3100</span></div>
                <div className={styles.slotRow}><span>container</span><span className={styles.slotRowVal}>myapp-blue</span></div>
                <div className={styles.slotRow}><span>status</span><span className={styles.slotRowVal}>{blueLive ? 'ACTIVE' : 'ROLLED_BACK'}</span></div>
              </div>
              <div className={`${styles.bgSlot} ${!blueLive ? styles.bgSlotGreenLive : ''}`}>
                <div className={styles.slotHeader}>
                  <span className={`${styles.slotName} ${styles.slotNameGreen}`}>GREEN</span>
                  <span className={`${styles.livePill} ${styles.livePillGreen} ${!blueLive ? styles.livePillShow : ''}`}>LIVE</span>
                </div>
                <div className={styles.slotRow}><span>port</span><span className={styles.slotRowVal}>:3101</span></div>
                <div className={styles.slotRow}><span>container</span><span className={styles.slotRowVal}>myapp-green</span></div>
                <div className={styles.slotRow}><span>status</span><span className={styles.slotRowVal}>{!blueLive ? 'ACTIVE' : 'idle'}</span></div>
              </div>
            </div>
            <div className={styles.trafficArrow}>
              nginx upstream →{' '}
              <span className={styles.trafficTo} style={{ color: blueLive ? '#3b82f6' : '#818cf8' }}>
                localhost:{blueLive ? '3100 (blue)' : '3101 (green)'}
              </span>
            </div>
            <div className={styles.bgControls}>
              <button className={styles.btnPrimary} onClick={simulateDeploy} disabled={simRunning}>
                {simRunning ? '...' : '▸ Simulate deploy'}
              </button>
              <button className={styles.btnGhost} onClick={resetSim}>Reset</button>
            </div>
            {simLog.length > 0 && (
              <div style={{ marginTop: 16, fontFamily: 'var(--font-mono, monospace)', fontSize: 12, lineHeight: 2, color: 'var(--muted)' }}>
                {simLog.map((l, i) => (
                  <div key={i} style={{ color: l.color }}>{l.text}</div>
                ))}
              </div>
            )}
          </div>

          {/* Rollback */}
          <div className={`${styles.flowPanel} ${activeTab === 'rollback' ? styles.active : ''}`}>
            <div className={styles.deploySteps}>
              {[
                { title: 'Find previous deployment', desc: 'Queries the most recent deployment with status ROLLED_BACK and a lower version number than current.', code: null },
                { title: 'Re-run old container', desc: 'Starts the previous image on its original port. If the image was pruned, rollback is aborted safely — the current deployment stays live.', code: 'docker run -d --name myapp-blue -p 3100:3000 versiongate-myapp:prev' },
                { title: 'Verify health', desc: 'Health check runs before switching traffic. If it fails, the restarted container is cleaned up and the current deployment stays active.', code: null },
                { title: 'Switch traffic & swap statuses', desc: 'Nginx is reloaded to the old container. The old deployment becomes ACTIVE, the current one becomes ROLLED_BACK.', code: null },
              ].map((step, i) => (
                <div key={i} className={`${styles.deployStep} ${i === 0 ? styles.active : ''}`}>
                  <div className={styles.stepNum}>{i + 1}</div>
                  <div className={styles.stepContent}>
                    <div className={styles.stepTitle}>{step.title}</div>
                    <div className={styles.stepDesc}>{step.desc}</div>
                    {step.code && <div className={styles.stepCode}>{step.code}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className={styles.fullDivider} />

      {/* ── FEATURES ── */}
      <section id="features" className={`${styles.section} ${styles.reveal}`}>
        <p className={styles.sectionLabel}>// features</p>
        <h2 className={styles.h2}>Everything you need.<br />Nothing you don&apos;t.</h2>
        <p className={styles.sectionSub}>Built for real deployments on real hardware, not abstract cloud primitives.</p>
        <div className={styles.features}>
          {[
            { icon: '⬡', title: 'Blue-green deployments',  desc: 'Two container slots per project. Traffic switches in milliseconds via Nginx upstream reload. Zero dropped connections.' },
            { icon: '⎇', title: 'Git-native workflow',      desc: 'Webhook triggers on push. VersionGate clones or fetches your repo, checks out the configured branch, and deploys.' },
            { icon: '⟳', title: 'One-click rollback',       desc: 'Every previous deployment is stored. Roll back to any ROLLED_BACK version instantly — health-checked before traffic switches.' },
            { icon: '✕', title: 'Cancel mid-deploy',        desc: 'Stuck on a long build? Hit Stop. The pipeline is interrupted at the next checkpoint, the container stopped, and the lock released.' },
            { icon: '📄', title: 'Auto Dockerfile',          desc: 'No Dockerfile? VersionGate generates one — detects Node.js, Bun, Python. Scans subdirectories. Regenerated each deploy, never overwrites yours.' },
            { icon: '⚡', title: 'Crash recovery',           desc: 'On startup, reconciliation scans for DEPLOYING records (process died mid-deploy), marks them FAILED, and cleans up orphaned containers.' },
            { icon: '⚙',  title: 'Per-project env vars',    desc: 'Inject environment variables per project via the dashboard. Applied to the next deploy — no restart required.' },
            { icon: '◈',  title: 'Server monitoring',        desc: 'Live CPU, memory, disk, and network stats for the host server. Per-container metrics polled in real-time from the dashboard.' },
            { icon: '✦',  title: 'Automatic CI pipeline',   desc: 'AI-generates a production GitHub Actions workflow for your project — detects runtime, caches deps, runs build & test, then fires the VersionGate webhook.' },
          ].map(f => (
            <div key={f.title} className={styles.feature}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <div className={styles.featureTitle}>{f.title}</div>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className={styles.fullDivider} />

      {/* ── COMPARISON ── */}
      <section id="compare" className={`${styles.section} ${styles.reveal}`}>
        <p className={styles.sectionLabel}>// why versiongate</p>
        <h2 className={styles.h2}>Simple, self-hosted, yours.</h2>
        <p className={styles.sectionSub}>No vendor lock-in. No monthly bill for a deployment tool. Just your server, running your code.</p>
        <table className={styles.compareTable}>
          <thead>
            <tr>
              <th>Feature</th>
              <th className={styles.thHl}>VersionGate</th>
              <th>Heroku / Render</th>
              <th>Kubernetes</th>
              <th>Raw Docker</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Zero-downtime deploys', 'y', 'y', 'y', 'n'],
              ['Self-hosted',           'y', 'n', 'y', 'y'],
              ['No cloud fees',         'y', 'n', 'p', 'y'],
              ['Dashboard UI',          'y', 'y', 'p', 'n'],
              ['One-click rollback',    'y', 'p', 'y', 'n'],
              ['Git-native workflow',   'y', 'y', 'p', 'n'],
              ['AI CI pipeline gen',    'y', 'n', 'n', 'n'],
              ['Setup complexity', 'Low', 'Low', 'High', 'Medium'],
              ['Open source',           'y', 'n', 'y', 'y'],
            ].map(([feat, vg, ...rest]) => {
              const Cell = ({ val }: { val: string }) => {
                if (val === 'y')    return <span className={styles.cyes}>✓</span>;
                if (val === 'n')    return <span className={styles.cno}>✗</span>;
                if (val === 'p')    return <span className={styles.cpart}>partial</span>;
                if (val === 'Low')  return <span className={styles.cyes}>Low</span>;
                if (val === 'High') return <span className={styles.cno}>High</span>;
                return <span className={styles.cpart}>{val}</span>;
              };
              return (
                <tr key={feat as string}>
                  <td>{feat}</td>
                  <td className={styles.tdHl}><Cell val={vg as string} /></td>
                  {rest.map((v, i) => <td key={i}><Cell val={v as string} /></td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <hr className={styles.fullDivider} />

      {/* ── SETUP ── */}
      <section id="setup" className={`${styles.section} ${styles.reveal}`}>
        <p className={styles.sectionLabel}>// setup</p>
        <h2 className={styles.h2}>Local setup in 6 steps.</h2>
        <p className={styles.sectionSub}>Requires Bun, Docker, Nginx, and a PostgreSQL database (Neon free tier works).</p>

        <div className={styles.setupSteps}>

          <div className={styles.setupStep}>
            <div className={styles.setupNum}>1</div>
            <div className={styles.setupContent}>
              <div className={styles.setupTitle}>Clone &amp; install</div>
              <p className={styles.setupDesc}>Clone the repo and install dependencies with Bun.</p>
              <div className={styles.codeBlock}>
                <div className={styles.codeBlockHeader}>
                  <span className={styles.codeBlockLang}>bash</span>
                  <CopyBtn codeKey="clone" text={CODE.clone} />
                </div>
                <pre><span className={styles.hl}>git clone</span>{' '}https://github.com/dinexh/VersionGate{'\n'}<span className={styles.hl}>cd</span>{' '}VersionGate{'\n'}<span className={styles.hl}>bun install</span></pre>
              </div>
            </div>
          </div>

          <div className={styles.setupStep}>
            <div className={styles.setupNum}>2</div>
            <div className={styles.setupContent}>
              <div className={styles.setupTitle}>Configure .env</div>
              <p className={styles.setupDesc}>Create a <code>.env</code> file at the repo root. Only <code>DATABASE_URL</code> is required.</p>
              <div className={styles.codeBlock}>
                <div className={styles.codeBlockHeader}>
                  <span className={styles.codeBlockLang}>.env</span>
                  <CopyBtn codeKey="env" text={CODE.env} />
                </div>
                <pre>
                  <span className={styles.cm}># Required</span>{'\n'}
                  <span className={styles.vr}>DATABASE_URL</span>=postgresql://user:pass@host/db{'\n\n'}
                  <span className={styles.cm}># Optional</span>{'\n'}
                  <span className={styles.vr}>PORT</span>=9090{'\n'}
                  <span className={styles.vr}>DOCKER_NETWORK</span>=bridge{'\n'}
                  <span className={styles.vr}>NGINX_CONFIG_PATH</span>=/etc/nginx/conf.d/upstream.conf{'\n'}
                  <span className={styles.vr}>PROJECTS_ROOT_PATH</span>=/var/versiongate/projects{'\n'}
                  <span className={styles.vr}>GEMINI_API_KEY</span>=           <span className={styles.cm}># for AI pipeline generation</span>
                </pre>
              </div>
            </div>
          </div>

          <div className={styles.setupStep}>
            <div className={styles.setupNum}>3</div>
            <div className={styles.setupContent}>
              <div className={styles.setupTitle}>Push database schema</div>
              <p className={styles.setupDesc}>Creates the <code>Project</code> and <code>Deployment</code> tables. Re-run after any schema change.</p>
              <div className={styles.codeBlock}>
                <div className={styles.codeBlockHeader}>
                  <span className={styles.codeBlockLang}>bash</span>
                  <CopyBtn codeKey="prisma" text={CODE.prisma} />
                </div>
                <pre><span className={styles.hl}>bunx prisma db push</span></pre>
              </div>
            </div>
          </div>

          <div className={styles.setupStep}>
            <div className={styles.setupNum}>4</div>
            <div className={styles.setupContent}>
              <div className={styles.setupTitle}>Build the dashboard</div>
              <p className={styles.setupDesc}>Next.js static export. Fastify serves it automatically from <code>dashboard/out/</code>.</p>
              <div className={styles.codeBlock}>
                <div className={styles.codeBlockHeader}>
                  <span className={styles.codeBlockLang}>bash</span>
                  <CopyBtn codeKey="dashboard" text={CODE.dashboard} />
                </div>
                <pre><span className={styles.hl}>cd</span> dashboard {'&&'} <span className={styles.hl}>bun install</span> {'&&'} <span className={styles.hl}>bun run build</span> {'&&'} <span className={styles.hl}>cd</span> ..</pre>
              </div>
            </div>
          </div>

          <div className={styles.setupStep}>
            <div className={styles.setupNum}>5</div>
            <div className={styles.setupContent}>
              <div className={styles.setupTitle}>Start the engine</div>
              <p className={styles.setupDesc}>Dev mode with watch, or production via PM2.</p>
              <div className={styles.codeBlock}>
                <div className={styles.codeBlockHeader}>
                  <span className={styles.codeBlockLang}>bash — dev</span>
                  <CopyBtn codeKey="devStart" text={CODE.devStart} />
                </div>
                <pre><span className={styles.hl}>bun --watch</span> src/server.ts</pre>
              </div>
              <div className={`${styles.codeBlock} ${styles.mt16}`}>
                <div className={styles.codeBlockHeader}>
                  <span className={styles.codeBlockLang}>bash — production</span>
                  <CopyBtn codeKey="prodStart" text={CODE.prodStart} />
                </div>
                <pre><span className={styles.hl}>pm2 start</span> ecosystem.config.cjs{'\n'}<span className={styles.hl}>pm2 save</span>                 <span className={styles.cm}># persist across reboots</span></pre>
              </div>
              <p className={`${styles.setupDesc} ${styles.mt8}`}>Engine + dashboard available at <strong>http://localhost:9090</strong></p>
            </div>
          </div>

          <div className={styles.setupStep}>
            <div className={styles.setupNum}>6</div>
            <div className={styles.setupContent}>
              <div className={styles.setupTitle}>Create a project &amp; deploy</div>
              <p className={styles.setupDesc}><code>basePort</code> is auto-assigned. <code>webhookSecret</code> is auto-generated — copy the URL from the dashboard after creation.</p>
              <div className={styles.codeBlock}>
                <div className={styles.codeBlockHeader}>
                  <span className={styles.codeBlockLang}>bash</span>
                  <CopyBtn codeKey="deploy" text={CODE.deploy} />
                </div>
                <pre>
                  <span className={styles.cm}># Create project</span>{'\n'}
                  <span className={styles.hl}>curl</span> -X POST http://localhost:9090/api/v1/projects \{'\n'}
                  {'  '}-H <span className={styles.st}>&apos;Content-Type: application/json&apos;</span> \{'\n'}
                  {'  '}-d <span className={styles.st}>&apos;{'{ "name": "myapp", "repoUrl": "https://github.com/you/myapp", "branch": "main", "appPort": 3000 }'}&apos;</span>{'\n\n'}
                  <span className={styles.cm}># Trigger first deploy</span>{'\n'}
                  <span className={styles.hl}>curl</span> -X POST http://localhost:9090/api/v1/deploy \{'\n'}
                  {'  '}-H <span className={styles.st}>&apos;Content-Type: application/json&apos;</span> \{'\n'}
                  {'  '}-d <span className={styles.st}>&apos;{'{ "projectId": "<id>" }'}&apos;</span>
                </pre>
              </div>
            </div>
          </div>

        </div>

        {/* ENV TABLE */}
        <h3 className={styles.envH3}>Environment variables</h3>
        <div className={styles.codeBlock} style={{ padding: 0 }}>
          <table className={styles.envTable}>
            <thead>
              <tr><th>Variable</th><th>Default</th><th>Description</th></tr>
            </thead>
            <tbody>
              {[
                { key: 'DATABASE_URL',       req: true,  def: '—',                                    desc: 'PostgreSQL connection string' },
                { key: 'PORT',               req: false, def: '9090',                                 desc: 'API + dashboard port' },
                { key: 'DOCKER_NETWORK',     req: false, def: 'bridge',                               desc: 'Docker network for containers' },
                { key: 'NGINX_CONFIG_PATH',  req: false, def: '/etc/nginx/conf.d/upstream.conf',      desc: 'Nginx upstream file' },
                { key: 'PROJECTS_ROOT_PATH', req: false, def: '/var/versiongate/projects',            desc: 'Root dir for cloned repos' },
                { key: 'GEMINI_API_KEY',     req: false, def: '—',                                    desc: 'Google AI Studio key (optional)' },
                { key: 'GEMINI_MODEL',       req: false, def: 'gemini-2.5-pro',                       desc: 'Gemini model ID' },
                { key: 'LOG_LEVEL',          req: false, def: 'info',                                 desc: 'Pino log level' },
              ].map(r => (
                <tr key={r.key}>
                  <td className={styles.envKey}>{r.key}{r.req && <span className={styles.reqBadge}>required</span>}</td>
                  <td className={styles.envDefault}>{r.def}</td>
                  <td className={styles.envDesc}>{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <strong>VersionGate Engine</strong> — self-hosted, zero-downtime deployments
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
            Built with Bun · Fastify · Prisma · Docker · Nginx · Next.js
          </div>
        </div>
        <ul className={styles.footerLinks}>
          <li><a href="https://github.com/dinexh/VersionGate" target="_blank" rel="noreferrer">GitHub ↗</a></li>
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#setup">Setup</a></li>
        </ul>
      </footer>

    </div>
  );
}
