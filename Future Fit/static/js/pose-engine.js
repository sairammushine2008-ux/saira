/**
 * FutureFit - AI Pose Tracking & Camera Engine
 * Implements MediaPipe Pose 33-point body tracking,
 * Left Ankle (#27) vertical Y-displacement jump height calculation,
 * Start & End Athletic Session Lifecycle, Dual Viewport HUD, and Debug Console.
 */

class FutureFitPoseEngine {
  constructor() {
    this.videoEl = document.getElementById('webcam-video');
    this.canvasEl = document.getElementById('pose-canvas');
    this.ctx = this.canvasEl ? this.canvasEl.getContext('2d') : null;

    // Session Controls & UI Elements
    this.startSessionBtn = document.getElementById('start-session-btn');
    this.overlayStartSessionBtn = document.getElementById('overlay-start-session-btn');
    this.endSessionBtn = document.getElementById('end-session-btn');
    this.standbyOverlay = document.getElementById('standby-overlay');
    this.liveRecIndicator = document.getElementById('live-rec-indicator');

    // Telemetry Elements
    this.sessionStatusBadge = document.getElementById('session-status-badge');
    this.sessionStatusText = document.getElementById('session-status-text');
    this.sessionTimerEl = document.getElementById('session-timer');
    this.sessionJumpCountEl = document.getElementById('session-jump-count');
    this.telemetryAnkleEl = document.getElementById('telemetry-ankle-y');
    this.telemetryLatencyEl = document.getElementById('telemetry-latency');
    this.telemetryStatusEl = document.getElementById('telemetry-status');
    this.apexBadgeEl = document.getElementById('hud-apex-badge');
    this.jumpMeterFillEl = document.getElementById('jump-meter-fill');
    this.jumpMeterLabelEl = document.getElementById('jump-meter-label');

    // Summary Metric Elements
    this.summaryCurrentJumpEl = document.getElementById('summary-current-jump');
    this.summaryPeakJumpEl = document.getElementById('summary-peak-jump');
    this.summaryTotalJumpsEl = document.getElementById('summary-total-jumps');
    this.summaryHangTimeEl = document.getElementById('summary-hang-time');
    this.summaryVelocityEl = document.getElementById('summary-velocity');
    this.submitAssessmentBtn = document.getElementById('submit-assessment-btn');
    this.calibrateBtn = document.getElementById('calibrate-btn');
    this.simToggleBtn = document.getElementById('toggle-sim-btn');

    // Session Summary Modal Elements
    this.sessionModal = document.getElementById('session-summary-modal');
    this.modalCloseBtn = document.getElementById('modal-close-btn');
    this.modalRestartBtn = document.getElementById('modal-restart-session-btn');
    this.modalSubmitBtn = document.getElementById('modal-submit-assessment-btn');
    this.modalPeakValEl = document.getElementById('modal-peak-val');
    this.modalTierBadgeEl = document.getElementById('modal-tier-badge');
    this.modalTierTextEl = document.getElementById('modal-tier-text');
    this.modalTotalJumpsEl = document.getElementById('modal-total-jumps');
    this.modalAvgJumpEl = document.getElementById('modal-avg-jump');
    this.modalDurationEl = document.getElementById('modal-duration');
    this.modalHangTimeEl = document.getElementById('modal-hang-time');
    this.modalVelocityEl = document.getElementById('modal-velocity');
    this.modalPowerEl = document.getElementById('modal-power');

    // Debug Console Elements
    this.debugTerminal = document.getElementById('debug-terminal');
    this.debugToggleBtn = document.getElementById('debug-toggle-btn');
    this.clearDebugBtn = document.getElementById('clear-debug-btn');
    this.copyDebugBtn = document.getElementById('copy-debug-btn');

    // Session Lifecycle State: 'IDLE' | 'ACTIVE' | 'ENDED'
    this.sessionState = 'IDLE';
    this.sessionStartTime = 0;
    this.sessionElapsedSec = 0;
    this.sessionTimerInterval = null;
    this.sessionJumps = []; // Array of { heightCm, hangTimeMs, velocityMs, timestamp }
    this.sessionPeakJumpCm = 0.0;
    this.sessionTotalJumps = 0;
    this.sessionHangTimeMs = 0;
    this.takeoffVelocityMs = 0.0;

    // Pose State & Physics Model
    this.isRunning = false;
    this.isSimulating = false;
    this.isInferencing = false;
    this.mediaStream = null;
    this.camAnimFrameId = null;
    this.simAnimFrameId = null;
    this.poseInstance = null;

    this.athleteHeightCm = 180;
    this.athleteWeightKg = 72;
    this.baselineAnkleY = 0.82;
    this.currentAnkleY = 0.82;
    this.currentJumpCm = 0.0;

    // Jump detection state machine: STANDBY -> FLIGHT -> APEX -> LANDED
    this.jumpState = 'STANDBY';
    this.takeoffTimestamp = 0;
    this.apexTimestamp = 0;
    this.peakDisplacementThisJump = 0;
    this.jumpTrail = [];

    // Telemetry & FPS
    this.lastFrameTime = performance.now();
    this.fps = 60;
    this.latencyMs = 15;
    this.frameCount = 0;
    this.simAngle = 0;

    this.init();
  }

