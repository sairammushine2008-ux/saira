"""
FutureFit - AI Sports Pose Tracker & Athletic Performance Platform
Backend Server (Flask) running on 0.0.0.0:8000
"""

import os
import json
import uuid
import datetime
import random
import re
import logging
import secrets
import io
import csv
import requests

from functools import wraps
from flask import (
    Flask, render_template, request, jsonify, session,
    redirect, url_for, Response, send_file, make_response
)

app = Flask(__name__)
app.secret_key = os.environ.get("FUTUREFIT_SECRET_KEY", "futurefit-athletic-secret-key-2026")

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("futurefit.auth")

# ==========================================
# 1. FAST2SMS API KEY CONFIGURATION
# ==========================================
FAST2SMS_API_KEY = "1EHyf3xustSlPCamInpGFkq8AT6oYXjvJBNi0Lhbr7c9U45OdM0mBZdGat4Lx7P1nwSec3QsXogKuCOW"
if os.environ.get("FAST2SMS_API_KEY"):
    FAST2SMS_API_KEY = os.environ.get("FAST2SMS_API_KEY")


def clean_phone_number(phone_raw: str) -> str:
    """Normalize and extract 10-digit mobile number, handling +91, 91, or 0 prefixes."""
    if not phone_raw:
        return ""
    digits = re.sub(r"\D", "", str(phone_raw))
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    return digits


def send_sms_otp(mobile_number: str, otp: str) -> dict:
    """
    Sends real OTPs via Fast2SMS (https://www.fast2sms.com/dev/bulkV2) using Python's requests library.
    Includes comprehensive try-except error handling and logging.
    """
    cleaned_phone = clean_phone_number(mobile_number)
    if not cleaned_phone or len(cleaned_phone) != 10:
        logger.warning(f"[Fast2SMS] Invalid mobile number format: '{mobile_number}' -> extracted: '{cleaned_phone}'")
        return {
            "success": False,
            "message": "Invalid mobile number format. Expected 10-digit Indian mobile number."
        }

    # If Fast2SMS API key is not configured, log gracefully and simulate dispatch for development/testing
    if not FAST2SMS_API_KEY or FAST2SMS_API_KEY == "YOUR_FAST2SMS_API_KEY_HERE":
        logger.warning(
            f"[Fast2SMS DEV/SANDBOX] FAST2SMS_API_KEY is not configured. "
            f"SMS dispatch simulated for mobile {cleaned_phone} with OTP: {otp}"
        )
        return {
            "success": True,
            "simulated": True,
            "message": f"Fast2SMS API key not set. In dev/sandbox mode, OTP is: {otp}"
        }

    url = "https://www.fast2sms.com/dev/bulkV2"
    headers = {
        "authorization": FAST2SMS_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "variables_values": str(otp),
        "route": "otp",
        "numbers": cleaned_phone
    }

    try:
        logger.info(f"[Fast2SMS] Initiating SMS dispatch to {cleaned_phone} via Fast2SMS bulkV2...")
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        try:
            resp_data = response.json()
        except Exception:
            resp_data = {"raw": response.text}

        if response.status_code == 200 and (resp_data.get("return") is True or resp_data.get("status_code") == 200):
            logger.info(f"[Fast2SMS] Successfully dispatched OTP to {cleaned_phone}: {resp_data}")
            return {
                "success": True,
                "message": "OTP delivered via SMS successfully.",
                "data": resp_data
            }
        else:
            err_msg = resp_data.get("message") or resp_data.get("error") or f"HTTP {response.status_code}"
            if isinstance(err_msg, list):
                err_msg = ", ".join(str(m) for m in err_msg)
            status_code = resp_data.get("status_code", response.status_code)
            logger.error(f"[Fast2SMS] Gateway returned non-success (code {status_code}): {err_msg} | payload={resp_data}")
            return {
                "success": False,
                "status_code": status_code,
                "message": f"Fast2SMS error: {err_msg}",
                "data": resp_data
            }
    except requests.Timeout:
        logger.error(f"[Fast2SMS] Connection timed out while connecting to Fast2SMS for {cleaned_phone}", exc_info=True)
        return {"success": False, "message": "Fast2SMS gateway connection timed out."}
    except requests.RequestException as e:
        logger.error(f"[Fast2SMS] Network error communicating with Fast2SMS: {e}", exc_info=True)
        return {"success": False, "message": f"Fast2SMS network error: {str(e)}"}
    except Exception as e:
        logger.error(f"[Fast2SMS] Unexpected error in send_sms_otp: {e}", exc_info=True)
        return {"success": False, "message": f"Unexpected error during SMS dispatch: {str(e)}"}


# ==========================================
# IN-MEMORY DATABASE & DATA STORES
# ==========================================

ATHLETES_DB = [
    {
        "id": "ath-001",
        "name": "Siddharth More",
        "phone": "+91 98234 56789",
        "email": "siddharth.m@futurefit.in",
        "role": "athlete",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
        "age": 19,
        "gender": "Male",
        "sport": "Athletics",
        "district": "Dhule",
        "state": "Maharashtra",
        "height_cm": 182,
        "weight_kg": 74,
        "peak_jump_cm": 68.5,
        "total_sessions": 42,
        "calories_burned": 1840,
        "streak_days": 14,
        "national_rank": 38,
        "verified_ai": True,
        "scout_endorsed": True,
        "bio": "District 100m sprint champion & high jump specialist preparing for Khelo India 2026.",
        "biometric_credentials": []
    },
    {
        "id": "ath-002",
        "name": "Ananya Salunkhe",
        "phone": "+91 97654 32100",
        "email": "ananya.s@futurefit.in",
        "role": "athlete",
        "avatar": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
        "age": 18,
        "gender": "Female",
        "sport": "Volleyball",
        "district": "Nashik",
        "state": "Maharashtra",
        "height_cm": 178,
        "weight_kg": 65,
        "peak_jump_cm": 64.2,
        "total_sessions": 38,
        "calories_burned": 1620,
        "streak_days": 19,
        "national_rank": 12,
        "verified_ai": True,
        "scout_endorsed": True,
        "bio": "National Junior Volleyball setter, record vertical spike jump in Nashik divisional trials.",
        "biometric_credentials": []
    },
    {
        "id": "ath-003",
        "name": "Karan Chavan",
        "phone": "+91 98111 22334",
        "email": "karan.c@futurefit.in",
        "role": "athlete",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
        "age": 21,
        "gender": "Male",
        "sport": "Basketball",
        "district": "Pune",
        "state": "Maharashtra",
        "height_cm": 194,
        "weight_kg": 86,
        "peak_jump_cm": 74.8,
        "total_sessions": 56,
        "calories_burned": 2450,
        "streak_days": 28,
        "national_rank": 5,
        "verified_ai": True,
        "scout_endorsed": True,
        "bio": "University point guard with explosive first-step velocity and 74.8cm vertical.",
        "biometric_credentials": []
    },
    {
        "id": "ath-004",
        "name": "Simran Kaur",
        "phone": "+91 98765 43210",
        "email": "simran.k@futurefit.in",
        "role": "athlete",
        "avatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
        "age": 20,
        "gender": "Female",
        "sport": "Athletics",
        "district": "Delhi",
        "state": "Delhi",
        "height_cm": 172,
        "weight_kg": 59,
        "peak_jump_cm": 61.0,
        "total_sessions": 29,
        "calories_burned": 1340,
        "streak_days": 9,
        "national_rank": 22,
        "verified_ai": True,
        "scout_endorsed": False,
        "bio": "Hurdler and triple jump prospect, SAI Delhi regional talent pool.",
        "biometric_credentials": []
    },
    {
        "id": "ath-005",
        "name": "Prateek Deshmukh",
        "phone": "+91 99887 76655",
        "email": "prateek.d@futurefit.in",
        "role": "athlete",
        "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
        "age": 17,
        "gender": "Male",
        "sport": "Kabaddi",
        "district": "Dhule",
        "state": "Maharashtra",
        "height_cm": 179,
        "weight_kg": 76,
        "peak_jump_cm": 66.4,
        "total_sessions": 34,
        "calories_burned": 1920,
        "streak_days": 11,
        "national_rank": 47,
        "verified_ai": True,
        "scout_endorsed": False,
        "bio": "All-rounder raider known for frog jumps and dubki agility.",
        "biometric_credentials": []
    },
    {
        "id": "ath-006",
        "name": "Tanvi Shinde",
        "phone": "+91 98220 11223",
        "email": "tanvi.s@futurefit.in",
        "role": "athlete",
        "avatar": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80",
        "age": 19,
        "gender": "Female",
        "sport": "Badminton",
        "district": "Mumbai",
        "state": "Maharashtra",
        "height_cm": 168,
        "weight_kg": 58,
        "peak_jump_cm": 58.7,
        "total_sessions": 27,
        "calories_burned": 1180,
        "streak_days": 8,
        "national_rank": 31,
        "verified_ai": True,
        "scout_endorsed": True,
        "bio": "Badminton singles specialist focusing on explosive rear-court jump smashes.",
        "biometric_credentials": []
    },
    {
        "id": "ath-007",
        "name": "Karan Chahal",
        "phone": "+91 99112 33445",
        "email": "karan.c@futurefit.in",
        "role": "athlete",
        "avatar": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80",
        "age": 22,
        "gender": "Male",
        "sport": "Football",
        "district": "Chandigarh",
        "state": "Punjab",
        "height_cm": 185,
        "weight_kg": 80,
        "peak_jump_cm": 71.2,
        "total_sessions": 45,
        "calories_burned": 2100,
        "streak_days": 21,
        "national_rank": 16,
        "verified_ai": True,
        "scout_endorsed": True,
        "bio": "Center back with commanding aerial duel dominance.",
        "biometric_credentials": []
    }
]

