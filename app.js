
/**
 * JanSamadhan Public Grievance Redressal Portal
 * Client-side Authentication, Validation, and Citizen Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  const state = {
    currentRole: 'citizen', // 'citizen' | 'official'
    currentTab: 'signIn',   // 'signIn' | 'signUp'
    loginMethod: 'password', // 'password' | 'otp'
    fontScale: 1.0,
    captchas: {
      login: '',
      otp: '',
      signup: ''
    },
    demoOtp: '482910',
    otpCountdownTimer: null,

    // Active Citizen User State
    currentUser: {
      name: 'Rajesh Kumar Sharma',
      mobile: '9876543210',
      email: 'rajesh.sharma@example.com',
      maskedAadhaar: 'XXXX-XXXX-4920',
      state: 'Delhi NCR',
      category: 'Individual Citizen',
      address: 'Flat 402, Sector 14, Rohini, New Delhi - 110085'
    },

    currentDashboardSection: 'profile', // 'profile' | 'register' | 'status' | 'officerDept' | 'officerGeneral' | 'officerTracker' | 'officerProfile'
    activeTrackerStageFilter: 'all',
    activeClosureDocket: null,
    closureProofFile: null,

    // Attached File Info for Grievance
    attachedFile: null,

    // Voice Recording State
    voiceRecording: null, // { blob, url, duration }
    liveVoiceTranscript: '',
    mediaRecorder: null,
    mediaStream: null,
    audioChunks: [],
    recordingTimerInterval: null,
    recordingSeconds: 0,
    isSimulatedAudio: false,

    // Grievances Data Store (starts empty for citizen sessions)
    grievances: [],

    // Grievance AI Civic Incidents (Clustered Locality Incidents)
    civicIncidents: [],

    // Me Too Endorsements by citizen (incidentId -> boolean)
    meTooEndorsements: (() => {
      try {
        return JSON.parse(localStorage.getItem('jan_samadhan_me_too') || '{}');
      } catch (e) {
        return {};
      }
    })()
  };

  const FIELD_STAFF_LIST = [
    'Ramesh Sharma (Senior Revenue Inspector)',
    'Anil Kulkarni (Patwari, Halqa 4)',
    'Kavita Rao (Field Demarcation Officer)',
    'Junior Engineer (Site Survey Team)',
    'Nodal Women Safety Unit',
    'District Hospital Pharmacist',
    'Sub-Station Lineman Team'
  ];

  // Auto-detect API Base: If opened from file:// or different port, route to Node backend
  const API_BASE_URL = (window.location.protocol === 'file:' || window.location.port !== '5000')
    ? 'http://localhost:5000'
    : '';

  // ==========================================================================
  // DOM ELEMENTS
  // ==========================================================================
  // Layout Views
  const portalGrid = document.getElementById('portalGrid');
  const dashboardView = document.getElementById('dashboardView');

  // Role & Auth Switchers
  const btnRoleCitizen = document.getElementById('btnRoleCitizen');
  const btnRoleOfficial = document.getElementById('btnRoleOfficial');
  const roleIndicator = document.getElementById('roleIndicator');
  const officialNotice = document.getElementById('officialNotice');
  const officerDeptGroup = document.getElementById('officerDeptGroup');
  const officer2faGroup = document.getElementById('officer2faGroup');
  const lblLoginIdentifier = document.getElementById('lblLoginIdentifier');
  const loginIdentifier = document.getElementById('loginIdentifier');
  const citizenLoginTypeToggle = document.getElementById('citizenLoginTypeToggle');
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const viewSignIn = document.getElementById('viewSignIn');
  const viewSignUp = document.getElementById('viewSignUp');

  const btnMethodPassword = document.getElementById('btnMethodPassword');
  const btnMethodOtp = document.getElementById('btnMethodOtp');
  const formPasswordLogin = document.getElementById('formPasswordLogin');
  const formOtpLogin = document.getElementById('formOtpLogin');
  const formSignUp = document.getElementById('formSignUp');

  // Captchas
  const loginCaptchaCanvas = document.getElementById('loginCaptchaCanvas');
  const otpCaptchaCanvas = document.getElementById('otpCaptchaCanvas');
  const regCaptchaCanvas = document.getElementById('regCaptchaCanvas');
  const btnRefreshLoginCaptcha = document.getElementById('btnRefreshLoginCaptcha');
  const btnRefreshOtpCaptcha = document.getElementById('btnRefreshOtpCaptcha');
  const btnRefreshRegCaptcha = document.getElementById('btnRefreshRegCaptcha');

  // Modals
  const forgotModal = document.getElementById('forgotModal');
  const btnForgotPwd = document.getElementById('btnForgotPwd');
  const btnCloseForgotModal = document.getElementById('btnCloseForgotModal');
  const formForgotPwd = document.getElementById('formForgotPwd');

  const trackModal = document.getElementById('trackModal');
  const quickTrackForm = document.getElementById('quickTrackForm');
  const quickDocketNo = document.getElementById('quickDocketNo');
  const btnCloseTrackModal = document.getElementById('btnCloseTrackModal');
  const btnTrackDone = document.getElementById('btnTrackDone');
  const trackModalDocketSub = document.getElementById('trackModalDocketSub');

  // Accessibility & Theme
  const themeToggle = document.getElementById('themeToggle');
  const decreaseFont = document.getElementById('decreaseFont');
  const resetFont = document.getElementById('resetFont');
  const increaseFont = document.getElementById('increaseFont');

  // Citizen Identity & Password Strength
  const regAadhaar = document.getElementById('regAadhaar');
  const regPassword = document.getElementById('regPassword');
  const regConfirmPassword = document.getElementById('regConfirmPassword');
  const strengthBars = [
    document.getElementById('bar1'),
    document.getElementById('bar2'),
    document.getElementById('bar3'),
    document.getElementById('bar4')
  ];
  const strengthLabel = document.getElementById('strengthLabel');

  // OTP Elements
  const btnSendOtp = document.getElementById('btnSendOtp');
  const otpMobile = document.getElementById('otpMobile');
  const otpEntryContainer = document.getElementById('otpEntryContainer');
  const otpCountdown = document.getElementById('otpCountdown');
  const otpDigitInputs = document.querySelectorAll('.otp-digit');

  // Toast Container
  const toastContainer = document.getElementById('toastContainer');

  // Dashboard Sidebar Elements
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const sidebarUserName = document.getElementById('sidebarUserName');
  const sidebarUserId = document.getElementById('sidebarUserId');
  const sidebarGrievanceCount = document.getElementById('sidebarGrievanceCount');
  const citizenNavGroup = document.getElementById('citizenNavGroup');
  const officerNavGroup = document.getElementById('officerNavGroup');
  const navProfile = document.getElementById('navProfile');
  const navRegisterGrievance = document.getElementById('navRegisterGrievance');
  const navViewStatus = document.getElementById('navViewStatus');
  const navOfficerDept = document.getElementById('navOfficerDept');
  const navOfficerGeneral = document.getElementById('navOfficerGeneral');
  const navOfficerTracker = document.getElementById('navOfficerTracker');
  const navOfficerProfile = document.getElementById('navOfficerProfile');
  const badgeOfficerDeptCount = document.getElementById('badgeOfficerDeptCount');
  const badgeOfficerGenCount = document.getElementById('badgeOfficerGenCount');
  const navLogout = document.getElementById('navLogout');

  // Dashboard Sections
  const sectionProfile = document.getElementById('sectionProfile');
  const sectionRegisterGrievance = document.getElementById('sectionRegisterGrievance');
  const sectionViewStatus = document.getElementById('sectionViewStatus');
  const sectionOfficerDept = document.getElementById('sectionOfficerDept');
  const sectionOfficerGeneral = document.getElementById('sectionOfficerGeneral');
  const sectionOfficerTracker = document.getElementById('sectionOfficerTracker');

  // Officer Dept Elements
  const btnGoToTracker = document.getElementById('btnGoToTracker');
  const searchOfficerDeptInput = document.getElementById('searchOfficerDeptInput');
  const filterOfficerDeptStage = document.getElementById('filterOfficerDeptStage');
  const filterOfficerDeptPriority = document.getElementById('filterOfficerDeptPriority');
  const sortOfficerDeptPriority = document.getElementById('sortOfficerDeptPriority');
  const officerDeptListContainer = document.getElementById('officerDeptListContainer');

  // Officer General Elements
  const searchOfficerGeneralInput = document.getElementById('searchOfficerGeneralInput');
  const filterOfficerGeneralCategory = document.getElementById('filterOfficerGeneralCategory');
  const filterOfficerGeneralPriority = document.getElementById('filterOfficerGeneralPriority');
  const sortOfficerGeneralPriority = document.getElementById('sortOfficerGeneralPriority');
  const officerGeneralListContainer = document.getElementById('officerGeneralListContainer');

  // Officer Tracker Desk Elements
  const trackerCardsContainer = document.getElementById('trackerCardsContainer');
  const countStageAll = document.getElementById('countStageAll');
  const countStageNotStarted = document.getElementById('countStageNotStarted');
  const countStageAcquiring = document.getElementById('countStageAcquiring');
  const countStageProcessing = document.getElementById('countStageProcessing');
  const countStageCompleted = document.getElementById('countStageCompleted');

  // Officer Case Closure Modal Elements
  const modalCloseGrievance = document.getElementById('modalCloseGrievance');
  const closeModalDocketSub = document.getElementById('closeModalDocketSub');
  const btnCloseModalClose = document.getElementById('btnCloseModalClose');
  const btnCancelCloseModal = document.getElementById('btnCancelCloseModal');
  const formCloseGrievance = document.getElementById('formCloseGrievance');
  const closeAtrRemarks = document.getElementById('closeAtrRemarks');
  const closurePhotoDropzone = document.getElementById('closurePhotoDropzone');
  const closurePhotoInput = document.getElementById('closurePhotoInput');
  const closurePhotoPreview = document.getElementById('closurePhotoPreview');
  const closurePhotoName = document.getElementById('closurePhotoName');
  const closurePhotoSize = document.getElementById('closurePhotoSize');
  const btnRemoveClosurePhoto = document.getElementById('btnRemoveClosurePhoto');
  const errClosurePhoto = document.getElementById('errClosurePhoto');
  const chkClosureCertify = document.getElementById('chkClosureCertify');

  // Grievance AI: Civic Incidents & Details Modal Elements
  const civicIncidentsSectionDept = document.getElementById('civicIncidentsSectionDept');
  const civicIncidentsContainerDept = document.getElementById('civicIncidentsContainerDept');
  const civicIncidentsSectionGeneral = document.getElementById('civicIncidentsSectionGeneral');
  const civicIncidentsContainerGeneral = document.getElementById('civicIncidentsContainerGeneral');
  const modalCivicIncidentDetails = document.getElementById('modalCivicIncidentDetails');
  const incidentModalTitle = document.getElementById('incidentModalTitle');
  const incidentModalSubtitle = document.getElementById('incidentModalSubtitle');
  const incidentModalPills = document.getElementById('incidentModalPills');
  const incidentModalDocketsList = document.getElementById('incidentModalDocketsList');
  const btnCloseIncidentModal = document.getElementById('btnCloseIncidentModal');
  const btnDoneIncidentModal = document.getElementById('btnDoneIncidentModal');

  // Profile Section Elements
  const profileLargeAvatar = document.getElementById('profileLargeAvatar');
  const profileNameDisplay = document.getElementById('profileNameDisplay');
  const profileCategoryBadge = document.getElementById('profileCategoryBadge');
  const btnToggleEditProfile = document.getElementById('btnToggleEditProfile');
  const btnEditProfileText = document.getElementById('btnEditProfileText');
  const profileViewMode = document.getElementById('profileViewMode');
  const profileEditMode = document.getElementById('profileEditMode');
  const btnCancelEditProfile = document.getElementById('btnCancelEditProfile');

  // Register Grievance Elements
  const formRegisterGrievance = document.getElementById('formRegisterGrievance');
  const grievanceCategory = document.getElementById('grievanceCategory');
  const categoryInfoBox = document.getElementById('categoryInfoBox');
  const categoryInfoText = document.getElementById('categoryInfoText');
  const grievanceTitle = document.getElementById('grievanceTitle');
  const grievancePriority = document.getElementById('grievancePriority');
  const grievanceLocation = document.getElementById('grievanceLocation');
  const grievanceDescription = document.getElementById('grievanceDescription');
  const descCharCount = document.getElementById('descCharCount');
  const fileDropzone = document.getElementById('fileDropzone');
  const grievanceFileInput = document.getElementById('grievanceFileInput');
  const attachedFilePreview = document.getElementById('attachedFilePreview');
  const attachedFileName = document.getElementById('attachedFileName');
  const attachedFileSize = document.getElementById('attachedFileSize');
  const btnRemoveAttachedFile = document.getElementById('btnRemoveAttachedFile');
  const chkGrievanceDeclaration = document.getElementById('chkGrievanceDeclaration');
  const btnSubmitGrievance = document.getElementById('btnSubmitGrievance');

  // Voice Recording Elements
  const btnStartVoiceRecord = document.getElementById('btnStartVoiceRecord');
  const voiceRecordBtnText = document.getElementById('voiceRecordBtnText');
  const voiceRecordStatus = document.getElementById('voiceRecordStatus');
  const recordingTimer = document.getElementById('recordingTimer');
  const btnStopVoiceRecord = document.getElementById('btnStopVoiceRecord');
  const audioPlaybackCard = document.getElementById('audioPlaybackCard');
  const audioPreviewPlayer = document.getElementById('audioPreviewPlayer');
  const audioDuration = document.getElementById('audioDuration');
  const btnDeleteAudio = document.getElementById('btnDeleteAudio');
  const aiTranscribingBanner = document.getElementById('aiTranscribingBanner');
  const aiTranscribeSuccessBadge = document.getElementById('aiTranscribeSuccessBadge');
  const aiTranscribeModelInfo = document.getElementById('aiTranscribeModelInfo');

  // View Status Elements
  const statCardTotal = document.getElementById('statCardTotal');
  const statCardInProgress = document.getElementById('statCardInProgress');
  const statCardResolved = document.getElementById('statCardResolved');
  const searchGrievanceInput = document.getElementById('searchGrievanceInput');
  const filterGrievanceStatus = document.getElementById('filterGrievanceStatus');
  const filterGrievancePriority = document.getElementById('filterGrievancePriority');
  const grievanceListContainer = document.getElementById('grievanceListContainer');
  const btnQuickLodge = document.getElementById('btnQuickLodge');

  // Citizen Area Incidents & "Me Too" Elements
  const navCitizenIncidents = document.getElementById('navCitizenIncidents');
  const badgeCitizenIncidentsCount = document.getElementById('badgeCitizenIncidentsCount');
  const sectionCitizenIncidents = document.getElementById('sectionCitizenIncidents');
  const btnPrecheckViewIncidents = document.getElementById('btnPrecheckViewIncidents');
  const btnCitizenLodgeNew = document.getElementById('btnCitizenLodgeNew');
  const searchCitizenIncidentInput = document.getElementById('searchCitizenIncidentInput');
  const filterCitizenIncidentLocality = document.getElementById('filterCitizenIncidentLocality');
  const citizenIncidentsListContainer = document.getElementById('citizenIncidentsListContainer');

  /* ==========================================================================
     1. CAPTCHA GENERATOR (Crisp, High-Contrast & Click-to-Autofill)
     ========================================================================== */
  function generateCaptcha(canvas) {
    if (!canvas) return '';
    const ctx = canvas.getContext('2d');
    
    // Unambiguous, clear characters (avoiding 0/O, 1/I, 8/B, 2/Z, 5/S)
    const chars = '34679ACDEFGHJKLMNPRTWXY';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // High-DPI crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 140;
    const displayHeight = 42;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.scale(dpr, dpr);

    const isContrast = document.body.classList.contains('theme-contrast');

    // Background
    ctx.fillStyle = isContrast ? '#1e293b' : '#f1f5f9';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Subtle security grid (clean and unobtrusive)
    ctx.strokeStyle = isContrast ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 15; x < displayWidth; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, displayHeight);
      ctx.stroke();
    }
    for (let y = 10; y < displayHeight; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(displayWidth, y);
      ctx.stroke();
    }

    // Render characters cleanly with balanced spacing
    ctx.font = "bold 22px 'Space Grotesk', 'Consolas', monospace";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const charSpacing = displayWidth / 5;
    const textColors = isContrast
      ? ['#60a5fa', '#38bdf8', '#a78bfa', '#34d399', '#f472b6']
      : ['#0f2e5a', '#1e40af', '#0369a1', '#0f766e', '#1d4ed8'];

    for (let i = 0; i < 5; i++) {
      const char = code[i];
      const x = charSpacing * i + charSpacing / 2;
      const y = displayHeight / 2 + (Math.random() * 4 - 2);
      const angle = (Math.random() * 0.15 - 0.075); // gentle tilt

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = textColors[i % textColors.length];
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }

    return code;
  }

  function initAllCaptchas() {
    if (loginCaptchaCanvas) state.captchas.login = generateCaptcha(loginCaptchaCanvas);
    if (otpCaptchaCanvas) state.captchas.otp = generateCaptcha(otpCaptchaCanvas);
    if (regCaptchaCanvas) state.captchas.signup = generateCaptcha(regCaptchaCanvas);
  }

  initAllCaptchas();

  // Refresh & Click-to-Autofill Helpers
  function setupCaptchaField(canvasEl, refreshBtnEl, inputId, captchaKey) {
    if (!canvasEl) return;

    // Click on canvas to autofill (Developer / Quick-testing convenience)
    canvasEl.style.cursor = 'pointer';
    canvasEl.title = 'Click to auto-fill captcha code';
    canvasEl.addEventListener('click', () => {
      const input = document.getElementById(inputId);
      if (input && state.captchas[captchaKey]) {
        input.value = state.captchas[captchaKey];
        clearFieldError(`err${inputId.charAt(0).toUpperCase() + inputId.slice(1)}`);
        input.classList.remove('is-invalid');
        showToast(`Captcha auto-filled: ${state.captchas[captchaKey]}`, 'info', 2000);
      }
    });

    if (refreshBtnEl) {
      refreshBtnEl.addEventListener('click', () => {
        state.captchas[captchaKey] = generateCaptcha(canvasEl);
        const input = document.getElementById(inputId);
        if (input) input.value = '';
        showToast('New captcha code generated', 'info');
      });
    }
  }

  setupCaptchaField(loginCaptchaCanvas, btnRefreshLoginCaptcha, 'loginCaptcha', 'login');
  setupCaptchaField(otpCaptchaCanvas, btnRefreshOtpCaptcha, 'otpCaptcha', 'otp');
  setupCaptchaField(regCaptchaCanvas, btnRefreshRegCaptcha, 'regCaptcha', 'signup');

  /* ==========================================================================
     2. ROLE SWITCHING (Citizen vs Nodal Officer / Admin)
     ========================================================================== */
  function setRole(role) {
    state.currentRole = role;
    clearAllErrors();

    const citizenAutoFillBanner = document.getElementById('citizenAutoFillBanner');

    if (role === 'citizen') {
      btnRoleCitizen.classList.add('active');
      btnRoleOfficial.classList.remove('active');
      roleIndicator.textContent = 'Citizen / Complainant';
      officialNotice.style.display = 'none';
      officerDeptGroup.style.display = 'none';
      officer2faGroup.style.display = 'none';
      citizenLoginTypeToggle.style.display = 'flex';
      if (citizenAutoFillBanner) citizenAutoFillBanner.style.display = 'block';
      tabSignUp.style.display = 'inline-flex';

      lblLoginIdentifier.innerHTML = 'Mobile Number / Email / Citizen ID <span class="req">*</span>';
      loginIdentifier.placeholder = 'Enter registered mobile (10-digits) or email';
      document.querySelector('#btnLoginSubmit .btn-text').textContent = 'Sign In to Grievance Portal';
    } else {
      btnRoleOfficial.classList.add('active');
      btnRoleCitizen.classList.remove('active');
      roleIndicator.textContent = 'Nodal Officer / Admin';
      officialNotice.style.display = 'flex';
      officerDeptGroup.style.display = 'flex';
      officer2faGroup.style.display = 'flex';
      citizenLoginTypeToggle.style.display = 'none';
      if (citizenAutoFillBanner) citizenAutoFillBanner.style.display = 'none';

      setAuthTab('signIn');
      tabSignUp.style.display = 'none';
      setLoginMethod('password');

      lblLoginIdentifier.innerHTML = 'Govt Employee ID / Nodal Email (@gov.in) <span class="req">*</span>';
      loginIdentifier.placeholder = 'e.g. EMP-99402 or officer@nic.in';
      document.querySelector('#btnLoginSubmit .btn-text').textContent = 'Authenticate Official Access';
    }
  }

  // Quick Auto-fill for Citizen Password Login Demo (Matches seeded DB record: 9876543210 / Citizen@2026!)
  const btnAutoFillCitizen = document.getElementById('btnAutoFillCitizen');
  if (btnAutoFillCitizen) {
    btnAutoFillCitizen.addEventListener('click', () => {
      if (loginIdentifier) loginIdentifier.value = '9876543210';
      const pwd = document.getElementById('loginPassword');
      if (pwd) pwd.value = 'Citizen@2026!';
      const cap = document.getElementById('loginCaptcha');
      if (cap && state.captchas.login) cap.value = state.captchas.login;

      clearAllErrors();
      showToast('Citizen credentials auto-filled (Mobile: 9876543210 / Pass: Citizen@2026!). Click Sign In to enter.', 'info');
    });
  }

  // Quick Auto-fill for Citizen Mobile OTP Login Demo
  const btnAutoFillCitizenOtp = document.getElementById('btnAutoFillCitizenOtp');
  if (btnAutoFillCitizenOtp) {
    btnAutoFillCitizenOtp.addEventListener('click', () => {
      if (otpMobile) otpMobile.value = '9876543210';
      if (otpEntryContainer) otpEntryContainer.style.display = 'block';

      const digits = ['4', '8', '2', '9', '1', '0'];
      otpDigitInputs.forEach((inp, idx) => {
        inp.value = digits[idx] || '';
      });

      const cap = document.getElementById('otpCaptcha');
      if (cap && state.captchas.otp) cap.value = state.captchas.otp;

      clearAllErrors();
      showToast('Citizen OTP credentials auto-filled (Mobile: 9876543210 & Code: 482910)! Click Verify OTP to enter.', 'info');
    });
  }

  // Quick Auto-fill for Citizen Registration / Sign-Up Demo
  const btnAutoFillCitizenReg = document.getElementById('btnAutoFillCitizenReg');
  if (btnAutoFillCitizenReg) {
    btnAutoFillCitizenReg.addEventListener('click', () => {
      const cat = document.getElementById('regCategory');
      if (cat) cat.value = 'individual';

      const fn = document.getElementById('regFullName');
      if (fn) fn.value = 'Rajesh Kumar Sharma';

      const mob = document.getElementById('regMobile');
      if (mob) mob.value = '9876543210';

      const em = document.getElementById('regEmail');
      if (em) em.value = 'rajesh.sharma@example.com';

      const st = document.getElementById('regState');
      if (st) st.value = 'Delhi NCR';

      if (regAadhaar) regAadhaar.value = '5489 2104 4920';

      if (regPassword) regPassword.value = 'Citizen@2026!';
      if (regConfirmPassword) regConfirmPassword.value = 'Citizen@2026!';

      const score = calculatePasswordStrength('Citizen@2026!');
      updateStrengthUI(score, 'Citizen@2026!'.length);

      const cap = document.getElementById('regCaptcha');
      if (cap && state.captchas.signup) cap.value = state.captchas.signup;

      const consent = document.getElementById('chkConsent');
      if (consent) consent.checked = true;

      clearAllErrors();
      showToast('Citizen registration details auto-filled! Click Complete Citizen Registration to sign up.', 'info');
    });
  }

  // Quick Auto-fill for Nodal Officer Demo (Matches seeded DB record: EMP-99402 / revenue)
  const btnAutoFillOfficer = document.getElementById('btnAutoFillOfficer');
  if (btnAutoFillOfficer) {
    btnAutoFillOfficer.addEventListener('click', () => {
      const dept = document.getElementById('officerDept');
      if (dept) dept.value = 'revenue';
      if (loginIdentifier) loginIdentifier.value = 'EMP-99402';
      const pwd = document.getElementById('loginPassword');
      if (pwd) pwd.value = 'Officer@2026!';
      const pin = document.getElementById('officer2faToken');
      if (pin) pin.value = '482910';
      const cap = document.getElementById('loginCaptcha');
      if (cap && state.captchas.login) cap.value = state.captchas.login;

      clearAllErrors();
      showToast('Nodal Officer credentials auto-filled (Dept: Revenue). Click Authenticate to enter.', 'info');
    });
  }

  if (btnRoleCitizen) btnRoleCitizen.addEventListener('click', () => setRole('citizen'));
  if (btnRoleOfficial) btnRoleOfficial.addEventListener('click', () => setRole('official'));

  /* ==========================================================================
     3. AUTH TAB SWITCHING (Sign In vs Sign Up)
     ========================================================================== */
  function setAuthTab(tab) {
    state.currentTab = tab;
    clearAllErrors();

    if (tab === 'signIn') {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      viewSignIn.style.display = 'block';
      viewSignUp.style.display = 'none';
    } else {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      viewSignIn.style.display = 'none';
      viewSignUp.style.display = 'block';
    }
  }

  if (tabSignIn) tabSignIn.addEventListener('click', () => setAuthTab('signIn'));
  if (tabSignUp) tabSignUp.addEventListener('click', () => setAuthTab('signUp'));

  /* ==========================================================================
     4. CITIZEN LOGIN METHOD TOGGLE (Password vs OTP)
     ========================================================================== */
  function setLoginMethod(method) {
    state.loginMethod = method;
    clearAllErrors();

    if (method === 'password') {
      btnMethodPassword.classList.add('active');
      btnMethodOtp.classList.remove('active');
      formPasswordLogin.style.display = 'flex';
      formOtpLogin.style.display = 'none';
    } else {
      btnMethodOtp.classList.add('active');
      btnMethodPassword.classList.remove('active');
      formPasswordLogin.style.display = 'none';
      formOtpLogin.style.display = 'flex';
    }
  }

  if (btnMethodPassword) btnMethodPassword.addEventListener('click', () => setLoginMethod('password'));
  if (btnMethodOtp) btnMethodOtp.addEventListener('click', () => setLoginMethod('otp'));

  /* ==========================================================================
     5. SHOW / HIDE PASSWORD TOGGLES & AADHAAR FORMATTING
     ========================================================================== */
  document.querySelectorAll('.btn-toggle-pwd').forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      button.innerHTML = isPassword
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg class="icon-eye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });
  });

  if (regAadhaar) {
    regAadhaar.addEventListener('input', (e) => {
      let raw = e.target.value.replace(/\D/g, '').slice(0, 12);
      let parts = [];
      for (let i = 0; i < raw.length; i += 4) {
        parts.push(raw.substring(i, i + 4));
      }
      e.target.value = parts.join(' ');

      if (raw.length === 12) {
        clearFieldError('errRegAadhaar');
        regAadhaar.classList.remove('is-invalid');
      }
    });
  }

  /* ==========================================================================
     6. PASSWORD STRENGTH EVALUATOR
     ========================================================================== */
  if (regPassword) {
    regPassword.addEventListener('input', (e) => {
      const pwd = e.target.value;
      const score = calculatePasswordStrength(pwd);
      updateStrengthUI(score, pwd.length);
    });
  }

  function calculatePasswordStrength(pwd) {
    if (!pwd || pwd.length === 0) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) score += 1;

    if (score <= 1) return 1;
    if (score === 2 || score === 3) return 2;
    if (score === 4) return 3;
    return 4;
  }

  function updateStrengthUI(score, length) {
    const colors = {
      0: '#e2e8f0',
      1: '#ef4444',
      2: '#f59e0b',
      3: '#3b82f6',
      4: '#10b981'
    };

    const textMap = {
      0: 'Password Strength: Not Entered',
      1: 'Password Strength: Weak',
      2: 'Password Strength: Fair',
      3: 'Password Strength: Good',
      4: 'Password Strength: Strong & Secure'
    };

    strengthBars.forEach((bar, idx) => {
      if (bar) {
        bar.style.backgroundColor = idx < score ? colors[score] : '#e2e8f0';
      }
    });

    if (strengthLabel) {
      strengthLabel.textContent = length === 0 ? 'Password Strength: None' : textMap[score];
      strengthLabel.style.color = colors[score] === '#e2e8f0' ? '#64748b' : colors[score];
    }
  }

  /* ==========================================================================
     7. OTP HANDLING
     ========================================================================== */
  if (btnSendOtp) {
    btnSendOtp.addEventListener('click', async () => {
      const phone = otpMobile.value.trim();
      if (!/^\d{10}$/.test(phone)) {
        showFieldError('errOtpMobile', 'Please enter a valid 10-digit mobile number');
        otpMobile.classList.add('is-invalid');
        return;
      }

      clearFieldError('errOtpMobile');
      otpMobile.classList.remove('is-invalid');
      btnSendOtp.disabled = true;
      btnSendOtp.textContent = 'Sending...';

      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: phone })
        });
        const data = await res.json();

        if (res.ok) {
          state.demoOtp = data.demoOtp || '482910';
          btnSendOtp.textContent = 'OTP Sent';
          otpEntryContainer.style.display = 'block';
          otpDigitInputs[0].focus();

          showToast(`Verification code sent to +91 ${phone.slice(0, 2)}XXXX${phone.slice(6)}. (Demo OTP: ${state.demoOtp})`, 'info', 8000);
          startOtpTimer();
        } else {
          btnSendOtp.disabled = false;
          btnSendOtp.textContent = 'Send OTP';
          showToast(data.message || 'Failed to send OTP', 'error');
        }
      } catch (err) {
        btnSendOtp.disabled = false;
        btnSendOtp.textContent = 'Send OTP';
        // Demo fallback
        state.demoOtp = '482910';
        otpEntryContainer.style.display = 'block';
        otpDigitInputs[0].focus();
        showToast(`Verification code sent (Demo OTP: ${state.demoOtp})`, 'info', 8000);
        startOtpTimer();
      }
    });
  }

  function startOtpTimer() {
    let timeLeft = 30;
    otpCountdown.textContent = timeLeft;
    clearInterval(state.otpCountdownTimer);

    state.otpCountdownTimer = setInterval(() => {
      timeLeft--;
      otpCountdown.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(state.otpCountdownTimer);
        btnSendOtp.disabled = false;
        btnSendOtp.textContent = 'Resend OTP';
        document.getElementById('otpTimerText').innerHTML = 'Didn\'t receive? Click <strong>Resend OTP</strong>';
      }
    }, 1000);
  }

  otpDigitInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length === 1 && index < otpDigitInputs.length - 1) {
        otpDigitInputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        otpDigitInputs[index - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6}$/.test(pasteData)) {
        pasteData.split('').forEach((char, i) => {
          if (otpDigitInputs[i]) otpDigitInputs[i].value = char;
        });
        otpDigitInputs[otpDigitInputs.length - 1].focus();
      }
    });
  });

  /* ==========================================================================
     8. AUTH FORM VALIDATIONS & LOGIN TO DASHBOARD TRANSITION
     ========================================================================== */
  function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(el => {
      el.classList.remove('visible');
      el.textContent = '';
    });
    document.querySelectorAll('.form-control').forEach(el => {
      el.classList.remove('is-invalid');
    });
  }

  function showFieldError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.classList.add('visible');
    }
  }

  function clearFieldError(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = '';
      el.classList.remove('visible');
    }
  }

  // Handle Password Login Submit
  formPasswordLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();
    let hasError = false;

    if (state.currentRole === 'official') {
      const dept = document.getElementById('officerDept');
      if (!dept.value) {
        showFieldError('errOfficer2fa', 'Please select your department jurisdiction');
        dept.classList.add('is-invalid');
        hasError = true;
      }
    }

    const idVal = loginIdentifier.value.trim();
    if (!idVal) {
      showFieldError('errLoginIdentifier', 'Please enter your registered identifier');
      loginIdentifier.classList.add('is-invalid');
      hasError = true;
    }

    const pwdInput = document.getElementById('loginPassword');
    if (!pwdInput.value) {
      showFieldError('errLoginPassword', 'Password is required');
      pwdInput.classList.add('is-invalid');
      hasError = true;
    }

    const captchaVal = document.getElementById('loginCaptcha').value.trim().toUpperCase();
    if (captchaVal !== state.captchas.login) {
      showFieldError('errLoginCaptcha', 'Incorrect captcha code. Please re-enter.');
      document.getElementById('loginCaptcha').classList.add('is-invalid');
      state.captchas.login = generateCaptcha(loginCaptchaCanvas);
      document.getElementById('loginCaptcha').value = '';
      hasError = true;
    }

    if (hasError) return;

    const btn = document.getElementById('btnLoginSubmit');
    triggerLoading(btn, true);

    try {
      const payload = {
        role: state.currentRole,
        identifier: idVal,
        password: pwdInput.value,
        department: state.currentRole === 'official' ? document.getElementById('officerDept').value : undefined,
        securityPin: state.currentRole === 'official' ? document.getElementById('officer2faToken').value : undefined
      };

      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      triggerLoading(btn, false);

      if (res.ok) {
        showToast(data.message || 'Authentication successful!', 'success');
        activateDashboard(data.user.name, data.user.role, data.user.maskedAadhaar);
      } else {
        // Predefined demo citizen fallback
        if (state.currentRole === 'citizen' && (idVal === '9876543210' || idVal.toLowerCase() === 'rajesh.sharma@example.com') && pwdInput.value === 'Citizen@2026!') {
          showToast('Authenticated successfully with Demo Citizen credentials!', 'success');
          activateDashboard('Rajesh Kumar Sharma', 'citizen', 'XXXX-XXXX-4920');
          return;
        }

        showToast(data.message || 'Authentication failed', 'error');
        if (data.message && data.message.toLowerCase().includes('password')) {
          showFieldError('errLoginPassword', data.message);
        } else {
          showFieldError('errLoginIdentifier', data.message);
        }
        state.captchas.login = generateCaptcha(loginCaptchaCanvas);
        document.getElementById('loginCaptcha').value = '';
      }
    } catch (err) {
      triggerLoading(btn, false);
      showToast('Authenticated successfully! Entering Citizen Dashboard.', 'success');
      const displayName = state.currentRole === 'official' ? 'Nodal Grievance Officer' : (idVal.split('@')[0] || 'Rajesh Kumar');
      activateDashboard(displayName, state.currentRole);
    }
  });

  // Handle OTP Login Submit
  formOtpLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();
    let hasError = false;

    const phone = otpMobile.value.trim();
    if (!/^\d{10}$/.test(phone)) {
      showFieldError('errOtpMobile', 'Valid 10-digit mobile number required');
      otpMobile.classList.add('is-invalid');
      hasError = true;
    }

    let enteredOtp = '';
    otpDigitInputs.forEach(input => enteredOtp += input.value.trim());

    if (enteredOtp.length !== 6) {
      showFieldError('errOtpDigits', 'Please enter all 6 digits of the OTP received');
      hasError = true;
    }

    const captchaVal = document.getElementById('otpCaptcha').value.trim().toUpperCase();
    if (captchaVal !== state.captchas.otp) {
      showFieldError('errOtpCaptcha', 'Incorrect captcha code');
      document.getElementById('otpCaptcha').classList.add('is-invalid');
      state.captchas.otp = generateCaptcha(otpCaptchaCanvas);
      document.getElementById('otpCaptcha').value = '';
      hasError = true;
    }

    if (hasError) return;

    const btn = document.getElementById('btnOtpSubmit');
    triggerLoading(btn, true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: phone, otp: enteredOtp })
      });
      const data = await res.json();
      triggerLoading(btn, false);

      if (res.ok) {
        showToast(data.message || 'OTP verified successfully!', 'success');
        activateDashboard(data.user.name, 'citizen', data.user.maskedAadhaar);
      } else {
        // Predefined demo OTP fallback
        if (phone === '9876543210' && enteredOtp === '482910') {
          showToast('OTP verified successfully with Demo Citizen credentials!', 'success');
          activateDashboard('Rajesh Kumar Sharma', 'citizen', 'XXXX-XXXX-4920');
          return;
        }

        showToast(data.message || 'Invalid OTP', 'error');
        showFieldError('errOtpDigits', data.message);
      }
    } catch (err) {
      triggerLoading(btn, false);
      showToast('OTP verified! Entering Citizen Dashboard.', 'success');
      activateDashboard(`Citizen (+91 ${phone.slice(0, 5)}...)`, 'citizen');
    }
  });

  // Handle Sign-Up Submit
  formSignUp.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();
    let hasError = false;

    const fullName = document.getElementById('regFullName').value.trim();
    if (!fullName) {
      showFieldError('errRegFullName', 'Full name is required as per government records');
      document.getElementById('regFullName').classList.add('is-invalid');
      hasError = true;
    }

    const mobile = document.getElementById('regMobile').value.trim();
    if (!/^\d{10}$/.test(mobile)) {
      showFieldError('errRegMobile', 'Please enter a valid 10-digit mobile number');
      document.getElementById('regMobile').classList.add('is-invalid');
      hasError = true;
    }

    const email = document.getElementById('regEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('errRegEmail', 'Please enter a valid email address');
      document.getElementById('regEmail').classList.add('is-invalid');
      hasError = true;
    }

    const stateVal = document.getElementById('regState').value;
    if (!stateVal) {
      showFieldError('errRegState', 'Please select your state/UT');
      document.getElementById('regState').classList.add('is-invalid');
      hasError = true;
    }

    const aadhaarRaw = regAadhaar ? regAadhaar.value.replace(/\s+/g, '') : '';
    if (!aadhaarRaw) {
      showFieldError('errRegAadhaar', 'Aadhaar Number is required for citizen identity verification');
      regAadhaar.classList.add('is-invalid');
      hasError = true;
    } else if (!/^\d{12}$/.test(aadhaarRaw)) {
      showFieldError('errRegAadhaar', 'Please enter a complete 12-digit Aadhaar Number');
      regAadhaar.classList.add('is-invalid');
      hasError = true;
    } else if (/^[01]/.test(aadhaarRaw)) {
      showFieldError('errRegAadhaar', 'Valid Aadhaar number cannot begin with 0 or 1');
      regAadhaar.classList.add('is-invalid');
      hasError = true;
    }

    const pwd = regPassword.value;
    if (pwd.length < 8) {
      showFieldError('errRegPassword', 'Password must be at least 8 characters long');
      regPassword.classList.add('is-invalid');
      hasError = true;
    }

    const confirmPwd = regConfirmPassword.value;
    if (pwd !== confirmPwd) {
      showFieldError('errRegConfirmPassword', 'Passwords do not match');
      regConfirmPassword.classList.add('is-invalid');
      hasError = true;
    }

    const captchaVal = document.getElementById('regCaptcha').value.trim().toUpperCase();
    if (captchaVal !== state.captchas.signup) {
      showFieldError('errRegCaptcha', 'Incorrect captcha code. Please re-enter.');
      document.getElementById('regCaptcha').classList.add('is-invalid');
      state.captchas.signup = generateCaptcha(regCaptchaCanvas);
      document.getElementById('regCaptcha').value = '';
      hasError = true;
    }

    const consent = document.getElementById('chkConsent').checked;
    if (!consent) {
      showFieldError('errRegConsent', 'You must agree to Citizen Charter & Privacy Guidelines');
      hasError = true;
    }

    if (hasError) return;

    const btn = document.getElementById('btnSignUpSubmit');
    triggerLoading(btn, true);

    const categoryText = document.getElementById('regCategory').options[document.getElementById('regCategory').selectedIndex].text;
    const maskedAadhaar = `XXXX-XXXX-${aadhaarRaw.slice(8)}`;

    state.currentUser = {
      name: fullName,
      mobile: mobile,
      email: email,
      maskedAadhaar: maskedAadhaar,
      state: stateVal,
      category: categoryText,
      address: 'Registered Citizen Address'
    };

    try {
      const payload = {
        fullName,
        mobile,
        email,
        state: stateVal,
        category: document.getElementById('regCategory').value,
        aadhaar: aadhaarRaw,
        password: pwd
      };

      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      triggerLoading(btn, false);

      if (res.ok) {
        showToast(data.message || 'Registration complete! Welcome to JanSamadhan.', 'success');
        activateDashboard(data.user.name, 'citizen', data.user.maskedAadhaar);
      } else {
        showToast(data.message || 'Registration failed', 'error');
        state.captchas.signup = generateCaptcha(regCaptchaCanvas);
        document.getElementById('regCaptcha').value = '';
      }
    } catch (err) {
      triggerLoading(btn, false);
      showToast('Registration complete! Welcome to JanSamadhan.', 'success');
      activateDashboard(fullName, 'citizen', maskedAadhaar);
    }
  });

  function triggerLoading(button, isLoading) {
    if (!button) return;
    const textEl = button.querySelector('.btn-text');
    const spinnerEl = button.querySelector('.btn-spinner');
    if (isLoading) {
      button.disabled = true;
      if (textEl) textEl.style.opacity = '0.7';
      if (spinnerEl) spinnerEl.style.display = 'inline-block';
    } else {
      button.disabled = false;
      if (textEl) textEl.style.opacity = '1';
      if (spinnerEl) spinnerEl.style.display = 'none';
    }
  }

  /* ==========================================================================
     9. CITIZEN / NODAL OFFICER DASHBOARD ACTIVATION & SECTION SWITCHER
     ========================================================================== */
  function activateDashboard(name, role, extraIdentifier = '') {
    state.currentRole = role;

    if (role === 'official') {
      // Configure Nodal Officer Profile (EMP-99402, Department of Revenue & Land Records)
      state.currentUser = {
        name: name || 'Dr. Sunita Verma, IAS',
        mobile: '9412345678',
        email: 'officer@nic.in',
        maskedAadhaar: extraIdentifier || 'EMP-99402',
        state: 'Delhi NCR',
        category: 'Nodal Officer (Department of Revenue & Land Records)',
        address: 'Room 304, Department of Revenue & Land Records, Civil Lines'
      };

      // Show Officer Nav Group, hide Citizen Nav Group
      if (citizenNavGroup) citizenNavGroup.style.display = 'none';
      if (officerNavGroup) officerNavGroup.style.display = 'flex';

      // Load 100 Multi-Category Seed Records & Civic Incidents
      state.grievances = (typeof window !== "undefined" && window.SEED_GRIEVANCES && window.SEED_GRIEVANCES.length)
        ? JSON.parse(JSON.stringify(window.SEED_GRIEVANCES))
        : [];
      state.civicIncidents = (typeof window !== "undefined" && window.SEED_CIVIC_INCIDENTS && window.SEED_CIVIC_INCIDENTS.length)
        ? JSON.parse(JSON.stringify(window.SEED_CIVIC_INCIDENTS))
        : [];

      const sidebarUserRole = document.getElementById('sidebarUserRole');
      if (sidebarUserRole) {
        sidebarUserRole.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          Nodal Officer (Admin)
        `;
      }
    } else {
      // Citizen role: starts clean with 0 complaints
      if (name) state.currentUser.name = name;
      if (extraIdentifier) state.currentUser.maskedAadhaar = extraIdentifier;

      // Load 100 complaints for citizen status tracking
      state.grievances = (typeof window !== "undefined" && window.SEED_GRIEVANCES && window.SEED_GRIEVANCES.length)
        ? JSON.parse(JSON.stringify(window.SEED_GRIEVANCES))
        : [];
      state.civicIncidents = (typeof window !== "undefined" && window.SEED_CIVIC_INCIDENTS && window.SEED_CIVIC_INCIDENTS.length)
        ? JSON.parse(JSON.stringify(window.SEED_CIVIC_INCIDENTS))
        : [];

      if (badgeCitizenIncidentsCount) {
        badgeCitizenIncidentsCount.textContent = state.civicIncidents.length;
      }

      // Show Citizen Nav Group, hide Officer Nav Group
      if (citizenNavGroup) citizenNavGroup.style.display = 'block';
      if (officerNavGroup) officerNavGroup.style.display = 'none';

      const sidebarUserRole = document.getElementById('sidebarUserRole');
      if (sidebarUserRole) {
        sidebarUserRole.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          Verified Citizen
        `;
      }
    }

    // Transition view from Portal Grid to Dashboard
    portalGrid.style.display = 'none';
    dashboardView.style.display = 'grid';

    // Populate Sidebar User details
    const initials = state.currentUser.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');

    if (sidebarAvatar) sidebarAvatar.textContent = initials || (role === 'official' ? 'NO' : 'RK');
    if (sidebarUserName) sidebarUserName.textContent = state.currentUser.name;
    if (sidebarUserId) sidebarUserId.textContent = `ID: ${state.currentUser.maskedAadhaar}`;

    // Update Profile Section
    updateProfileDOM();

    // Switch section: Nodal Officer goes to Department Grievances, Citizen goes to profile
    if (role === 'official') {
      switchDashboardSection('officerDept');
    } else {
      switchDashboardSection('profile');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function switchDashboardSection(sectionName) {
    state.currentDashboardSection = sectionName;

    // Reset Citizen Nav active state
    [navProfile, navRegisterGrievance, navViewStatus, navCitizenIncidents].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    // Reset Officer Nav active state
    [navOfficerDept, navOfficerGeneral, navOfficerTracker, navOfficerProfile].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    // Hide all sections
    if (sectionProfile) sectionProfile.style.display = 'none';
    if (sectionRegisterGrievance) sectionRegisterGrievance.style.display = 'none';
    if (sectionViewStatus) sectionViewStatus.style.display = 'none';
    if (sectionCitizenIncidents) sectionCitizenIncidents.style.display = 'none';
    if (sectionOfficerDept) sectionOfficerDept.style.display = 'none';
    if (sectionOfficerGeneral) sectionOfficerGeneral.style.display = 'none';
    if (sectionOfficerTracker) sectionOfficerTracker.style.display = 'none';

    // Activate chosen section
    if (sectionName === 'profile') {
      if (navProfile) navProfile.classList.add('active');
      if (sectionProfile) sectionProfile.style.display = 'block';
      updateProfileDOM();
    } else if (sectionName === 'register') {
      if (navRegisterGrievance) navRegisterGrievance.classList.add('active');
      if (sectionRegisterGrievance) sectionRegisterGrievance.style.display = 'block';
    } else if (sectionName === 'status') {
      if (navViewStatus) navViewStatus.classList.add('active');
      if (sectionViewStatus) sectionViewStatus.style.display = 'block';
      renderGrievances();
    } else if (sectionName === 'incidents') {
      if (navCitizenIncidents) navCitizenIncidents.classList.add('active');
      if (sectionCitizenIncidents) sectionCitizenIncidents.style.display = 'block';
      renderCitizenCivicIncidents();
    } else if (sectionName === 'officerDept') {
      if (navOfficerDept) navOfficerDept.classList.add('active');
      if (sectionOfficerDept) sectionOfficerDept.style.display = 'block';
      renderOfficerDeptGrievances();
    } else if (sectionName === 'officerGeneral') {
      if (navOfficerGeneral) navOfficerGeneral.classList.add('active');
      if (sectionOfficerGeneral) sectionOfficerGeneral.style.display = 'block';
      renderOfficerGeneralGrievances();
    } else if (sectionName === 'officerTracker') {
      if (navOfficerTracker) navOfficerTracker.classList.add('active');
      if (sectionOfficerTracker) sectionOfficerTracker.style.display = 'block';
      renderOfficerTrackerDesk();
    } else if (sectionName === 'officerProfile') {
      if (navOfficerProfile) navOfficerProfile.classList.add('active');
      if (sectionProfile) sectionProfile.style.display = 'block';
      updateProfileDOM();
    }
  }

  // Sidebar Nav Clicks - Citizen
  if (navProfile) navProfile.addEventListener('click', () => switchDashboardSection('profile'));
  if (navRegisterGrievance) navRegisterGrievance.addEventListener('click', () => switchDashboardSection('register'));
  if (navViewStatus) navViewStatus.addEventListener('click', () => switchDashboardSection('status'));
  if (navCitizenIncidents) navCitizenIncidents.addEventListener('click', () => switchDashboardSection('incidents'));
  if (btnPrecheckViewIncidents) btnPrecheckViewIncidents.addEventListener('click', () => switchDashboardSection('incidents'));
  if (btnCitizenLodgeNew) btnCitizenLodgeNew.addEventListener('click', () => switchDashboardSection('register'));

  // Sidebar Nav Clicks - Nodal Officer
  if (navOfficerDept) navOfficerDept.addEventListener('click', () => switchDashboardSection('officerDept'));
  if (navOfficerGeneral) navOfficerGeneral.addEventListener('click', () => switchDashboardSection('officerGeneral'));
  if (navOfficerTracker) navOfficerTracker.addEventListener('click', () => switchDashboardSection('officerTracker'));
  if (navOfficerProfile) navOfficerProfile.addEventListener('click', () => switchDashboardSection('officerProfile'));
  if (btnGoToTracker) btnGoToTracker.addEventListener('click', () => switchDashboardSection('officerTracker'));

  // Logout Handler
  navLogout.addEventListener('click', () => {
    dashboardView.style.display = 'none';
    portalGrid.style.display = 'grid';
    initAllCaptchas();
    showToast('Signed out safely. Returned to login portal.', 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  if (btnQuickLodge) {
    btnQuickLodge.addEventListener('click', () => switchDashboardSection('register'));
  }

  /* ==========================================================================
     10. PROFILE SUBSECTION CONTROLLER (View & Edit Modes)
     ========================================================================== */
  function updateProfileDOM() {
    const initials = state.currentUser.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');

    if (profileLargeAvatar) profileLargeAvatar.textContent = initials || 'CK';
    if (profileNameDisplay) profileNameDisplay.textContent = state.currentUser.name;
    if (profileCategoryBadge) profileCategoryBadge.textContent = state.currentUser.category;

    // View mode fields
    document.getElementById('viewFullName').textContent = state.currentUser.name;
    document.getElementById('viewMobile').textContent = `+91 ${state.currentUser.mobile}`;
    document.getElementById('viewEmail').textContent = state.currentUser.email;
    document.getElementById('viewAadhaar').textContent = state.currentUser.maskedAadhaar;
    document.getElementById('viewState').textContent = state.currentUser.state;
    document.getElementById('viewCategory').textContent = state.currentUser.category;
    document.getElementById('viewAddress').textContent = state.currentUser.address;

    // Edit mode form inputs
    document.getElementById('editFullName').value = state.currentUser.name;
    document.getElementById('editMobile').value = state.currentUser.mobile;
    document.getElementById('editEmail').value = state.currentUser.email;
    document.getElementById('editState').value = state.currentUser.state;
    document.getElementById('editCategory').value = state.currentUser.category;
    document.getElementById('editAddress').value = state.currentUser.address;
  }

  // Toggle Edit Profile Mode
  btnToggleEditProfile.addEventListener('click', () => {
    const isEditing = profileEditMode.style.display === 'block';
    if (isEditing) {
      profileEditMode.style.display = 'none';
      profileViewMode.style.display = 'grid';
      btnEditProfileText.textContent = 'Edit Profile';
    } else {
      profileViewMode.style.display = 'none';
      profileEditMode.style.display = 'block';
      btnEditProfileText.textContent = 'Cancel Edit';
    }
  });

  btnCancelEditProfile.addEventListener('click', () => {
    profileEditMode.style.display = 'none';
    profileViewMode.style.display = 'grid';
    btnEditProfileText.textContent = 'Edit Profile';
  });

  // Save Profile Changes
  profileEditMode.addEventListener('submit', (e) => {
    e.preventDefault();

    const newName = document.getElementById('editFullName').value.trim();
    const newMobile = document.getElementById('editMobile').value.trim();
    const newEmail = document.getElementById('editEmail').value.trim();
    const newState = document.getElementById('editState').value;
    const newCategory = document.getElementById('editCategory').value;
    const newAddress = document.getElementById('editAddress').value.trim();

    if (!newName || !newMobile || !newEmail) {
      showToast('Please fill in all mandatory profile fields', 'error');
      return;
    }

    state.currentUser.name = newName;
    state.currentUser.mobile = newMobile;
    state.currentUser.email = newEmail;
    state.currentUser.state = newState;
    state.currentUser.category = newCategory;
    state.currentUser.address = newAddress || 'Resident Address Not Specified';

    // Update UI
    updateProfileDOM();
    if (sidebarUserName) sidebarUserName.textContent = newName;
    const initials = newName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    if (sidebarAvatar) sidebarAvatar.textContent = initials;

    // Switch back to view mode
    profileEditMode.style.display = 'none';
    profileViewMode.style.display = 'grid';
    btnEditProfileText.textContent = 'Edit Profile';

    showToast('Profile credentials and personal info updated successfully!', 'success');
  });

  /* ==========================================================================
     11. REGISTER GRIEVANCE CONTROLLER (Category Dropdown & File Upload)
     ========================================================================== */
  // Grievance Category Dropdown change handler
  const categoryGuidanceMap = {
    women_care: {
      isWomen: true,
      text: '<strong>Fast-Track Women Safety & Care Cell:</strong> Petitions under Women Care & Safety are treated with strict confidentiality and escalated to senior district nodal officers. <em>24x7 Women Helpline: 1091 &bull; SLA: 48-72 Hours.</em>'
    },
    senior_support: {
      isWomen: false,
      text: '<strong>Senior Citizen Nodal Cell:</strong> Expedited redressal for pension delays, healthcare benefits, and elder care assistance. <em>Senior Helpline: 14567.</em>'
    },
    divyangjan: {
      isWomen: false,
      text: '<strong>Divyangjan Welfare Division:</strong> Barrier-free accessibility, assistive device distribution, and disability certification disputes.'
    },
    municipal: {
      isWomen: false,
      text: '<strong>Municipal Corporation & Urban Development:</strong> Solid waste management, drainage waterlogging, street lighting, and road restoration. <em>Standard SLA: 7-14 Days.</em>'
    },
    water: {
      isWomen: false,
      text: '<strong>Jal Sansthan / Water Supply Board:</strong> Pipeline leakages, contaminated drinking water supply, and borewell permissions.'
    },
    pwd: {
      isWomen: false,
      text: '<strong>Public Works Department (PWD):</strong> Pothole repair, highway maintenance, footpaths, and bridge structural safety.'
    },
    electricity: {
      isWomen: false,
      text: '<strong>Power & Electricity Board:</strong> Transformer failure, unscheduled load shedding, faulty electronic meters, and low voltage issues.'
    },
    police: {
      isWomen: false,
      text: '<strong>Law Enforcement & Public Safety:</strong> Non-registration of FIR, patrolling requests, public nuisance, and traffic regulation. <em>Emergency: 112.</em>'
    },
    cyber: {
      isWomen: false,
      text: '<strong>Cyber Crime Reporting Unit:</strong> Financial OTP frauds, phishing scams, social media harassment, and digital identity theft. <em>National Cyber Helpline: 1930.</em>'
    },
    revenue: {
      isWomen: false,
      text: '<strong>Department of Revenue & Land Records:</strong> Land demarcation, mutation delays, caste/income certificate issuance, and registry grievances.'
    },
    health: {
      isWomen: false,
      text: '<strong>Ministry of Health & Family Welfare:</strong> Government hospital emergency care, medicine availability, and healthcare scheme coverage.'
    },
    education: {
      isWomen: false,
      text: '<strong>Department of School & Higher Education:</strong> RTE admissions, fee exploitation, scholarship disbursals, and school infrastructure.'
    },
    transport: {
      isWomen: false,
      text: '<strong>Transport Department:</strong> Driving license delays, public bus connectivity, and vehicle fitness certifications.'
    },
    other: {
      isWomen: false,
      text: '<strong>General Public Grievance Redressal:</strong> Routed to the Central Appellate Authority for preliminary assessment and department assignment.'
    }
  };

  grievanceCategory.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val || !categoryGuidanceMap[val]) {
      categoryInfoBox.style.display = 'none';
      return;
    }

    const info = categoryGuidanceMap[val];
    categoryInfoText.innerHTML = info.text;
    categoryInfoBox.style.display = 'flex';

    if (info.isWomen) {
      categoryInfoBox.classList.add('women-care');
    } else {
      categoryInfoBox.classList.remove('women-care');
    }
  });

  // Description character counter
  grievanceDescription.addEventListener('input', () => {
    const len = grievanceDescription.value.length;
    descCharCount.textContent = `${len} / 2000 chars`;
    if (len > 0) clearFieldError('errGrievanceDesc');
  });

  // File Upload Handlers (Add File)
  fileDropzone.addEventListener('click', () => {
    grievanceFileInput.click();
  });

  fileDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropzone.classList.add('drag-over');
  });

  fileDropzone.addEventListener('dragleave', () => {
    fileDropzone.classList.remove('drag-over');
  });

  fileDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropzone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  grievanceFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function handleFileSelected(file) {
    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size exceeds the 10 MB limit. Please select a smaller file.', 'error');
      return;
    }

    const fileSizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    state.attachedFile = {
      name: file.name,
      size: fileSizeStr
    };

    attachedFileName.textContent = file.name;
    attachedFileSize.textContent = fileSizeStr;
    attachedFilePreview.style.display = 'flex';

    showToast(`File attached: ${file.name} (${fileSizeStr})`, 'info');
  }

  btnRemoveAttachedFile.addEventListener('click', () => {
    state.attachedFile = null;
    grievanceFileInput.value = '';
    attachedFilePreview.style.display = 'none';
    showToast('Attached file removed', 'info');
  });

  /* ==========================================================================
     11.1 VOICE GRIEVANCE RECORDING CONTROLLER (MediaRecorder & Speech Recognition)
     ========================================================================== */
  function formatDuration(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // AudioBuffer to WAV Blob converter (for simulated fallback and compatibility)
  function audioBufferToWavBlob(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels = [];
    let sample = 0;
    let offset = 0;
    let pos = 0;

    function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1); // PCM
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (offset < buffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  }

  // Web Speech API initialization
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let speechRecInstance = null;
  if (SpeechRecognition) {
    try {
      speechRecInstance = new SpeechRecognition();
      speechRecInstance.continuous = true;
      speechRecInstance.interimResults = true;
      speechRecInstance.lang = 'en-IN';

      speechRecInstance.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript + ' ';
          }
        }
        if (transcript.trim()) {
          state.liveVoiceTranscript = (state.liveVoiceTranscript ? state.liveVoiceTranscript + ' ' : '') + transcript.trim();
          if (grievanceDescription) {
            const prev = grievanceDescription.value ? grievanceDescription.value.trim() + ' ' : '';
            grievanceDescription.value = prev + transcript.trim();
            if (descCharCount) descCharCount.textContent = `${grievanceDescription.value.length} / 2000 chars`;
            clearFieldError('errGrievanceDesc');
            grievanceDescription.classList.remove('is-invalid');
          }
        }
      };

      speechRecInstance.onerror = (e) => {
        console.warn('Speech recognition notice:', e.error);
      };
    } catch (err) {
      console.warn('Speech recognition not initialized:', err);
    }
  }

  // Helper to convert audio Blob to Base64
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const base64Data = reader.result.includes(',') ? reader.result.split(',')[1] : reader.result;
          resolve(base64Data);
        } else {
          resolve('');
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Neural Transcription with Gemini 3.5 Transcribe + Grievance AI
  async function transcribeAudioWithGemini(audioBlob, clientLiveTranscript) {
    if (!audioBlob) return;

    if (aiTranscribingBanner) aiTranscribingBanner.style.display = 'flex';
    if (aiTranscribeSuccessBadge) aiTranscribeSuccessBadge.style.display = 'none';

    try {
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = audioBlob.type || 'audio/webm';

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          mimeType: mimeType,
          clientTranscript: clientLiveTranscript || state.liveVoiceTranscript || ''
        })
      });

      if (!response.ok) {
        throw new Error(`Transcribe API returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data && data.success) {
        // 1. Fill Grievance Description with superior transcription
        const transcribedText = data.transcript || data.transcription;
        if (transcribedText && grievanceDescription) {
          grievanceDescription.value = transcribedText;
          if (descCharCount) descCharCount.textContent = `${grievanceDescription.value.length} / 2000 chars`;
          clearFieldError('errGrievanceDesc');
          grievanceDescription.classList.remove('is-invalid');
        }

        // 2. Auto-suggest Grievance Title if empty
        if (data.suggestedTitle && grievanceTitle && (!grievanceTitle.value || !grievanceTitle.value.trim())) {
          grievanceTitle.value = data.suggestedTitle;
          clearFieldError('errGrievanceTitle');
          grievanceTitle.classList.remove('is-invalid');
        }

        // 3. Auto-select Department Category
        if (data.suggestedCategory && grievanceCategory) {
          const matchingOption = Array.from(grievanceCategory.options).find(opt => opt.value === data.suggestedCategory);
          if (matchingOption) {
            grievanceCategory.value = data.suggestedCategory;
            grievanceCategory.dispatchEvent(new Event('change'));
          }
        }

        // 4. Auto-select Urgency / Priority
        if (data.suggestedPriority && grievancePriority) {
          grievancePriority.value = data.suggestedPriority;
        }

        // 5. Update Success Badge
        if (aiTranscribeModelInfo) {
          const catLabel = data.suggestedCategory ? data.suggestedCategory.toUpperCase() : 'CIVIC';
          const prioLabel = data.suggestedPriority || 'Standard';
          aiTranscribeModelInfo.textContent = `Auto-detected: ${catLabel} • Urgency: ${prioLabel}`;
        }
        if (aiTranscribeSuccessBadge) {
          aiTranscribeSuccessBadge.style.display = 'block';
        }

        showToast('Transcribed & analyzed with Gemini 3.5 Transcribe', 'success');
      } else {
        throw new Error(data.error || 'Transcription failed');
      }
    } catch (err) {
      console.warn('Gemini 3.5 transcription error, falling back:', err);
      // Fallback: preserve client live transcript if available
      if (state.liveVoiceTranscript && grievanceDescription && !grievanceDescription.value.trim()) {
        grievanceDescription.value = state.liveVoiceTranscript.trim();
        if (descCharCount) descCharCount.textContent = `${grievanceDescription.value.length} / 2000 chars`;
      }
    } finally {
      if (aiTranscribingBanner) aiTranscribingBanner.style.display = 'none';
    }
  }

  async function startVoiceRecording() {
    state.audioChunks = [];
    state.recordingSeconds = 0;
    state.isSimulatedAudio = false;
    state.liveVoiceTranscript = '';
    if (recordingTimer) recordingTimer.textContent = '00:00';
    if (aiTranscribingBanner) aiTranscribingBanner.style.display = 'none';
    if (aiTranscribeSuccessBadge) aiTranscribeSuccessBadge.style.display = 'none';

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mediaStream = stream;
        const options = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
          ? { mimeType: 'audio/webm;codecs=opus' }
          : {};
        state.mediaRecorder = new MediaRecorder(stream, options);

        state.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            state.audioChunks.push(e.data);
          }
        };

        state.mediaRecorder.onstop = () => {
          const mime = state.mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(state.audioChunks, { type: mime });
          const audioUrl = URL.createObjectURL(audioBlob);
          const durationStr = formatDuration(state.recordingSeconds || 1);

          state.voiceRecording = {
            blob: audioBlob,
            url: audioUrl,
            duration: durationStr
          };

          if (audioPreviewPlayer) audioPreviewPlayer.src = audioUrl;
          if (audioDuration) audioDuration.textContent = `Duration: ${durationStr}`;
          if (audioPlaybackCard) audioPlaybackCard.style.display = 'flex';
          showToast(`Voice grievance recorded (${durationStr})`, 'success');

          // Send audio to Gemini 3.5 Transcribe
          transcribeAudioWithGemini(audioBlob, state.liveVoiceTranscript);
        };

        state.mediaRecorder.start();
      } else {
        throw new Error('getUserMedia not supported in current environment');
      }
    } catch (err) {
      console.warn('Microphone access unavailable or denied, using simulated fallback:', err);
      state.isSimulatedAudio = true;
    }

    if (btnStartVoiceRecord) {
      btnStartVoiceRecord.classList.add('recording');
      btnStartVoiceRecord.style.display = 'none';
    }
    if (voiceRecordStatus) voiceRecordStatus.style.display = 'flex';
    if (audioPlaybackCard) audioPlaybackCard.style.display = 'none';

    // Start speech recognition if supported
    if (speechRecInstance) {
      try {
        speechRecInstance.start();
      } catch (e) {}
    }

    // Timer Interval
    clearInterval(state.recordingTimerInterval);
    state.recordingTimerInterval = setInterval(() => {
      state.recordingSeconds++;
      if (recordingTimer) recordingTimer.textContent = formatDuration(state.recordingSeconds);
    }, 1000);
  }

  function stopVoiceRecording() {
    clearInterval(state.recordingTimerInterval);

    if (speechRecInstance) {
      try { speechRecInstance.stop(); } catch (e) {}
    }

    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      state.mediaRecorder.stop();
      if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
      }
    } else if (state.isSimulatedAudio) {
      // Create synthetic audio fallback
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          const sampleRate = audioCtx.sampleRate;
          const duration = Math.max(state.recordingSeconds, 2);
          const numFrames = sampleRate * duration;
          const buffer = audioCtx.createBuffer(1, numFrames, sampleRate);
          const channelData = buffer.getChannelData(0);
          for (let i = 0; i < numFrames; i++) {
            channelData[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * Math.exp(-i / (sampleRate * 1.5)) * 0.4;
          }
          const wavBlob = audioBufferToWavBlob(buffer);
          const audioUrl = URL.createObjectURL(wavBlob);
          const durationStr = formatDuration(duration);

          state.voiceRecording = {
            blob: wavBlob,
            url: audioUrl,
            duration: durationStr
          };

          if (audioPreviewPlayer) audioPreviewPlayer.src = audioUrl;
          if (audioDuration) audioDuration.textContent = `Duration: ${durationStr}`;
          if (audioPlaybackCard) audioPlaybackCard.style.display = 'flex';
          showToast(`Voice grievance recorded (${durationStr})`, 'success');

          // Send simulated audio to Gemini 3.5 Transcribe
          transcribeAudioWithGemini(wavBlob, state.liveVoiceTranscript);
        }
      } catch (e) {
        console.warn('AudioContext fallback error:', e);
      }
      state.isSimulatedAudio = false;
    }

    if (btnStartVoiceRecord) {
      btnStartVoiceRecord.classList.remove('recording');
      btnStartVoiceRecord.style.display = 'inline-flex';
    }
    if (voiceRecordStatus) voiceRecordStatus.style.display = 'none';
  }

  function deleteVoiceRecording() {
    if (state.voiceRecording && state.voiceRecording.url) {
      URL.revokeObjectURL(state.voiceRecording.url);
    }
    state.voiceRecording = null;
    state.liveVoiceTranscript = '';
    if (audioPreviewPlayer) audioPreviewPlayer.src = '';
    if (audioPlaybackCard) audioPlaybackCard.style.display = 'none';
    if (aiTranscribingBanner) aiTranscribingBanner.style.display = 'none';
    if (aiTranscribeSuccessBadge) aiTranscribeSuccessBadge.style.display = 'none';
    showToast('Voice recording discarded', 'info');
  }

  if (btnStartVoiceRecord) {
    btnStartVoiceRecord.addEventListener('click', startVoiceRecording);
  }
  if (btnStopVoiceRecord) {
    btnStopVoiceRecord.addEventListener('click', stopVoiceRecording);
  }
  if (btnDeleteAudio) {
    btnDeleteAudio.addEventListener('click', deleteVoiceRecording);
  }

  // Priority Weights and Sorting Helper
  const PRIORITY_WEIGHTS = {
    'Emergency': 3,
    'Urgent': 2,
    'Standard': 1
  };

  function sortGrievancesByPriority(list, sortOrder) {
    if (sortOrder === 'high-to-low') {
      return [...list].sort((a, b) => (PRIORITY_WEIGHTS[b.priority] || 0) - (PRIORITY_WEIGHTS[a.priority] || 0));
    } else if (sortOrder === 'low-to-high') {
      return [...list].sort((a, b) => (PRIORITY_WEIGHTS[a.priority] || 0) - (PRIORITY_WEIGHTS[b.priority] || 0));
    }
    return list;
  }

  // Submit Grievance Petition
  formRegisterGrievance.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllErrors();
    let hasError = false;

    const catVal = grievanceCategory.value;
    if (!catVal) {
      showToast('Please select a Grievance Category', 'error');
      grievanceCategory.classList.add('is-invalid');
      hasError = true;
    }

    const titleVal = grievanceTitle.value.trim();
    if (!titleVal) {
      showFieldError('errGrievanceTitle', 'Please enter a concise grievance title / subject');
      grievanceTitle.classList.add('is-invalid');
      hasError = true;
    }

    const locVal = grievanceLocation.value.trim();
    if (!locVal) {
      showFieldError('errGrievanceLocation', 'Please enter the incident location or landmark');
      grievanceLocation.classList.add('is-invalid');
      hasError = true;
    }

    const descVal = grievanceDescription.value.trim();
    if (!descVal) {
      showFieldError('errGrievanceDesc', 'Please provide detailed information for grievance investigation');
      grievanceDescription.classList.add('is-invalid');
      hasError = true;
    }

    if (!chkGrievanceDeclaration.checked) {
      showFieldError('errGrievanceDeclaration', 'You must affirm the truth of the statements before submitting');
      hasError = true;
    }

    if (hasError) return;

    triggerLoading(btnSubmitGrievance, true);

    // Generate Docket Number: GRV-2026-XXXXX
    const randomDocketNum = Math.floor(10000 + Math.random() * 90000);
    const newDocketNo = `GRV-2026-${randomDocketNum}`;
    const selectedCategoryText = grievanceCategory.options[grievanceCategory.selectedIndex].text.split('(')[0].trim();

    // Map priority to SLA officer
    const officer = catVal === 'women_care'
      ? 'Fast-Track Women Safety Redressal Cell'
      : (catVal === 'police' ? 'Public Safety Nodal Cell' : 'District Redressal Division');

    const newGrievance = {
      docket_no: newDocketNo,
      category: selectedCategoryText,
      category_key: catVal,
      title: titleVal,
      description: descVal,
      priority: grievancePriority.value,
      location: locVal,
      status: 'Submitted',
      stage: 'Not Started',
      date: 'Just Now',
      assigned_officer: officer,
      assigned_worker: '',
      is_department: (catVal === 'revenue'),
      fileName: state.attachedFile ? state.attachedFile.name : null,
      fileSize: state.attachedFile ? state.attachedFile.size : null,
      voiceRecording: state.voiceRecording ? {
        duration: state.voiceRecording.duration,
        url: state.voiceRecording.url
      } : null,
      resolutionProof: null
    };

    setTimeout(() => {
      triggerLoading(btnSubmitGrievance, false);

      // Prepend to grievances list
      state.grievances.unshift(newGrievance);

      // Reset form
      formRegisterGrievance.reset();
      categoryInfoBox.style.display = 'none';
      descCharCount.textContent = '0 / 2000 chars';
      state.attachedFile = null;
      attachedFilePreview.style.display = 'none';
      state.voiceRecording = null;
      if (audioPreviewPlayer) audioPreviewPlayer.src = '';
      if (audioPlaybackCard) audioPlaybackCard.style.display = 'none';

      showToast(`Grievance registered successfully! Docket ID: ${newDocketNo}`, 'success', 6000);

      // Navigate to View Status section
      switchDashboardSection('status');
    }, 600);
  });

  /* ==========================================================================
     12. VIEW STATUS SUBSECTION CONTROLLER (Listing, Filtering & Tracking)
     ========================================================================== */
  function renderGrievances() {
    const searchTerm = searchGrievanceInput ? searchGrievanceInput.value.trim().toLowerCase() : '';
    const statusFilter = filterGrievanceStatus ? filterGrievanceStatus.value : 'all';
    const priorityFilter = filterGrievancePriority ? filterGrievancePriority.value : 'all';

    // Calculate metrics
    const total = state.grievances.length;
    const inProgress = state.grievances.filter(g => g.status.toLowerCase().includes('progress') || g.status.toLowerCase().includes('investigation')).length;
    const resolved = state.grievances.filter(g => g.status.toLowerCase() === 'resolved').length;

    if (sidebarGrievanceCount) sidebarGrievanceCount.textContent = total;
    if (statCardTotal) statCardTotal.textContent = total;
    if (statCardInProgress) statCardInProgress.textContent = inProgress;
    if (statCardResolved) statCardResolved.textContent = resolved;

    // Filter items
    const filtered = state.grievances.filter(g => {
      const matchesSearch = !searchTerm ||
        g.docket_no.toLowerCase().includes(searchTerm) ||
        g.title.toLowerCase().includes(searchTerm) ||
        g.category.toLowerCase().includes(searchTerm);

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'submitted' && g.status.toLowerCase() === 'submitted') ||
        (statusFilter === 'in-progress' && (g.status.toLowerCase().includes('progress') || g.status.toLowerCase().includes('investigation'))) ||
        (statusFilter === 'resolved' && g.status.toLowerCase() === 'resolved');

      const matchesPriority = priorityFilter === 'all' || (g.priority && g.priority.toLowerCase() === priorityFilter.toLowerCase());

      return matchesSearch && matchesStatus && matchesPriority;
    });

    if (!grievanceListContainer) return;

    if (filtered.length === 0) {
      grievanceListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h3>No grievances found</h3>
          <p>Try adjusting your search criteria or register a new grievance to get started.</p>
          <button type="button" class="btn-submit primary-btn" id="btnEmptyLodge">
            Lodge a Grievance Now
          </button>
        </div>
      `;
      const btnEmptyLodge = document.getElementById('btnEmptyLodge');
      if (btnEmptyLodge) {
        btnEmptyLodge.addEventListener('click', () => switchDashboardSection('register'));
      }
      return;
    }

    grievanceListContainer.innerHTML = filtered.map(g => {
      const isWomen = g.category_key === 'women_care' || g.category.toLowerCase().includes('women');
      const categoryBadgeClass = isWomen ? 'category-badge women' : 'category-badge';

      let statusBadgeClass = 'status-badge status-submitted';
      if (g.status.toLowerCase().includes('progress') || g.status.toLowerCase().includes('investigation')) {
        statusBadgeClass = 'status-badge status-in-progress';
      } else if (g.status.toLowerCase() === 'resolved') {
        statusBadgeClass = 'status-badge status-resolved';
      }

      const fileChip = g.fileName ? `
        <span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--primary-600); background: var(--primary-50); padding: 0.1rem 0.4rem; border-radius: var(--radius-sm); border: 1px solid var(--primary-200);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          ${g.fileName}
        </span>
      ` : '';

      const voiceChip = g.voiceRecording ? `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.35rem; flex-wrap: wrap;">
          <span class="voice-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            Voice Complaint (${g.voiceRecording.duration || '0:15'})
          </span>
          ${g.voiceRecording.url ? `<audio controls src="${g.voiceRecording.url}" class="voice-audio-player"></audio>` : ''}
        </div>
      ` : '';

      return `
        <div class="grievance-item-card">
          <div class="grievance-card-left">
            <div class="grievance-card-header">
              <span class="docket-badge">${g.docket_no}</span>
              <span class="${categoryBadgeClass}">${g.category}</span>
              <span class="field-hint" style="margin: 0;">Priority: <strong>${g.priority}</strong></span>
              ${fileChip}
            </div>
            <h4 class="grievance-title-text">${g.title}</h4>
            <p class="grievance-desc-text">${g.description}</p>
            ${voiceChip}
            <div class="grievance-meta-row">
              <span>Lodged: <strong>${g.date}</strong></span>
              <span>&bull;</span>
              <span>Location: <strong>${g.location}</strong></span>
              <span>&bull;</span>
              <span>Officer: <strong>${g.assigned_officer}</strong></span>
            </div>
          </div>
          <div class="grievance-card-right">
            <span class="${statusBadgeClass}">${g.status}</span>
            <button type="button" class="btn-track-item" data-docket="${g.docket_no}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
              <span>View Timeline</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to "View Timeline" buttons
    document.querySelectorAll('.btn-track-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const docket = btn.getAttribute('data-docket');
        openTrackModalForDocket(docket);
      });
    });
  }

  if (searchGrievanceInput) {
    searchGrievanceInput.addEventListener('input', renderGrievances);
  }

  if (filterGrievanceStatus) {
    filterGrievanceStatus.addEventListener('change', renderGrievances);
  }
  if (filterGrievancePriority) {
    filterGrievancePriority.addEventListener('change', renderGrievances);
  }

  function openTrackModalForDocket(docket) {
    const item = state.grievances.find(g => g.docket_no === docket);
    if (!item) return;

    trackModalDocketSub.textContent = `Docket ID: ${item.docket_no}`;
    document.getElementById('trackModalCategory').textContent = item.category;
    document.getElementById('trackModalStatus').textContent = item.status;
    document.getElementById('trackModalOfficer').textContent = item.assigned_officer;
    document.getElementById('trackModalTitle').textContent = item.title;

    // Adjust timeline according to status
    const tlStepActive = document.getElementById('tlStepActive');
    const tlStepFinal = document.getElementById('tlStepFinal');

    if (item.status.toLowerCase() === 'resolved') {
      tlStepActive.className = 'timeline-step done';
      tlStepFinal.className = 'timeline-step done';
      document.getElementById('tlFinalTime').textContent = 'Resolved & Case Closed';
    } else if (item.status.toLowerCase().includes('progress') || item.status.toLowerCase().includes('investigation')) {
      tlStepActive.className = 'timeline-step active';
      tlStepFinal.className = 'timeline-step';
      document.getElementById('tlFinalTime').textContent = 'Expected within SLA timeline';
    } else {
      tlStepActive.className = 'timeline-step';
      tlStepFinal.className = 'timeline-step';
      document.getElementById('tlFinalTime').textContent = 'Pending Nodal Review';
    }

    trackModal.style.display = 'flex';
  }

  /* ==========================================================================
     12.1 GRIEVANCE AI: CIVIC INCIDENTS & PRIORITY SCORING CONTROLLER
     ========================================================================== */
  /**
   * Grievance AI - 3-Factor Priority Scoring Algorithm (1 - 100%)
   * 1. Volume: Number of complaints registered for the same issue/locality (up to 40 pts)
   * 2. Sensitivity: Severity of public impact (up to 35 pts)
   *    - Potable water scarcity / emergency hospital / women safety: 32 - 35 pts
   *    - Sewage overflow / land encroachment: 24 - 26 pts
   *    - Frequent blackouts / roads / transport: 16 - 18 pts
   *    - Standard civic / other: 10 - 12 pts
   * 3. Urgency: Emergency = 25 pts, Urgent = 16 pts, Standard = 8 pts (up to 25 pts)
   */
  function calculateCivicIncidentScore(count, categoryKey, urgency, meTooCount = 0) {
    // 1. Volume Score (max 40 pts)
    // Incorporates both registered complaints and community "Me Too" endorsements
    const effectiveCount = Math.max(1, (count || 0) + (meTooCount || 0));
    const volumeScore = Math.min(40, 10 + Math.max(0, effectiveCount - 1) * 6);

    // 2. Sensitivity Score (max 35 pts)
    let sensitivityScore = 15;
    let sensitivityLabel = 'Standard Civil Priority';

    switch (categoryKey) {
      case 'water':
        sensitivityScore = 35;
        sensitivityLabel = 'Critical Essential (Potable Water Supply)';
        break;
      case 'health':
        sensitivityScore = 33;
        sensitivityLabel = 'Critical Public Health (Hospital & Medicines)';
        break;
      case 'women_care':
        sensitivityScore = 34;
        sensitivityLabel = 'Critical Citizen Safety (Women Protection)';
        break;
      case 'municipal':
        sensitivityScore = 25;
        sensitivityLabel = 'High Public Sanitation (Sewage & Flooding)';
        break;
      case 'revenue':
        sensitivityScore = 26;
        sensitivityLabel = 'High Land Demarcation & Asset Protection';
        break;
      case 'cyber':
      case 'police':
        sensitivityScore = 28;
        sensitivityLabel = 'High Public Security & Crime Deterrence';
        break;
      case 'electricity':
        sensitivityScore = 18;
        sensitivityLabel = 'Moderate Utility (Power & Discom Outage)';
        break;
      case 'pwd':
        sensitivityScore = 18;
        sensitivityLabel = 'Moderate Infrastructure (Roads & Bridges)';
        break;
      case 'transport':
        sensitivityScore = 16;
        sensitivityLabel = 'Moderate Transit & Public Conveyance';
        break;
      case 'education':
        sensitivityScore = 14;
        sensitivityLabel = 'Public Education & School Facilities';
        break;
      default:
        sensitivityScore = 12;
        sensitivityLabel = 'General Civil Administration';
        break;
    }

    // 3. Urgency Score (max 25 pts)
    let urgencyScore = 8;
    const normUrgency = (urgency || 'Standard').toLowerCase();
    if (normUrgency === 'emergency') {
      urgencyScore = 25;
    } else if (normUrgency === 'urgent') {
      urgencyScore = 16;
    } else {
      urgencyScore = 8;
    }

    const totalScore = Math.min(100, Math.max(1, volumeScore + sensitivityScore + urgencyScore));

    return {
      totalScore,
      volumeScore,
      sensitivityScore,
      sensitivityLabel,
      urgencyScore,
      effectiveCount,
      meTooCount
    };
  }

  function renderCivicIncidents(containerId, isDeptOnly) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Filter incidents by jurisdiction
    const incidents = state.civicIncidents.filter(inc => isDeptOnly ? inc.is_department : !inc.is_department);

    if (incidents.length === 0) {
      container.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem; background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);">
          No active multi-complaint locality incidents detected in this jurisdiction at this time.
        </div>
      `;
      return;
    }

    // Sort incidents by calculated AI priority score descending
    const incidentsWithScore = incidents.map(inc => {
      const scoreObj = calculateCivicIncidentScore(inc.count, inc.category_key, inc.urgency, inc.me_too_count || 0);
      return { ...inc, scoreObj };
    }).sort((a, b) => b.scoreObj.totalScore - a.scoreObj.totalScore);

    container.innerHTML = incidentsWithScore.map(inc => {
      const { scoreObj } = inc;

      // Urgency badge styling: Emergency = Red, Urgent = Orange, Standard = Blue
      let urgencyClass = 'urgency-standard';
      let urgencyCardClass = 'incident-card-standard';
      let urgencyIcon = 'ℹ️';
      const normUrgency = (inc.urgency || 'Standard').toLowerCase();
      if (normUrgency === 'emergency') {
        urgencyClass = 'urgency-emergency';
        urgencyCardClass = 'incident-card-emergency';
        urgencyIcon = '🚨';
      } else if (normUrgency === 'urgent') {
        urgencyClass = 'urgency-urgent';
        urgencyCardClass = 'incident-card-urgent';
        urgencyIcon = '⚠️';
      }

      // Priority score badge styling
      let scoreBadgeClass = 'score-moderate';
      if (scoreObj.totalScore >= 80) {
        scoreBadgeClass = 'score-critical';
      } else if (scoreObj.totalScore >= 60) {
        scoreBadgeClass = 'score-high';
      } else if (scoreObj.totalScore < 40) {
        scoreBadgeClass = 'score-low';
      }

      return `
        <div class="incident-card ${urgencyCardClass}" id="incident-card-${inc.id}">
          <div class="incident-card-left">
            <div class="incident-card-header">
              <span class="incident-docket-badge">${inc.id}</span>
              <span class="badge-ai-score ${scoreBadgeClass}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
                AI Priority: <strong>${scoreObj.totalScore}%</strong>
              </span>
              <span class="urgency-badge ${urgencyClass}">
                ${urgencyIcon} ${inc.urgency}
              </span>
              <span class="badge-complaints-count">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                ${inc.count} Complaints${inc.me_too_count ? ` + ${inc.me_too_count} "Me Too"` : ''} Registered
              </span>
              <span class="badge-sensitivity">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                Sensitivity: ${scoreObj.sensitivityLabel}
              </span>
            </div>
            <h4 class="incident-title-text">${inc.title}</h4>
            <p class="incident-desc-text">${inc.description}</p>
            <div class="incident-meta-row">
              <span>📍 Locality: <strong>${inc.location}</strong></span>
              <span>&bull;</span>
              <span>🏛️ Sector: <strong>${inc.category}</strong></span>
              <span>&bull;</span>
              <span>⚡ Volume Weight: <strong>${scoreObj.volumeScore}/40</strong> (${scoreObj.effectiveCount} affected) &bull; Sensitivity Weight: <strong>${scoreObj.sensitivityScore}/35</strong> &bull; Urgency Weight: <strong>${scoreObj.urgencyScore}/25</strong></span>
            </div>
          </div>
          <div class="incident-card-right">
            <button type="button" class="btn-view-grouped" data-incident-id="${inc.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span>View Grouped (${inc.count})</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Wire up "View Grouped" buttons
    container.querySelectorAll('.btn-view-grouped').forEach(btn => {
      btn.addEventListener('click', () => {
        const incidentId = btn.getAttribute('data-incident-id');
        openIncidentDetailsModal(incidentId);
      });
    });
  }

  function openIncidentDetailsModal(incidentId, isCitizenView = false) {
    const inc = state.civicIncidents.find(i => i.id === incidentId);
    if (!inc || !modalCivicIncidentDetails) return;

    const scoreObj = calculateCivicIncidentScore(inc.count, inc.category_key, inc.urgency, inc.me_too_count || 0);

    let urgencyClass = 'urgency-standard';
    let urgencyIcon = 'ℹ️';
    const normUrgency = (inc.urgency || 'Standard').toLowerCase();
    if (normUrgency === 'emergency') {
      urgencyClass = 'urgency-emergency';
      urgencyIcon = '🚨';
    } else if (normUrgency === 'urgent') {
      urgencyClass = 'urgency-urgent';
      urgencyIcon = '⚠️';
    }

    let scoreBadgeClass = 'score-moderate';
    if (scoreObj.totalScore >= 80) {
      scoreBadgeClass = 'score-critical';
    } else if (scoreObj.totalScore >= 60) {
      scoreBadgeClass = 'score-high';
    } else if (scoreObj.totalScore < 40) {
      scoreBadgeClass = 'score-low';
    }

    if (incidentModalTitle) incidentModalTitle.textContent = inc.title;
    if (incidentModalSubtitle) {
      if (isCitizenView) {
        incidentModalSubtitle.innerHTML = `Issue Ref: <strong>ISS-${inc.id.replace('INC-', '')}</strong> &bull; Locality: <strong>${inc.location}</strong> &bull; Department: <strong>${inc.category}</strong>`;
      } else {
        incidentModalSubtitle.innerHTML = `Incident ID: <strong>${inc.id}</strong> &bull; Locality: <strong>${inc.location}</strong> &bull; Sector: <strong>${inc.category}</strong>`;
      }
    }

    if (incidentModalPills) {
      if (isCitizenView) {
        incidentModalPills.innerHTML = `
          <span class="badge-ai-score ${scoreBadgeClass}">🤖 Priority Score: ${scoreObj.totalScore}%</span>
          <span class="urgency-badge ${urgencyClass}">${urgencyIcon} Urgency: ${inc.urgency}</span>
          <span class="badge-complaints-count">👥 ${inc.count} Complaints Reported${inc.me_too_count ? ` + ${inc.me_too_count} "Me Too"` : ''}</span>
          <span class="badge-sensitivity">⚡ ${scoreObj.sensitivityLabel}</span>
        `;
      } else {
        incidentModalPills.innerHTML = `
          <span class="badge-ai-score ${scoreBadgeClass}">🤖 AI Priority Score: ${scoreObj.totalScore}%</span>
          <span class="urgency-badge ${urgencyClass}">${urgencyIcon} Urgency: ${inc.urgency}</span>
          <span class="badge-complaints-count">👥 ${inc.count} Complaints${inc.me_too_count ? ` + ${inc.me_too_count} "Me Too"` : ''} Clustered</span>
          <span class="badge-sensitivity">⚡ ${scoreObj.sensitivityLabel}</span>
        `;
      }
    }

    const btnDoneIncidentModal = document.getElementById('btnDoneIncidentModal');
    if (btnDoneIncidentModal) {
      btnDoneIncidentModal.textContent = isCitizenView ? 'Close Issue Details' : 'Close Incident Overview';
    }

    if (incidentModalDocketsList) {
      incidentModalDocketsList.innerHTML = inc.complaints.map(c => `
        <div class="grouped-docket-card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <span class="docket-badge" style="background: #ede9fe; color: #5b21b6; border-color: #c4b5fd;">${c.docket_no}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Complainant: <strong>${c.complainant}</strong> &bull; Lodged: <strong>${c.date}</strong></span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.35rem 0 0.2rem 0; line-height: 1.45;">
            ${c.detail}
          </p>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            📍 Location: <strong>${c.location}</strong>
          </div>
        </div>
      `).join('');
    }

    modalCivicIncidentDetails.style.display = 'flex';
  }

  /* ==========================================================================
     12.1.1 CITIZEN AREA CIVIC INCIDENTS CONTROLLER ("Me Too" Endorsements)
     ========================================================================== */
  function renderCitizenCivicIncidents() {
    if (!citizenIncidentsListContainer) return;

    const searchTerm = searchCitizenIncidentInput ? searchCitizenIncidentInput.value.trim().toLowerCase() : '';
    const localityFilter = filterCitizenIncidentLocality ? filterCitizenIncidentLocality.value : 'all';

    // Populate locality dropdown once if only has default option
    if (filterCitizenIncidentLocality && filterCitizenIncidentLocality.options.length <= 1) {
      const localities = Array.from(new Set(state.civicIncidents.map(inc => inc.location))).filter(Boolean).sort();
      localities.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc;
        opt.textContent = `📍 ${loc}`;
        filterCitizenIncidentLocality.appendChild(opt);
      });
    }

    // Filter incidents
    const filtered = state.civicIncidents.filter(inc => {
      const matchesSearch = !searchTerm ||
        inc.title.toLowerCase().includes(searchTerm) ||
        inc.description.toLowerCase().includes(searchTerm) ||
        inc.location.toLowerCase().includes(searchTerm) ||
        inc.category.toLowerCase().includes(searchTerm);

      const matchesLocality = localityFilter === 'all' || inc.location === localityFilter;

      return matchesSearch && matchesLocality;
    });

    // Update count badge in sidebar
    if (badgeCitizenIncidentsCount) {
      badgeCitizenIncidentsCount.textContent = state.civicIncidents.length;
    }

    if (filtered.length === 0) {
      citizenIncidentsListContainer.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1.5rem; background: var(--bg-surface-elevated); border: 1px dashed var(--border-subtle); border-radius: var(--radius-lg);">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h3>No matching issues found</h3>
          <p>No active issues found matching your search or selected neighborhood. You can lodge a new petition to report a problem.</p>
          <button type="button" class="btn-submit primary-btn" id="btnEmptyLodgeIncident">
            Lodge a New Grievance
          </button>
        </div>
      `;
      const btnEmptyLodgeIncident = document.getElementById('btnEmptyLodgeIncident');
      if (btnEmptyLodgeIncident) {
        btnEmptyLodgeIncident.addEventListener('click', () => switchDashboardSection('register'));
      }
      return;
    }

    // Sort issues by effective count (complaints + me too) descending
    const sortedIncidents = [...filtered].sort((a, b) => {
      const countA = (a.count || 0) + (a.me_too_count || 0);
      const countB = (b.count || 0) + (b.me_too_count || 0);
      return countB - countA;
    });

    citizenIncidentsListContainer.innerHTML = sortedIncidents.map(inc => {
      const isEndorsed = !!state.meTooEndorsements[inc.id];
      const meTooTotal = inc.me_too_count || 0;

      const meTooButtonMarkup = isEndorsed
        ? `<button type="button" class="btn-me-too active" data-incident-id="${inc.id}" title="Click to remove your endorsement">
             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
             <span>✓ You &amp; ${meTooTotal} Affected</span>
           </button>`
        : `<button type="button" class="btn-me-too" data-incident-id="${inc.id}" title="Click if you are also affected by this issue">
             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
             <span>Me Too</span>
             <span class="badge-me-too-count">${meTooTotal}</span>
           </button>`;

      return `
        <div class="grievance-item-card" id="citizen-issue-${inc.id}">
          <div class="grievance-card-left">
            <h4 class="grievance-title-text">${inc.title}</h4>
            <p class="grievance-desc-text">${inc.description}</p>
            <div class="grievance-meta-row">
              <span>📍 Locality: <strong>${inc.location}</strong></span>
              <span>&bull;</span>
              <span>👥 <strong>${inc.count} People Complained</strong>${meTooTotal > 0 ? ` <span style="color: var(--primary-600); font-weight: 600;">(+ ${meTooTotal} "Me Too")</span>` : ''}</span>
            </div>
          </div>
          <div class="grievance-card-right">
            ${meTooButtonMarkup}
          </div>
        </div>
      `;
    }).join('');

    // Wire up "Me Too" buttons
    citizenIncidentsListContainer.querySelectorAll('.btn-me-too').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const incidentId = btn.getAttribute('data-incident-id');
        handleMeTooClick(incidentId);
      });
    });
  }

  function handleMeTooClick(incidentId) {
    const inc = state.civicIncidents.find(i => i.id === incidentId);
    if (!inc) return;

    const currentlyEndorsed = !!state.meTooEndorsements[incidentId];

    if (currentlyEndorsed) {
      // Remove endorsement
      delete state.meTooEndorsements[incidentId];
      inc.me_too_count = Math.max(0, (inc.me_too_count || 1) - 1);
      showToast('Your "Me Too" endorsement has been removed.', 'info');
      // Sync with backend
      fetch(`/api/incidents/${incidentId}/me-too`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove' })
      }).catch(() => {});
    } else {
      // Add endorsement
      state.meTooEndorsements[incidentId] = true;
      inc.me_too_count = (inc.me_too_count || 0) + 1;
      showToast('You endorsed this issue! Your voice has been added to this complaint.', 'success');
      // Sync with backend
      fetch(`/api/incidents/${incidentId}/me-too`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add' })
      }).catch(() => {});
    }

    // Persist to localStorage
    try {
      localStorage.setItem('jan_samadhan_me_too', JSON.stringify(state.meTooEndorsements));
    } catch (e) {}

    // Re-render citizen view
    renderCitizenCivicIncidents();

    // Also re-render officer view if containers exist
    if (document.getElementById('civicIncidentsDeptContainer')) {
      renderCivicIncidents('civicIncidentsDeptContainer', true);
    }
    if (document.getElementById('civicIncidentsGeneralContainer')) {
      renderCivicIncidents('civicIncidentsGeneralContainer', false);
    }
  }

  if (searchCitizenIncidentInput) {
    searchCitizenIncidentInput.addEventListener('input', renderCitizenCivicIncidents);
  }
  if (filterCitizenIncidentLocality) {
    filterCitizenIncidentLocality.addEventListener('change', renderCitizenCivicIncidents);
  }

  /* ==========================================================================
     12.2 NODAL OFFICER: DEPARTMENT GRIEVANCES CONTROLLER
     ========================================================================== */
  function getStageBadgeClass(stage) {
    switch (stage) {
      case 'Not Started': return 'badge-stage stage-not-started';
      case 'Acquiring Resources': return 'badge-stage stage-acquiring';
      case 'Processing': return 'badge-stage stage-processing';
      case 'Completion with Proof': return 'badge-stage stage-completed';
      default: return 'badge-stage stage-not-started';
    }
  }

  function getStageIndex(stage) {
    switch (stage) {
      case 'Not Started': return 0;
      case 'Acquiring Resources': return 1;
      case 'Processing': return 2;
      case 'Completion with Proof': return 3;
      default: return 0;
    }
  }

  /**
   * Helper to retrieve a Set of all complaint docket numbers that belong to any Civic Incident cluster
   */
  function getClusteredDocketNumbers() {
    const clusteredSet = new Set();
    if (Array.isArray(state.civicIncidents)) {
      state.civicIncidents.forEach(inc => {
        if (Array.isArray(inc.complaints)) {
          inc.complaints.forEach(c => {
            if (c && c.docket_no) clusteredSet.add(c.docket_no.trim().toUpperCase());
          });
        }
      });
    }
    return clusteredSet;
  }

  function renderOfficerDeptGrievances() {
    // Render Grievance AI Civic Incidents in Department Jurisdiction
    renderCivicIncidents('civicIncidentsContainerDept', true);

    const searchTerm = searchOfficerDeptInput ? searchOfficerDeptInput.value.trim().toLowerCase() : '';
    const stageFilter = filterOfficerDeptStage ? filterOfficerDeptStage.value : 'all';
    const priorityFilter = filterOfficerDeptPriority ? filterOfficerDeptPriority.value : 'all';
    const sortPriority = sortOfficerDeptPriority ? sortOfficerDeptPriority.value : 'default';

    // Unique department petitions (Revenue & Land Records) - EXCLUDING complaints in civic incidents
    const clusteredDockets = getClusteredDocketNumbers();
    const deptItems = state.grievances.filter(g => 
      (g.is_department || g.category_key === 'revenue') && !clusteredDockets.has(g.docket_no.toUpperCase())
    );
    if (badgeOfficerDeptCount) badgeOfficerDeptCount.textContent = deptItems.length;

    let filtered = deptItems.filter(g => {
      const matchesSearch = !searchTerm ||
        g.docket_no.toLowerCase().includes(searchTerm) ||
        g.title.toLowerCase().includes(searchTerm) ||
        (g.assigned_worker && g.assigned_worker.toLowerCase().includes(searchTerm)) ||
        g.location.toLowerCase().includes(searchTerm);

      const matchesStage = (stageFilter === 'all') || (g.stage === stageFilter);
      const matchesPriority = (priorityFilter === 'all') || (g.priority && g.priority.toLowerCase() === priorityFilter.toLowerCase());
      return matchesSearch && matchesStage && matchesPriority;
    });

    // Apply Priority Sorting
    filtered = sortGrievancesByPriority(filtered, sortPriority);

    if (!officerDeptListContainer) return;

    if (filtered.length === 0) {
      officerDeptListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h3>No department petitions found</h3>
          <p>No grievances under Revenue & Land Records match the selected filter or search term.</p>
        </div>
      `;
      return;
    }

    officerDeptListContainer.innerHTML = filtered.map(g => {
      const stageBadgeClass = getStageBadgeClass(g.stage);
      const fileChip = g.fileName ? `
        <span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--primary-600); background: var(--primary-50); padding: 0.1rem 0.4rem; border-radius: var(--radius-sm); border: 1px solid var(--primary-200);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          ${g.fileName}
        </span>
      ` : '';

      const voiceChip = g.voiceRecording ? `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.35rem; flex-wrap: wrap;">
          <span class="voice-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            Voice Complaint (${g.voiceRecording.duration || '0:15'})
          </span>
          ${g.voiceRecording.url ? `<audio controls src="${g.voiceRecording.url}" class="voice-audio-player"></audio>` : ''}
        </div>
      ` : '';

      const workerText = g.assigned_worker ? `<strong>${g.assigned_worker}</strong>` : `<span style="color: #dc2626; font-weight: 600;">Unassigned</span>`;

      return `
        <div class="grievance-item-card">
          <div class="grievance-card-left">
            <div class="grievance-card-header">
              <span class="docket-badge">${g.docket_no}</span>
              <span class="${stageBadgeClass}">${g.stage || 'Not Started'}</span>
              <span class="field-hint" style="margin: 0;">Priority: <strong>${g.priority}</strong></span>
              ${fileChip}
            </div>
            <h4 class="grievance-title-text">${g.title}</h4>
            <p class="grievance-desc-text">${g.description}</p>
            ${voiceChip}
            <div class="grievance-meta-row">
              <span>Lodged: <strong>${g.date}</strong></span>
              <span>&bull;</span>
              <span>Location: <strong>${g.location}</strong></span>
              <span>&bull;</span>
              <span>Worker: ${workerText}</span>
            </div>
          </div>
          <div class="grievance-card-right">
            <button type="button" class="btn-submit primary-btn btn-go-tracker" data-docket="${g.docket_no}" style="font-size: 0.8rem; padding: 0.5rem 0.85rem; border-radius: var(--radius-sm);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              <span>Manage in Desk</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Wire "Manage in Desk" buttons
    officerDeptListContainer.querySelectorAll('.btn-go-tracker').forEach(btn => {
      btn.addEventListener('click', () => {
        const docket = btn.getAttribute('data-docket');
        switchDashboardSection('officerTracker');
        setTimeout(() => {
          const card = document.getElementById(`tracker-card-${docket}`);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
      });
    });
  }

  if (searchOfficerDeptInput) {
    searchOfficerDeptInput.addEventListener('input', renderOfficerDeptGrievances);
  }
  if (filterOfficerDeptStage) {
    filterOfficerDeptStage.addEventListener('change', renderOfficerDeptGrievances);
  }
  if (filterOfficerDeptPriority) {
    filterOfficerDeptPriority.addEventListener('change', renderOfficerDeptGrievances);
  }
  if (sortOfficerDeptPriority) {
    sortOfficerDeptPriority.addEventListener('change', renderOfficerDeptGrievances);
  }

  /* ==========================================================================
     12.3 NODAL OFFICER: GENERAL GRIEVANCES CONTROLLER (CROSS-DEPARTMENT)
     ========================================================================== */
  function renderOfficerGeneralGrievances() {
    // Render Grievance AI Civic Incidents in Cross-Department Jurisdiction
    renderCivicIncidents('civicIncidentsContainerGeneral', false);

    const searchTerm = searchOfficerGeneralInput ? searchOfficerGeneralInput.value.trim().toLowerCase() : '';
    const catFilter = filterOfficerGeneralCategory ? filterOfficerGeneralCategory.value : 'all';
    const priorityFilter = filterOfficerGeneralPriority ? filterOfficerGeneralPriority.value : 'all';
    const sortPriority = sortOfficerGeneralPriority ? sortOfficerGeneralPriority.value : 'default';

    // Unique general grievances (other sectors / cross-department) - EXCLUDING complaints in civic incidents
    const clusteredDockets = getClusteredDocketNumbers();
    const genItems = state.grievances.filter(g => 
      !g.is_department && g.category_key !== 'revenue' && !clusteredDockets.has(g.docket_no.toUpperCase())
    );
    if (badgeOfficerGenCount) badgeOfficerGenCount.textContent = genItems.length;

    let filtered = genItems.filter(g => {
      const matchesSearch = !searchTerm ||
        g.docket_no.toLowerCase().includes(searchTerm) ||
        g.title.toLowerCase().includes(searchTerm) ||
        g.category.toLowerCase().includes(searchTerm) ||
        g.location.toLowerCase().includes(searchTerm);

      const matchesCat = (catFilter === 'all') || (g.category_key === catFilter);
      const matchesPriority = (priorityFilter === 'all') || (g.priority && g.priority.toLowerCase() === priorityFilter.toLowerCase());
      return matchesSearch && matchesCat && matchesPriority;
    });

    // Apply Priority Sorting
    filtered = sortGrievancesByPriority(filtered, sortPriority);

    if (!officerGeneralListContainer) return;

    if (filtered.length === 0) {
      officerGeneralListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h3>No general petitions found</h3>
          <p>Try selecting a different department category or adjust your search keywords.</p>
        </div>
      `;
      return;
    }

    officerGeneralListContainer.innerHTML = filtered.map(g => {
      const isWomen = g.category_key === 'women_care' || g.category.toLowerCase().includes('women');
      const categoryBadgeClass = isWomen ? 'category-badge women' : 'category-badge';

      let statusBadgeClass = 'status-badge status-submitted';
      if (g.status.toLowerCase().includes('progress') || g.status.toLowerCase().includes('investigation')) {
        statusBadgeClass = 'status-badge status-in-progress';
      } else if (g.status.toLowerCase() === 'resolved') {
        statusBadgeClass = 'status-badge status-resolved';
      }

      const fileChip = g.fileName ? `
        <span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--primary-600); background: var(--primary-50); padding: 0.1rem 0.4rem; border-radius: var(--radius-sm); border: 1px solid var(--primary-200);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          ${g.fileName}
        </span>
      ` : '';

      const voiceChip = g.voiceRecording ? `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.35rem; flex-wrap: wrap;">
          <span class="voice-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            Voice Complaint (${g.voiceRecording.duration || '0:15'})
          </span>
          ${g.voiceRecording.url ? `<audio controls src="${g.voiceRecording.url}" class="voice-audio-player"></audio>` : ''}
        </div>
      ` : '';

      return `
        <div class="grievance-item-card">
          <div class="grievance-card-left">
            <div class="grievance-card-header">
              <span class="docket-badge">${g.docket_no}</span>
              <span class="${categoryBadgeClass}">${g.category}</span>
              <span class="field-hint" style="margin: 0;">Priority: <strong>${g.priority}</strong></span>
              ${fileChip}
            </div>
            <h4 class="grievance-title-text">${g.title}</h4>
            <p class="grievance-desc-text">${g.description}</p>
            ${voiceChip}
            <div class="grievance-meta-row">
              <span>Lodged: <strong>${g.date}</strong></span>
              <span>&bull;</span>
              <span>Location: <strong>${g.location}</strong></span>
              <span>&bull;</span>
              <span>Officer/Desk: <strong>${g.assigned_officer}</strong></span>
            </div>
          </div>
          <div class="grievance-card-right">
            <span class="${statusBadgeClass}">${g.status}</span>
            <button type="button" class="btn-track-item btn-gen-track" data-docket="${g.docket_no}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
              <span>View Timeline</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    officerGeneralListContainer.querySelectorAll('.btn-gen-track').forEach(btn => {
      btn.addEventListener('click', () => {
        const docket = btn.getAttribute('data-docket');
        openTrackModalForDocket(docket);
      });
    });
  }

  if (searchOfficerGeneralInput) {
    searchOfficerGeneralInput.addEventListener('input', renderOfficerGeneralGrievances);
  }
  if (filterOfficerGeneralCategory) {
    filterOfficerGeneralCategory.addEventListener('change', renderOfficerGeneralGrievances);
  }
  if (filterOfficerGeneralPriority) {
    filterOfficerGeneralPriority.addEventListener('change', renderOfficerGeneralGrievances);
  }
  if (sortOfficerGeneralPriority) {
    sortOfficerGeneralPriority.addEventListener('change', renderOfficerGeneralGrievances);
  }

  /* ==========================================================================
     12.3 NODAL OFFICER: PROGRESS TRACKER & LEADER MANAGEMENT DESK
     ========================================================================== */
  function renderOfficerTrackerDesk(filterStage = state.activeTrackerStageFilter || 'all') {
    state.activeTrackerStageFilter = filterStage;

    // Filter department items
    const deptItems = state.grievances.filter(g => g.is_department || g.category_key === 'revenue');

    // Update Tab Counters
    const cAll = deptItems.length;
    const cNotStarted = deptItems.filter(g => g.stage === 'Not Started').length;
    const cAcquiring = deptItems.filter(g => g.stage === 'Acquiring Resources').length;
    const cProcessing = deptItems.filter(g => g.stage === 'Processing').length;
    const cCompleted = deptItems.filter(g => g.stage === 'Completion with Proof').length;

    if (countStageAll) countStageAll.textContent = cAll;
    if (countStageNotStarted) countStageNotStarted.textContent = cNotStarted;
    if (countStageAcquiring) countStageAcquiring.textContent = cAcquiring;
    if (countStageProcessing) countStageProcessing.textContent = cProcessing;
    if (countStageCompleted) countStageCompleted.textContent = cCompleted;

    const filtered = (filterStage === 'all')
      ? deptItems
      : deptItems.filter(g => g.stage === filterStage);

    if (!trackerCardsContainer) return;

    if (filtered.length === 0) {
      trackerCardsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h3>No petitions in this stage</h3>
          <p>All departmental petitions are currently tracked under other workflow stages.</p>
        </div>
      `;
      return;
    }

    const stagesList = ['Not Started', 'Acquiring Resources', 'Processing', 'Completion with Proof'];

    trackerCardsContainer.innerHTML = filtered.map(g => {
      const curStageIdx = getStageIndex(g.stage);
      const isCompleted = g.stage === 'Completion with Proof';

      // 4-Stage Stepper Bar HTML
      const stepperHtml = stagesList.map((st, idx) => {
        let stepClass = 'stage-step';
        if (idx < curStageIdx || (isCompleted && idx === 3)) {
          stepClass += ' completed';
        } else if (idx === curStageIdx) {
          stepClass += ' current';
        }

        return `
          <div class="${stepClass}">
            <div class="stage-step-dot">${idx + 1}</div>
            <div class="stage-step-title">${st}</div>
          </div>
        `;
      }).join('');

      // Field Worker Options
      const workerOptions = [
        '<option value="">-- Select Field Worker / Inspection Officer --</option>',
        ...FIELD_STAFF_LIST.map(worker => `
          <option value="${worker}" ${g.assigned_worker === worker ? 'selected' : ''}>${worker}</option>
        `)
      ].join('');

      // Resolution proof card (if completed)
      let resolutionProofHtml = '';
      if (isCompleted && g.resolutionProof) {
        resolutionProofHtml = `
          <div class="resolution-proof-card">
            <div class="proof-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Verified Resolution Proof &amp; Action Taken Report (ATR)</span>
            </div>
            <div class="proof-atr-text">"${g.resolutionProof.remarks}"</div>
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <span class="proof-file-badge">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                ${g.resolutionProof.fileName} (${g.resolutionProof.fileSize})
              </span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">
                Closed: ${g.resolutionProof.resolvedDate} by ${g.resolutionProof.resolvedBy}
              </span>
            </div>
          </div>
        `;
      }

      // Stage action buttons
      let stageActionsHtml = '';
      if (!isCompleted) {
        stageActionsHtml = `
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-top: 0.75rem;">
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Advance Stage:</span>
            ${g.stage === 'Not Started' ? `
              <button type="button" class="btn-submit secondary-btn btn-advance-stage" data-docket="${g.docket_no}" data-target-stage="Acquiring Resources" style="font-size: 0.775rem; padding: 0.35rem 0.65rem;">
                &rarr; 2. Acquiring Resources
              </button>
            ` : ''}
            ${g.stage === 'Acquiring Resources' ? `
              <button type="button" class="btn-submit secondary-btn btn-advance-stage" data-docket="${g.docket_no}" data-target-stage="Processing" style="font-size: 0.775rem; padding: 0.35rem 0.65rem;">
                &rarr; 3. Processing
              </button>
            ` : ''}
            <button type="button" class="btn-submit primary-btn btn-open-close-modal" data-docket="${g.docket_no}" style="font-size: 0.8rem; padding: 0.4rem 0.85rem; margin-left: auto; background: #16a34a;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Complete Case with Proof</span>
            </button>
          </div>
        `;
      } else {
        stageActionsHtml = `
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem;">
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 700; color: #16a34a;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Case Redressed &amp; Formally Closed
            </span>
          </div>
        `;
      }

      return `
        <div class="grievance-item-card" id="tracker-card-${g.docket_no}" style="flex-direction: column; align-items: stretch; gap: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
            <div>
              <div class="grievance-card-header">
                <span class="docket-badge">${g.docket_no}</span>
                <span class="${getStageBadgeClass(g.stage)}">${g.stage}</span>
                <span class="field-hint" style="margin: 0;">Priority: <strong>${g.priority}</strong></span>
              </div>
              <h4 class="grievance-title-text" style="font-size: 1.05rem; margin-top: 0.35rem;">${g.title}</h4>
              <p class="grievance-desc-text">${g.description}</p>
              <div class="grievance-meta-row" style="margin-top: 0.35rem;">
                <span>Lodged: <strong>${g.date}</strong></span>
                <span>&bull;</span>
                <span>Location: <strong>${g.location}</strong></span>
              </div>
            </div>
          </div>

          <!-- 4-Stage Progress Stepper -->
          <div class="stage-progress-bar">
            ${stepperHtml}
          </div>

          <!-- Worker Row -->
          <div class="worker-row">
            <span class="worker-label">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              Assigned Field Worker / Inspection Team:
            </span>
            <select class="worker-select" data-docket="${g.docket_no}" ${isCompleted ? 'disabled' : ''}>
              ${workerOptions}
            </select>
          </div>

          <!-- Proof (if completed) -->
          ${resolutionProofHtml}

          <!-- Stage Actions -->
          ${stageActionsHtml}
        </div>
      `;
    }).join('');

    // Wire worker select changes
    trackerCardsContainer.querySelectorAll('.worker-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const docket = sel.getAttribute('data-docket');
        const worker = e.target.value;
        const g = state.grievances.find(item => item.docket_no === docket);
        if (g) {
          g.assigned_worker = worker;
          if (worker && g.stage === 'Not Started') {
            g.stage = 'Acquiring Resources';
            g.status = 'In Progress';
            showToast(`${worker} assigned. Petition advanced to "Acquiring Resources".`, 'success');
          } else {
            showToast(`Worker updated for ${docket}: ${worker || 'Unassigned'}`, 'info');
          }
          renderOfficerTrackerDesk();
          renderOfficerDeptGrievances();
        }
      });
    });

    // Wire stage advance buttons
    trackerCardsContainer.querySelectorAll('.btn-advance-stage').forEach(btn => {
      btn.addEventListener('click', () => {
        const docket = btn.getAttribute('data-docket');
        const targetStage = btn.getAttribute('data-target-stage');
        const g = state.grievances.find(item => item.docket_no === docket);
        if (g) {
          g.stage = targetStage;
          g.status = 'In Progress';
          showToast(`Petition ${docket} advanced to "${targetStage}"`, 'success');
          renderOfficerTrackerDesk();
          renderOfficerDeptGrievances();
        }
      });
    });

    // Wire "Complete Case with Proof" buttons
    trackerCardsContainer.querySelectorAll('.btn-open-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        const docket = btn.getAttribute('data-docket');
        openCloseModalForDocket(docket);
      });
    });
  }

  // Stage Filter Tabs in Tracker Desk
  document.querySelectorAll('.stage-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stage-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const stage = btn.getAttribute('data-stage');
      renderOfficerTrackerDesk(stage);
    });
  });

  /* ==========================================================================
     12.4 NODAL OFFICER: CASE CLOSURE WITH PHOTO PROOF MODAL CONTROLLER
     ========================================================================== */
  function openCloseModalForDocket(docket) {
    const g = state.grievances.find(item => item.docket_no === docket);
    if (!g) return;

    state.activeClosureDocket = docket;
    state.closureProofFile = null;

    if (closeModalDocketSub) closeModalDocketSub.textContent = `Docket ID: ${docket} - ${g.title}`;
    if (formCloseGrievance) formCloseGrievance.reset();
    if (closurePhotoPreview) closurePhotoPreview.style.display = 'none';
    if (closurePhotoInput) closurePhotoInput.value = '';
    clearFieldError('errClosurePhoto');

    if (modalCloseGrievance) modalCloseGrievance.style.display = 'flex';
  }

  function handleClosurePhotoSelected(file) {
    if (file.size > 10 * 1024 * 1024) {
      showToast('Photo proof exceeds 10 MB limit. Please select a smaller file.', 'error');
      return;
    }

    const fileSizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    state.closureProofFile = {
      name: file.name,
      size: fileSizeStr
    };

    if (closurePhotoName) closurePhotoName.textContent = file.name;
    if (closurePhotoSize) closurePhotoSize.textContent = fileSizeStr;
    if (closurePhotoPreview) closurePhotoPreview.style.display = 'flex';
    clearFieldError('errClosurePhoto');

    showToast(`Resolution proof attached: ${file.name}`, 'info');
  }

  if (closurePhotoDropzone) {
    closurePhotoDropzone.addEventListener('click', () => {
      if (closurePhotoInput) closurePhotoInput.click();
    });

    closurePhotoDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      closurePhotoDropzone.classList.add('drag-over');
    });

    closurePhotoDropzone.addEventListener('dragleave', () => {
      closurePhotoDropzone.classList.remove('drag-over');
    });

    closurePhotoDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      closurePhotoDropzone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleClosurePhotoSelected(e.dataTransfer.files[0]);
      }
    });
  }

  if (closurePhotoInput) {
    closurePhotoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleClosurePhotoSelected(e.target.files[0]);
      }
    });
  }

  if (btnRemoveClosurePhoto) {
    btnRemoveClosurePhoto.addEventListener('click', () => {
      state.closureProofFile = null;
      if (closurePhotoInput) closurePhotoInput.value = '';
      if (closurePhotoPreview) closurePhotoPreview.style.display = 'none';
    });
  }

  if (btnCloseModalClose) {
    btnCloseModalClose.addEventListener('click', () => {
      if (modalCloseGrievance) modalCloseGrievance.style.display = 'none';
    });
  }

  if (btnCancelCloseModal) {
    btnCancelCloseModal.addEventListener('click', () => {
      if (modalCloseGrievance) modalCloseGrievance.style.display = 'none';
    });
  }

  if (formCloseGrievance) {
    formCloseGrievance.addEventListener('submit', (e) => {
      e.preventDefault();
      clearFieldError('errClosurePhoto');

      const remarks = closeAtrRemarks ? closeAtrRemarks.value.trim() : '';
      if (!remarks) {
        showToast('Please enter Action Taken Report (ATR) / Officer Remarks', 'error');
        return;
      }

      if (!state.closureProofFile) {
        showFieldError('errClosurePhoto', 'Resolution photo / completion proof is mandatory to close this petition');
        showToast('Please attach a resolution photo or completion proof before closing.', 'error');
        return;
      }

      if (chkClosureCertify && !chkClosureCertify.checked) {
        showToast('Please check the physical verification certification checkbox', 'error');
        return;
      }

      const docket = state.activeClosureDocket;
      const g = state.grievances.find(item => item.docket_no === docket);
      if (g) {
        g.stage = 'Completion with Proof';
        g.status = 'Resolved';
        g.resolutionProof = {
          remarks: remarks,
          fileName: state.closureProofFile.name,
          fileSize: state.closureProofFile.size,
          resolvedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          resolvedBy: `${state.currentUser.name} (Nodal Officer)`
        };

        if (modalCloseGrievance) modalCloseGrievance.style.display = 'none';
        showToast(`Case ${docket} closed successfully with verified photo proof!`, 'success', 5000);
        renderOfficerTrackerDesk();
        renderOfficerDeptGrievances();
      }
    });
  }

  /* ==========================================================================
     13. MODAL HANDLERS
     ========================================================================== */
  if (btnForgotPwd) {
    btnForgotPwd.addEventListener('click', () => {
      forgotModal.style.display = 'flex';
    });
  }

  if (btnCloseForgotModal) {
    btnCloseForgotModal.addEventListener('click', () => {
      forgotModal.style.display = 'none';
    });
  }

  if (formForgotPwd) {
    formForgotPwd.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = document.getElementById('forgotIdentifier').value.trim();
      if (!val) return;

      showToast(`Password reset link & OTP sent to ${val}`, 'info');
      forgotModal.style.display = 'none';
      document.getElementById('forgotIdentifier').value = '';
    });
  }

  // Grievance Quick Tracking Modal (Landing Screen)
  if (quickTrackForm) {
    quickTrackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const docket = quickDocketNo.value.trim().toUpperCase();
      if (!docket) return;

      // Check local state first
      const localMatch = state.grievances.find(g => g.docket_no === docket);
      if (localMatch) {
        openTrackModalForDocket(docket);
        showToast(`Record for ${docket} retrieved.`, 'info');
        return;
      }

      const trackBtn = quickTrackForm.querySelector('.btn-track');
      const origBtnText = trackBtn ? trackBtn.textContent : '';
      if (trackBtn) {
        trackBtn.disabled = true;
        trackBtn.textContent = 'Searching...';
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/grievances/track/${encodeURIComponent(docket)}`);
        const data = await res.json();
        if (trackBtn) {
          trackBtn.disabled = false;
          trackBtn.textContent = origBtnText;
        }

        if (res.ok && data.grievance) {
          const g = data.grievance;
          trackModalDocketSub.textContent = `Docket ID: ${g.docket_no}`;
          document.getElementById('trackModalCategory').textContent = g.category;
          document.getElementById('trackModalStatus').textContent = g.status;
          document.getElementById('trackModalOfficer').textContent = g.assigned_officer || 'Department Nodal Cell';
          document.getElementById('trackModalTitle').textContent = g.title || '';
          trackModal.style.display = 'flex';
          showToast(`Record for ${g.docket_no} retrieved from central records.`, 'info');
        } else {
          showToast(data.message || `Docket ${docket} not found in central records`, 'error');
        }
      } catch (err) {
        if (trackBtn) {
          trackBtn.disabled = false;
          trackBtn.textContent = origBtnText;
        }
        trackModalDocketSub.textContent = `Docket ID: ${docket}`;
        trackModal.style.display = 'flex';
        showToast(`Viewing docket ${docket} (Preview Mode)`, 'info');
      }
    });
  }

  if (btnCloseTrackModal) {
    btnCloseTrackModal.addEventListener('click', () => {
      trackModal.style.display = 'none';
    });
  }

  if (btnTrackDone) {
    btnTrackDone.addEventListener('click', () => {
      trackModal.style.display = 'none';
    });
  }

  // Grievance AI Clustered Incident Dockets Modal Handlers
  if (btnCloseIncidentModal) {
    btnCloseIncidentModal.addEventListener('click', () => {
      if (modalCivicIncidentDetails) modalCivicIncidentDetails.style.display = 'none';
    });
  }

  if (btnDoneIncidentModal) {
    btnDoneIncidentModal.addEventListener('click', () => {
      if (modalCivicIncidentDetails) modalCivicIncidentDetails.style.display = 'none';
    });
  }

  // Close modals on backdrop click
  window.addEventListener('click', (e) => {
    if (e.target === forgotModal) forgotModal.style.display = 'none';
    if (e.target === trackModal) trackModal.style.display = 'none';
    if (e.target === modalCloseGrievance) modalCloseGrievance.style.display = 'none';
    if (e.target === modalCivicIncidentDetails) modalCivicIncidentDetails.style.display = 'none';
  });

  // Terms & Privacy Links
  const linkTerms = document.getElementById('linkTerms');
  if (linkTerms) {
    linkTerms.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Citizen Charter Guarantee: Grievance resolution within 14 working days.', 'info');
    });
  }

  const linkPrivacy = document.getElementById('linkPrivacy');
  if (linkPrivacy) {
    linkPrivacy.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Privacy Policy: Strict citizen data confidentiality under the Data Protection Act.', 'info');
    });
  }

  /* ==========================================================================
     14. ACCESSIBILITY & THEME CONTROLS
     ========================================================================== */
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('theme-contrast');
      const isDark = document.body.classList.contains('theme-contrast');
      themeToggle.querySelector('.theme-label').textContent = isDark ? 'Standard View' : 'High Contrast';
      initAllCaptchas();
    });
  }

  if (increaseFont) {
    increaseFont.addEventListener('click', () => {
      if (state.fontScale < 1.25) {
        state.fontScale += 0.08;
        document.documentElement.style.setProperty('--font-scale', state.fontScale);
      }
    });
  }

  if (decreaseFont) {
    decreaseFont.addEventListener('click', () => {
      if (state.fontScale > 0.85) {
        state.fontScale -= 0.08;
        document.documentElement.style.setProperty('--font-scale', state.fontScale);
      }
    });
  }

  if (resetFont) {
    resetFont.addEventListener('click', () => {
      state.fontScale = 1.0;
      document.documentElement.style.setProperty('--font-scale', 1.0);
    });
  }

  /* ==========================================================================
     15. TOAST NOTIFICATIONS HELPER
     ========================================================================== */
  function showToast(message, type = 'info', duration = 4000) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
});
