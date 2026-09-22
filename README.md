# JanSamadhan - AI-Powered Public Grievance Portal

A centralized, transparent, and citizen-first public grievance redressal and monitoring platform with AI-driven clustering, prioritization, and community endorsement ("Me Too") system.

## Key Features

- **Citizen Experience**:
  - **Single Citizen ID & Authentication**: Aadhaar-compliant verification with instant mobile OTP and password login.
  - **Multilingual & Voice Grievance Lodging**: Lodging grievances via text or neural speech-to-text powered by Gemini 3.5 Transcribe.
  - **Issues in Your Area**: Neighborhood issues feed allowing citizens to view existing reported problems in their locality.
  - **"Me Too" Endorsement**: Citizens can indicate they are also affected by an existing issue with a single click, boosting community volume and escalating official priority without filing duplicate complaints.
  - **Duplicate Prevention Precheck**: Inline banner checks for existing neighborhood issues before a citizen lodges a new petition.
  - **Real-Time Grievance Tracker**: Public tracking of grievance progress with milestones and assigned nodal officers.

- **Nodal Officer / Admin Portal**:
  - **Grievance AI Civic Incident Detection**: Groups individual complaints from the same area and category into clustered Civic Incidents.
  - **3-Factor AI Priority Scoring (1–100%)**:
    - **Volume Score ($S_{\text{volume}}$ - max 40 pts)**: Scales with registered complaints and community "Me Too" endorsements: $S_{\text{volume}} = \min(40, 10 + (\text{effectiveCount} - 1) \times 6)$.
    - **Sensitivity Score ($S_{\text{sensitivity}}$ - max 35 pts)**: Critical Essential (Water 35 pts), Citizen Safety (Women Care 34 pts), Health (33 pts), Cyber/Police (28 pts), Land/Revenue (26 pts), Municipal (25 pts), Electricity/PWD (18 pts).
    - **Urgency Score ($S_{\text{urgency}}$ - max 25 pts)**: Emergency (25 pts), Urgent (16 pts), Standard (8 pts).
  - **Deduplicated Grievance Views**: Separates clustered Civic Incidents from unique standalone grievances.
  - **Officer Workflow Desk**: Manage stages, assign field workers, upload reports, and update resolution statuses.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (`pg` driver with connection pooling and automated schema migration)
- **Frontend**: Vanilla HTML5, CSS3 (responsive, accessible, high contrast mode), Vanilla JavaScript (reactive SPA state architecture)
- **AI & Speech**: Google Gemini 3.5 Transcribe API integration with fallback neural speech engine

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/palenceaga/ai-grevinance.git
   cd ai-grevinance
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Copy `.env.example` to `.env` and fill in your database credentials:
   ```bash
   cp .env.example .env
   ```

4. Seed the Database:
   ```bash
   node seed-db.js
   ```

5. Start the Application:
   ```bash
   npm start
   ```
   Open `http://localhost:5000` in your browser.