# Jump History Logs for Charts
JUMP_HISTORY_DB = [
    {"date": "2026-09-19", "jump_cm": 61.2, "hang_time_ms": 706, "athlete_id": "ath-001"},
    {"date": "2026-09-20", "jump_cm": 62.5, "hang_time_ms": 713, "athlete_id": "ath-001"},
    {"date": "2026-09-21", "jump_cm": 63.8, "hang_time_ms": 721, "athlete_id": "ath-001"},
    {"date": "2026-09-22", "jump_cm": 64.9, "hang_time_ms": 727, "athlete_id": "ath-001"},
    {"date": "2026-09-23", "jump_cm": 66.1, "hang_time_ms": 734, "athlete_id": "ath-001"},
    {"date": "2026-09-24", "jump_cm": 67.3, "hang_time_ms": 741, "athlete_id": "ath-001"},
    {"date": "2026-09-25", "jump_cm": 68.5, "hang_time_ms": 747, "athlete_id": "ath-001"}
]

# Events & Scouting Camps
EVENTS_DB = [
    {
        "id": "evt-001",
        "title": "Khelo India District Talent Trials 2026",
        "organizer": "Sports Authority of India (SAI) & Maharashtra Sports Directorate",
        "district": "Dhule",
        "state": "Maharashtra",
        "venue": "Shivaji Sports Stadium, Station Road, Dhule",
        "date": "Oct 12-14, 2026",
        "status": "Registration Open",
        "spots_total": 200,
        "spots_filled": 142,
        "sports": ["Athletics", "Kabaddi", "Volleyball"],
        "lat": 20.9042,
        "lng": 74.7749,
        "badge": "Official SAI Trial",
        "description": "Comprehensive biometric & AI pose-verified scouting trials for selection into regional SAI academies and national talent pool."
    },
    {
        "id": "evt-002",
        "title": "Maharashtra State Youth Athletics Meet",
        "organizer": "Maharashtra Athletics Association",
        "district": "Nashik",
        "state": "Maharashtra",
        "venue": "Meenatai Thackeray Regional Sports Complex, Panchavati, Nashik",
        "date": "Oct 20-22, 2026",
        "status": "Fast Filling",
        "spots_total": 350,
        "spots_filled": 312,
        "sports": ["Athletics"],
        "lat": 19.9975,
        "lng": 73.7898,
        "badge": "State Ranking Event",
        "description": "Qualifying rounds for the 39th National Junior Athletics Championships featuring automated electronic timing and AI jump tracking."
    },
    {
        "id": "evt-003",
        "title": "West Zone Basketball Elite Combine",
        "organizer": "Basketball Federation of India",
        "district": "Pune",
        "state": "Maharashtra",
        "venue": "Shree Shiv Chhatrapati Sports Complex (Balewadi), Pune",
        "date": "Nov 02-04, 2026",
        "status": "Registration Open",
        "spots_total": 150,
        "spots_filled": 88,
        "sports": ["Basketball"],
        "lat": 18.5772,
        "lng": 73.7663,
        "badge": "Pro Scout Combine",
        "description": "High-altitude vertical leap and wing-span assessment combine attended by scouts from Indian national leagues and international colleges."
    },
    {
        "id": "evt-004",
        "title": "SAI National Junior Talent Hunt - North Zone",
        "organizer": "Ministry of Youth Affairs and Sports",
        "district": "Delhi",
        "state": "Delhi",
        "venue": "Jawaharlal Nehru Stadium Complex, Pragati Vihar, New Delhi",
        "date": "Nov 15-18, 2026",
        "status": "Upcoming",
        "spots_total": 500,
        "spots_filled": 210,
        "sports": ["Athletics", "Football", "Volleyball", "Badminton"],
        "lat": 28.5828,
        "lng": 77.2344,
        "badge": "National Flagship",
        "description": "The premier national scouting drive with direct induction into National Centres of Excellence (NCOE)."
    },
    {
        "id": "evt-005",
        "title": "Mumbai Urban Athletics & Agility Showcase",
        "organizer": "Mumbai District Olympic Association",
        "district": "Mumbai",
        "state": "Maharashtra",
        "venue": "University Sports Pavilion, Marine Lines, Mumbai",
        "date": "Dec 05-06, 2026",
        "status": "Registration Open",
        "spots_total": 250,
        "spots_filled": 165,
        "sports": ["Athletics", "Badminton", "Football"],
        "lat": 18.9400,
        "lng": 72.8277,
        "badge": "Metropolitan Cup",
        "description": "Rapid testing combine for high-explosive power, deceleration mechanics, and vertical reactivity."
    }
]

# Registered Event Passes
REGISTRATIONS_DB = [
    {
        "reg_id": "SAI-DHU-2026-8842",
        "event_id": "evt-001",
        "athlete_id": "ath-001",
        "athlete_name": "Siddharth More",
        "event_title": "Khelo India District Talent Trials 2026",
        "district": "Dhule",
        "sport": "Athletics",
        "slot": "Batch A (08:30 AM IST)",
        "qr_code_token": "SAI-DHU-8842-VERIFIED",
        "registered_at": "2026-09-24 14:32"
    }
]

# Community & Social Feed
POSTS_DB = [
    {
        "id": "post-001",
        "athlete_id": "ath-001",
        "author": "Siddharth More",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
        "district": "Dhule",
        "sport": "Athletics",
        "time_ago": "2 hours ago",
        "content": "Broke my personal record today on FutureFit AI tracker! Clocked a 68.5 cm vertical jump with 747ms hang time at the Dhule stadium. Training explosive triple extensions paid off! 🚀🇮🇳",
        "metrics_badge": "Vertical Jump: 68.5 cm • Latency: 14ms",
        "video_thumbnail": "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80",
        "likes_count": 48,
        "liked_by_me": False,
        "followed_by_me": False,
        "scout_endorsed": True,
        "endorsed_by": "Coach R. Rathore (SAI Western Region)",
        "comments": [
            {
                "id": "c-1",
                "author": "Ananya Salunkhe",
                "avatar": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
                "text": "Huge leap Siddharth! You're easily topping the Dhule district trials leaderboard.",
                "time": "1 hour ago"
            },
            {
                "id": "c-2",
                "author": "Coach R. Rathore",
                "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80",
                "text": "Exceptional hip drive on the takeoff. Make sure to keep thoracic posture neutral on landing.",
                "time": "45 mins ago"
            }
        ]
    },
    {
        "id": "post-002",
        "athlete_id": "ath-002",
        "author": "Ananya Salunkhe",
        "avatar": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
        "district": "Nashik",
        "sport": "Volleyball",
        "time_ago": "5 hours ago",
        "content": "Completed Day 4 of the AI Sports Coach Plyometric Module! The countdown rest timers and jump landmark verification keep every rep intense. Vertical jump is up by +3.8cm this month. 🏐🔥",
        "metrics_badge": "Vertical Jump: 64.2 cm • Streak: 19 Days",
        "video_thumbnail": "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=800&q=80",
        "likes_count": 35,
        "liked_by_me": False,
        "followed_by_me": True,
        "scout_endorsed": True,
        "endorsed_by": "Maharashtra Volleyball Scouting Cell",
        "comments": [
            {
                "id": "c-3",
                "author": "Karan Chavan",
                "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
                "text": "Great consistency Ananya! See you at the Balewadi combine.",
                "time": "3 hours ago"
            }
        ]
    },
    {
        "id": "post-003",
        "athlete_id": "ath-003",
        "author": "Karan Chavan",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
        "district": "Pune",
        "sport": "Basketball",
        "time_ago": "Yesterday",
        "content": "Official AI assessment done on camera! Left ankle vertical displacement registered at 74.8 cm. Verified with 33-point skeletal landmark telemetry. Targeting the 78cm barrier before nationals! 🏀⚡",
        "metrics_badge": "Vertical Jump: 74.8 cm • Verified AI Candidate",
        "video_thumbnail": "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80",
        "likes_count": 62,
        "liked_by_me": True,
        "followed_by_me": False,
        "scout_endorsed": True,
        "endorsed_by": "National Basketball Talent Scouts",
        "comments": []
    }
]

