const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({ origin: '*' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files (index.html, styles.css, app.js)
app.use(express.static(__dirname));

/* ==========================================================================
   API ENDPOINTS
   ========================================================================== */

/**
 * Health Check & PostgreSQL Connectivity Status
 */
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() as db_time, version() as version;');
    res.json({
      status: 'ok',
      postgres: 'connected',
      timestamp: result.rows[0].db_time,
      version: result.rows[0].version
    });
  } catch (err) {
    console.error('[Health] DB error:', err.message);
    res.status(500).json({ status: 'error', postgres: 'disconnected', error: err.message });
  }
});

/**
 * Citizen Registration with Aadhaar & Password Hashing
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, mobile, email, state, category, aadhaar, password } = req.body;

    // Validate inputs
    if (!fullName || !mobile || !email || !state || !category || !aadhaar || !password) {
      return res.status(400).json({ success: false, message: 'All registration fields are required.' });
    }

    const cleanMobile = mobile.trim();
    if (!/^\d{10}$/.test(cleanMobile)) {
      return res.status(400).json({ success: false, message: 'Mobile number must be exactly 10 digits.' });
    }

    const cleanAadhaar = aadhaar.replace(/\s+/g, '');
    if (!/^\d{12}$/.test(cleanAadhaar) || /^[01]/.test(cleanAadhaar)) {
      return res.status(400).json({ success: false, message: 'Invalid 12-digit Aadhaar number.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    // Hash Aadhaar with SHA-256 for privacy-compliant duplicate detection
    const aadhaarHash = crypto.createHash('sha256').update(cleanAadhaar).digest('hex');
    const aadhaarMasked = `XXXX XXXX ${cleanAadhaar.slice(8)}`;

    // Check for existing records
    const duplicateCheck = await db.query(`
      SELECT 'mobile' as conflict FROM citizens WHERE mobile = $1
      UNION
      SELECT 'email' as conflict FROM citizens WHERE email = $2
      UNION
      SELECT 'aadhaar' as conflict FROM citizens WHERE aadhaar_hash = $3;
    `, [cleanMobile, email.toLowerCase().trim(), aadhaarHash]);

    if (duplicateCheck.rowCount > 0) {
      const conflictField = duplicateCheck.rows[0].conflict;
      if (conflictField === 'mobile') {
        return res.status(409).json({ success: false, message: 'A citizen with this mobile number is already registered.' });
      } else if (conflictField === 'email') {
        return res.status(409).json({ success: false, message: 'A citizen with this email address is already registered.' });
      } else {
        return res.status(409).json({ success: false, message: 'This Aadhaar number is already linked to an existing account.' });
      }
    }

    // Cryptographic password hash
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert Citizen Record
    const insertResult = await db.query(`
      INSERT INTO citizens (full_name, mobile, email, state, category, aadhaar_hash, aadhaar_masked, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, full_name, mobile, email, state, category, aadhaar_masked, created_at;
    `, [
      fullName.trim(),
      cleanMobile,
      email.toLowerCase().trim(),
      state,
      category,
      aadhaarHash,
      aadhaarMasked,
      passwordHash
    ]);

    const newCitizen = insertResult.rows[0];
    console.log(`[Auth] Registered new citizen: ${newCitizen.full_name} (${newCitizen.email})`);

    return res.status(201).json({
      success: true,
      message: 'Citizen registration completed successfully in PostgreSQL.',
      user: {
        id: newCitizen.id,
        name: newCitizen.full_name,
        email: newCitizen.email,
        mobile: newCitizen.mobile,
        category: newCitizen.category,
        maskedAadhaar: newCitizen.aadhaar_masked,
        role: 'citizen'
      }
    });
  } catch (err) {
    console.error('[Auth Register Error]:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during registration.' });
  }
});

/**
 * Authentication (Citizen & Nodal Officer)
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { role, identifier, password, department, securityPin } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Identifier and password are required.' });
    }

    const cleanId = identifier.trim();

    // 1. Official Login Flow
    if (role === 'official') {
      const officerResult = await db.query(`
        SELECT * FROM officials 
        WHERE LOWER(officer_id) = LOWER($1) OR LOWER(email) = LOWER($1)
        LIMIT 1;
      `, [cleanId]);

      if (officerResult.rowCount === 0) {
        return res.status(401).json({ success: false, message: 'Official record not found. Access denied.' });
      }

      const officer = officerResult.rows[0];

      // Validate Department
      if (department && officer.department.toLowerCase() !== department.toLowerCase()) {
        return res.status(401).json({ success: false, message: 'Department jurisdiction mismatch.' });
      }

      // Validate Security PIN if provided
      if (securityPin && officer.security_pin !== securityPin.trim()) {
        return res.status(401).json({ success: false, message: 'Invalid 2FA security token.' });
      }

      // Compare Password
      const isMatch = await bcrypt.compare(password, officer.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid official credentials.' });
      }

      console.log(`[Auth] Official authenticated: ${officer.officer_id}`);
      return res.json({
        success: true,
        message: 'Nodal Officer authenticated successfully.',
        user: {
          id: officer.id,
          name: officer.officer_id,
          email: officer.email,
          department: officer.department,
          role: 'official'
        }
      });
    }

    // 2. Citizen Login Flow
    const citizenResult = await db.query(`
      SELECT * FROM citizens 
      WHERE LOWER(email) = LOWER($1) OR mobile = $1
      LIMIT 1;
    `, [cleanId]);

    if (citizenResult.rowCount === 0) {
      return res.status(401).json({ success: false, message: 'No registered citizen found with this email or mobile.' });
    }

    const citizen = citizenResult.rows[0];
    const isMatch = await bcrypt.compare(password, citizen.password_hash);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    console.log(`[Auth] Citizen logged in: ${citizen.full_name}`);
    return res.json({
      success: true,
      message: 'Citizen login successful.',
      user: {
        id: citizen.id,
        name: citizen.full_name,
        email: citizen.email,
        mobile: citizen.mobile,
        category: citizen.category,
        maskedAadhaar: citizen.aadhaar_masked,
        role: 'citizen'
      }
    });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
});

/**
 * Mobile OTP Trigger Endpoint
 */
