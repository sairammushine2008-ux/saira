/**
 * FutureFit - Talent Scout & Leaderboard System
 * Filterable by District (Dhule, Nashik, Pune, Mumbai, Delhi),
 * State, Sport, Gender, and Timeframe. Verified AI Badges.
 */

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('leaderboard-tbody');
  const districtSelect = document.getElementById('filter-district');
  const stateSelect = document.getElementById('filter-state');
  const sportSelect = document.getElementById('filter-sport');
  const genderSelect = document.getElementById('filter-gender');
  const timeframePills = document.querySelectorAll('.timeframe-pill');
  const searchInput = document.getElementById('search-athlete-input');
  const totalAthletesCountEl = document.getElementById('total-athletes-count');

  // Athlete Profile Modal
  const athleteModal = document.getElementById('athlete-profile-modal');
  const modalAvatar = document.getElementById('ath-modal-avatar');
  const modalName = document.getElementById('ath-modal-name');
  const modalLocation = document.getElementById('ath-modal-location');
  const modalSport = document.getElementById('ath-modal-sport');
  const modalPeakJump = document.getElementById('ath-modal-peak-jump');
  const modalSessions = document.getElementById('ath-modal-sessions');
  const modalRank = document.getElementById('ath-modal-rank');
  const modalBio = document.getElementById('ath-modal-bio');
  const modalBadgesContainer = document.getElementById('ath-modal-badges');
  const modalEndorseBtn = document.getElementById('ath-modal-endorse-btn');

  let currentAthletes = [];
  let currentTimeframe = 'All-Time';
  let activeAthleteInModal = null;

  // Initial Fetch
  fetchLeaderboard();

  // Filter change handlers
  [districtSelect, stateSelect, sportSelect, genderSelect].forEach((select) => {
    if (select) {
      select.addEventListener('change', () => fetchLeaderboard());
    }
  });

  // Timeframe pills
  timeframePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      timeframePills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentTimeframe = pill.dataset.timeframe || 'All-Time';
      fetchLeaderboard();
      showToast(`Leaderboard updated for: ${currentTimeframe}`, 'info');
    });
  });

  // Search input with debounce
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderLeaderboardRows(filterBySearch(currentAthletes));
    });
  }

  async function fetchLeaderboard() {
    const district = districtSelect ? districtSelect.value : 'All';
    const state = stateSelect ? stateSelect.value : 'All';
    const sport = sportSelect ? sportSelect.value : 'All';
    const gender = genderSelect ? genderSelect.value : 'All';

    const params = new URLSearchParams({
      district,
      state,
      sport,
      gender,
      timeframe: currentTimeframe
    });

    try {
      const res = await fetch(`/api/leaderboard?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        currentAthletes = data.athletes;
        if (totalAthletesCountEl) {
          totalAthletesCountEl.textContent = `${data.total} Candidates Filtered`;
        }
        renderLeaderboardRows(filterBySearch(currentAthletes));
      }
    } catch (e) {
      console.error('Leaderboard error', e);
    }
  }

  function filterBySearch(athletes) {
    if (!searchInput || !searchInput.value.trim()) return athletes;
    const term = searchInput.value.toLowerCase().trim();
    return athletes.filter((a) =>
      a.name.toLowerCase().includes(term) ||
      a.district.toLowerCase().includes(term) ||
      a.sport.toLowerCase().includes(term) ||
      a.state.toLowerCase().includes(term)
    );
  }

  function renderLeaderboardRows(athletes) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (athletes.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No athletes found matching the selected district or sports filters.
          </td>
        </tr>
      `;
      return;
    }

    athletes.forEach((ath, idx) => {
      const rank = ath.filter_rank || idx + 1;
      let rankBadge = `<span style="font-weight: 800; font-size: 1rem; color: var(--text-secondary);">#${rank}</span>`;
      if (rank === 1) {
        rankBadge = `<span style="font-size: 1.25rem; font-weight: 800; color: #f59e0b;">🥇 #1</span>`;
      } else if (rank === 2) {
        rankBadge = `<span style="font-size: 1.15rem; font-weight: 800; color: #94a3b8;">🥈 #2</span>`;
      } else if (rank === 3) {
        rankBadge = `<span style="font-size: 1.15rem; font-weight: 800; color: #b45309;">🥉 #3</span>`;
      }

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-color)';
      tr.style.transition = 'var(--transition-smooth)';

      tr.innerHTML = `
        <td style="padding: 1rem; text-align: center;">${rankBadge}</td>
        <td style="padding: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <img src="${ath.avatar}" alt="${ath.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--accent-cyan);" />
            <div>
              <div style="font-weight: 700; color: var(--text-primary);">${ath.name}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${ath.gender}, ${ath.age} yrs</div>
            </div>
          </div>
        </td>
        <td style="padding: 1rem;">
          <span style="font-weight: 600; color: var(--accent-cyan);">${ath.district}</span>,
          <span style="color: var(--text-secondary); font-size: 0.85rem;">${ath.state}</span>
        </td>
        <td style="padding: 1rem;">
          <span class="badge badge-purple">${ath.sport}</span>
        </td>
        <td style="padding: 1rem;">
          <div style="display: flex; align-items: baseline; gap: 0.35rem;">
            <span style="font-family: var(--font-mono); font-size: 1.3rem; font-weight: 800; color: var(--text-primary);">${ath.peak_jump_cm}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">cm</span>
          </div>
        </td>
        <td style="padding: 1rem;">
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            ${ath.verified_ai ? '<span class="badge badge-ai-verified">✓ Verified AI Candidate</span>' : '<span class="badge badge-secondary">Pending Camera</span>'}
            ${ath.scout_endorsed ? '<span class="badge badge-scout">★ SAI Endorsed</span>' : ''}
          </div>
        </td>
        <td style="padding: 1rem; text-align: right;">
          <button class="btn btn-sm btn-outline-cyan view-athlete-btn" data-athlete-id="${ath.id}">
            View Biometrics
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Attach click handlers to "View Biometrics"
    document.querySelectorAll('.view-athlete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const athId = btn.dataset.athleteId;
        const ath = currentAthletes.find((a) => a.id === athId);
        if (ath) openAthleteModal(ath);
      });
    });
  }

  function openAthleteModal(ath) {
    activeAthleteInModal = ath;
    if (modalAvatar) modalAvatar.src = ath.avatar;
    if (modalName) modalName.textContent = ath.name;
    if (modalLocation) modalLocation.textContent = `${ath.district}, ${ath.state} • ${ath.age} yrs (${ath.gender})`;
    if (modalSport) modalSport.textContent = ath.sport;
    if (modalPeakJump) modalPeakJump.textContent = `${ath.peak_jump_cm} cm`;
    if (modalSessions) modalSessions.textContent = `${ath.total_sessions} Sessions`;
    if (modalRank) modalRank.textContent = `#${ath.national_rank}`;
    if (modalBio) modalBio.textContent = ath.bio;

    if (modalBadgesContainer) {
      modalBadgesContainer.innerHTML = `
        ${ath.verified_ai ? '<span class="badge badge-ai-verified">✓ Verified AI Candidate</span>' : ''}
        ${ath.scout_endorsed ? '<span class="badge badge-scout">★ Official SAI Scout Endorsed</span>' : ''}
        <span class="badge badge-cyan">${ath.district} Talent Pool</span>
      `;
    }

    if (modalEndorseBtn) {
      modalEndorseBtn.innerHTML = ath.scout_endorsed
        ? `<span>✓ Endorsed by SAI</span>`
        : `<span>Award Scout Endorsement</span>`;
    }

    openModal('athlete-profile-modal');
  }

  // Handle Endorsement in modal
  if (modalEndorseBtn) {
    modalEndorseBtn.addEventListener('click', () => {
      if (!activeAthleteInModal) return;
      activeAthleteInModal.scout_endorsed = true;
      modalEndorseBtn.innerHTML = `<span>✓ Endorsed by SAI</span>`;
      if (window.soundFx) window.soundFx.play('apex');
      showToast(`Official SAI Scout Endorsement conferred to ${activeAthleteInModal.name}!`, 'success');
      renderLeaderboardRows(filterBySearch(currentAthletes));
    });
  }
});