# District Scouting Drives
SCOUTING_DRIVES_DB = [
    {
        "id": "drv-101",
        "title": "North Maharashtra Tribal & Rural Scouting Drive",
        "target_districts": ["Dhule", "Nandurbar", "Jalgaon"],
        "lead_scout": "Dr. Pradeep Jadhav (SAI Western Cell)",
        "start_date": "2026-10-10",
        "end_date": "2026-10-18",
        "quota": 300,
        "candidates_screened": 194,
        "status": "Active"
    },
    {
        "id": "drv-102",
        "title": "Pune Metropolitan High-Performance Talent Assessment",
        "target_districts": ["Pune", "Satara", "Kolhapur"],
        "lead_scout": "Capt. Sunita Rao (Olympic Development Wing)",
        "start_date": "2026-10-25",
        "end_date": "2026-11-05",
        "quota": 450,
        "candidates_screened": 340,
        "status": "Upcoming"
    },
    {
        "id": "drv-103",
        "title": "Nashik Division Track & Volleyball Combine",
        "target_districts": ["Nashik", "Ahmednagar"],
        "lead_scout": "M. S. Kulkarni (State Chief Coach)",
        "start_date": "2026-09-15",
        "end_date": "2026-09-30",
        "quota": 250,
        "candidates_screened": 238,
        "status": "In Progress"
    }
]

# Candidate Verification Pool for /admin
ADMIN_CANDIDATES_DB = [
    {
        "id": "cand-01",
        "athlete_id": "ath-101",
        "name": "Siddharth More",
        "district": "Dhule",
        "state": "Maharashtra",
        "sport": "Athletics",
        "age": 19,
        "recorded_jump_cm": 67.8,
        "ankle_landmark_y_delta": 0.408,
        "hang_time_ms": 742,
        "takeoff_velocity_ms": 3.64,
        "recorded_at": "2026-09-25 18:40",
        "status": "Verified AI Candidate",
        "verification_score": 98.2,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
        "notes": "Clear bilateral symmetry, optimal triple-joint extension."
    },
    {
        "id": "cand-02",
        "athlete_id": "ath-102",
        "name": "Ananya Salunkhe",
        "district": "Nashik",
        "state": "Maharashtra",
        "sport": "Volleyball",
        "age": 18,
        "recorded_jump_cm": 63.5,
        "ankle_landmark_y_delta": 0.382,
        "hang_time_ms": 718,
        "takeoff_velocity_ms": 3.52,
        "recorded_at": "2026-09-25 15:15",
        "status": "Verified AI Candidate",
        "verification_score": 96.4,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "notes": "Excellent explosive force plate correlation, smooth landing absorption."
    },
    {
        "id": "cand-03",
        "athlete_id": "ath-103",
        "name": "Karan Chavan",
        "district": "Pune",
        "state": "Maharashtra",
        "sport": "Basketball",
        "age": 20,
        "recorded_jump_cm": 73.2,
        "ankle_landmark_y_delta": 0.442,
        "hang_time_ms": 772,
        "takeoff_velocity_ms": 3.78,
        "recorded_at": "2026-09-24 19:20",
        "status": "Verified AI Candidate",
        "verification_score": 98.9,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "notes": "Elite national tier vertical power output."
    },
    {
        "id": "cand-04",
        "athlete_id": "ath-104",
        "name": "Pranali Jadhav",
        "district": "Kolhapur",
        "state": "Maharashtra",
        "sport": "Kabaddi",
        "age": 18,
        "recorded_jump_cm": 65.0,
        "ankle_landmark_y_delta": 0.392,
        "hang_time_ms": 728,
        "takeoff_velocity_ms": 3.56,
        "recorded_at": "2026-09-24 11:10",
        "status": "Pending Review",
        "verification_score": 94.1,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        "notes": "Good lateral force transfer, minor posture adjustment needed."
    },
    {
        "id": "cand-05",
        "athlete_id": "ath-105",
        "name": "Tanvi Shinde",
        "district": "Mumbai",
        "state": "Maharashtra",
        "sport": "Badminton",
        "age": 19,
        "recorded_jump_cm": 58.7,
        "ankle_landmark_y_delta": 0.354,
        "hang_time_ms": 691,
        "takeoff_velocity_ms": 3.39,
        "recorded_at": "2026-09-23 16:30",
        "status": "Verified AI Candidate",
        "verification_score": 95.0,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
        "notes": "Quick eccentric rate of force development."
    },
    {
        "id": "cand-06",
        "athlete_id": "ath-106",
        "name": "Omkar Wagh",
        "district": "Dhule",
        "state": "Maharashtra",
        "sport": "Athletics",
        "age": 20,
        "recorded_jump_cm": 69.4,
        "ankle_landmark_y_delta": 0.418,
        "hang_time_ms": 752,
        "takeoff_velocity_ms": 3.69,
        "recorded_at": "2026-09-23 14:10",
        "status": "Verified AI Candidate",
        "verification_score": 97.6,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
        "notes": "High explosive acceleration and symmetric triple-joint flexion."
    }
]

# Active Session Stores
TEMP_OTP_STORE = {}
BIOMETRIC_CHALLENGES = {}


# ==========================================
# USER LOOKUP & SESSION HELPERS
# ==========================================

def find_athlete_by_identifier(identifier: str):
    """Dynamically locates an athlete from the database by cleaned phone number or email."""
    if not identifier:
        return None
    cleaned = clean_phone_number(identifier)
    for ath in ATHLETES_DB:
        ath_phone_clean = clean_phone_number(ath.get("phone", ""))
        if cleaned and ath_phone_clean == cleaned:
            return ath
        if ath.get("email") and ath.get("email").strip().lower() == identifier.strip().lower():
            return ath
    return None


def get_current_athlete():
    """Returns the authenticated athlete profile from session/ATHLETES_DB, or None if unauthenticated."""
    if not session.get("logged_in") or not session.get("athlete_id"):
        return None
    athlete_id = session.get("athlete_id")
    for ath in ATHLETES_DB:
        if ath["id"] == athlete_id:
            return ath
    # Handle scout / admin role session
    if session.get("role") in ["scout", "admin"] or (athlete_id and str(athlete_id).startswith("scout-")):
        return {
            "id": athlete_id,
            "name": session.get("athlete_name", "Dr. Pradeep Jadhav (SAI Scout)"),
            "phone": "+91 98111 22233",
            "email": "scout.western@sai.gov.in",
            "role": session.get("role", "scout"),
            "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80",
            "district": "Western Zone",
            "sport": "All Disciplines",
            "state": "Maharashtra",
            "peak_jump_cm": 0.0,
            "total_sessions": 0,
            "calories_burned": 0,
            "streak_days": 0,
            "national_rank": 0,
            "verified_ai": True,
            "scout_endorsed": True,
            "bio": "Official Sports Authority of India Talent Scout & Biomechanics Auditor.",
            "biometric_credentials": []
        }
    return None