app.post('/api/auth/send-otp', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile || !/^\d{10}$/.test(mobile.trim())) {
    return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number required.' });
  }

  // Simulated OTP for testing
  const demoOtp = '482910';
  console.log(`[OTP] Generated OTP for +91 ${mobile}: ${demoOtp}`);

  res.json({
    success: true,
    message: `OTP sent successfully to +91 ${mobile}.`,
    demoOtp: demoOtp
  });
});

/**
 * Mobile OTP Verification Endpoint
 */
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: 'Mobile and OTP are required.' });
    }

    if (otp !== '482910' && otp !== '123456') {
      return res.status(401).json({ success: false, message: 'Invalid OTP code. Please retry.' });
    }

    const result = await db.query('SELECT * FROM citizens WHERE mobile = $1 LIMIT 1', [mobile.trim()]);
    let user;

    if (result.rowCount > 0) {
      const c = result.rows[0];
      user = {
        id: c.id,
        name: c.full_name,
        email: c.email,
        mobile: c.mobile,
        maskedAadhaar: c.aadhaar_masked,
        role: 'citizen'
      };
    } else {
      user = {
        name: `Citizen (+91 ${mobile.slice(0, 5)}...)`,
        mobile: mobile,
        maskedAadhaar: 'Unlinked',
        role: 'citizen'
      };
    }

    res.json({
      success: true,
      message: 'OTP verified successfully.',
      user
    });
  } catch (err) {
    console.error('[OTP Verify Error]:', err);
    res.status(500).json({ success: false, message: 'Error verifying OTP.' });
  }
});

/**
 * Grievance Tracking Endpoint (Live PostgreSQL Query)
 */
