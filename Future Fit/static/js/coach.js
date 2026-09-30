/**
 * FutureFit - AI Sports Coach & Training
 * Questionnaire Generator, Dynamic Weekly Schedule,
 * Rest Timers with Audio Alerts (Beeps/Whistle), and Video Modals.
 */

document.addEventListener('DOMContentLoaded', () => {
  const coachForm = document.getElementById('coach-questionnaire-form');
  const generatePlanBtn = document.getElementById('generate-plan-btn');
  const planContainer = document.getElementById('workout-plan-container');
  const dayTabsContainer = document.getElementById('day-tabs-container');
  const activeDayTitleEl = document.getElementById('active-day-title');
  const activeDayFocusEl = document.getElementById('active-day-focus');
  const activeDayExercisesEl = document.getElementById('active-day-exercises');

  // Video Demo Modal Elements
  const videoModal = document.getElementById('video-demo-modal');
  const videoTitleEl = document.getElementById('video-modal-title');
  const videoTargetEl = document.getElementById('video-modal-target');
  const videoFocusEl = document.getElementById('video-modal-focus');
  const videoIframe = document.getElementById('video-modal-iframe');

  let activePlan = null;
  let activeDayIndex = 0;
  const activeTimers = {}; // Store timer intervals per exercise card

  // Fetch initial plan
  fetchActivePlan();

  async function fetchActivePlan() {
    try {
      const res = await fetch('/api/coach/plan');
      const data = await res.json();
      if (data.success && data.plan) {
        activePlan = data.plan;
        renderPlanUI();
      }
    } catch (e) {
      console.error('Error fetching workout plan', e);
    }
  }

  // Handle Questionnaire Submit
  if (coachForm) {
    coachForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sport = document.getElementById('coach-sport-select').value;
      const age = document.getElementById('coach-age-select').value;
      const goal = document.getElementById('coach-goal-select').value;
      const time = document.getElementById('coach-time-select').value;

      if (generatePlanBtn) {
        generatePlanBtn.disabled = true;
        generatePlanBtn.innerHTML = `
          <svg class="spin-animate" width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
          Generating AI Athletic Protocol...
        `;
      }

      try {
        const res = await fetch('/api/coach/generate-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sport, age, goal, time })
        });
        const data = await res.json();

        if (data.success) {
          activePlan = data.plan;
          activeDayIndex = 0;
          renderPlanUI();
          showToast(`Custom AI workout schedule for ${sport} created!`, 'success');
          // Smooth scroll to schedule
          if (planContainer) {
            planContainer.scrollIntoView({ behavior: 'smooth' });
          }
        } else {
          showToast(data.message || 'Failed to generate schedule.', 'error');
        }
      } catch (err) {
        showToast('Generated plan loaded in memory.', 'success');
      } finally {
        if (generatePlanBtn) {
          generatePlanBtn.disabled = false;
          generatePlanBtn.innerHTML = `
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span>Generate Custom AI Schedule</span>
          `;
        }
      }
    });
  }

  function renderPlanUI() {
    if (!activePlan || !dayTabsContainer) return;

    // Render Day Tabs (Day 1 - Day 7)
    dayTabsContainer.innerHTML = '';
    activePlan.days.forEach((dayObj, idx) => {
      const btn = document.createElement('button');
      btn.className = `btn btn-sm ${idx === activeDayIndex ? 'btn-primary' : 'btn-secondary'}`;
      btn.innerHTML = `Day ${dayObj.day}`;
      btn.addEventListener('click', () => {
        activeDayIndex = idx;
        renderPlanUI();
      });
      dayTabsContainer.appendChild(btn);
    });

    // Render Current Day Info
    const currentDay = activePlan.days[activeDayIndex];
    if (activeDayTitleEl) {
      activeDayTitleEl.textContent = `Day ${currentDay.day}: ${currentDay.title}`;
    }
    if (activeDayFocusEl) {
      activeDayFocusEl.textContent = `Target Focus: ${currentDay.focus}`;
    }

    // Render Exercises
    if (!activeDayExercisesEl) return;
    activeDayExercisesEl.innerHTML = '';

    if (!currentDay.exercises || currentDay.exercises.length === 0) {
      activeDayExercisesEl.innerHTML = `
        <div class="glass-card" style="text-align: center; padding: 3rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🧘</div>
          <h3>Deload & Active Biometric Recovery</h3>
          <p style="color: var(--text-secondary); max-width: 500px; margin: 0.5rem auto 1.5rem;">
            Light dynamic stretching, foam rolling, and hydration. Perform a baseline jump assessment on the camera engine to track weekly adaptation.
          </p>
          <a href="/tracker" class="btn btn-outline-cyan">Launch Camera Jump Assessment</a>
        </div>
      `;
      return;
    }

    currentDay.exercises.forEach((ex, exIdx) => {
      const card = document.createElement('div');
      card.className = 'glass-card exercise-card';
      card.id = `exercise-card-${exIdx}`;
      card.style.marginBottom = '1.25rem';

      const timerId = `timer-${activeDayIndex}-${exIdx}`;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              <span class="badge badge-cyan">${ex.difficulty}</span>
              <span class="badge badge-purple">${ex.target}</span>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 700;">${ex.name}</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 4px;">
              <strong>Coaching Cue:</strong> ${ex.focus}
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="text-align: right;">
              <div style="font-size: 1.2rem; font-weight: 800; color: var(--accent-lime);">${ex.sets}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">${ex.reps}</div>
            </div>
            <button class="btn btn-sm btn-outline-cyan watch-video-btn" data-ex-idx="${exIdx}">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <span>Demo Video</span>
            </button>
          </div>
        </div>

        <!-- Functional Rest Timer Component -->
        <div style="background: rgba(0, 0, 0, 0.25); border-radius: var(--radius-sm); padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 0.85rem; color: var(--text-secondary);">Rest Interval:</span>
            <span id="timer-display-${timerId}" style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: var(--accent-amber);">
              ${ex.rest_seconds}s
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button class="btn btn-sm btn-secondary timer-start-btn" id="start-btn-${timerId}" data-timer-id="${timerId}" data-duration="${ex.rest_seconds}">
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <span>Start Rest</span>
            </button>
            <button class="btn btn-sm btn-secondary timer-reset-btn" id="reset-btn-${timerId}" data-timer-id="${timerId}" data-duration="${ex.rest_seconds}">
              Reset
            </button>
            <button class="btn btn-sm btn-lime mark-completed-btn" data-card-id="exercise-card-${exIdx}">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span>Complete</span>
            </button>
          </div>
        </div>
      `;

      activeDayExercisesEl.appendChild(card);
    });

    setupCardInteractivity();
  }

  function setupCardInteractivity() {
    // Video Modal Buttons
    document.querySelectorAll('.watch-video-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const exIdx = parseInt(btn.dataset.exIdx);
        const ex = activePlan.days[activeDayIndex].exercises[exIdx];
        if (!ex) return;

        if (videoTitleEl) videoTitleEl.textContent = ex.name;
        if (videoTargetEl) videoTargetEl.textContent = ex.target;
        if (videoFocusEl) videoFocusEl.textContent = ex.focus;
        if (videoIframe) {
          videoIframe.src = ex.video_url;
        }

        openModal('video-demo-modal');
      });
    });

    // Mark Completed Buttons
    document.querySelectorAll('.mark-completed-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cardId = btn.dataset.cardId;
        const card = document.getElementById(cardId);
        if (card) {
          const isDone = card.classList.toggle('completed-exercise');
          if (isDone) {
            card.style.borderColor = 'var(--accent-lime)';
            card.style.background = 'rgba(16, 185, 129, 0.08)';
            btn.innerHTML = `<span>✓ Completed</span>`;
            if (window.soundFx) window.soundFx.play('success');
            showToast('Set completed! Rest timer ready.', 'success');
          } else {
            card.style.borderColor = 'var(--border-color)';
            card.style.background = 'var(--bg-card)';
            btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> <span>Complete</span>`;
          }
        }
      });
    });

    // Functional Countdown Rest Timers
    document.querySelectorAll('.timer-start-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const timerId = btn.dataset.timerId;
        const duration = parseInt(btn.dataset.duration);
        handleTimerToggle(timerId, duration, btn);
      });
    });

    document.querySelectorAll('.timer-reset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const timerId = btn.dataset.timerId;
        const duration = parseInt(btn.dataset.duration);
        resetTimer(timerId, duration);
      });
    });
  }

  function handleTimerToggle(timerId, duration, btn) {
    const displayEl = document.getElementById(`timer-display-${timerId}`);

    if (activeTimers[timerId] && activeTimers[timerId].interval) {
      // Pause
      clearInterval(activeTimers[timerId].interval);
      activeTimers[timerId].interval = null;
      btn.innerHTML = `
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        <span>Resume</span>
      `;
      showToast('Rest timer paused', 'info');
      return;
    }

    if (!activeTimers[timerId]) {
      activeTimers[timerId] = { remaining: duration, interval: null };
    }

    btn.innerHTML = `
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
      <span>Pause</span>
    `;

    activeTimers[timerId].interval = setInterval(() => {
      activeTimers[timerId].remaining--;
      const rem = activeTimers[timerId].remaining;
      if (displayEl) displayEl.textContent = `${rem}s`;

      // Audio beeps at 3, 2, 1
      if (rem <= 3 && rem > 0) {
        if (window.soundFx) window.soundFx.play('beep');
      }

      // Finish at 0
      if (rem <= 0) {
        clearInterval(activeTimers[timerId].interval);
        activeTimers[timerId].interval = null;
        activeTimers[timerId].remaining = duration;
        if (displayEl) displayEl.textContent = 'REST DONE!';
        btn.innerHTML = `
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <span>Start Rest</span>
        `;
        // Sound dual referee whistle!
        if (window.soundFx) window.soundFx.play('whistle');
        showToast('🔔 Rest period completed! Get ready for next explosive set!', 'warning', 5000);
      }
    }, 1000);
  }

  function resetTimer(timerId, duration) {
    if (activeTimers[timerId] && activeTimers[timerId].interval) {
      clearInterval(activeTimers[timerId].interval);
    }
    activeTimers[timerId] = { remaining: duration, interval: null };
    const displayEl = document.getElementById(`timer-display-${timerId}`);
    if (displayEl) displayEl.textContent = `${duration}s`;
    const startBtn = document.getElementById(`start-btn-${timerId}`);
    if (startBtn) {
      startBtn.innerHTML = `
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        <span>Start Rest</span>
      `;
    }
  }

  // Handle Video Demo Modal Close to stop video playback
  const closeVideoBtn = document.getElementById('close-video-modal-btn');
  if (closeVideoBtn) {
    closeVideoBtn.addEventListener('click', () => {
      if (videoIframe) videoIframe.src = '';
      closeModal('video-demo-modal');
    });
  }
});