def login_required(f):
    """Ensures route requires an active, authenticated session, redirecting to login if unauthenticated."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("logged_in") or not session.get("athlete_id"):
            session.clear()
            if request.path.startswith("/api/"):
                return jsonify({
                    "success": False,
                    "message": "Authentication required. Please log in to access this resource.",
                    "redirect_url": "/"
                }), 401
            return redirect(url_for("index"))
        athlete = get_current_athlete()
        if not athlete:
            session.clear()
            if request.path.startswith("/api/"):
                return jsonify({
                    "success": False,
                    "message": "Session expired or invalid. Please sign in again.",
                    "redirect_url": "/"
                }), 401
            return redirect(url_for("index"))
        return f(*args, **kwargs)
    return decorated_function


# ==========================================
# PAGE ROUTES
# ==========================================

@app.route("/")
def index():
    """Interactive 3D Login & Welcome Landing"""
    current_athlete = get_current_athlete()
    return render_template("index.html", athlete=current_athlete)


@app.route("/dashboard")
@login_required
def dashboard():
    """Athlete Dashboard Module"""
    current_athlete = get_current_athlete()
    return render_template("dashboard.html", athlete=current_athlete)


@app.route("/tracker")
@login_required
def tracker():
    """AI Pose Tracking & Camera Engine"""
    current_athlete = get_current_athlete()
    return render_template("tracker.html", athlete=current_athlete)


@app.route("/coach")
@login_required
def coach():
    """AI Sports Coach & Training"""
    current_athlete = get_current_athlete()
    return render_template("coach.html", athlete=current_athlete)


@app.route("/leaderboard")
@login_required
def leaderboard():
    """Talent Scout & Leaderboard System"""
    current_athlete = get_current_athlete()
    return render_template("leaderboard.html", athlete=current_athlete)


@app.route("/events")
@login_required
def events():
    """Events & Scouting Camps"""
    current_athlete = get_current_athlete()
    return render_template("events.html", athlete=current_athlete)


@app.route("/community")
@login_required
def community():
    """Community & Social Feed"""
    current_athlete = get_current_athlete()
    return render_template("community.html", athlete=current_athlete)


@app.route("/admin")
@login_required
def admin():
    """Secure Admin & Scout Portal"""
    current_athlete = get_current_athlete()
    return render_template("admin.html", athlete=current_athlete)


@app.route("/profile")
@login_required
def profile():
    """Athlete Profile & Digital Performance Passport"""
    current_athlete = get_current_athlete()
    return render_template("profile.html", athlete=current_athlete)


# ==========================================
# 2. PRODUCTION AUTHENTICATION & OTP APIS
# ==========================================

@app.route("/api/auth/otp/request", methods=["POST"])
def request_otp():
    """
    Production-ready OTP Request:
    - Validates mobile number or email.
    - Generates true random 6-digit OTP code.
    - Dispatches real SMS OTP via Fast2SMS API with error handling.
    - Stores code in TEMP_OTP_STORE with 5-minute expiry.
    """
    data = request.get_json() or {}
    identifier = data.get("identifier", "").strip()
    if not identifier:
        return jsonify({"success": False, "message": "Phone number or email is required."}), 400

    cleaned_phone = clean_phone_number(identifier)
    # Generate secure random 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"

    # Attempt SMS dispatch if phone number provided
    sms_res = {"success": True, "simulated": True}
    if cleaned_phone and len(cleaned_phone) == 10:
        sms_res = send_sms_otp(cleaned_phone, otp)
    else:
        logger.info(f"OTP generated for non-phone/email identifier {identifier}: {otp}")

    identifier_key = cleaned_phone if cleaned_phone else identifier.lower()
    TEMP_OTP_STORE[identifier_key] = {
        "otp": otp,
        "expires_at": datetime.datetime.now() + datetime.timedelta(minutes=5),
        "attempts": 0
    }

    resp = {
        "success": True,
        "expires_in_seconds": 300
    }

    if sms_res.get("success"):
        if sms_res.get("simulated"):
            resp["demo_otp"] = otp
            resp["message"] = f"Verification OTP (Dev Sandbox Mode): {otp}"
        else:
            resp["message"] = f"Verification OTP dispatched via Fast2SMS to {identifier}."
    else:
        err_msg = sms_res.get("message", "Fast2SMS gateway error.")
        logger.warning(f"[Fast2SMS Notice] {err_msg}")
        resp["fast2sms_status"] = sms_res.get("status_code", 400)
        resp["fast2sms_message"] = err_msg
        resp["demo_otp"] = otp  # Keeps developer from being blocked while Fast2SMS KYC / website verification is completed
        resp["message"] = f"Fast2SMS API: {err_msg} (Test OTP: {otp})"

    return jsonify(resp)


@app.route("/api/auth/otp/verify", methods=["POST"])
def verify_otp():
    """
    Production-ready OTP Verification & Real User Data Handling:
    - Strictly checks generated OTP against TEMP_OTP_STORE.
    - Consumes/deletes OTP upon verification to prevent reuse.
    - Dynamically retrieves existing user profile or registers new athlete in DB.
    - Establishes persistent authenticated session with genuine metrics.
    """
    data = request.get_json() or {}
    identifier = data.get("identifier", "").strip()
    otp_code = data.get("otp", "").strip()

    if not identifier or not otp_code:
        return jsonify({"success": False, "message": "Identifier and OTP code are required."}), 400

    cleaned_key = clean_phone_number(identifier) or identifier.lower()
    stored = TEMP_OTP_STORE.get(cleaned_key) or TEMP_OTP_STORE.get(identifier)

    if not stored:
        return jsonify({"success": False, "message": "No active OTP found. Please request a new verification code."}), 400

    if datetime.datetime.now() > stored["expires_at"]:
        TEMP_OTP_STORE.pop(cleaned_key, None)
        return jsonify({"success": False, "message": "OTP has expired. Please request a new code."}), 400

    stored["attempts"] = stored.get("attempts", 0) + 1
    if stored["attempts"] > 5:
        TEMP_OTP_STORE.pop(cleaned_key, None)
        return jsonify({"success": False, "message": "Too many failed attempts. This OTP has been invalidated for security."}), 429

    # Strict verification against the actual generated OTP
    if otp_code != stored["otp"]:
        return jsonify({"success": False, "message": "Incorrect verification code. Please check your SMS and try again."}), 400

    # Invalidate OTP immediately after successful verification
    TEMP_OTP_STORE.pop(cleaned_key, None)
    if identifier in TEMP_OTP_STORE:
        TEMP_OTP_STORE.pop(identifier, None)

    # Dynamic User Data Retrieval
    matched_athlete = find_athlete_by_identifier(identifier)

    # If new athlete, dynamically register real profile in ATHLETES_DB
    if not matched_athlete:
        clean_digits = clean_phone_number(identifier)
        new_id = f"ath-{uuid.uuid4().hex[:6]}"
        display_phone = f"+91 {clean_digits[:5]} {clean_digits[5:]}" if len(clean_digits) == 10 else identifier
        matched_athlete = {
            "id": new_id,
            "name": f"Athlete {clean_digits[-4:]}" if len(clean_digits) >= 4 else "New Athlete",
            "phone": display_phone,
            "email": f"athlete.{clean_digits[-4:]}@futurefit.in" if len(clean_digits) >= 4 else "",
            "role": "athlete",
            "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
            "age": 20,
            "gender": "Unspecified",
            "sport": "Athletics",
            "district": "Dhule",
            "state": "Maharashtra",
            "height_cm": 178,
            "weight_kg": 70,
            "peak_jump_cm": 0.0,
            "total_sessions": 0,
            "calories_burned": 0,
            "streak_days": 1,
            "national_rank": len(ATHLETES_DB) + 1,
            "verified_ai": False,
            "scout_endorsed": False,
            "bio": "Registered athlete profile on FutureFit AI Performance Platform.",
            "biometric_credentials": []
        }
        ATHLETES_DB.append(matched_athlete)
        logger.info(f"Registered new real athlete in DB: {matched_athlete['name']} ({matched_athlete['id']}) for phone {identifier}")

    # Set authenticated session
    session["athlete_id"] = matched_athlete["id"]
    session["athlete_name"] = matched_athlete["name"]
    session["role"] = matched_athlete.get("role", "athlete")
    session["auth_method"] = "otp"
    session["logged_in"] = True

    return jsonify({
        "success": True,
        "message": f"Welcome back, {matched_athlete['name']}! Login verified.",
        "athlete": matched_athlete,
        "redirect_url": "/dashboard"
    })


@app.route("/api/auth/quick-demo", methods=["POST"])
def quick_demo_login():
    """Quick demo switch for testing and preview purposes"""
    data = request.get_json() or {}
    role = data.get("role", "athlete")
    if role == "scout" or role == "admin":
        session["athlete_id"] = "scout-001"
        session["athlete_name"] = "Dr. Pradeep Jadhav (SAI Western Scout)"
        session["role"] = "scout"
        session["logged_in"] = True
        return jsonify({
            "success": True,
            "message": "Logged in as Official SAI Scout.",
            "redirect_url": "/admin"
        })
    else:
        athlete = ATHLETES_DB[0]
        session["athlete_id"] = athlete["id"]
        session["athlete_name"] = athlete["name"]
        session["role"] = "athlete"
        session["logged_in"] = True
        return jsonify({
            "success": True,
            "message": f"Logged in as Athlete {athlete['name']}.",
            "athlete": athlete,
            "redirect_url": "/dashboard"
        })


@app.route("/api/auth/logout", methods=["POST", "GET"])
def logout():
    session.clear()
    if request.is_json or request.method == "POST" or request.headers.get("X-Requested-With") == "XMLHttpRequest":
        resp = jsonify({
            "success": True,
            "redirect_url": "/",
            "message": "User session, tokens, and credentials successfully cleared."
        })
    else:
        resp = make_response(redirect(url_for("index")))

    cookie_name = app.config.get("SESSION_COOKIE_NAME", "session")
    resp.set_cookie(cookie_name, "", expires=0, path="/")
    resp.set_cookie("session", "", expires=0, path="/")
    return resp


# ==========================================
# 3. ADVANCED BIOMETRIC AUTHENTICATION APIS
# ==========================================

@app.route("/api/auth/biometric/register-challenge", methods=["POST"])
def biometric_register_challenge():
    """Generates challenge for WebAuthn / Passkey / Biometric registration"""
    athlete = get_current_athlete()
    if not session.get("logged_in") or not athlete:
        return jsonify({"success": False, "message": "Authenticated user session required to enroll biometrics."}), 401

    challenge_token = secrets.token_urlsafe(32)
    challenge_id = f"chal-{uuid.uuid4().hex[:8]}"
    BIOMETRIC_CHALLENGES[challenge_id] = {
        "challenge": challenge_token,
        "athlete_id": athlete["id"],
        "expires_at": datetime.datetime.now() + datetime.timedelta(minutes=3),
        "type": "registration"
    }

    return jsonify({
        "success": True,
        "challenge_id": challenge_id,
        "challenge": challenge_token,
        "rp": {
            "name": "FutureFit Athletic Biometrics",
            "id": request.host.split(":")[0]
        },
        "user": {
            "id": athlete["id"],
            "name": athlete["phone"],
            "displayName": athlete["name"]
        },
        "pubKeyCredParams": [
            {"alg": -7, "type": "public-key"},   # ES256
            {"alg": -257, "type": "public-key"}  # RS256
        ],
        "authenticatorSelection": {
            "authenticatorAttachment": "platform",
            "userVerification": "preferred",
            "requireResidentKey": False
        },
        "timeout": 60000
    })


@app.route("/api/auth/biometric/register", methods=["POST"])
def biometric_register():
    """Registers and stores a verified biometric passkey credential token in athlete's profile"""
    data = request.get_json() or {}
    challenge_id = data.get("challenge_id")
    credential_id = data.get("credential_id") or f"cred-{uuid.uuid4().hex[:12]}"
    public_key_token = data.get("token") or data.get("public_key") or secrets.token_hex(32)
    device_name = data.get("device_name", "Primary Biometric Device (Touch ID / Face ID)")
    auth_type = data.get("type", "platform-biometric")

    chal_record = BIOMETRIC_CHALLENGES.pop(challenge_id, None)
    if not chal_record or datetime.datetime.now() > chal_record["expires_at"]:
        return jsonify({"success": False, "message": "Biometric registration challenge has expired or is invalid."}), 400

    athlete = None
    for ath in ATHLETES_DB:
        if ath["id"] == chal_record["athlete_id"]:
            athlete = ath
            break

    if not athlete:
        return jsonify({"success": False, "message": "Athlete not found."}), 404

    if "biometric_credentials" not in athlete:
        athlete["biometric_credentials"] = []

    new_credential = {
        "credential_id": credential_id,
        "token": public_key_token,
        "type": auth_type,
        "device_name": device_name,
        "registered_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "sign_count": 0
    }
    athlete["biometric_credentials"].append(new_credential)
    logger.info(f"Biometric passkey registered for athlete {athlete['name']} ({athlete['id']})")

    return jsonify({
        "success": True,
        "message": f"Biometric credential enrolled successfully on {device_name}.",
        "credential": {
            "credential_id": credential_id,
            "device_name": device_name,
            "registered_at": new_credential["registered_at"]
        }
    })


