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
    // Comparison slider
    comparison: $('#comparison'),
    compOverlay: $('#compOverlay'),
    compSlider: $('#compSlider'),
    videoBefore: $('#videoBefore'),
    videoAfter: $('#videoAfter'),
    playCompare: $('#playCompare'),
    // Error modal
    errorModal: $('#errorModal'),
    errorModalClose: $('#errorModalClose'),
  };

  let selectedFile = null;
  const RING_CIRCUMFERENCE = 2 * Math.PI * 80; // r=80 in the SVG

  // ═══════════════════════════════════════════════════════════════════════
  // 1. CUSTOM CURSOR — thick glowing comet + sparkles + constellations
  // ═══════════════════════════════════════════════════════════════════════
  const canvas = EL.canvas;
  const ctx = canvas ? canvas.getContext('2d') : null;
  const mouse = { x: 0, y: 0 };
  const trail = [];
  const particles = [];
  const sparkles = [];      // floating dots that drift off the trail
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  if (!isMobile && ctx) {
    let frameCount = 0;

    window.addEventListener('mousemove', e => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      trail.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (trail.length > 60) trail.shift();

      // Spawn sparkles along the trail every few frames
      frameCount++;
      if (frameCount % 3 === 0) {
        const angle = Math.random() * Math.PI * 2;
        const drift = 0.3 + Math.random() * 0.8;
        sparkles.push({
          x: e.clientX + (Math.random() - 0.5) * 10,
          y: e.clientY + (Math.random() - 0.5) * 10,
          vx: Math.cos(angle) * drift,
          vy: Math.sin(angle) * drift,
          life: 1,
          size: 1.5 + Math.random() * 2.5,
          hue: 250 + Math.random() * 130, // purple→cyan→pink range
        });
      }
    });

    window.addEventListener('mousedown', e => {
      const colors = ['#a78bfa', '#06b6d4', '#ec4899', '#8b5cf6', '#22d3ee', '#f472b6'];
      // Burst ring
      for (let i = 0; i < 18; i++) {
        const angle = (Math.PI * 2 * i) / 18;
        const speed = 4 + Math.random() * 5;
        particles.push({
          x: e.clientX, y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1, size: 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          type: 'ring',
        });
      }
      // Inner sparks
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2;
        particles.push({
          x: e.clientX, y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 1, size: 1.5 + Math.random() * 2,
          color: '#ffffff',
          type: 'spark',
        });
      }
    });

    function drawTrailPath() {
      if (trail.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) {
        const p = trail[i], pp = trail[i - 1];
        ctx.quadraticCurveTo(pp.x, pp.y, (pp.x + p.x) / 2, (pp.y + p.y) / 2);
      }
    }

    function drawCursor() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Age trail
      const alive = trail.filter(p => { p.age++; return p.age < 40; });
      trail.length = 0;
      trail.push(...alive);

      if (trail.length > 3) {
        // Layer 1 — Wide outer glow
        drawTrailPath();
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.04)';
        ctx.lineWidth = 28;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke();

        // Layer 2 — Medium glow
        drawTrailPath();
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
        ctx.lineWidth = 14;
        ctx.stroke();

        // Layer 3 — Bright core with gradient
        drawTrailPath();
        const grad = ctx.createLinearGradient(
          trail[0].x, trail[0].y,
          trail[trail.length - 1].x, trail[trail.length - 1].y
        );
        grad.addColorStop(0, 'rgba(167, 139, 250, 0)');
        grad.addColorStop(0.3, 'rgba(139, 92, 246, 0.4)');
        grad.addColorStop(0.6, 'rgba(6, 182, 212, 0.6)');
        grad.addColorStop(1, 'rgba(236, 72, 153, 0.8)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 4;
        ctx.stroke();

        // Cursor dot
        const last = trail[trail.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
        const dotGrad = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 5);
        dotGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        dotGrad.addColorStop(1, 'rgba(167, 139, 250, 0)');
        ctx.fillStyle = dotGrad;
        ctx.fill();
      }

      // Draw sparkles + constellation lines between nearby sparkles
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx; s.y += s.vy;
        s.life -= 0.012;
        if (s.life <= 0) { sparkles.splice(i, 1); continue; }

        // Sparkle dot
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${s.hue}, 80%, 70%, ${s.life * 0.6})`;
        ctx.fill();

        // Constellation lines to nearby sparkles
        for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
          const s2 = sparkles[j];
          const dx = s.x - s2.x, dy = s.y - s2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.strokeStyle = `hsla(${(s.hue + s2.hue) / 2}, 60%, 60%, ${(1 - dist / 80) * s.life * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw click particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += (p.type === 'spark' ? 0.08 : 0.15);
        p.vx *= 0.96; p.vy *= 0.96;
        p.life -= (p.type === 'spark' ? 0.03 : 0.02);
        if (p.life <= 0) { particles.splice(i, 1); continue; }

        ctx.beginPath();
        if (p.type === 'spark') {
          // Tiny bright sparks
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${p.life})`;
        } else {
          // Ring particles with glow
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.color + Math.floor(p.life * 220).toString(16).padStart(2, '0');
        }
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
        showErrorModal();
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

  // ═══════════════════════════════════════════════════════════════════════
  // 8. ERROR MODAL — replaces browser alert()
  // ═══════════════════════════════════════════════════════════════════════
  function showErrorModal() {
    if (EL.errorModal) EL.errorModal.classList.remove('hidden');
  }
  function hideErrorModal() {
    if (EL.errorModal) EL.errorModal.classList.add('hidden');
  }
  if (EL.errorModalClose) EL.errorModalClose.addEventListener('click', hideErrorModal);
  if (EL.errorModal) EL.errorModal.addEventListener('click', e => {
    if (e.target === EL.errorModal) hideErrorModal();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 9. BEFORE/AFTER COMPARISON SLIDER
  // ═══════════════════════════════════════════════════════════════════════
  if (EL.comparison) {
    let isDragging = false;

    function updateSlider(x) {
      const rect = EL.comparison.getBoundingClientRect();
      let pct = ((x - rect.left) / rect.width) * 100;
      pct = Math.max(2, Math.min(98, pct));
      EL.compOverlay.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      EL.compSlider.style.left = pct + '%';
    }

    EL.comparison.addEventListener('mousedown', e => { isDragging = true; updateSlider(e.clientX); });
    window.addEventListener('mousemove', e => { if (isDragging) updateSlider(e.clientX); });
    window.addEventListener('mouseup', () => { isDragging = false; });

    // Touch support
    EL.comparison.addEventListener('touchstart', e => { isDragging = true; updateSlider(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchmove', e => { if (isDragging) updateSlider(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchend', () => { isDragging = false; });
  }

  // Play/pause button for comparison videos
  if (EL.playCompare && EL.videoBefore && EL.videoAfter) {
    let playing = false;
    EL.playCompare.addEventListener('click', () => {
      if (!playing) {
        EL.videoBefore.play();
        EL.videoAfter.play();
        EL.playCompare.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
      } else {
        EL.videoBefore.pause();
        EL.videoAfter.pause();
        EL.playCompare.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play Comparison';
      }
      playing = !playing;
    });

    // Sync videos on seek
    EL.videoBefore.addEventListener('seeked', () => {
      EL.videoAfter.currentTime = EL.videoBefore.currentTime;
    });
  }

})();
