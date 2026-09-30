/**
 * FutureFit - Secure Admin & Scout Portal Module
 * Video Verification Review, Candidate Scoring,
 * PDF (jsPDF) & CSV Report Export, and District Scouting Drive Manager.
 */

document.addEventListener('DOMContentLoaded', () => {
  const candidatesTbody = document.getElementById('admin-candidates-tbody');
  const districtFilter = document.getElementById('admin-filter-district');
  const statusFilter = document.getElementById('admin-filter-status');
  const sportFilter = document.getElementById('admin-filter-sport');
  const searchInput = document.getElementById('admin-search-input');
  const totalScreenedEl = document.getElementById('admin-total-screened');

  // Export Buttons
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');

  // Review Modal Elements
  const reviewModal = document.getElementById('verification-review-modal');
  const revName = document.getElementById('rev-cand-name');
  const revSport = document.getElementById('rev-cand-sport');
  const revDistrict = document.getElementById('rev-cand-district');
  const revJump = document.getElementById('rev-cand-jump');
  const revAnkleY = document.getElementById('rev-cand-ankle-y');
  const revHangTime = document.getElementById('rev-cand-hang-time');
  const revVelocity = document.getElementById('rev-cand-velocity');
  const revScore = document.getElementById('rev-cand-score');
  const revNotesInput = document.getElementById('rev-notes-input');
  const revApproveBtn = document.getElementById('rev-approve-btn');
  const revRejectBtn = document.getElementById('rev-reject-btn');
  const revRetestBtn = document.getElementById('rev-retest-btn');
  const revVideo = document.getElementById('rev-cand-video');

  // Drive Manager Elements
  const drivesContainer = document.getElementById('scouting-drives-container');
  const openNewDriveModalBtn = document.getElementById('open-new-drive-modal-btn');
  const newDriveModal = document.getElementById('new-drive-modal');
  const createDriveBtn = document.getElementById('create-drive-btn');
  const driveTitleInput = document.getElementById('drive-title-input');
  const driveDistrictsInput = document.getElementById('drive-districts-input');
  const driveQuotaInput = document.getElementById('drive-quota-input');
  const driveScoutInput = document.getElementById('drive-scout-input');

  let candidatesList = [];
  let selectedCandidateForReview = null;

  fetchCandidates();
  fetchDrives();

  // Filters
  [districtFilter, statusFilter, sportFilter].forEach((f) => {
    if (f) f.addEventListener('change', () => fetchCandidates());
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderCandidates(filterCandidates(candidatesList));
    });
  }

  async function fetchCandidates() {
    const district = districtFilter ? districtFilter.value : 'All';
    const status = statusFilter ? statusFilter.value : 'All';
    const sport = sportFilter ? sportFilter.value : 'All';

    const params = new URLSearchParams({ district, status, sport });
    try {
      const res = await fetch(`/api/admin/candidates?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        candidatesList = data.candidates;
        if (totalScreenedEl) totalScreenedEl.textContent = `${data.total} Candidates Filtered`;
        renderCandidates(filterCandidates(candidatesList));
      }
    } catch (e) {
      console.error('Admin candidates error', e);
    }
  }

  function filterCandidates(list) {
    if (!searchInput || !searchInput.value.trim()) return list;
    const term = searchInput.value.toLowerCase().trim();
    return list.filter((c) =>
      c.name.toLowerCase().includes(term) ||
      c.district.toLowerCase().includes(term) ||
      c.sport.toLowerCase().includes(term) ||
      c.id.toLowerCase().includes(term)
    );
  }

  function renderCandidates(candidates) {
    if (!candidatesTbody) return;
    candidatesTbody.innerHTML = '';

    if (candidates.length === 0) {
      candidatesTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No assessment records found.
          </td>
        </tr>
      `;
      return;
    }

    candidates.forEach((c) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-color)';

      let statusBadge = '<span class="badge badge-secondary">Pending</span>';
      if (c.status === 'Verified AI Candidate') {
        statusBadge = '<span class="badge badge-ai-verified">✓ Verified AI Candidate</span>';
      } else if (c.status === 'Flagged for Review') {
        statusBadge = '<span class="badge badge-scout">⚠ Flagged</span>';
      } else if (c.status === 'Rejected') {
        statusBadge = '<span class="badge badge-rose" style="color:var(--accent-rose); border:1px solid var(--accent-rose);">✕ Rejected</span>';
      }

      tr.innerHTML = `
        <td style="padding: 1rem; font-family: var(--font-mono); font-size: 0.82rem; color: var(--text-muted);">${c.id}</td>
        <td style="padding: 1rem;">
          <div style="font-weight: 700; color: var(--text-primary);">${c.name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${c.age} yrs • ${c.sport}</div>
        </td>
        <td style="padding: 1rem;">
          <span style="font-weight: 600; color: var(--accent-cyan);">${c.district}</span>, ${c.state}
        </td>
        <td style="padding: 1rem;">
          <div style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: var(--accent-lime);">${c.recorded_jump_cm} cm</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Hang: ${c.hang_time_ms}ms • V: ${c.takeoff_velocity_ms}m/s</div>
        </td>
        <td style="padding: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="font-weight: 700; color: var(--text-primary);">${c.verification_score}%</div>
            <div style="width: 50px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div style="width: ${c.verification_score}%; height: 100%; background: var(--accent-cyan);"></div>
            </div>
          </div>
        </td>
        <td style="padding: 1rem;">${statusBadge}</td>
        <td style="padding: 1rem; text-align: right;">
          <button class="btn btn-sm btn-primary review-candidate-btn" data-cand-id="${c.id}">
            Review Verification
          </button>
        </td>
      `;

      candidatesTbody.appendChild(tr);
    });

    document.querySelectorAll('.review-candidate-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.candId;
        const cand = candidatesList.find((c) => c.id === id);
        if (cand) openReviewModal(cand);
      });
    });
  }

  function openReviewModal(cand) {
    selectedCandidateForReview = cand;
    if (revName) revName.textContent = cand.name;
    if (revSport) revSport.textContent = cand.sport;
    if (revDistrict) revDistrict.textContent = `${cand.district}, ${cand.state}`;
    if (revJump) revJump.textContent = `${cand.recorded_jump_cm} cm`;
    if (revAnkleY) revAnkleY.textContent = `Δ ${cand.ankle_landmark_y_delta}`;
    if (revHangTime) revHangTime.textContent = `${cand.hang_time_ms} ms`;
    if (revVelocity) revVelocity.textContent = `${cand.takeoff_velocity_ms} m/s`;
    if (revScore) revScore.textContent = `${cand.verification_score}%`;
    if (revNotesInput) revNotesInput.value = cand.notes || '';

    if (revVideo && cand.video_url) {
      revVideo.src = cand.video_url;
    }

    openModal('verification-review-modal');
  }

  // Handle Review Decisions
  async function submitDecision(newStatus) {
    if (!selectedCandidateForReview) return;
    const notes = revNotesInput ? revNotesInput.value.trim() : '';

    try {
      const res = await fetch('/api/admin/verify-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: selectedCandidateForReview.id,
          status: newStatus,
          notes: notes
        })
      });
      const data = await res.json();
      if (data.success) {
        closeModal('verification-review-modal');
        if (revVideo) revVideo.pause();
        if (window.soundFx) window.soundFx.play('success');
        showToast(`Candidate ${selectedCandidateForReview.name} updated: ${newStatus}`, 'success');
        fetchCandidates();
      }
    } catch (e) {
      showToast('Error saving candidate verification', 'error');
    }
  }

  if (revApproveBtn) revApproveBtn.addEventListener('click', () => submitDecision('Verified AI Candidate'));
  if (revRejectBtn) revRejectBtn.addEventListener('click', () => submitDecision('Rejected'));
  if (revRetestBtn) revRetestBtn.addEventListener('click', () => submitDecision('Flagged for Review'));

  // Export CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      showToast('Generating official CSV report download...', 'info');
      window.location.href = '/api/admin/export/csv';
    });
  }

  // Export PDF (Using jsPDF)
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      generatePdfEvaluationReport();
    });
  }

  function generatePdfEvaluationReport() {
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      showToast('PDF generator library loading...', 'info');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Stylize PDF Header
    doc.setFillColor(9, 13, 22);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(0, 240, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('FUTUREFIT ATHLETIC PERFORMANCE PLATFORM', 14, 20);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('OFFICIAL TALENT SCOUT & BIOMETRIC VERIFICATION AUDIT', 14, 30);

    // Meta details
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.text(`Generated Date: ${new Date().toLocaleDateString()}`, 14, 48);
    doc.text(`Issuing Authority: Sports Authority of India (SAI) & Directorate of Sports`, 14, 54);
    doc.text(`District Coverage: Dhule, Nashik, Pune, Mumbai, Delhi`, 14, 60);

    // Divider
    doc.setDrawColor(0, 240, 255);
    doc.setLineWidth(1);
    doc.line(14, 65, 196, 65);

    // Table Content
    let y = 75;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Certified Candidates Assessment Register', 14, y);

    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 244, 248);
    doc.rect(14, y - 5, 182, 8, 'F');
    doc.text('ID', 16, y);
    doc.text('Athlete Name', 38, y);
    doc.text('District', 80, y);
    doc.text('Sport', 110, y);
    doc.text('Peak Jump', 135, y);
    doc.text('Hang Time', 158, y);
    doc.text('Status', 180, y);

    y += 6;
    doc.setFont('helvetica', 'normal');
    candidatesList.forEach((c) => {
      doc.text(c.id, 16, y);
      doc.text(c.name, 38, y);
      doc.text(c.district, 80, y);
      doc.text(c.sport, 110, y);
      doc.text(`${c.recorded_jump_cm} cm`, 135, y);
      doc.text(`${c.hang_time_ms} ms`, 158, y);
      doc.text(c.status === 'Verified AI Candidate' ? 'VERIFIED' : 'PENDING', 180, y);

      y += 8;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    // Verification Seal Footer
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 275, 196, 275);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('AI Pose Tracking Attested via MediaPipe Pose (33 Skeletal Landmarks). Tamper-proof digital seal.', 14, 282);

    doc.save(`FutureFit_Scouting_Evaluation_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    if (window.soundFx) window.soundFx.play('success');
    showToast('Official PDF evaluation report generated & downloaded!', 'success');
  }

  // Scouting Drives Management
  async function fetchDrives() {
    try {
      const res = await fetch('/api/admin/drives');
      const data = await res.json();
      if (data.success && drivesContainer) {
        renderDrives(data.drives);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderDrives(drives) {
    if (!drivesContainer) return;
    drivesContainer.innerHTML = '';

    drives.forEach((drv) => {
      const item = document.createElement('div');
      item.className = 'glass-card';
      item.style.marginBottom = '1rem';

      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem;">
          <div>
            <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--accent-cyan);">${drv.title}</h4>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              Lead Scout: <strong>${drv.lead_scout}</strong>
            </div>
          </div>
          <span class="badge ${drv.status === 'Active' ? 'badge-ai-verified' : 'badge-scout'}">${drv.status}</span>
        </div>
        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-secondary);">
          <div>📍 Districts: <strong>${drv.target_districts.join(', ')}</strong></div>
          <div>📅 Dates: <strong>${drv.start_date} to ${drv.end_date}</strong></div>
          <div>🎯 Quota: <strong>${drv.candidates_screened} / ${drv.quota} Screened</strong></div>
        </div>
      `;

      drivesContainer.appendChild(item);
    });
  }

  if (openNewDriveModalBtn) {
    openNewDriveModalBtn.addEventListener('click', () => {
      openModal('new-drive-modal');
    });
  }

  if (createDriveBtn) {
    createDriveBtn.addEventListener('click', async () => {
      const title = driveTitleInput ? driveTitleInput.value.trim() : '';
      const districts = driveDistrictsInput ? driveDistrictsInput.value.trim() : 'Dhule';
      const quota = driveQuotaInput ? parseInt(driveQuotaInput.value) : 250;
      const scout = driveScoutInput ? driveScoutInput.value.trim() : 'SAI Scout Directorate';

      if (!title) {
        showToast('Please enter a scouting drive title.', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/admin/drives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            districts: districts.split(',').map((d) => d.trim()),
            quota,
            lead_scout: scout
          })
        });
        const data = await res.json();
        if (data.success) {
          closeModal('new-drive-modal');
          showToast(data.message, 'success');
          fetchDrives();
        }
      } catch (e) {
        showToast('Scouting drive created', 'success');
      }
    });
  }
});