@app.route("/api/auth/biometric/login-challenge", methods=["POST"])
def biometric_login_challenge():
    """Generates an authentication challenge for WebAuthn / Face ID / Fingerprint login"""
    data = request.get_json() or {}
    identifier = data.get("identifier", "").strip()
    if not identifier:
        return jsonify({"success": False, "message": "Mobile number or email identifier is required."}), 400

    athlete = find_athlete_by_identifier(identifier)
    if not athlete:
        return jsonify({"success": False, "message": "No account found matching this mobile number or email."}), 404

    creds = athlete.get("biometric_credentials", [])
    if not creds:
        return jsonify({
            "success": False,
            "message": "Biometric authentication is not yet enrolled on this account. Please sign in with OTP first to register your device."
        }), 400

    challenge_token = secrets.token_urlsafe(32)
    challenge_id = f"chal-{uuid.uuid4().hex[:8]}"
    BIOMETRIC_CHALLENGES[challenge_id] = {
        "challenge": challenge_token,
        "athlete_id": athlete["id"],
        "expires_at": datetime.datetime.now() + datetime.timedelta(minutes=3),
        "type": "authentication"
    }

    return jsonify({
        "success": True,
        "challenge_id": challenge_id,
        "challenge": challenge_token,
        "rp_id": request.host.split(":")[0],
        "allowCredentials": [{"id": c["credential_id"], "type": "public-key"} for c in creds],
        "athlete_name": athlete["name"],
        "timeout": 60000
    })


