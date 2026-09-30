/**
 * FutureFit - Global Application Controller
 * Handles Theme Switching, Eye Protection Mode, Web Audio Synthesis, Modals, and Toasts.
 */

// Global State
window.FutureFit = window.FutureFit || {};

// Web Audio API Synthesizer for Athletic Cues & Whistles
class SoundEffectsManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(type = 'beep') {
    try {
      this.init();
      if (!this.ctx || !this.enabled) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'beep') {
        // High crisp countdown beep (880 Hz - A5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'whistle') {
        // Dual athletic referee whistle sound (2400 Hz modulated)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc2.type = 'sine';
        osc.frequency.setValueAtTime(2600, now);
        osc2.frequency.setValueAtTime(2800, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        gain2.gain.setValueAtTime(0.2, now);
        gain2.gain.linearRampToValueAtTime(0.3, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.45);
        osc2.stop(now + 0.45);
      } else if (type === 'apex') {
        // Majestic uplifting chord for peak jump recording
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
          const chordOsc = this.ctx.createOscillator();
          const chordGain = this.ctx.createGain();
          chordOsc.connect(chordGain);
          chordGain.connect(this.ctx.destination);

          chordOsc.type = 'sine';
          chordOsc.frequency.setValueAtTime(freq, now + idx * 0.04);
          chordGain.gain.setValueAtTime(0.08, now + idx * 0.04);
          chordGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

          chordOsc.start(now + idx * 0.04);
          chordOsc.stop(now + 0.55);
        });
      } else if (type === 'success') {
        // Positive confirmation ding
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }
}

window.soundFx = new SoundEffectsManager();

// Toast Notifications System
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="20" height="20" fill="none" stroke="#10b981" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="20" height="20" fill="none" stroke="#f43f5e" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
  } else if (type === 'warning') {
    iconSvg = `<svg width="20" height="20" fill="none" stroke="#f59e0b" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
  } else {
    iconSvg = `<svg width="20" height="20" fill="none" stroke="#00f0ff" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  }

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-msg">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  // Play audio alert
  if (type === 'success') window.soundFx.play('success');

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Modal Management Helper
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// Global Event Listeners & Theme Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Setup Eye Protection Overlay element
  if (!document.getElementById('eye-protection-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'eye-protection-overlay';
    document.body.appendChild(overlay);
  }

  // Restore Theme
  const savedTheme = localStorage.getItem('futurefit_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
  }

  // Restore Eye Protection Mode
  const savedEyeProtection = localStorage.getItem('futurefit_eye_protection') === 'true';
  if (savedEyeProtection) {
    document.body.classList.add('eye-protection-active');
  }

  // Dark / Light Mode Toggle Button
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    updateThemeIcon(savedTheme === 'light');
    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-mode');
      const newTheme = isLight ? 'light' : 'dark';
      localStorage.setItem('futurefit_theme', newTheme);
      updateThemeIcon(isLight);
      showToast(`${isLight ? 'Light Stadium' : 'Deep Athletic Dark'} Mode activated!`, 'info');
    });
  }

  function updateThemeIcon(isLight) {
    if (!themeToggleBtn) return;
    if (isLight) {
      themeToggleBtn.innerHTML = `
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
        </svg>
      `;
      themeToggleBtn.title = "Switch to Dark Mode";
    } else {
      themeToggleBtn.innerHTML = `
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
      `;
      themeToggleBtn.title = "Switch to Light Mode";
    }
  }

  // Eye Protection Warm Tint Toggle Button
  const eyeProtectBtn = document.getElementById('eye-protection-btn');
  if (eyeProtectBtn) {
    if (savedEyeProtection) eyeProtectBtn.classList.add('active');
    eyeProtectBtn.addEventListener('click', () => {
      const isActive = document.body.classList.toggle('eye-protection-active');
      localStorage.setItem('futurefit_eye_protection', isActive);
      eyeProtectBtn.classList.toggle('active', isActive);
      showToast(
        isActive
          ? 'Eye Protection Warm Tint ON (Night Shift Active)'
          : 'Eye Protection Tint OFF',
        isActive ? 'warning' : 'info'
      );
    });
  }

  // User Profile Dropdown Toggle
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userDropdown = document.getElementById('user-dropdown');
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!userDropdown.contains(e.target)) {
        userDropdown.classList.remove('show');
      }
    });
  }

  // Logout Handler: Thorough session & credential clearance
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        // Clear all browser authentication storage and cached state
        localStorage.clear();
        sessionStorage.clear();

        showToast('Signing out... Clearing session state.', 'info');
        const res = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        window.location.href = data.redirect_url || '/';
      } catch (err) {
        window.location.href = '/';
      }
    });
  }

  // Close modals on backdrop click or Escape key
  document.querySelectorAll('.modal-backdrop').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.show').forEach((modal) => {
        modal.classList.remove('show');
        document.body.style.overflow = '';
      });
    }
  });
});