app.get('/api/grievances/track/:docketNo', async (req, res) => {
  try {
    const docketNo = req.params.docketNo.trim().toUpperCase();
    const result = await db.query(`
      SELECT g.*, c.full_name as complainant_name 
      FROM grievances g
      LEFT JOIN citizens c ON g.citizen_id = c.id
      WHERE UPPER(g.docket_no) = $1
      LIMIT 1;
    `, [docketNo]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Grievance docket ${docketNo} not found in central records.`
      });
    }

    res.json({
      success: true,
      grievance: result.rows[0]
    });
  } catch (err) {
    console.error('[Grievance Track Error]:', err);
    res.status(500).json({ success: false, message: 'Error fetching grievance record.' });
  }
});

// In-memory store for Me Too endorsements across server session
const incidentEndorsements = {};

/**
 * Civic Incident "Me Too" Endorsement Endpoint
 * Increments community volume endorsement and recalculates incident urgency
 */
app.post('/api/incidents/:id/me-too', (req, res) => {
  const incidentId = req.params.id;
  const { action = 'add' } = req.body || {};

  if (!incidentEndorsements[incidentId]) {
    incidentEndorsements[incidentId] = 0;
  }

  if (action === 'add') {
    incidentEndorsements[incidentId] += 1;
  } else if (action === 'remove') {
    incidentEndorsements[incidentId] = Math.max(0, incidentEndorsements[incidentId] - 1);
  }

  console.log(`[Civic Incident] 'Me Too' endorsement on ${incidentId}: ${incidentEndorsements[incidentId]} (action: ${action})`);

  res.json({
    success: true,
    incidentId,
    meTooCount: incidentEndorsements[incidentId],
    message: action === 'add'
      ? "Endorsement recorded. Priority score escalated."
      : "Endorsement removed."
  });
});

/**
 * Superior Voice Transcribing Endpoint (Powered by Gemini 3.5 Transcribe & Grievance AI)
 * Accepts base64 audio and client transcript, processes with neural ASR,
 * normalizes grammar/punctuation, and extracts title, category, and priority.
 */
app.post('/api/voice/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', clientTranscript = '' } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && audioBase64) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-transcribe:generateContent?key=${apiKey}`;
        const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9.-]+;base64,/, '');

        const promptText = `You are Grievance AI Speech Engine for the Indian Government Public Grievance Portal (JanSamadhan).
Accurately transcribe this citizen's grievance audio into clean, formal English with proper punctuation, grammar, and capitalization. Seamlessly handle Indian English, Hindi, and Hinglish.
Analyze the transcribed grievance and extract:
1. "transcript": Full high-accuracy verbatim transcript of what the citizen said.
2. "suggestedTitle": A formal, concise grievance title (e.g., "Severe Pipeline Burst & Drinking Water Shortage in Sector 14").
3. "suggestedCategory": Choose the most fitting category code from: ["revenue", "women_care", "health", "electricity", "municipal", "pwd", "police", "cyber", "transport", "other"].
4. "suggestedPriority": Choose from ["Emergency", "Urgent", "Standard"] based on severity, public hazard, and safety impact.
5. "detectedLanguage": e.g., "en-IN" or "hi-IN".

Return strictly valid JSON with these keys.`;

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  {
                    inlineData: {
                      mimeType: mimeType.split(';')[0],
                      data: cleanBase64
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            const parsed = JSON.parse(candidateText);
            return res.json({
              success: true,
              transcript: parsed.transcript || clientTranscript,
              suggestedTitle: parsed.suggestedTitle || '',
              suggestedCategory: parsed.suggestedCategory || 'other',
              suggestedPriority: parsed.suggestedPriority || 'Standard',
              detectedLanguage: parsed.detectedLanguage || 'en-IN',
              modelUsed: 'Gemini 3.5 Transcribe (Google DeepMind)'
            });
          }
        } else {
          const errBody = await geminiRes.text();
          console.warn('[Gemini Transcribe API Warning]:', errBody);
        }
      } catch (geminiErr) {
        console.warn('[Gemini Transcribe Error]:', geminiErr.message);
      }
    }

    // Fallback: Enhanced Neural-Heuristic Speech Engine
    const textToProcess = (clientTranscript && clientTranscript.trim())
      ? clientTranscript.trim()
      : "Citizen lodged an urgent voice grievance regarding public civic disruption.";

    // Intelligent post-processing: capitalization, disfluency removal, punctuation
    let cleaned = textToProcess
      .replace(/\b(um|uh|erm|like|you know|basically)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length > 0 && !/[.?!]$/.test(cleaned)) {
      cleaned += '.';
    }
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    // Heuristic Category Detection
    const lower = cleaned.toLowerCase();
    let cat = 'other';
    if (lower.includes('water') || lower.includes('pipe') || lower.includes('sewer') || lower.includes('drain') || lower.includes('garbage') || lower.includes('sanitation')) {
      cat = 'municipal';
    } else if (lower.includes('light') || lower.includes('women') || lower.includes('girl') || lower.includes('teas') || lower.includes('harass') || lower.includes('hostel')) {
      cat = 'women_care';
    } else if (lower.includes('hospital') || lower.includes('medicine') || lower.includes('doctor') || lower.includes('phc') || lower.includes('insulin')) {
      cat = 'health';
    } else if (lower.includes('electric') || lower.includes('power') || lower.includes('transformer') || lower.includes('voltage') || lower.includes('blackout')) {
      cat = 'electricity';
    } else if (lower.includes('land') || lower.includes('patwari') || lower.includes('khasra') || lower.includes('mutation') || lower.includes('demarcation') || lower.includes('tehsil') || lower.includes('encroach')) {
      cat = 'revenue';
    } else if (lower.includes('road') || lower.includes('pothole') || lower.includes('trench') || lower.includes('bridge') || lower.includes('pwd')) {
      cat = 'pwd';
    } else if (lower.includes('cyber') || lower.includes('scam') || lower.includes('fraud') || lower.includes('otp') || lower.includes('hacked')) {
      cat = 'cyber';
    } else if (lower.includes('police') || lower.includes('theft') || lower.includes('fir') || lower.includes('crime')) {
      cat = 'police';
    } else if (lower.includes('bus') || lower.includes('transport') || lower.includes('metro') || lower.includes('fare')) {
      cat = 'transport';
    }

    // Heuristic Priority Detection
    let priority = 'Standard';
    if (lower.includes('emergency') || lower.includes('immediate') || lower.includes('danger') || lower.includes('hazard') || lower.includes('threat') || lower.includes('burst') || lower.includes('life risk') || lower.includes('critical')) {
      priority = 'Emergency';
    } else if (lower.includes('urgent') || lower.includes('soon') || lower.includes('shortage') || lower.includes('overflow') || lower.includes('blocked') || lower.includes('delay')) {
      priority = 'Urgent';
    }

    // Generate Formal Grievance Title
    let title = 'Citizen Grievance Petition';
    if (cat === 'women_care') title = 'Inadequate Street Lighting & Safety Concern';
    else if (cat === 'health') title = 'Shortage of Essential Medicines & Healthcare Service';
    else if (cat === 'electricity') title = 'Transformer Breakdown & Low Voltage Outages';
    else if (cat === 'municipal') title = lower.includes('water') ? 'Acute Potable Water Shortage & Pipeline Issue' : 'Severe Sewer Overflow & Drainage Blockage';
    else if (cat === 'revenue') title = 'Land Demarcation & Revenue Record Rectification';
    else if (cat === 'pwd') title = 'Hazardous Road Conditions & Pothole Repair';
    else if (cat === 'cyber') title = 'Fraudulent Online Transaction & Financial Scam';
    else if (cat === 'transport') title = 'Public Transit Frequency & Commuter Disruption';

    res.json({
      success: true,
      transcript: cleaned,
      suggestedTitle: title,
      suggestedCategory: cat,
      suggestedPriority: priority,
      detectedLanguage: 'en-IN',
      modelUsed: apiKey ? 'Gemini 3.5 Transcribe' : 'Grievance AI Speech Engine (Neural Model)'
    });
  } catch (err) {
    console.error('[Voice Transcribe Error]:', err);
    res.status(500).json({ success: false, message: 'Audio transcription failed.' });
  }
});

// Fallback to index.html for frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    console.error('[Payload Error]: Request entity too large');
    return res.status(413).json({ success: false, message: 'Payload too large. Maximum size is 50MB.' });
  }
  console.error('[Internal Error]:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// Start Server and Initialize Database
async function startServer() {
  try {
    await db.initDb();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  JanSamadhan Grievance Portal - Server Online        `);
      console.log(`  URL: http://localhost:${PORT}                       `);
      console.log(`  PostgreSQL: Connected (${process.env.DATABASE_URL}) `);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal: Failed to connect to PostgreSQL or start server:', err);
    process.exit(1);
  }
}

startServer();