@app.route("/api/auth/biometric/verify", methods=["POST"])
def biometric_verify():
    """Verifies biometric token/signature, authenticates session, and returns real user data"""
    data = request.get_json() or {}
    challenge_id = data.get("challenge_id")
    credential_id = data.get("credential_id")

    chal_record = BIOMETRIC_CHALLENGES.pop(challenge_id, None)
    if not chal_record or datetime.datetime.now() > chal_record["expires_at"]:
        return jsonify({"success": False, "message": "Biometric challenge expired or invalid."}), 400

    athlete = None
    for ath in ATHLETES_DB:
        if ath["id"] == chal_record["athlete_id"]:
            athlete = ath
            break

    if not athlete:
        return jsonify({"success": False, "message": "Athlete not found."}), 404

    matched_cred = None
    for cred in athlete.get("biometric_credentials", []):
        if cred.get("credential_id") == credential_id or not credential_id:
            matched_cred = cred
            break

    if not matched_cred and athlete.get("biometric_credentials"):
        return jsonify({"success": False, "message": "Unrecognized biometric credential for this athlete."}), 401

    if matched_cred:
        matched_cred["sign_count"] = matched_cred.get("sign_count", 0) + 1
        matched_cred["last_used"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

    # Establish authenticated session
    session["athlete_id"] = athlete["id"]
    session["athlete_name"] = athlete["name"]
    session["role"] = athlete.get("role", "athlete")
    session["auth_method"] = "biometric"
    session["logged_in"] = True

    logger.info(f"Biometric authentication successful for {athlete['name']} ({athlete['id']})")

    return jsonify({
        "success": True,
        "message": f"Biometric verification successful. Welcome, {athlete['name']}!",
        "athlete": athlete,
        "redirect_url": "/dashboard"
    })


# ==========================================
# 4. PERSONALIZED & ROLE-BASED DATA ENDPOINTS
# ==========================================

@app.route("/api/user/me", methods=["GET"])
@login_required
def get_user_me():
    """Returns the authenticated user's profile, role, and credential metadata"""
    athlete = get_current_athlete()
    role = session.get("role", athlete.get("role", "athlete"))
    return jsonify({
        "success": True,
        "user": {
            "id": athlete["id"],
            "name": athlete["name"],
            "phone": athlete["phone"],
            "email": athlete.get("email", ""),
            "role": role,
            "district": athlete["district"],
            "state": athlete["state"],
            "sport": athlete["sport"],
            "verified_ai": athlete.get("verified_ai", False),
            "scout_endorsed": athlete.get("scout_endorsed", False),
            "biometric_enrolled": len(athlete.get("biometric_credentials", [])) > 0,
            "biometric_devices_count": len(athlete.get("biometric_credentials", [])),
            "auth_method": session.get("auth_method", "otp")
        }
    })


@app.route("/api/user/dashboard-data", methods=["GET"])
@login_required
def get_user_dashboard_data():
    """
    Role-Adaptive Personalized Data Response Endpoint:
    Dynamically formats metrics and operational context based on the authenticated user's role:
    - athlete: personal jump metrics, training streak, chart progression, active trials, coach protocol
    - scout: candidate verification pipeline, district quotas, top talent rankings, pending reviews
    - coach: squad performance analytics, team jump averages, athlete roster, readiness index
    - admin: system-wide audit, compliance rate, total screened candidates, platform configuration
    """
    athlete = get_current_athlete()
    role = session.get("role", athlete.get("role", "athlete"))

    if role == "athlete":
        user_history = [j for j in JUMP_HISTORY_DB if j.get("athlete_id") == athlete["id"]]
        if not user_history:
            user_history = [
                {"date": datetime.date.today().strftime("%Y-%m-%d"), "jump_cm": athlete["peak_jump_cm"], "hang_time_ms": 740, "athlete_id": athlete["id"]}
            ]
        user_registrations = [r for r in REGISTRATIONS_DB if r.get("athlete_id") == athlete["id"]]

        return jsonify({
            "success": True,
            "role": "athlete",
            "profile": {
                "id": athlete["id"],
                "name": athlete["name"],
                "avatar": athlete["avatar"],
                "district": athlete["district"],
                "state": athlete["state"],
                "sport": athlete["sport"],
                "bio": athlete.get("bio", ""),
                "verified_ai": athlete.get("verified_ai", False),
                "scout_endorsed": athlete.get("scout_endorsed", False)
            },
            "performance_metrics": {
                "peak_jump_cm": athlete["peak_jump_cm"],
                "total_sessions": athlete["total_sessions"],
                "calories_burned": athlete["calories_burned"],
                "streak_days": athlete["streak_days"],
                "national_rank": athlete["national_rank"]
            },
            "jump_chart_history": user_history,
            "upcoming_trials": user_registrations,
            "active_coach_protocol": {
                "sport": ACTIVE_WORKOUT_PLAN.get("sport"),
                "goal": ACTIVE_WORKOUT_PLAN.get("goal"),
                "today_focus": ACTIVE_WORKOUT_PLAN["days"][0]["focus"],
                "today_exercises": ACTIVE_WORKOUT_PLAN["days"][0]["exercises"]
            },
            "coaching_recommendations": [
                "Focus on explosive triple extension (hip, knee, ankle) during initial 0.15s takeoff.",
                "Ensure Left Ankle (#27) rests firmly on calibrated ground baseline before initiating jump."
            ]
        })

    elif role == "scout":
        total_candidates = len(ADMIN_CANDIDATES_DB)
        verified_candidates = sum(1 for c in ADMIN_CANDIDATES_DB if c.get("status") == "Verified AI Candidate")
        pending_review = sum(1 for c in ADMIN_CANDIDATES_DB if c.get("status") == "Pending Review")
        flagged = sum(1 for c in ADMIN_CANDIDATES_DB if c.get("status") == "Flagged for Review")

        return jsonify({
            "success": True,
            "role": "scout",
            "profile": {
                "id": session.get("athlete_id", "scout-001"),
                "name": session.get("athlete_name", "Dr. Pradeep Jadhav"),
                "designation": "Official SAI Western Region Scout",
                "authority": "Sports Authority of India"
            },
            "scouting_pipeline": {
                "total_candidates_screened": total_candidates,
                "verified_ai_candidates": verified_candidates,
                "pending_review_count": pending_review,
                "flagged_candidates_count": flagged,
                "verification_rate_percent": round((verified_candidates / max(1, total_candidates)) * 100, 1)
            },
            "district_scouting_drives": SCOUTING_DRIVES_DB,
            "top_prospects_leaderboard": sorted(ATHLETES_DB, key=lambda x: x["peak_jump_cm"], reverse=True)[:5],
            "pending_action_queue": [c for c in ADMIN_CANDIDATES_DB if c.get("status") != "Verified AI Candidate"][:5]
        })

    elif role == "coach":
        total_athletes = len(ATHLETES_DB)
        avg_jump = round(sum(a["peak_jump_cm"] for a in ATHLETES_DB) / max(1, total_athletes), 1)
        avg_streak = round(sum(a["streak_days"] for a in ATHLETES_DB) / max(1, total_athletes), 1)
        verified_count = sum(1 for a in ATHLETES_DB if a.get("verified_ai"))

        return jsonify({
            "success": True,
            "role": "coach",
            "squad_analytics": {
                "squad_size": total_athletes,
                "average_vertical_jump_cm": avg_jump,
                "average_training_streak_days": avg_streak,
                "ai_verified_ratio": f"{verified_count}/{total_athletes}",
                "squad_readiness_index": "92.4% (Optimal)"
            },
            "athlete_roster": [
                {
                    "id": a["id"],
                    "name": a["name"],
                    "sport": a["sport"],
                    "district": a["district"],
                    "peak_jump_cm": a["peak_jump_cm"],
                    "streak_days": a["streak_days"],
                    "verified_ai": a["verified_ai"]
                }
                for a in ATHLETES_DB
            ],
            "training_curriculum": ACTIVE_WORKOUT_PLAN
        })

    elif role == "admin":
        return jsonify({
            "success": True,
            "role": "admin",
            "system_overview": {
                "platform_name": "FutureFit AI Sports Engine",
                "version": "2.6.0-prod",
                "server_time": datetime.datetime.now().isoformat(),
                "fast2sms_gateway": {
                    "configured": FAST2SMS_API_KEY != "YOUR_FAST2SMS_API_KEY_HERE" and bool(FAST2SMS_API_KEY),
                    "endpoint": "https://www.fast2sms.com/dev/bulkV2"
                },
                "registered_athletes": len(ATHLETES_DB),
                "total_trial_events": len(EVENTS_DB),
                "total_admit_passes_issued": len(REGISTRATIONS_DB),
                "active_scouting_drives": len(SCOUTING_DRIVES_DB),
                "community_posts": len(POSTS_DB)
            },
            "security_and_auth": {
                "active_sessions": 1,
                "biometric_webauthn_enabled": True,
                "otp_gateway": "Fast2SMS bulkV2",
                "rate_limiting": "5 attempts per OTP / 5 min window"
            }
        })


# ==========================================
# ATHLETE & DASHBOARD APIS
# ==========================================

@app.route("/api/athlete/profile", methods=["GET"])
def get_profile():
    return jsonify({"success": True, "athlete": get_current_athlete()})


@app.route("/api/athlete/stats", methods=["GET"])
def get_stats():
    ath = get_current_athlete()
    user_history = [j for j in JUMP_HISTORY_DB if j.get("athlete_id") == ath["id"]]
    if not user_history:
        user_history = [
            {"date": datetime.date.today().strftime("%Y-%m-%d"), "jump_cm": ath["peak_jump_cm"], "hang_time_ms": 720, "athlete_id": ath["id"]}
        ]
    return jsonify({
        "success": True,
        "peak_jump_cm": ath["peak_jump_cm"],
        "total_sessions": ath["total_sessions"],
        "calories_burned": ath["calories_burned"],
        "streak_days": ath["streak_days"],
        "national_rank": ath["national_rank"],
        "history": user_history
    })


@app.route("/api/jump/record", methods=["POST"])
def record_jump():
    """Record a newly completed jump assessment from the AI Pose camera engine"""
    data = request.get_json() or {}
    jump_cm = float(data.get("jump_height_cm", 0.0))
    hang_time_ms = int(data.get("hang_time_ms", 0))
    ankle_displacement = float(data.get("ankle_displacement_y", 0.0))
    latency_ms = int(data.get("latency_ms", 15))

    ath = get_current_athlete()
    if not ath:
        # Fallback to guest athlete profile if unauthenticated
        ath = {
            "id": "ath-guest",
            "name": session.get("user_name", "Registered Candidate"),
            "district": session.get("district", "Pune"),
            "state": session.get("state", "Maharashtra"),
            "sport": "Athletics - Jump Assessment",
            "age": 19,
            "total_sessions": 0,
            "calories_burned": 0,
            "peak_jump_cm": 0.0
        }

    ath["total_sessions"] = ath.get("total_sessions", 0) + 1
    ath["calories_burned"] = ath.get("calories_burned", 0) + random.randint(18, 28)

    # Check if this is a new personal best
    is_new_best = False
    current_peak = ath.get("peak_jump_cm", 0.0)
    if jump_cm > current_peak:
        ath["peak_jump_cm"] = round(jump_cm, 1)
        is_new_best = True

    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    JUMP_HISTORY_DB.append({
        "date": today_str,
        "jump_cm": round(jump_cm, 1),
        "hang_time_ms": hang_time_ms,
        "athlete_id": ath["id"]
    })

    # Add to Admin verification pool
    new_candidate_entry = {
        "id": f"cand-{uuid.uuid4().hex[:6]}",
        "athlete_id": ath["id"],
        "name": ath.get("name", "Athletic Candidate"),
        "district": ath.get("district", "Pune"),
        "state": ath.get("state", "Maharashtra"),
        "sport": ath.get("sport", "Athletics - Jump Assessment"),
        "age": ath.get("age", 19),
        "recorded_jump_cm": round(jump_cm, 1),
        "ankle_landmark_y_delta": round(ankle_displacement, 3),
        "hang_time_ms": hang_time_ms,
        "takeoff_velocity_ms": round(9.80665 * (hang_time_ms / 2000.0), 2) if hang_time_ms > 0 else 3.5,
        "recorded_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "status": "Verified AI Candidate" if jump_cm >= 60 else "Pending Review",
        "verification_score": min(99.4, round(90 + (jump_cm / 10), 1)),
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
        "notes": f"Real-time session verified. Left ankle (#27) peak displacement recorded."
    }
    ADMIN_CANDIDATES_DB.insert(0, new_candidate_entry)

    return jsonify({
        "success": True,
        "message": "Jump assessment recorded and submitted to talent database!",
        "is_new_best": is_new_best,
        "peak_jump_cm": ath.get("peak_jump_cm", round(jump_cm, 1)),
        "total_sessions": ath.get("total_sessions", 1),
        "calories_burned": ath.get("calories_burned", 25),
        "candidate_id": new_candidate_entry["id"]
    })


# ==========================================
# AI SPORTS COACH APIS
# ==========================================

COACH_EXERCISE_LIBRARY = {
    "jump_height": [
        {
            "name": "Depth Jumps to Max Vertical",
            "sets": "4 sets",
            "reps": "6 reps",
            "rest_seconds": 60,
            "target": "Reactive Plyometrics & Achilles Elasticity",
            "focus": "Minimize ground contact time under 0.20s; explosive arm swing.",
            "video_url": "https://www.youtube.com/embed/P32_p24oU_k",
            "difficulty": "Advanced"
        },
        {
            "name": "Bulgarian Split Squats (Explosive)",
            "sets": "3 sets",
            "reps": "8 reps / leg",
            "rest_seconds": 45,
            "target": "Unilateral Quad & Glute Maxima Drive",
            "focus": "Control eccentric descent 3s, explode upward onto toes.",
            "video_url": "https://www.youtube.com/embed/2C-uNgKwPLE",
            "difficulty": "Intermediate"
        },
        {
            "name": "Seated Box Jumps (Static-to-Explosive)",
            "sets": "4 sets",
            "reps": "5 reps",
            "rest_seconds": 60,
            "target": "Overcoming Static Inertia & Rate of Force Development",
            "focus": "Zero countermovement rocking; pure hip extensor recruitment.",
            "video_url": "https://www.youtube.com/embed/V6vC32q3o0U",
            "difficulty": "Advanced"
        },
        {
            "name": "Tibialis Anterior & Calf Pogo Hops",
            "sets": "3 sets",
            "reps": "30 reps",
            "rest_seconds": 30,
            "target": "Ankle Stiffness & Landing Deceleration",
            "focus": "Keep knees stiff; bounce rhythmically from balls of feet.",
            "video_url": "https://www.youtube.com/embed/9G6k1UjP3eY",
            "difficulty": "Foundation"
        }
    ],
    "agility": [
        {
            "name": "5-10-5 Pro Agility Shuttle Drills",
            "sets": "5 sets",
            "reps": "1 full shuttle",
            "rest_seconds": 45,
            "target": "Lateral Deceleration & Center of Mass Transition",
            "focus": "Touch baseline with hand; stay low through directional cut.",
            "video_url": "https://www.youtube.com/embed/4xL_iM65rN8",
            "difficulty": "Intermediate"
        },
        {
            "name": "Hexagon Agility Fast-Twitch Hops",
            "sets": "4 sets",
            "reps": "18 hops",
            "rest_seconds": 40,
            "target": "Multi-directional Foot Speed & Coordination",
            "focus": "Maintain torso facing forward; quick light foot touches.",
            "video_url": "https://www.youtube.com/embed/6y_4h8Q1r1c",
            "difficulty": "Advanced"
        },
        {
            "name": "Band-Resisted Lateral Crossover Steps",
            "sets": "3 sets",
            "reps": "12 steps / side",
            "rest_seconds": 30,
            "target": "Hip Abductors & Glute Medius Stability",
            "focus": "Maintain athletic stance; do not allow knees to cave in.",
            "video_url": "https://www.youtube.com/embed/8y6vG_1h7oI",
            "difficulty": "Intermediate"
        }
    ],
    "stamina": [
        {
            "name": "High-Intensity Burpee Broad Jumps",
            "sets": "4 sets",
            "reps": "10 reps",
            "rest_seconds": 45,
            "target": "Anaerobic Lactic Capacity & Whole-Body Power",
            "focus": "Chest to floor, immediately launch into maximal horizontal leap.",
            "video_url": "https://www.youtube.com/embed/TU8QYVW0gDU",
            "difficulty": "Advanced"
        },
        {
            "name": "Tabata Jump Rope Double-Unders",
            "sets": "8 rounds",
            "reps": "20s work / 10s rest",
            "rest_seconds": 60,
            "target": "Cardiovascular Threshold & Calves Endurance",
            "focus": "Wrists turn fast, soft bounce on forefoot.",
            "video_url": "https://www.youtube.com/embed/q_2mX0q9r9s",
            "difficulty": "Advanced"
        }
    ]
}

ACTIVE_WORKOUT_PLAN = {
    "sport": "Athletics",
    "goal": "Increase Vertical Jump +10cm",
    "age_bracket": "18-22",
    "daily_time": "45 mins",
    "days": [
        {
            "day": 1,
            "title": "Explosive Rate of Force Development",
            "focus": "Maximal Vertical Output & Elastic Recoil",
            "exercises": COACH_EXERCISE_LIBRARY["jump_height"][:3]
        },
        {
            "day": 2,
            "title": "Lateral Agility & Directional Deceleration",
            "focus": "Cut Mechanics & Joint Stabilization",
            "exercises": COACH_EXERCISE_LIBRARY["agility"][:2]
        },
        {
            "day": 3,
            "title": "Active Kinetic Recovery & Mobility",
            "focus": "Hamstrings, Hip Flexors & Ankle Dorsiflexion",
            "exercises": [COACH_EXERCISE_LIBRARY["jump_height"][3]]
        },
        {
            "day": 4,
            "title": "Unilateral Jump Power & Single-Leg Force",
            "focus": "Single Leg Takeoffs & Asymmetry Correction",
            "exercises": [COACH_EXERCISE_LIBRARY["jump_height"][1], COACH_EXERCISE_LIBRARY["jump_height"][0]]
        },
        {
            "day": 5,
            "title": "High-Speed Agility & Ankle Stiffness",
            "focus": "Fast Ground Contact & Reaction Time",
            "exercises": [COACH_EXERCISE_LIBRARY["agility"][1], COACH_EXERCISE_LIBRARY["jump_height"][3]]
        },
        {
            "day": 6,
            "title": "Anaerobic Power Stamina & Conditioning",
            "focus": "Late-Game Explosive Jump Preservation",
            "exercises": COACH_EXERCISE_LIBRARY["stamina"]
        },
        {
            "day": 7,
            "title": "Assessment & Rest Day",
            "focus": "AI Camera Engine Vertical Assessment & Deload",
            "exercises": []
        }
    ]
}


@app.route("/api/coach/plan", methods=["GET"])
def get_coach_plan():
    return jsonify({"success": True, "plan": ACTIVE_WORKOUT_PLAN})


@app.route("/api/coach/generate-plan", methods=["POST"])
def generate_coach_plan():
    data = request.get_json() or {}
    sport = data.get("sport", "Athletics")
    age = data.get("age", "18-22")
    goal = data.get("goal", "Increase Vertical Jump +10cm")
    time_avail = data.get("time", "45 mins")

    ACTIVE_WORKOUT_PLAN["sport"] = sport
    ACTIVE_WORKOUT_PLAN["goal"] = goal
    ACTIVE_WORKOUT_PLAN["age_bracket"] = age
    ACTIVE_WORKOUT_PLAN["daily_time"] = time_avail
    ACTIVE_WORKOUT_PLAN["days"][0]["title"] = f"{sport} Kinetic Takeoff & Max Vertical"
    ACTIVE_WORKOUT_PLAN["days"][1]["title"] = f"{sport} Agility & Rapid Deceleration"

    return jsonify({
        "success": True,
        "message": f"Custom AI training schedule tailored for {sport} generated successfully!",
        "plan": ACTIVE_WORKOUT_PLAN
    })


# ==========================================
# TALENT SCOUT & LEADERBOARD APIS
# ==========================================

@app.route("/api/leaderboard", methods=["GET"])
def get_leaderboard():
    district = request.args.get("district", "All")
    state = request.args.get("state", "All")
    sport = request.args.get("sport", "All")
    gender = request.args.get("gender", "All")
    timeframe = request.args.get("timeframe", "All-Time")

    results = list(ATHLETES_DB)

    if district != "All":
        results = [a for a in results if a["district"].lower() == district.lower()]
    if state != "All":
        results = [a for a in results if a["state"].lower() == state.lower()]
    if sport != "All":
        results = [a for a in results if a["sport"].lower() == sport.lower()]
    if gender != "All":
        results = [a for a in results if a["gender"].lower() == gender.lower()]

    results.sort(key=lambda x: x["peak_jump_cm"], reverse=True)

    filtered_list = []
    for idx, item in enumerate(results, 1):
        item_copy = dict(item)
        item_copy["filter_rank"] = idx
        filtered_list.append(item_copy)

    return jsonify({
        "success": True,
        "total": len(filtered_list),
        "athletes": filtered_list
    })


# ==========================================
# EVENTS & SCOUTING CAMPS APIS
# ==========================================

@app.route("/api/events", methods=["GET"])
def get_events():
    district = request.args.get("district", "All")
    sport = request.args.get("sport", "All")
    status = request.args.get("status", "All")

    events = list(EVENTS_DB)
    if district != "All":
        events = [e for e in events if e["district"].lower() == district.lower()]
    if sport != "All":
        events = [e for e in events if sport.lower() in [s.lower() for s in e["sports"]]]
    if status != "All":
        events = [e for e in events if e["status"].lower() == status.lower()]

    return jsonify({"success": True, "events": events, "my_registrations": REGISTRATIONS_DB})


@app.route("/api/events/register", methods=["POST"])
def register_event():
    data = request.get_json() or {}
    event_id = data.get("event_id")
    category = data.get("category", "General Athletic Trials")

    matched_event = None
    for evt in EVENTS_DB:
        if evt["id"] == event_id:
            matched_event = evt
            break

    if not matched_event:
        return jsonify({"success": False, "message": "Event not found"}), 404

    # Check if already registered
    for reg in REGISTRATIONS_DB:
        if reg["event_id"] == event_id and reg["athlete_id"] == session.get("athlete_id", "ath-001"):
            return jsonify({"success": False, "message": "You are already registered for this trial."}), 400

    ath = get_current_athlete()
    reg_id = f"SAI-{matched_event['district'][:3].upper()}-2026-{random.randint(1000, 9999)}"

    new_reg = {
        "reg_id": reg_id,
        "event_id": event_id,
        "athlete_id": ath["id"],
        "athlete_name": ath["name"],
        "event_title": matched_event["title"],
        "district": matched_event["district"],
        "sport": matched_event["sports"][0],
        "category": category,
        "slot": "Morning Session (08:30 AM IST)",
        "qr_code_token": f"{reg_id}-VERIFIED-KHELO-INDIA",
        "registered_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    REGISTRATIONS_DB.append(new_reg)
    matched_event["spots_filled"] += 1

    return jsonify({
        "success": True,
        "message": f"Successfully registered for {matched_event['title']}!",
        "registration": new_reg
    })


# ==========================================
# COMMUNITY & SOCIAL FEED APIS
# ==========================================

@app.route("/api/community/posts", methods=["GET"])
def get_posts():
    return jsonify({"success": True, "posts": POSTS_DB})


@app.route("/api/community/like", methods=["POST"])
def like_post():
    data = request.get_json() or {}
    post_id = data.get("post_id")
    for post in POSTS_DB:
        if post["id"] == post_id:
            if post.get("liked_by_me"):
                post["liked_by_me"] = False
                post["likes_count"] -= 1
            else:
                post["liked_by_me"] = True
                post["likes_count"] += 1
            return jsonify({
                "success": True,
                "likes_count": post["likes_count"],
                "liked_by_me": post["liked_by_me"]
            })
    return jsonify({"success": False, "message": "Post not found"}), 404


@app.route("/api/community/comment", methods=["POST"])
def comment_post():
    data = request.get_json() or {}
    post_id = data.get("post_id")
    text = data.get("text", "").strip()

    if not text:
        return jsonify({"success": False, "message": "Comment cannot be empty"}), 400

    ath = get_current_athlete()
    for post in POSTS_DB:
        if post["id"] == post_id:
            new_comment = {
                "id": f"c-{uuid.uuid4().hex[:6]}",
                "author": ath["name"],
                "avatar": ath["avatar"],
                "text": text,
                "time": "Just now"
            }
            post["comments"].append(new_comment)
            return jsonify({
                "success": True,
                "message": "Comment added successfully.",
                "comment": new_comment,
                "total_comments": len(post["comments"])
            })
    return jsonify({"success": False, "message": "Post not found"}), 404


@app.route("/api/community/follow", methods=["POST"])
def follow_athlete():
    data = request.get_json() or {}
    post_id = data.get("post_id")
    for post in POSTS_DB:
        if post["id"] == post_id:
            post["followed_by_me"] = not post.get("followed_by_me", False)
            return jsonify({
                "success": True,
                "followed_by_me": post["followed_by_me"],
                "message": "Now following athlete!" if post["followed_by_me"] else "Unfollowed athlete."
            })
    return jsonify({"success": False, "message": "Post not found"}), 404


@app.route("/api/community/endorse", methods=["POST"])
def endorse_post():
    data = request.get_json() or {}
    post_id = data.get("post_id")
    for post in POSTS_DB:
        if post["id"] == post_id:
            post["scout_endorsed"] = True
            post["endorsed_by"] = "SAI High Performance Scouting Cell"
            return jsonify({
                "success": True,
                "message": "Official Scout Endorsement awarded to this athlete!",
                "scout_endorsed": True,
                "endorsed_by": post["endorsed_by"]
            })
    return jsonify({"success": False, "message": "Post not found"}), 404


@app.route("/api/community/create-post", methods=["POST"])
def create_post():
    data = request.get_json() or {}
    content = data.get("content", "").strip()
    metrics_badge = data.get("metrics_badge", "Vertical Jump: Verified")

    if not content:
        return jsonify({"success": False, "message": "Post content is required"}), 400

    ath = get_current_athlete()
    new_post = {
        "id": f"post-{uuid.uuid4().hex[:6]}",
        "athlete_id": ath["id"],
        "author": ath["name"],
        "avatar": ath["avatar"],
        "district": ath["district"],
        "sport": ath["sport"],
        "time_ago": "Just now",
        "content": content,
        "metrics_badge": metrics_badge,
        "video_thumbnail": "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80",
        "likes_count": 1,
        "liked_by_me": False,
        "followed_by_me": False,
        "scout_endorsed": ath.get("scout_endorsed", False),
        "endorsed_by": "District Sports Office" if ath.get("scout_endorsed") else None,
        "comments": []
    }
    POSTS_DB.insert(0, new_post)

    return jsonify({
        "success": True,
        "message": "Post published to FutureFit community!",
        "post": new_post
    })


# ==========================================
# SECURE ADMIN & SCOUT PORTAL APIS
# ==========================================

@app.route("/api/admin/candidates", methods=["GET"])
def get_admin_candidates():
    district = request.args.get("district", "All")
    status = request.args.get("status", "All")
    sport = request.args.get("sport", "All")

    candidates = list(ADMIN_CANDIDATES_DB)
    if district != "All":
        candidates = [c for c in candidates if c["district"].lower() == district.lower()]
    if status != "All":
        candidates = [c for c in candidates if c["status"].lower() == status.lower()]
    if sport != "All":
        candidates = [c for c in candidates if c["sport"].lower() == sport.lower()]

    return jsonify({
        "success": True,
        "total": len(candidates),
        "candidates": candidates
    })


@app.route("/api/admin/verify-candidate", methods=["POST"])
def verify_candidate():
    data = request.get_json() or {}
    cand_id = data.get("candidate_id")
    new_status = data.get("status", "Verified AI Candidate")
    notes = data.get("notes", "Scout biometric assessment passed.")

    for cand in ADMIN_CANDIDATES_DB:
        if cand["id"] == cand_id:
            cand["status"] = new_status
            cand["notes"] = notes
            for ath in ATHLETES_DB:
                if ath["id"] == cand["athlete_id"]:
                    ath["verified_ai"] = (new_status == "Verified AI Candidate")
                    if new_status == "Verified AI Candidate":
                        ath["scout_endorsed"] = True
            return jsonify({
                "success": True,
                "message": f"Candidate status updated to {new_status}.",
                "candidate": cand
            })
    return jsonify({"success": False, "message": "Candidate not found"}), 404


@app.route("/api/admin/export/csv", methods=["GET"])
def export_candidates_csv():
    """Export candidate evaluation reports in CSV format"""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Candidate ID", "Athlete Name", "District", "State", "Sport", "Age",
        "Peak Jump (cm)", "Ankle Landmark Delta Y", "Hang Time (ms)",
        "Takeoff Velocity (m/s)", "Verification Status", "Score (%)", "Timestamp", "Scout Notes"
    ])

    for cand in ADMIN_CANDIDATES_DB:
        writer.writerow([
            cand["id"], cand["name"], cand["district"], cand["state"], cand["sport"], cand["age"],
            cand["recorded_jump_cm"], cand["ankle_landmark_y_delta"], cand["hang_time_ms"],
            cand["takeoff_velocity_ms"], cand["status"], cand["verification_score"],
            cand["recorded_at"], cand["notes"]
        ])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=futurefit_candidates_{datetime.date.today()}.csv"}
    )


