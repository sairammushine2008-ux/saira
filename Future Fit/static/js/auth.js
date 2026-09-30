/**
 * FutureFit - Authentication & OTP Verification Flow
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize 3D Scene if canvas container exists
  if (document.getElementById('three-hero-canvas')) {
    new AthleticBiomechanicsScene('three-hero-canvas');
  }

  const authForm = document.getElementById('login-form');
  const identifierInput = document.getElementById('auth-identifier');
  const sendOtpBtn = document.getElementById('send-otp-btn');
  const otpModal = document.getElementById('otp-modal');
  const otpRecipientDisplay = document.getElementById('otp-recipient-display');
  const verifyOtpBtn = document.getElementById('verify-otp-btn');
  const otpCountdownEl = document.getElementById('otp-countdown');
  const resendOtpBtn = document.getElementById('resend-otp-btn');
  const autofillDemoOtpBtn = document.getElementById('autofill-demo-otp-btn');
  const otpInputs = document.querySelectorAll('.otp-box');

  let currentIdentifier = '';
  let countdownInterval = null;
  let countdownSeconds = 60;
  let activeServerOtp = '';

  // Handle Login Form Submit -> Request OTP
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = identifierInput ? identifierInput.value.trim() : '';
      if (!val) {
        showToast('Please enter your phone number or email.', 'warning');
        if (identifierInput) identifierInput.focus();
        return;
      }

      currentIdentifier = val;
      if (sendOtpBtn) {
        sendOtpBtn.disabled = true;
        sendOtpBtn.innerHTML = `
          <svg class="spin-animate" width="18" height="18" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/>
            <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
          Sending SMS...
        `;
      }

      try {
        const res = await fetch('/api/auth/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: currentIdentifier })
        });
        const data = await res.json();

        if (data.success) {
          if (otpRecipientDisplay) {
            otpRecipientDisplay.textContent = currentIdentifier;
          }
          openModal('otp-modal');
          startCountdown();
          clearOtpInputs();

          if (data.demo_otp) {
            activeServerOtp = data.demo_otp;
            if (autofillDemoOtpBtn) {
              autofillDemoOtpBtn.style.display = 'inline-flex';
              autofillDemoOtpBtn.textContent = `⚡ Auto-fill Code (${data.demo_otp})`;
            }
            if (data.fast2sms_message) {
              showToast(`${data.fast2sms_message} (Test OTP: ${data.demo_otp})`, 'warning', 8000);
            } else {
              showToast(`Verification OTP dispatched! Code: ${data.demo_otp}`, 'success', 6000);
            }
          } else {
            activeServerOtp = '';
            if (autofillDemoOtpBtn) {
              autofillDemoOtpBtn.style.display = 'none';
            }
            showToast(`Verification OTP dispatched via Fast2SMS to ${currentIdentifier}!`, 'success', 5000);
          }

          if (otpInputs.length > 0) otpInputs[0].focus();
        } else {
          showToast(data.message || 'Failed to send OTP.', 'error');
        }
      } catch (err) {
        showToast('Network error while requesting OTP. Please retry.', 'error');
      } finally {
        if (sendOtpBtn) {
          sendOtpBtn.disabled = false;
          sendOtpBtn.innerHTML = `
            <span>Send SMS OTP</span>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          `;
        }
      }
    });
  }

  // Biometric Login Handler (Touch ID / Face ID / WebAuthn)
  const biometricLoginBtn = document.getElementById('biometric-login-btn');
  if (biometricLoginBtn) {
    biometricLoginBtn.addEventListener('click', async () => {
      const val = identifierInput ? identifierInput.value.trim() : '';
      if (!val) {
        showToast('Please enter your mobile number or email to authenticate with biometrics.', 'warning');
        if (identifierInput) identifierInput.focus();
        return;
      }

      showToast('Contacting Biometric Passkey Sensor...', 'info');
      try {
        const chalRes = await fetch('/api/auth/biometric/login-challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: val })
        });
        const chalData = await chalRes.json();
        if (!chalData.success) {
          showToast(chalData.message, 'warning', 5000);
          return;
        }

        // Send verification
        const credId = (chalData.allowCredentials && chalData.allowCredentials[0]) ? chalData.allowCredentials[0].id : null;
        const verifyRes = await fetch('/api/auth/biometric/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challenge_id: chalData.challenge_id,
            credential_id: credId
          })
        });
        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          if (window.soundFx) window.soundFx.play('success');
          showToast(verifyData.message, 'success');
          setTimeout(() => {
            window.location.href = verifyData.redirect_url || '/dashboard';
          }, 500);
        } else {
          showToast(verifyData.message, 'error');
        }
      } catch (err) {
        showToast('Biometric sensor error. Please use SMS OTP.', 'error');
      }
    });
  }

  // OTP 6-Box Navigation (Auto-advance & Backspace)
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length === 1) {
        if (index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        }
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6}$/.test(pasteData)) {
        pasteData.split('').forEach((char, i) => {
          if (otpInputs[i]) otpInputs[i].value = char;
        });
        otpInputs[otpInputs.length - 1].focus();
      }
    });
  });

  function getEnteredOtp() {
    let code = '';
    otpInputs.forEach((inp) => (code += inp.value));
    return code.trim();
  }

  function clearOtpInputs() {
    otpInputs.forEach((inp) => (inp.value = ''));
  }

  // Auto-fill Generated OTP Button
  if (autofillDemoOtpBtn) {
    autofillDemoOtpBtn.addEventListener('click', () => {
      if (!activeServerOtp) {
        showToast('Please check your mobile phone for the dispatched OTP.', 'info');
        return;
      }
      activeServerOtp.split('').forEach((digit, i) => {
        if (otpInputs[i]) otpInputs[i].value = digit;
      });
      showToast(`Code ${activeServerOtp} auto-filled!`, 'info');
      if (verifyOtpBtn) verifyOtpBtn.focus();
    });
  }

  // Countdown Timer
  function startCountdown() {
    clearInterval(countdownInterval);
    countdownSeconds = 60;
    if (resendOtpBtn) resendOtpBtn.disabled = true;
    updateCountdownUI();

    countdownInterval = setInterval(() => {
      countdownSeconds--;
      updateCountdownUI();
      if (countdownSeconds <= 0) {
        clearInterval(countdownInterval);
        if (resendOtpBtn) resendOtpBtn.disabled = false;
        if (otpCountdownEl) otpCountdownEl.textContent = 'Code expired. You can resend now.';
      }
    }, 1000);
  }

  function updateCountdownUI() {
    if (otpCountdownEl) {
      otpCountdownEl.textContent = `Resend available in ${countdownSeconds}s`;
    }
  }

  // Resend OTP Button
  if (resendOtpBtn) {
    resendOtpBtn.addEventListener('click', async () => {
      resendOtpBtn.disabled = true;
      try {
        const res = await fetch('/api/auth/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: currentIdentifier || 'demo' })
        });
        const data = await res.json();
        if (data.success) {
          startCountdown();
          clearOtpInputs();
          if (otpInputs.length > 0) otpInputs[0].focus();
          showToast(`New code dispatched! Demo OTP: ${data.demo_otp}`, 'success');
        }
      } catch (e) {
        showToast('Failed to resend code.', 'error');
        resendOtpBtn.disabled = false;
      }
    });
  }

  // Verify OTP Submission
  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', async () => {
      const code = getEnteredOtp();
      if (code.length !== 6) {
        showToast('Please enter all 6 digits of the OTP code.', 'warning');
        return;
      }

      verifyOtpBtn.disabled = true;
      verifyOtpBtn.innerHTML = `
        <svg class="spin-animate" width="18" height="18" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/>
          <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
        Verifying Biometric Profile...
      `;

      try {
        const res = await fetch('/api/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: currentIdentifier || 'demo',
            otp: code
          })
        });
        const data = await res.json();

        if (data.success) {
          showToast(data.message, 'success');
          closeModal('otp-modal');
          setTimeout(() => {
            window.location.href = data.redirect_url || '/dashboard';
          }, 600);
        } else {
          showToast(data.message || 'Invalid code. Use demo auto-fill.', 'error');
          verifyOtpBtn.disabled = false;
          verifyOtpBtn.innerHTML = `<span>Verify & Launch Platform</span>`;
        }
      } catch (err) {
        showToast('Verification failed. Please check network.', 'error');
        verifyOtpBtn.disabled = false;
        verifyOtpBtn.innerHTML = `<span>Verify & Launch Platform</span>`;
      }
    });
  }

  // Quick Demo Logins (Athlete & Scout)
  const quickAthleteBtn = document.getElementById('quick-athlete-btn');
  if (quickAthleteBtn) {
    quickAthleteBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/auth/quick-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'athlete' })
        });
        const data = await res.json();
        showToast(`Entering as ${data.athlete.name} (${data.athlete.district}, ${data.athlete.sport})`, 'success');
        setTimeout(() => (window.location.href = data.redirect_url), 400);
      } catch (e) {
        window.location.href = '/dashboard';
      }
    });
  }

  const quickScoutBtn = document.getElementById('quick-scout-btn');
  if (quickScoutBtn) {
    quickScoutBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/auth/quick-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'scout' })
        });
        const data = await res.json();
        showToast('Entering Secure Government & Scout Portal...', 'success');
        setTimeout(() => (window.location.href = data.redirect_url), 400);
      } catch (e) {
        window.location.href = '/admin';
      }
    });
  }

  // Tab switcher for Login Methods (OTP vs Scout Credentials)
  const tabBtns = document.querySelectorAll('.auth-tab-btn');
  const tabPanes = document.querySelectorAll('.auth-tab-pane');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.target);
      if (targetPane) targetPane.classList.add('active');
    });
  });
});
