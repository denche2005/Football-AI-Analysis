/* ═══════════════════════════════════════════════════════════════════════
   Football AI Analysis — main.js
   Custom cursor, parallax orbs, scroll-reveal, tech carousel, SSE upload
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── DOM refs ──────────────────────────────────────────────────────
  const EL = {
    canvas: $('#cursorCanvas'),
    orbPurple: $('#orbPurple'),
    orbCyan: $('#orbCyan'),
    orbPink: $('#orbPink'),
    heroOrb: $('#heroOrb'),
    nav: $('#nav'),
    uploadZone: $('#uploadZone'),
    fileInput: $('#fileInput'),
    analyzeBtn: $('#analyzeBtn'),
    analyzeBtnTxt: $('#analyzeBtnText'),
    apiUrl: $('#apiUrl'),
    loaderOverlay: $('#loaderOverlay'),
    ringFill: $('#ringFill'),
    overlayPct: $('#overlayPct'),
    overlayEta: $('#overlayEta'),
    loaderStep: $('#loaderStep'),
    terminalLog: $('#terminalLog'),
    possBar1: $('#possBar1'),
    possBar2: $('#possBar2'),
    possLabel1: $('#possLabel1'),
    possLabel2: $('#possLabel2'),
    statsBody: $('#statsTableBody'),
    downloadBtn: $('#downloadBtn'),
    carouselTrack: $('#carouselTrack'),
  };

  let selectedFile = null;
  const RING_CIRCUMFERENCE = 2 * Math.PI * 80; // r=80 in the SVG

  // ═══════════════════════════════════════════════════════════════════════
  // 1. CUSTOM CURSOR — canvas comet trail + click explosions
  // ═══════════════════════════════════════════════════════════════════════
  const canvas = EL.canvas;
  const ctx = canvas ? canvas.getContext('2d') : null;
  const mouse = { x: 0, y: 0 };
  const trail = [];
  const particles = [];
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  if (!isMobile && ctx) {
    window.addEventListener('mousemove', e => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      trail.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (trail.length > 50) trail.shift();
    });

    window.addEventListener('mousedown', e => {
      // Click explosion
      const colors = ['#a78bfa', '#06b6d4', '#ec4899', '#8b5cf6', '#22d3ee'];
      for (let i = 0; i < 14; i++) {
        const angle = (Math.PI * 2 * i) / 14;
        const speed = 3 + Math.random() * 4;
        particles.push({
          x: e.clientX, y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1, size: 3 + Math.random() * 4,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    });

    function drawCursor() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw comet trail
      const alive = trail.filter(p => { p.age++; return p.age < 30; });
      trail.length = 0;
      trail.push(...alive);

      if (trail.length > 2) {
        // Glow
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
          const p = trail[i], pp = trail[i - 1];
          ctx.quadraticCurveTo(pp.x, pp.y, (pp.x + p.x) / 2, (pp.y + p.y) / 2);
        }
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.08)';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
          const p = trail[i], pp = trail[i - 1];
          ctx.quadraticCurveTo(pp.x, pp.y, (pp.x + p.x) / 2, (pp.y + p.y) / 2);
        }
        const grad = ctx.createLinearGradient(trail[0].x, trail[0].y, trail[trail.length - 1].x, trail[trail.length - 1].y);
        grad.addColorStop(0, 'rgba(167, 139, 250, 0)');
        grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.5)');
        grad.addColorStop(1, 'rgba(236, 72, 153, 0.7)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.12; p.vx *= 0.97; p.vy *= 0.97;
        p.life -= 0.025;
        if (p.life <= 0) { particles.splice(i, 1); continue; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.life * 200).toString(16).padStart(2, '0');
        ctx.fill();
      }

      requestAnimationFrame(drawCursor);
    }
    drawCursor();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. PARALLAX ORBS — follow mouse gently
  // ═══════════════════════════════════════════════════════════════════════
  if (!isMobile) {
    window.addEventListener('mousemove', e => {
      const cx = (e.clientX / window.innerWidth - 0.5) * 2;
      const cy = (e.clientY / window.innerHeight - 0.5) * 2;

      if (EL.orbPurple) EL.orbPurple.style.transform = `translate(${cx * 40}px, ${cy * 40}px)`;
      if (EL.orbCyan) EL.orbCyan.style.transform = `translate(${cx * -25}px, ${cy * -25}px)`;
      if (EL.orbPink) EL.orbPink.style.transform = `translate(calc(-50% + ${cx * 15}px), calc(-50% + ${cy * 15}px))`;
      if (EL.heroOrb) EL.heroOrb.style.transform = `translate(${cx * -18}px, ${cy * -18}px)`;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. SCROLL — nav glass + reveal
  // ═══════════════════════════════════════════════════════════════════════
  window.addEventListener('scroll', () => {
    if (EL.nav) EL.nav.classList.toggle('scrolled', window.scrollY > 50);
  });

  // IntersectionObserver for reveals
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.12 });
  $$('.reveal').forEach(el => observer.observe(el));

  // ═══════════════════════════════════════════════════════════════════════
  // 4. TECH CAROUSEL — build 3× for infinite scroll
  // ═══════════════════════════════════════════════════════════════════════
  const TECHS = [
    { name: 'Python 3.11', icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },
    { name: 'YOLOv8', icon: '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/>' },
    { name: 'OpenCV', icon: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' },
    { name: 'ByteTrack', icon: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' },
    { name: 'NumPy', icon: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>' },
    { name: 'scikit-learn', icon: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' },
    { name: 'FastAPI', icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
    { name: 'supervision', icon: '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>' },
  ];

  if (EL.carouselTrack) {
    let html = '';
    for (let rep = 0; rep < 3; rep++) {
      TECHS.forEach(t => {
        html += `<div class="tech-pill glass"><svg class="icon" viewBox="0 0 24 24">${t.icon}</svg>${esc(t.name)}</div>`;
      });
    }
    EL.carouselTrack.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. FILE UPLOAD — drag/drop + click
  // ═══════════════════════════════════════════════════════════════════════
  if (EL.uploadZone && EL.fileInput) {
    EL.uploadZone.addEventListener('click', () => EL.fileInput.click());
    EL.uploadZone.addEventListener('dragover', e => { e.preventDefault(); EL.uploadZone.classList.add('drag-over'); });
    EL.uploadZone.addEventListener('dragleave', () => EL.uploadZone.classList.remove('drag-over'));
    EL.uploadZone.addEventListener('drop', e => {
      e.preventDefault(); EL.uploadZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) pickFile(e.dataTransfer.files[0]);
    });
    EL.fileInput.addEventListener('change', () => {
      if (EL.fileInput.files.length) pickFile(EL.fileInput.files[0]);
    });
  }

  function pickFile(file) {
    selectedFile = file;
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    EL.uploadZone.innerHTML = `
      <span class="upload-zone__icon">
        <svg class="icon" viewBox="0 0 24 24" style="font-size:2.2rem;color:var(--purple)">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </span>
      <p class="upload-zone__text">${esc(file.name)}</p>
      <p class="upload-zone__hint">${sizeMB} MB — click to change</p>
    `;
    EL.analyzeBtn.disabled = false;
    EL.analyzeBtnTxt.textContent = 'Run Analysis';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. ANALYZE — upload + SSE progress
  // ═══════════════════════════════════════════════════════════════════════
  if (EL.analyzeBtn) {
    EL.analyzeBtn.addEventListener('click', async () => {
      if (!selectedFile) return;
      const base = (EL.apiUrl?.value || 'http://127.0.0.1:8000').replace(/\/+$/, '');

      // Disable button
      EL.analyzeBtn.disabled = true;
      EL.analyzeBtnTxt.innerHTML = '<span class="spinner"></span> Uploading…';

      try {
        const fd = new FormData();
        fd.append('video', selectedFile);
        const res = await fetch(`${base}/analyze`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const { job_id } = await res.json();

        // Show loader overlay
        showLoader();
        streamProgress(base, job_id);
      } catch (err) {
        alert('Analysis failed: ' + err.message);
        EL.analyzeBtn.disabled = false;
        EL.analyzeBtnTxt.textContent = 'Run Analysis';
      }
    });
  }

  function showLoader() {
    EL.loaderOverlay.classList.remove('hidden');
    EL.terminalLog.innerHTML = '<div class="log-line"><span class="log-time">[SYSTEM]</span><span class="log-msg">Upload complete. Starting pipeline…</span></div>';
    updateRing(0);
  }

  function hideLoader() {
    EL.loaderOverlay.classList.add('hidden');
  }

  function updateRing(pct) {
    const offset = RING_CIRCUMFERENCE - (pct / 100) * RING_CIRCUMFERENCE;
    if (EL.ringFill) EL.ringFill.style.strokeDashoffset = offset;
    if (EL.overlayPct) EL.overlayPct.textContent = `${Math.round(pct)}%`;
  }

  function addLog(msg) {
    const now = new Date().toLocaleTimeString('en', { hour12: false });
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `<span class="log-time">[${now}]</span><span class="log-msg">${esc(msg)}</span>`;
    EL.terminalLog.appendChild(line);
    EL.terminalLog.scrollTop = EL.terminalLog.scrollHeight;
  }

  function streamProgress(base, jobId) {
    const es = new EventSource(`${base}/progress/${jobId}`);

    es.onmessage = (event) => {
      try {
        const d = JSON.parse(event.data);
        const pct = d.pct || 0;
        const step = (d.step || '').toUpperCase();
        const detail = d.detail || '';

        updateRing(pct);
        if (EL.loaderStep) EL.loaderStep.textContent = step;
        if (detail) addLog(`${step}: ${detail}`);

        // ETA
        if (d.eta_seconds && d.eta_seconds > 0 && EL.overlayEta) {
          const mins = Math.floor(d.eta_seconds / 60);
          const secs = Math.round(d.eta_seconds % 60);
          EL.overlayEta.textContent = `≈ ${mins}m ${secs}s remaining`;
        }

        // Done
        if (d.step === 'done') {
          es.close();
          addLog('✔ Analysis complete!');
          hideLoader();
          renderResults(d.stats, base, jobId);
          EL.analyzeBtn.disabled = false;
          EL.analyzeBtnTxt.textContent = 'Run Analysis';
        }

        // Error
        if (d.step === 'error') {
          es.close();
          addLog('✖ Error: ' + detail);
          setTimeout(hideLoader, 3000);
          EL.analyzeBtn.disabled = false;
          EL.analyzeBtnTxt.textContent = 'Run Analysis';
        }
      } catch (_) { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close();
      addLog('Connection lost — check backend');
      setTimeout(hideLoader, 3000);
      EL.analyzeBtn.disabled = false;
      EL.analyzeBtnTxt.textContent = 'Run Analysis';
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. RENDER RESULTS
  // ═══════════════════════════════════════════════════════════════════════
  function renderResults(stats, base, jobId) {
    if (!stats) return;

    // Possession
    const p = stats.possession || {};
    const t1 = p.team1 || 0, t2 = p.team2 || 0;
    const c = stats.team_colors || {};
    const c1 = c.team1 || '#a78bfa', c2 = c.team2 || '#06b6d4';

    if (EL.possBar1) { EL.possBar1.style.flex = t1; EL.possBar1.style.background = c1; }
    if (EL.possBar2) { EL.possBar2.style.flex = t2; EL.possBar2.style.background = c2; }
    if (EL.possLabel1) EL.possLabel1.innerHTML = `<span class="team-dot" style="background:${c1}"></span>Team 1 — ${t1.toFixed(1)}%`;
    if (EL.possLabel2) EL.possLabel2.innerHTML = `<span class="team-dot" style="background:${c2}"></span>Team 2 — ${t2.toFixed(1)}%`;

    // Player stats table
    const players = stats.players || {};
    const rows = Object.entries(players)
      .sort((a, b) => b[1].max_speed_kmh - a[1].max_speed_kmh)
      .slice(0, 15);

    if (EL.statsBody) {
      EL.statsBody.innerHTML = rows.map(([id, d]) => {
        const tc = d.team === 1 ? c1 : c2;
        return `<tr>
          <td>#${id}</td>
          <td><span class="team-dot" style="background:${tc}"></span>Team ${d.team}</td>
          <td>${d.max_speed_kmh}</td>
          <td>${d.distance_m}</td>
        </tr>`;
      }).join('');
    }

    // Download button
    if (EL.downloadBtn) {
      EL.downloadBtn.href = `${base}/result/${jobId}`;
      EL.downloadBtn.classList.remove('hidden');
      EL.downloadBtn.setAttribute('download', `football_analysis_${jobId}.avi`);
    }
  }

})();