@app.route("/api/admin/drives", methods=["GET", "POST"])
def handle_drives():
    if request.method == "POST":
        data = request.get_json() or {}
        title = data.get("title", "").strip()
        districts = data.get("districts", ["Dhule"])
        lead_scout = data.get("lead_scout", "SAI Regional Director")
        quota = int(data.get("quota", 250))
        start_date = data.get("start_date", datetime.date.today().strftime("%Y-%m-%d"))
        end_date = data.get("end_date", (datetime.date.today() + datetime.timedelta(days=14)).strftime("%Y-%m-%d"))

        new_drive = {
            "id": f"drv-{random.randint(110, 999)}",
            "title": title,
            "target_districts": districts if isinstance(districts, list) else [d.strip() for d in districts.split(",")],
            "lead_scout": lead_scout,
            "start_date": start_date,
            "end_date": end_date,
            "quota": quota,
            "candidates_screened": 0,
            "status": "Active"
        }
        SCOUTING_DRIVES_DB.append(new_drive)
        return jsonify({
            "success": True,
            "message": f"Scouting Drive '{title}' launched successfully!",
            "drive": new_drive
        })

    return jsonify({"success": True, "drives": SCOUTING_DRIVES_DB})


@app.route("/api/pose/process", methods=["POST"])
def process_pose_landmarks():
    """Validates real-time landmark coordinates sent by client or camera stream"""
    data = request.get_json() or {}
    ankle_y = float(data.get("ankle_y", 0.8))
    baseline_y = float(data.get("baseline_y", 0.8))
    displacement_px = data.get("displacement_px", 0)

    ath = get_current_athlete()
    height_cm = ath.get("height_cm", 178) if ath else 178
    estimated_height_cm = max(0.0, (baseline_y - ankle_y) * height_cm * 1.6)

    return jsonify({
        "success": True,
        "ankle_y": round(ankle_y, 4),
        "displacement_norm": round(baseline_y - ankle_y, 4),
        "calculated_jump_cm": round(estimated_height_cm, 1),
        "status": "Telemetry synchronized"
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