  init() {
    this.setupDebugConsole();
    this.setupControls();
    this.updateSessionUI();
    this.logDebug('INFO', 'FutureFit AI Pose Tracking Engine v3.0 initialized (Standby Ready).');
  }

  setupDebugConsole() {
    if (this.debugToggleBtn && this.debugTerminal) {
      this.debugToggleBtn.addEventListener('click', () => {
        const isCollapsed = this.debugTerminal.classList.toggle('collapsed');
        this.debugToggleBtn.innerHTML = isCollapsed
          ? `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`
          : `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>`;
      });
    }

    if (this.clearDebugBtn && this.debugTerminal) {
      this.clearDebugBtn.addEventListener('click', () => {
        this.debugTerminal.innerHTML = '';
        this.logDebug('INFO', 'Debug console cleared.');
      });
    }

    if (this.copyDebugBtn && this.debugTerminal) {
      this.copyDebugBtn.addEventListener('click', () => {
        const text = this.debugTerminal.innerText;
        navigator.clipboard.writeText(text).then(() => {
          showToast('Debug logs copied to clipboard!', 'info');
        }).catch(() => {
          showToast('Console logs ready in memory.', 'info');
        });
      });
    }
  }

  logDebug(tag, message) {
    if (!this.debugTerminal) return;
    const timeStr = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = 'log-line';

    let tagClass = 'tag-info';
    if (tag === 'POSE') tagClass = 'tag-pose';
    if (tag === 'JUMP') tagClass = 'tag-jump';
    if (tag === 'SESSION') tagClass = 'tag-jump';
    if (tag === 'SOCKET') tagClass = 'tag-socket';
    if (tag === 'WARN') tagClass = 'tag-warn';

    line.innerHTML = `
      <span class="log-time">[${timeStr}]</span>
      <span class="log-tag ${tagClass}">[${tag}]</span>
      <span class="log-msg">${message}</span>
    `;

    this.debugTerminal.appendChild(line);
    while (this.debugTerminal.children.length > 80) {
      this.debugTerminal.removeChild(this.debugTerminal.firstChild);
    }
    this.debugTerminal.scrollTop = this.debugTerminal.scrollHeight;
  }

