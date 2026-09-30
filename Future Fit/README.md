# FutureFit - AI Sports Pose Tracker & Athletic Performance Platform

FutureFit is a complete, production-ready AI sports pose tracking and athletic performance scouting web application. It combines real-time computer vision (33-point MediaPipe pose estimation) with physics-based vertical jump calculation (tracking Left Ankle Landmark #27), customized sports coaching, district scouting combines (Khelo India & SAI standards), community athletic feeds, and a secure government scout portal.

---

## 🌟 Core Features & Modules

### 1. Interactive 3D Login & Production Authentication Flow
- **Interactive Three.js 3D Scene**: Kinetic biomechanical wireframe humanoid and 1,400+ particle constellation that reacts dynamically to mouse movement, camera tilt, and kinetic energy pulses.
- **Fast2SMS API Integration (`https://www.fast2sms.com/dev/bulkV2`)**:
  - `FAST2SMS_API_KEY = "YOUR_FAST2SMS_API_KEY_HERE"` placeholder near top of `app.py` (with `os.environ` fallback).
  - Helper `send_sms_otp(mobile_number, otp)` sends real SMS OTPs with graceful error handling and timeout protection.
  - Generates cryptographically secure 6-digit OTPs with 5-minute TTL, attempt count limits, and immediate single-use deletion to prevent replay attacks.
- **Dynamic User Data Handling**:
  - Dynamic user data retrieval by verified phone number from the database.
  - Automatically registers new real athlete profiles upon successful OTP verification without dummy placeholders.
- **Biometric Authentication (WebAuthn / Face ID / Touch ID / Fingerprint)**:
  - FIDO2 / WebAuthn challenge-response backend endpoints (`/api/auth/biometric/*`).
  - Enroll Face / Touch ID from athlete profile and sign in passwordlessly from login screen.
- **Role-Adaptive Data APIs**:
  - `/api/user/me`: Current session user, role, and biometric credentials status.
  - `/api/user/dashboard-data`: Role-adaptive dynamic metrics for athletes, scouts, coaches, and administrators.
- **Display Modes**: Persistent navigation bar with **Dark Stadium / Light Mode** toggle and **Eye Protection Mode (Night Shift warm amber tint filter)**.

### 2. AI Pose Tracking & Camera Engine (`/tracker`)
- **33 Skeletal Body Landmarks**: Full-body pose estimation rendering head, shoulders, torso, hips, knees, and ankles.
- **Left Ankle Landmark (#27) Vertical Jump Physics Engine**:
  - Automatically calibrates standing ground baseline $Y_{baseline}$.
  - Real-time vertical displacement $\Delta Y = Y_{baseline} - Y_{current}$.
  - Normalizes displacement to athlete standing height to compute live vertical jump in centimeters ($cm$).
  - Kinematic state machine (`STANDBY` $\rightarrow$ `PREP` $\rightarrow$ `FLIGHT` $\rightarrow$ `APEX` $\rightarrow$ `LANDED`).
  - Hang time calculation ($t_{hang}$ ms) and takeoff velocity ($v_0 = g \cdot \frac{t_{hang}}{2}$ m/s).
  - Web Audio synthesis chime upon hitting session apex peak!
- **Side-by-Side Dual Viewport**:
  - **Left**: Live raw webcam video feed with biometric alignment guide and live telemetry status.
  - **Right**: Processed AI landmark stream with kinetic bone linkages, neon apex callout banner, and vertical height ruler.
- **Live Telemetry Bar**: Real-time display of Left Ankle #27 level, latency in ms (60 FPS), and connection status badge.
- **On-Screen Collapsible Debug Console**: Live terminal logging real-time FPS, coordinate streams, socket synchronization events, and jump state transitions.
- **Synthetic Athletic Jump Simulator**: One-click simulation toggle allowing full end-to-end testing even without a physical webcam.

### 3. Dynamic Athlete Dashboard (`/dashboard`)
- **Hero Banner**: Personalized greeting, motivational status, and quick launch button directly into the AI Camera Engine.
- **Dynamic Stats Row**: Peak Vertical Jump (cm), Total Jump Sessions, Calories Burned (kcal), Training Streak (days), and National Ranking.
- **Chart.js Weekly Jump Improvement**: Interactive line chart with timeline filters (*Last 7 Days*, *Last 30 Days*, *All-Time*).
- **6-Axis Biometric Radar Chart**: Explosive Power, Lateral Agility, Anaerobic Stamina, Bilateral Balance, Reaction Speed, and Ankle Stiffness.

### 4. AI Sports Coach & Training (`/coach`)
- **Dynamic Sports Questionnaire**: Sport (Athletics, Basketball, Volleyball, Kabaddi, Badminton, Football, Cricket), Age bracket, Target Goal, and Daily Available Time.
- **Periodized 7-Day Workout Protocol**: Generates custom agility, plyometric, and recovery routines.
- **Interactive Workout Cards**: Sets, reps, coaching cues, video demonstration modal with YouTube movement breakdowns, and "Mark Completed" checkmarks.
- **Functional Countdown Rest Timers**: Start/Pause/Reset controls with synthesized Web Audio alert beeps (3, 2, 1) and dual-tone athletic referee whistle upon rest completion.

### 5. Talent Scout & Leaderboard System (`/leaderboard`)
- **Multi-Filter System**: Filter by District (*Dhule*, *Nashik*, *Pune*, *Mumbai*, *Delhi*, *Chandigarh*), State (*Maharashtra*, *Delhi*, *Punjab*), Sport, Gender, and Timeframe (*Weekly*, *Monthly*, *All-Time*).
- **Verified AI Candidate Badges**: Visual certification for athletes whose jump heights have been authenticated on camera.
- **Interactive Biometrics Modal**: Detailed candidate passport with physical metrics, jump breakdown, and "Award Scout Endorsement" action.

### 6. Events & Scouting Camps (`/events`)
- **District Scouting Trials**: Browse Khelo India District Talent Trials, Maharashtra State Youth Athletics Meet, and SAI National Combines.
- **Interactive Map View**: Powered by Leaflet.js with geo-located trial markers across Indian sports hubs.
- **Official Scouting Admit Pass**: Generates an instant verifiable admit pass with unique Registration ID (e.g. `SAI-DHU-2026-8842`), batch reporting slot, QR verification code, and "Print / Download Admit Card" button.

### 7. Community & Social Feed (`/community`)
- **Athlete Social Feed**: Share vertical jump personal records, video progress clips, and training streaks.
- **100% Functional Interactions**: Working Likes counter, expandable Comments section with real-time comment posting, Share to clipboard with toast notification, Follow/Unfollow athlete toggle, and Official Scout Endorsement awards.
- **Publish Update Modal**: Post custom captions with verified biometric badges.

### 8. Secure Admin & Scout Portal (`/admin`)
- **Government & Scout Dashboard**: Sports Authority of India (SAI) candidate review queue.
- **Video & Telemetry Audit**: Watch recorded verification video alongside Left Ankle Delta Y, Hang Time ms, and AI confidence score.
- **Scout Actions**: "Approve AI Verification", "Flag for Camera Re-Test", and "Reject Record".
- **Multi-Format Export**:
  - **PDF Export**: Generates an official, certified Athletic Biometrics Audit Certificate using `jsPDF`.
  - **CSV Export**: Instant download of district candidate data.
- **District Scouting Drive Manager**: Create and launch new talent combines with custom district targets and quotas.

---

## 🚀 Running the Application

### 1. Requirements
- Python 3.9+ (Tested on Python 3.14)
- Flask (`pip install flask`)

### 2. Fast2SMS API Key Setup (Optional for Live SMS)
In `app.py`, update:
```python
FAST2SMS_API_KEY = "YOUR_FAST2SMS_API_KEY_HERE"  # Or set via FAST2SMS_API_KEY environment variable
```
*Note: If the key is left as the placeholder, the application runs in development sandbox mode—logging the generated secure 6-digit OTP to the console and returning it in the API response for instant zero-cost testing.*

### 3. Start the Server
Run the Flask backend configured on `0.0.0.0:8080`:
```bash
python app.py
```

### 4. Open in Browser
Navigate to:
```
http://localhost:8080
```
or test on local network via your machine's IP address on port `8080`.

---

## 🧪 Authentication & Quick Testing

- **Live / Sandbox Mobile OTP**:
  - Enter any 10-digit Indian phone number (e.g. `9823456789`).
  - Enter the 6-digit OTP sent via SMS (or pre-populated in sandbox mode).
  - Existing registered athletes (*Siddharth More*, *Neha Patil*, *Kabir Singh*, etc.) will dynamically load their authentic profiles and jump metrics.
  - New mobile numbers automatically register a dynamic athlete profile in the database.
- **Biometric Passkey / Touch ID / Face ID**:
  - From the athlete Profile page (`/profile`), click **"Enroll Face / Touch ID"** to register your hardware authenticator.
  - On the Login screen, click **"Use Biometric / Face ID"** for instant passwordless authentication.
- **Scout / Admin Portal**:
  - Click **"Official Scout / Admin"** $\rightarrow$ **"Enter Scout & Admin Portal"** or navigate directly to `/admin`.
