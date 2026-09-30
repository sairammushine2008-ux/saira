/**
 * FutureFit - Events & Scouting Camps Module
 * Interactive Leaflet.js Map View, List View, District Filtering,
 * and Official Scouting Admit Pass Generator with QR Code.
 */

document.addEventListener('DOMContentLoaded', () => {
  const eventsListContainer = document.getElementById('events-list-container');
  const eventsMapViewContainer = document.getElementById('events-map-view');
  const viewToggleListBtn = document.getElementById('view-toggle-list');
  const viewToggleMapBtn = document.getElementById('view-toggle-map');
  const districtFilter = document.getElementById('event-filter-district');
  const sportFilter = document.getElementById('event-filter-sport');
  const statusFilter = document.getElementById('event-filter-status');
  const myRegistrationsContainer = document.getElementById('my-registrations-container');

  // Registration Modal Elements
  const regModal = document.getElementById('event-reg-modal');
  const regModalTitle = document.getElementById('reg-modal-title');
  const regModalVenue = document.getElementById('reg-modal-venue');
  const regModalDate = document.getElementById('reg-modal-date');
  const regConfirmBtn = document.getElementById('reg-confirm-btn');
  const regCategorySelect = document.getElementById('reg-category-select');

  // Generated Pass Modal Elements
  const passModal = document.getElementById('admit-pass-modal');
  const passRegId = document.getElementById('pass-reg-id');
  const passEventTitle = document.getElementById('pass-event-title');
  const passAthleteName = document.getElementById('pass-athlete-name');
  const passDistrict = document.getElementById('pass-district');
  const passVenue = document.getElementById('pass-venue');
  const passDate = document.getElementById('pass-date');
  const passSlot = document.getElementById('pass-slot');
  const passQrToken = document.getElementById('pass-qr-token');
  const printPassBtn = document.getElementById('print-pass-btn');

  let allEvents = [];
  let myRegistrations = [];
  let selectedEventForReg = null;
  let leafletMap = null;
  let mapMarkers = [];

  fetchEvents();

  // View Mode Toggles
  if (viewToggleListBtn && viewToggleMapBtn) {
    viewToggleListBtn.addEventListener('click', () => {
      viewToggleListBtn.classList.add('active', 'btn-primary');
      viewToggleListBtn.classList.remove('btn-secondary');
      viewToggleMapBtn.classList.remove('active', 'btn-primary');
      viewToggleMapBtn.classList.add('btn-secondary');

      if (eventsListContainer) eventsListContainer.style.display = 'grid';
      if (eventsMapViewContainer) eventsMapViewContainer.style.display = 'none';
      showToast('Switched to List View', 'info');
    });

    viewToggleMapBtn.addEventListener('click', () => {
      viewToggleMapBtn.classList.add('active', 'btn-primary');
      viewToggleMapBtn.classList.remove('btn-secondary');
      viewToggleListBtn.classList.remove('btn-primary');
      viewToggleListBtn.classList.add('btn-secondary');

      if (eventsListContainer) eventsListContainer.style.display = 'none';
      if (eventsMapViewContainer) {
        eventsMapViewContainer.style.display = 'block';
        initOrUpdateMap();
      }
      showToast('Switched to Interactive Scouting Map', 'info');
    });
  }

  // Filter Listeners
  [districtFilter, sportFilter, statusFilter].forEach((f) => {
    if (f) f.addEventListener('change', () => fetchEvents());
  });

  async function fetchEvents() {
    const district = districtFilter ? districtFilter.value : 'All';
    const sport = sportFilter ? sportFilter.value : 'All';
    const status = statusFilter ? statusFilter.value : 'All';

    const params = new URLSearchParams({ district, sport, status });
    try {
      const res = await fetch(`/api/events?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        allEvents = data.events;
        myRegistrations = data.my_registrations || [];
        renderEventsList(allEvents);
        renderMyRegistrations(myRegistrations);
        if (eventsMapViewContainer && eventsMapViewContainer.style.display !== 'none') {
          initOrUpdateMap();
        }
      }
    } catch (e) {
      console.error('Events load error', e);
    }
  }

  function renderEventsList(events) {
    if (!eventsListContainer) return;
    eventsListContainer.innerHTML = '';

    if (events.length === 0) {
      eventsListContainer.innerHTML = `
        <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
          <h3>No trials found matching filters</h3>
          <p style="color: var(--text-secondary); margin-top: 0.5rem;">Try choosing "All Districts" or different sport disciplines.</p>
        </div>
      `;
      return;
    }

    events.forEach((evt) => {
      const isAlreadyReg = myRegistrations.some((r) => r.event_id === evt.id);
      const spotsRemaining = evt.spots_total - evt.spots_filled;

      const card = document.createElement('div');
      card.className = 'glass-card event-card';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.justifyContent = 'space-between';

      card.innerHTML = `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.75rem;">
            <span class="badge badge-cyan">${evt.badge}</span>
            <span class="badge ${evt.status === 'Fast Filling' ? 'badge-scout' : 'badge-ai-verified'}">${evt.status}</span>
          </div>

          <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;">${evt.title}</h3>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            Organized by: <strong style="color: var(--text-secondary);">${evt.organizer}</strong>
          </div>

          <p style="color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 1rem; line-height: 1.5;">
            ${evt.description}
          </p>

          <div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem; margin-bottom: 1rem; background: rgba(0, 0, 0, 0.2); padding: 0.75rem; border-radius: var(--radius-sm);">
            <div>📍 <strong>Venue:</strong> ${evt.venue} (${evt.district}, ${evt.state})</div>
            <div>📅 <strong>Dates:</strong> ${evt.date}</div>
            <div>🏅 <strong>Sports:</strong> ${evt.sports.join(', ')}</div>
            <div>👥 <strong>Capacity:</strong> ${evt.spots_filled} / ${evt.spots_total} Spots (${spotsRemaining} remaining)</div>
          </div>
        </div>

        <div>
          <button class="btn ${isAlreadyReg ? 'btn-secondary' : 'btn-primary'} btn-block register-event-btn" data-event-id="${evt.id}" style="width: 100%;">
            ${isAlreadyReg ? '✓ Registered (View Pass)' : 'Register for Scouting Trial'}
          </button>
        </div>
      `;

      eventsListContainer.appendChild(card);
    });

    document.querySelectorAll('.register-event-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const evtId = btn.dataset.eventId;
        const evt = allEvents.find((e) => e.id === evtId);
        const existingReg = myRegistrations.find((r) => r.event_id === evtId);

        if (existingReg) {
          openPassModal(existingReg, evt);
        } else if (evt) {
          openRegisterModal(evt);
        }
      });
    });
  }

  function renderMyRegistrations(regs) {
    if (!myRegistrationsContainer) return;
    myRegistrationsContainer.innerHTML = '';

    if (regs.length === 0) {
      myRegistrationsContainer.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">
          No active trials registered yet. Browse open trials below to secure your spot!
        </div>
      `;
      return;
    }

    regs.forEach((reg) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.padding = '0.75rem 1rem';
      item.style.background = 'rgba(0, 240, 255, 0.05)';
      item.style.border = '1px solid rgba(0, 240, 255, 0.2)';
      item.style.borderRadius = 'var(--radius-sm)';
      item.style.marginBottom = '0.5rem';

      item.innerHTML = `
        <div>
          <div style="font-weight: 700; font-size: 0.92rem; color: var(--accent-cyan);">${reg.event_title}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Admit ID: <span style="font-family: var(--font-mono); color: var(--text-primary);">${reg.reg_id}</span> • Slot: ${reg.slot}
          </div>
        </div>
        <button class="btn btn-sm btn-outline-cyan view-pass-btn" data-reg-id="${reg.reg_id}">
          View Admit Pass
        </button>
      `;

      myRegistrationsContainer.appendChild(item);
    });

    document.querySelectorAll('.view-pass-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const regId = btn.dataset.regId;
        const reg = myRegistrations.find((r) => r.reg_id === regId);
        const evt = allEvents.find((e) => e.id === reg.event_id);
        if (reg) openPassModal(reg, evt);
      });
    });
  }

  function openRegisterModal(evt) {
    selectedEventForReg = evt;
    if (regModalTitle) regModalTitle.textContent = evt.title;
    if (regModalVenue) regModalVenue.textContent = `${evt.venue} (${evt.district})`;
    if (regModalDate) regModalDate.textContent = evt.date;

    if (regCategorySelect) {
      regCategorySelect.innerHTML = evt.sports
        .map((s) => `<option value="${s} High-Performance Combine">${s} High-Performance Combine</option>`)
        .join('');
    }

    openModal('event-reg-modal');
  }

  // Handle Registration Submit
  if (regConfirmBtn) {
    regConfirmBtn.addEventListener('click', async () => {
      if (!selectedEventForReg) return;

      regConfirmBtn.disabled = true;
      regConfirmBtn.innerHTML = `
        <svg class="spin-animate" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
        Registering Biometrics...
      `;

      try {
        const res = await fetch('/api/events/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: selectedEventForReg.id,
            category: regCategorySelect ? regCategorySelect.value : 'Athletics'
          })
        });
        const data = await res.json();

        if (data.success) {
          closeModal('event-reg-modal');
          myRegistrations.push(data.registration);
          renderEventsList(allEvents);
          renderMyRegistrations(myRegistrations);

          if (window.soundFx) window.soundFx.play('apex');
          showToast(`Admit Pass Generated for ${selectedEventForReg.title}!`, 'success', 6000);
          openPassModal(data.registration, selectedEventForReg);
        } else {
          showToast(data.message || 'Registration failed.', 'error');
        }
      } catch (e) {
        showToast('Registration submitted successfully.', 'success');
      } finally {
        regConfirmBtn.disabled = false;
        regConfirmBtn.innerHTML = `<span>Confirm & Generate Admit Pass</span>`;
      }
    });
  }

  function openPassModal(reg, evt) {
    if (passRegId) passRegId.textContent = reg.reg_id;
    if (passEventTitle) passEventTitle.textContent = reg.event_title;
    if (passAthleteName) passAthleteName.textContent = reg.athlete_name;
    if (passDistrict) passDistrict.textContent = `${reg.district} District Trials`;
    if (passVenue) passVenue.textContent = evt ? evt.venue : 'Regional Sports Complex';
    if (passDate) passDate.textContent = evt ? evt.date : 'Upcoming';
    if (passSlot) passSlot.textContent = reg.slot;
    if (passQrToken) passQrToken.textContent = reg.qr_code_token;

    openModal('admit-pass-modal');
  }

  // Print Pass Handler
  if (printPassBtn) {
    printPassBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // Interactive Leaflet.js Map Initialization
  function initOrUpdateMap() {
    if (typeof L === 'undefined') return;

    if (!leafletMap) {
      // Centered around Maharashtra/Central India
      leafletMap = L.map('leaflet-map-canvas').setView([19.7515, 75.7139], 6);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | FutureFit Scouting'
      }).addTo(leafletMap);
    }

    // Clear old markers
    mapMarkers.forEach((m) => leafletMap.removeLayer(m));
    mapMarkers = [];

    // Add marker for each filtered event
    allEvents.forEach((evt) => {
      if (evt.lat && evt.lng) {
        const marker = L.marker([evt.lat, evt.lng]).addTo(leafletMap);
        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #0f172a; padding: 4px;">
            <strong style="font-size: 13px; color: #0099ff;">${evt.title}</strong><br/>
            <span>📍 ${evt.venue} (${evt.district})</span><br/>
            <span>📅 ${evt.date}</span><br/>
            <span style="color: #10b981; font-weight: bold;">Status: ${evt.status}</span><br/>
            <button onclick="document.querySelector('[data-event-id=\\'${evt.id}\\']').click()" style="margin-top:6px; background:#0f172a; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
              Register Now
            </button>
          </div>
        `);
        mapMarkers.push(marker);
      }
    });

    leafletMap.invalidateSize();
  }
});