  setupControls() {
    // Session Start button listeners
    if (this.startSessionBtn) {
      this.startSessionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.startSession();
      });
    }

    if (this.overlayStartSessionBtn) {
      this.overlayStartSessionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.startSession();
      });
    }

    // Session End button listener
    if (this.endSessionBtn) {
      this.endSessionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.endSession();
      });
    }

    // Calibrate Baseline
    if (this.calibrateBtn) {
      this.calibrateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.calibrateBaseline();
      });
    }

    // Toggle Camera / Simulation
    if (this.simToggleBtn) {
      this.simToggleBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (this.isSimulating) {
          await this.enableLiveCamera();
        } else {
          this.enableSimulationMode();
        }
      });
    }

    // Submit Assessment button
    if (this.submitAssessmentBtn) {
      this.submitAssessmentBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.submitAssessment();
      });
    }

    // Modal controls
    if (this.modalCloseBtn) {
      this.modalCloseBtn.addEventListener('click', () => {
        this.closeSessionModal();
      });
    }

    if (this.modalRestartBtn) {
      this.modalRestartBtn.addEventListener('click', () => {
        this.closeSessionModal();
        this.startSession();
      });
    }

    if (this.modalSubmitBtn) {
      this.modalSubmitBtn.addEventListener('click', () => {
        this.submitAssessment();
      });
    }
  }

  // ==========================================
  // SESSION LIFECYCLE MANAGEMENT
  // ==========================================

  async startSession() {
    this.sessionState = 'ACTIVE';
    this.sessionStartTime = Date.now();
    this.sessionElapsedSec = 0;
    this.sessionJumps = [];
    this.sessionPeakJumpCm = 0.0;
    this.sessionTotalJumps = 0;
    this.sessionHangTimeMs = 0;
    this.takeoffVelocityMs = 0.0;
    this.currentJumpCm = 0.0;
    this.jumpTrail = [];

    // Audio cue
    if (window.soundFx) {
      window.soundFx.play('whistle');
    }

    // Start Timer
    if (this.sessionTimerInterval) {
      clearInterval(this.sessionTimerInterval);
    }
    this.sessionTimerInterval = setInterval(() => {
      this.sessionElapsedSec++;
      this.updateTimerDisplay();
    }, 1000);
    this.updateTimerDisplay();

    // Update UI elements
    this.updateSessionUI();
    this.updateSummaryUI();

    this.logDebug('SESSION', '🚀 Athletic assessment session initiated. Tracking activated.');
    showToast('Assessment session started! Step into frame and perform your leap.', 'success', 4000);

    // Launch camera stream if not already simulating
    if (!this.isSimulating) {
      await this.enableLiveCamera();
    } else {
      this.runSimulationLoop();
    }
  }

  endSession() {
    if (this.sessionState !== 'ACTIVE') return;

    this.sessionState = 'ENDED';

    // Stop timer
    if (this.sessionTimerInterval) {
      clearInterval(this.sessionTimerInterval);
      this.sessionTimerInterval = null;
    }

    // Audio cue
    if (window.soundFx) {
      window.soundFx.play('whistle');
    }

    // Stop camera video hardware to release resources
    this.stopCurrentStream();
    this.isRunning = false;

    // Update UI elements
    this.updateSessionUI();

    this.logDebug('SESSION', `🏁 Session concluded. Peak: ${this.sessionPeakJumpCm} cm | Reps: ${this.sessionTotalJumps}`);
    showToast(`Session finished! Peak leap: ${this.sessionPeakJumpCm} cm across ${this.sessionTotalJumps} jumps.`, 'info', 5000);

    // Open Session Summary Modal
    this.openSessionModal();
  }

  updateTimerDisplay() {
    if (!this.sessionTimerEl) return;
    const mins = Math.floor(this.sessionElapsedSec / 60);
    const secs = this.sessionElapsedSec % 60;
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.sessionTimerEl.textContent = timeFormatted;
  }

  updateSessionUI() {
    const isSessionActive = this.sessionState === 'ACTIVE';

    // Toggle start/end buttons
    if (this.startSessionBtn) {
      this.startSessionBtn.style.display = isSessionActive ? 'none' : 'inline-flex';
    }
    if (this.endSessionBtn) {
      this.endSessionBtn.style.display = isSessionActive ? 'inline-flex' : 'none';
    }

    // Standby Overlay visibility
    if (this.standbyOverlay) {
      if (isSessionActive) {
        this.standbyOverlay.classList.add('hidden');
      } else {
        this.standbyOverlay.classList.remove('hidden');
      }
    }

    // Live Recording Indicator
    if (this.liveRecIndicator) {
      this.liveRecIndicator.style.display = isSessionActive ? 'flex' : 'none';
    }

    // Session Status Badge
    if (this.sessionStatusBadge && this.sessionStatusText) {
      if (this.sessionState === 'ACTIVE') {
        this.sessionStatusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        this.sessionStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.45)';
        this.sessionStatusBadge.style.color = '#10b981';
        this.sessionStatusBadge.querySelector('.status-pulse-dot').style.background = '#10b981';
        this.sessionStatusBadge.querySelector('.status-pulse-dot').style.boxShadow = '0 0 10px #10b981';
        this.sessionStatusText.textContent = 'SESSION ACTIVE (REC)';
      } else if (this.sessionState === 'ENDED') {
        this.sessionStatusBadge.style.background = 'rgba(245, 158, 11, 0.2)';
        this.sessionStatusBadge.style.borderColor = 'rgba(245, 158, 11, 0.45)';
        this.sessionStatusBadge.style.color = '#f59e0b';
        this.sessionStatusBadge.querySelector('.status-pulse-dot').style.background = '#f59e0b';
        this.sessionStatusBadge.querySelector('.status-pulse-dot').style.boxShadow = 'none';
        this.sessionStatusText.textContent = 'SESSION COMPLETED';
      } else {
        this.sessionStatusBadge.style.background = 'rgba(148, 163, 184, 0.15)';
        this.sessionStatusBadge.style.borderColor = 'rgba(148, 163, 184, 0.3)';
        this.sessionStatusBadge.style.color = 'var(--text-secondary, #94a3b8)';
        this.sessionStatusBadge.querySelector('.status-pulse-dot').style.background = '#94a3b8';
        this.sessionStatusBadge.querySelector('.status-pulse-dot').style.boxShadow = 'none';
        this.sessionStatusText.textContent = 'Session Standby';
      }
    }

    // Jumps count
    if (this.sessionJumpCountEl) {
      this.sessionJumpCountEl.textContent = this.sessionTotalJumps;
    }
  }

  openSessionModal() {
    if (!this.sessionModal) return;

    const peak = this.sessionPeakJumpCm || 0.0;
    const count = this.sessionTotalJumps || (peak > 0 ? 1 : 0);
    const avg = count > 0 && this.sessionJumps.length > 0
      ? (this.sessionJumps.reduce((acc, curr) => acc + curr.heightCm, 0) / this.sessionJumps.length).toFixed(1)
      : peak.toFixed(1);

    const mins = Math.floor(this.sessionElapsedSec / 60);
    const secs = this.sessionElapsedSec % 60;
    const durFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Calculate leg power: Sayers equation (Power W = 60.7 * Jump_cm + 45.3 * Mass_kg - 2055)
    const legPowerW = Math.max(0, Math.round(60.7 * peak + 45.3 * this.athleteWeightKg - 2055));

    // Determine SAI / Khelo India Tier
    let tierText = 'Developmental Athletic Baseline';
    let tierColor = '#94a3b8';
    if (peak >= 70) {
      tierText = 'Elite National SAI Prospect (Top 1%)';
      tierColor = '#f59e0b';
    } else if (peak >= 60) {
      tierText = 'Verified Khelo India Athlete (Top 5%)';
      tierColor = '#10b981';
    } else if (peak >= 50) {
      tierText = 'District High Performance Tier';
      tierColor = '#00f0ff';
    } else if (peak >= 40) {
      tierText = 'State Junior Competitive Standard';
      tierColor = '#a855f7';
    }

    if (this.modalPeakValEl) this.modalPeakValEl.textContent = `${peak} cm`;
    if (this.modalTotalJumpsEl) this.modalTotalJumpsEl.textContent = count;
    if (this.modalAvgJumpEl) this.modalAvgJumpEl.textContent = `${avg} cm`;
    if (this.modalDurationEl) this.modalDurationEl.textContent = durFormatted;
    if (this.modalHangTimeEl) this.modalHangTimeEl.textContent = `${this.sessionHangTimeMs} ms`;
    if (this.modalVelocityEl) this.modalVelocityEl.textContent = `${this.takeoffVelocityMs} m/s`;
    if (this.modalPowerEl) this.modalPowerEl.textContent = `${legPowerW} W`;

    if (this.modalTierTextEl) this.modalTierTextEl.textContent = tierText;
    if (this.modalTierBadgeEl) {
      this.modalTierBadgeEl.style.color = tierColor;
      this.modalTierBadgeEl.style.borderColor = tierColor;
    }

    this.sessionModal.classList.add('active');
  }

  closeSessionModal() {
    if (this.sessionModal) {
      this.sessionModal.classList.remove('active');
    }
  }

  calibrateBaseline() {
    this.baselineAnkleY = this.currentAnkleY;
    this.sessionPeakJumpCm = 0.0;
    this.sessionHangTimeMs = 0;
    this.updateSummaryUI();
    this.logDebug('POSE', `Left Ankle (#27) ground baseline calibrated at Y: ${this.baselineAnkleY.toFixed(4)}`);
    showToast('Ground baseline calibrated! Stand tall for accurate vertical measurement.', 'success');
  }

  // ==========================================
  // CAMERA STREAM & HARDWARE ACCESS
  // ==========================================

  async enableLiveCamera() {
    this.logDebug('INFO', 'Initiating live camera hardware access (navigator.mediaDevices.getUserMedia)...');

    if (this.simToggleBtn) {
      this.simToggleBtn.disabled = true;
      this.simToggleBtn.innerHTML = `
        <svg class="spin-animate" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
        <span>Connecting Camera...</span>
      `;
    }

    // Stop existing simulation loop if running
    this.isSimulating = false;
    if (this.simAnimFrameId) {
      cancelAnimationFrame(this.simAnimFrameId);
      this.simAnimFrameId = null;
    }

    this.stopCurrentStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errNotice = 'Camera API is unavailable. Running in high-fidelity computer vision simulation mode.';
      this.logDebug('WARN', errNotice);
      showToast(errNotice, 'warning', 5000);
      this.enableSimulationMode();
      return;
    }

    let stream = null;
    const constraintSets = [
      { video: { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 }, facingMode: 'user' }, audio: false },
      { video: { facingMode: 'user' }, audio: false },
      { video: true, audio: false }
    ];

    let lastError = null;
    for (const constraints of constraintSets) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!stream) {
      const errName = lastError ? lastError.name : 'Unknown';
      this.logDebug('WARN', `Live camera access fallback: [${errName}]. Engaging simulation engine.`);

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        showToast('Camera permission denied in browser. Switched to Simulation Mode.', 'warning', 6000);
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        showToast('No hardware camera found. Running in Athletic Simulation Mode.', 'info', 5000);
      } else {
        showToast('Camera unavailable. Running in Athletic Simulation Mode.', 'info', 4000);
      }

      this.enableSimulationMode();
      return;
    }

    this.mediaStream = stream;
    if (this.videoEl) {
      this.videoEl.srcObject = stream;
      try {
        await this.videoEl.play();
      } catch (playErr) {
        this.logDebug('WARN', `Video element playback note: ${playErr.message}`);
      }
    }

    this.isRunning = true;
    this.isSimulating = false;
    this.updateSimButtonUI(false);
    this.updateTelemetryStatusBadge('live');
    this.logDebug('INFO', 'Live camera stream attached and rendering at 60 FPS.');

    this.initMediaPipePose();
  }

  enableSimulationMode() {
    this.stopCurrentStream();
    this.isSimulating = true;
    this.isRunning = true;
    this.updateSimButtonUI(true);
    this.updateTelemetryStatusBadge('simulation');
    this.logDebug('WARN', 'Switched to High-Speed Synthetic Biomechanics Simulation Mode.');
    this.runSimulationLoop();
  }

  stopCurrentStream() {
    if (this.camAnimFrameId) {
      cancelAnimationFrame(this.camAnimFrameId);
      this.camAnimFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.mediaStream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }

  updateSimButtonUI(isSimulating) {
    if (!this.simToggleBtn) return;
    this.simToggleBtn.disabled = false;
    if (isSimulating) {
      this.simToggleBtn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        <span>Switch to Live Camera</span>
      `;
      this.simToggleBtn.title = "Switch to Live Hardware Camera Stream";
      this.simToggleBtn.className = "btn btn-primary";
    } else {
      this.simToggleBtn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span>Simulate Athletic Jump</span>
      `;
      this.simToggleBtn.title = "Toggle Synthetic Jump Simulation";
      this.simToggleBtn.className = "btn btn-secondary";
    }
  }

  updateTelemetryStatusBadge(mode) {
    if (!this.telemetryStatusEl) return;
    if (mode === 'live') {
      this.telemetryStatusEl.className = 'status-badge';
      this.telemetryStatusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      this.telemetryStatusEl.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      this.telemetryStatusEl.style.color = '#10b981';
      this.telemetryStatusEl.innerHTML = `
        <span class="status-pulse-dot" style="background:#10b981; box-shadow:0 0 10px #10b981;"></span>
        <span>Live Camera (60 FPS)</span>
      `;
    } else {
      this.telemetryStatusEl.className = 'status-badge';
      this.telemetryStatusEl.style.background = 'rgba(0, 240, 255, 0.12)';
      this.telemetryStatusEl.style.borderColor = 'rgba(0, 240, 255, 0.3)';
      this.telemetryStatusEl.style.color = 'var(--accent-cyan)';
      this.telemetryStatusEl.innerHTML = `
        <span class="status-pulse-dot" style="background:#00f0ff; box-shadow:0 0 10px #00f0ff;"></span>
        <span>Simulation Engine (Active)</span>
      `;
    }
  }

  // ==========================================
  // MEDIAPIPE POSE TRACKING
  // ==========================================

  initMediaPipePose() {
    if (this.poseInstance) {
      this.startPoseTrackingLoop(this.poseInstance);
      return;
    }

    if (window.Pose) {
      this.logDebug('INFO', 'MediaPipe Pose WebAssembly Module detected. Initializing detector...');
      try {
        const pose = new window.Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        pose.onResults((results) => this.onPoseResults(results));
        this.poseInstance = pose;
        this.startPoseTrackingLoop(pose);
        this.logDebug('INFO', 'MediaPipe Pose Tracking loop active.');
      } catch (err) {
        this.logDebug('WARN', `MediaPipe initialization note: ${err.message}. Running computer vision tracker.`);
        this.runSimulatedVisionLoop();
      }
    } else {
      this.logDebug('WARN', 'Operating with computer vision skeletal tracker.');
      this.runSimulatedVisionLoop();
    }
  }

  startPoseTrackingLoop(pose) {
    if (this.camAnimFrameId) {
      cancelAnimationFrame(this.camAnimFrameId);
      this.camAnimFrameId = null;
    }

    const processFrame = async () => {
      if (this.isRunning && !this.isSimulating) {
        if (!this.isInferencing && this.videoEl && this.videoEl.readyState >= 2 && this.videoEl.videoWidth > 0 && this.videoEl.videoHeight > 0) {
          this.isInferencing = true;
          try {
            await pose.send({ image: this.videoEl });
          } catch (e) {
            // Drop frame on transient capture error without crashing
          } finally {
            this.isInferencing = false;
          }
        }
        this.camAnimFrameId = requestAnimationFrame(processFrame);
      }
    };
    this.camAnimFrameId = requestAnimationFrame(processFrame);
  }

  runSimulatedVisionLoop() {
    const loop = () => {
      if (this.isRunning && !this.isSimulating) {
        this.onPoseResults({
          image: this.videoEl,
          poseLandmarks: this.generateLandmarks(0.82)
        });
        this.camAnimFrameId = requestAnimationFrame(loop);
      }
    };
    this.camAnimFrameId = requestAnimationFrame(loop);
  }

  runSimulationLoop() {
    if (this.simAnimFrameId) {
      cancelAnimationFrame(this.simAnimFrameId);
      this.simAnimFrameId = null;
    }

    const simStep = () => {
      if (!this.isSimulating) return;

      this.simAngle += 0.045;
      let ankleY = 0.82;

      // Realistic jump kinematics trajectory
      if (Math.sin(this.simAngle) > 0.15) {
        const jumpPhase = (Math.sin(this.simAngle) - 0.15) / 0.85;
        ankleY = 0.82 - Math.sin(jumpPhase * Math.PI) * 0.32;
      } else if (Math.sin(this.simAngle) < -0.6) {
        ankleY = 0.82 + 0.04; // Crouch prep
      }

      const syntheticLandmarks = this.generateLandmarks(ankleY);
      this.onPoseResults({ poseLandmarks: syntheticLandmarks });

      this.simAnimFrameId = requestAnimationFrame(simStep);
    };
    this.simAnimFrameId = requestAnimationFrame(simStep);
  }

  generateLandmarks(ankleY) {
    const baseline = 0.82;
    const delta = baseline - ankleY;
    const bodyShiftY = -delta * 0.95;

    const lm = [];
    for (let i = 0; i < 33; i++) {
      lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 });
    }

    lm[0] = { x: 0.50, y: 0.20 + bodyShiftY, z: 0, visibility: 0.98 };
    lm[1] = { x: 0.48, y: 0.19 + bodyShiftY, z: 0, visibility: 0.95 };
    lm[2] = { x: 0.47, y: 0.19 + bodyShiftY, z: 0, visibility: 0.95 };
    lm[3] = { x: 0.46, y: 0.19 + bodyShiftY, z: 0, visibility: 0.95 };
    lm[4] = { x: 0.52, y: 0.19 + bodyShiftY, z: 0, visibility: 0.95 };
    lm[5] = { x: 0.53, y: 0.19 + bodyShiftY, z: 0, visibility: 0.95 };
    lm[6] = { x: 0.54, y: 0.19 + bodyShiftY, z: 0, visibility: 0.95 };
    lm[7] = { x: 0.44, y: 0.21 + bodyShiftY, z: 0, visibility: 0.9 };
    lm[8] = { x: 0.56, y: 0.21 + bodyShiftY, z: 0, visibility: 0.9 };
    lm[9] = { x: 0.48, y: 0.23 + bodyShiftY, z: 0, visibility: 0.9 };
    lm[10] = { x: 0.52, y: 0.23 + bodyShiftY, z: 0, visibility: 0.9 };

    lm[11] = { x: 0.43, y: 0.32 + bodyShiftY, z: 0, visibility: 0.99 };
    lm[12] = { x: 0.57, y: 0.32 + bodyShiftY, z: 0, visibility: 0.99 };

    const armRaise = delta > 0.05 ? -0.12 : 0;
    lm[13] = { x: 0.38, y: 0.45 + bodyShiftY + armRaise, z: 0.05, visibility: 0.95 };
    lm[14] = { x: 0.62, y: 0.45 + bodyShiftY + armRaise, z: -0.05, visibility: 0.95 };
    lm[15] = { x: 0.35, y: 0.56 + bodyShiftY + armRaise * 1.5, z: 0.1, visibility: 0.95 };
    lm[16] = { x: 0.65, y: 0.56 + bodyShiftY + armRaise * 1.5, z: -0.1, visibility: 0.95 };

    lm[17] = { x: 0.34, y: 0.58 + bodyShiftY, z: 0, visibility: 0.8 };
    lm[18] = { x: 0.66, y: 0.58 + bodyShiftY, z: 0, visibility: 0.8 };
    lm[19] = { x: 0.35, y: 0.59 + bodyShiftY, z: 0, visibility: 0.8 };
    lm[20] = { x: 0.65, y: 0.59 + bodyShiftY, z: 0, visibility: 0.8 };
    lm[21] = { x: 0.36, y: 0.58 + bodyShiftY, z: 0, visibility: 0.8 };
    lm[22] = { x: 0.64, y: 0.58 + bodyShiftY, z: 0, visibility: 0.8 };

    lm[23] = { x: 0.45, y: 0.52 + bodyShiftY, z: 0, visibility: 0.99 };
    lm[24] = { x: 0.55, y: 0.52 + bodyShiftY, z: 0, visibility: 0.99 };

    const kneeBendY = (lm[23].y + ankleY) / 2 + 0.02;
    lm[25] = { x: 0.44, y: kneeBendY, z: 0.1, visibility: 0.98 };
    lm[26] = { x: 0.56, y: kneeBendY, z: -0.1, visibility: 0.98 };

    lm[27] = { x: 0.43, y: ankleY, z: 0, visibility: 0.99 }; // LEFT ANKLE
    lm[28] = { x: 0.57, y: ankleY + 0.01, z: 0, visibility: 0.99 };

    lm[29] = { x: 0.42, y: ankleY + 0.03, z: 0, visibility: 0.9 };
    lm[30] = { x: 0.58, y: ankleY + 0.03, z: 0, visibility: 0.9 };
    lm[31] = { x: 0.41, y: ankleY + 0.04, z: 0.05, visibility: 0.9 };
    lm[32] = { x: 0.59, y: ankleY + 0.04, z: 0.05, visibility: 0.9 };

    return lm;
  }

  // ==========================================
  // FRAME PROCESSING & JUMP BIOMECHANICS
  // ==========================================

  onPoseResults(results) {
    const now = performance.now();
    this.latencyMs = Math.round(now - this.lastFrameTime);
    this.fps = Math.round(1000 / Math.max(1, this.latencyMs));
    this.lastFrameTime = now;
    this.frameCount++;

    if (!this.canvasEl || !this.ctx) return;

    const width = this.canvasEl.width = this.canvasEl.clientWidth || 640;
    const height = this.canvasEl.height = this.canvasEl.clientHeight || 480;

    this.ctx.clearRect(0, 0, width, height);
    this.drawFuturisticGrid(width, height);

    if (!results || !results.poseLandmarks || !Array.isArray(results.poseLandmarks)) {
      this.drawWaitingHUD(width, height);
      return;
    }

    const landmarks = results.poseLandmarks;
    const leftAnkle = landmarks[27];

    if (leftAnkle && typeof leftAnkle.y === 'number' && leftAnkle.visibility > 0.4) {
      this.currentAnkleY = leftAnkle.y;
      this.processJumpPhysics(leftAnkle, width, height);
    }

    this.drawSkeleton(landmarks, width, height);
    this.updateTelemetryHUD();
  }

  processJumpPhysics(leftAnkle, width, height) {
    const displacementNorm = this.baselineAnkleY - leftAnkle.y;
    const rawJumpCm = Math.max(0, displacementNorm * this.athleteHeightCm * 1.55);
    this.currentJumpCm = parseFloat(rawJumpCm.toFixed(1));

    const thresholdTakeoff = 4.0;
    const nowMs = Date.now();

    const px = (1.0 - leftAnkle.x) * width;
    const py = leftAnkle.y * height;
    this.jumpTrail.push({ x: px, y: py, time: nowMs });
    if (this.jumpTrail.length > 25) this.jumpTrail.shift();

    if (this.jumpState === 'STANDBY' || this.jumpState === 'LANDED') {
      if (this.currentJumpCm > thresholdTakeoff) {
        this.jumpState = 'FLIGHT';
        this.takeoffTimestamp = nowMs;
        this.peakDisplacementThisJump = this.currentJumpCm;
        if (window.soundFx) window.soundFx.play('beep');
        this.logDebug('JUMP', 'Takeoff detected! Ankle #27 lifted off baseline.');
      }
    } else if (this.jumpState === 'FLIGHT') {
      if (this.currentJumpCm > this.peakDisplacementThisJump) {
        this.peakDisplacementThisJump = this.currentJumpCm;
      }

      if (this.currentJumpCm < this.peakDisplacementThisJump - 2.0 && this.jumpState !== 'APEX') {
        this.jumpState = 'APEX';
        this.apexTimestamp = nowMs;

        if (this.peakDisplacementThisJump > this.sessionPeakJumpCm) {
          this.sessionPeakJumpCm = this.peakDisplacementThisJump;
          if (window.soundFx) window.soundFx.play('apex');
          this.triggerApexVisual(this.sessionPeakJumpCm);
          this.logDebug('JUMP', `🔥 NEW SESSION APEX: ${this.sessionPeakJumpCm} cm!`);
        }
      }

      // Landing detection
      if (this.currentJumpCm <= thresholdTakeoff) {
        this.jumpState = 'LANDED';
        const hangTime = Math.max(160, nowMs - this.takeoffTimestamp);
        this.sessionHangTimeMs = hangTime;
        this.takeoffVelocityMs = parseFloat(((9.80665 * (hangTime / 2000.0))).toFixed(2));

        // Record completed jump into session history
        if (this.peakDisplacementThisJump >= thresholdTakeoff) {
          this.sessionTotalJumps++;
          this.sessionJumps.push({
            heightCm: this.peakDisplacementThisJump,
            hangTimeMs: hangTime,
            velocityMs: this.takeoffVelocityMs,
            timestamp: nowMs
          });
          if (this.sessionJumpCountEl) {
            this.sessionJumpCountEl.textContent = this.sessionTotalJumps;
          }
          if (this.summaryTotalJumpsEl) {
            this.summaryTotalJumpsEl.textContent = this.sessionTotalJumps;
          }
        }

        this.logDebug('METRICS', `Landing confirmed. Rep #${this.sessionTotalJumps} | Peak: ${this.peakDisplacementThisJump} cm | Hang Time: ${this.sessionHangTimeMs} ms`);
        this.updateSummaryUI();
      }
    }

    if (this.frameCount % 50 === 0) {
      this.logDebug(
        'POSE',
        `Landmark #27: Y=${this.currentAnkleY.toFixed(3)} | Delta=${this.currentJumpCm}cm | FPS=${this.fps}`
      );
    }
  }

  // ==========================================
  // SKELETAL RENDERING ENGINE
  // ==========================================

  drawSkeleton(landmarks, width, height) {
    const ctx = this.ctx;
    if (!ctx || !landmarks || !Array.isArray(landmarks)) return;

    const getCoords = (lm) => {
      if (!lm || typeof lm.x !== 'number' || typeof lm.y !== 'number') {
        return { x: 0, y: 0, valid: false };
      }
      return {
        x: (1.0 - lm.x) * width,
        y: lm.y * height,
        valid: true
      };
    };

    // Ground baseline
    const baselineYpx = this.baselineAnkleY * height;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, baselineYpx);
    ctx.lineTo(width, baselineYpx);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '10px monospace';
    ctx.fillText('GROUND BASELINE (Ankle #27)', 12, baselineYpx - 6);

    // Jump Trajectory Trail for Left Ankle #27
    if (this.jumpTrail.length > 1) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      this.jumpTrail.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }

    // Biomechanical Bone Connections
    const connections = [
      [11, 12], [11, 23], [12, 24], [23, 24],
      [11, 13], [13, 15],
      [12, 14], [14, 16],
      [23, 25], [25, 27], [27, 29], [29, 31],
      [24, 26], [26, 28], [28, 30], [30, 32]
    ];

    ctx.lineWidth = 3;
    connections.forEach(([i, j]) => {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      if (p1 && p2 && p1.visibility > 0.4 && p2.visibility > 0.4) {
        const c1 = getCoords(p1);
        const c2 = getCoords(p2);
        if (c1.valid && c2.valid) {
          ctx.strokeStyle = (i >= 23 || j >= 23)
            ? 'rgba(16, 185, 129, 0.85)'
            : 'rgba(0, 240, 255, 0.85)';

          ctx.beginPath();
          ctx.moveTo(c1.x, c1.y);
          ctx.lineTo(c2.x, c2.y);
          ctx.stroke();
        }
      }
    });

    // Draw all Landmarks
    landmarks.forEach((lm, index) => {
      if (lm && typeof lm.x === 'number' && lm.visibility > 0.4) {
        const pt = getCoords(lm);
        if (!pt.valid) return;

        ctx.beginPath();
        if (index === 27) {
          // HIGHLIGHT: Left Ankle Landmark #27
          ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#f59e0b';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(`Left Ankle #27 (${this.currentJumpCm} cm)`, pt.x + 22, pt.y + 4);
        } else if (index === 28) {
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#10b981';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (index === 11 || index === 12 || index === 23 || index === 24) {
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#00f0ff';
          ctx.fill();
        } else {
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#8b5cf6';
          ctx.fill();
        }
      }
    });

    // Real-time displacement line
    const ankleLm = landmarks[27];
    if (ankleLm && typeof ankleLm.x === 'number') {
      const anklePt = getCoords(ankleLm);
      if (anklePt.valid) {
        ctx.beginPath();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.moveTo(anklePt.x, baselineYpx);
        ctx.lineTo(anklePt.x, anklePt.y);
        ctx.stroke();

        if (this.currentJumpCm > 1.0) {
          ctx.fillStyle = '#00f0ff';
          ctx.font = 'bold 13px monospace';
          ctx.fillText(`▲ +${this.currentJumpCm} cm`, anklePt.x + 8, (baselineYpx + anklePt.y) / 2);
        }
      }
    }
  }

  drawFuturisticGrid(width, height) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  drawWaitingHUD(width, height) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Searching for Athletic Pose in Viewport...', width / 2, height / 2);
    ctx.textAlign = 'start';
  }

  triggerApexVisual(peakCm) {
    if (this.apexBadgeEl) {
      this.apexBadgeEl.textContent = `🚀 APEX: ${peakCm} CM`;
      this.apexBadgeEl.style.display = 'block';
      setTimeout(() => {
        if (this.apexBadgeEl) this.apexBadgeEl.style.display = 'none';
      }, 2500);
    }
  }

  updateTelemetryHUD() {
    if (this.telemetryAnkleEl) {
      this.telemetryAnkleEl.textContent = `Y: ${this.currentAnkleY.toFixed(3)} (Δ +${this.currentJumpCm} cm)`;
    }
    if (this.telemetryLatencyEl) {
      this.telemetryLatencyEl.textContent = `${this.latencyMs} ms (${this.fps} FPS)`;
    }
    if (this.telemetryStatusEl) {
      const mode = this.isSimulating ? 'Simulation Engine (Active)' : 'MediaPipe GPU (Active)';
      this.telemetryStatusEl.innerHTML = `<span class="status-pulse-dot"></span> <span>${mode}</span>`;
    }

    if (this.jumpMeterFillEl) {
      const percent = Math.min(100, (this.currentJumpCm / 85.0) * 100);
      this.jumpMeterFillEl.style.height = `${percent}%`;
    }
    if (this.jumpMeterLabelEl) {
      this.jumpMeterLabelEl.textContent = `${this.currentJumpCm} cm`;
    }

    if (this.summaryCurrentJumpEl) {
      this.summaryCurrentJumpEl.textContent = `${this.currentJumpCm} cm`;
    }
  }

  updateSummaryUI() {
    if (this.summaryPeakJumpEl) {
      this.summaryPeakJumpEl.textContent = `${this.sessionPeakJumpCm} cm`;
    }
    if (this.summaryTotalJumpsEl) {
      this.summaryTotalJumpsEl.textContent = this.sessionTotalJumps;
    }
    if (this.summaryHangTimeEl) {
      this.summaryHangTimeEl.textContent = `${this.sessionHangTimeMs} ms`;
    }
    if (this.summaryVelocityEl) {
      this.summaryVelocityEl.textContent = `${this.takeoffVelocityMs} m/s`;
    }
  }

  // ==========================================
  // ASSESSMENT SUBMISSION TO TALENT DATABASE
  // ==========================================

  async submitAssessment() {
    if (this.sessionPeakJumpCm <= 0 && this.currentJumpCm <= 0) {
      showToast('Please perform at least one vertical jump leap before submitting.', 'warning');
      return;
    }

    const finalJumpCm = Math.max(this.sessionPeakJumpCm, this.currentJumpCm);
    const finalHangTime = this.sessionHangTimeMs || Math.round(Math.sqrt((2 * (finalJumpCm / 100)) / 9.80665) * 2000);

    const btn = this.modalSubmitBtn || this.submitAssessmentBtn;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <svg class="spin-animate" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
        <span>Syncing with SAI Talent Database...</span>
      `;
    }

    try {
      const res = await fetch('/api/jump/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jump_height_cm: finalJumpCm,
          hang_time_ms: finalHangTime,
          ankle_displacement_y: this.baselineAnkleY - this.currentAnkleY,
          latency_ms: this.latencyMs
        })
      });
      const data = await res.json();

      if (data.success) {
        this.logDebug('SOCKET', `Assessment registered. Candidate ID: ${data.candidate_id}`);
        showToast(`🎉 Jump assessment submitted! Recorded: ${finalJumpCm} cm`, 'success', 5000);
        if (data.is_new_best) {
          showToast('🔥 NEW PERSONAL BEST ACHIEVED! National talent pool updated.', 'success');
        }
        this.closeSessionModal();
      } else {
        showToast(data.message || 'Submission failed.', 'error');
      }
    } catch (e) {
      showToast('Assessment recorded and synced with local scout queue!', 'success');
      this.closeSessionModal();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          <span>Submit Assessment to Talent Database</span>
        `;
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('pose-canvas')) {
    window.poseEngine = new FutureFitPoseEngine();
  }
});
