const APP_VERSION = "0.2";

// When true: skip login/register flow and open directly on kanban (demo mode / localStorage).
// Set to false to restore auth flow.
const SKIP_LOGIN_OPEN_KANBAN = true;

const STORAGE_KEY = "trelloCloneState.v1";
const EMAIL_SETTINGS_KEY = "trelloCloneEmailSettings.v1";
const GEMINI_SETTINGS_KEY = "trelloCloneGeminiSettings.v1";
const POMODORO_SETTINGS_KEY = "trelloClonePomodoroSettings.v1";
const WORLD_CLOCK_VISIBLE_KEY = "trelloCloneWorldClockVisible.v1";
const USERS_STORAGE_KEY = "trelloCloneUsers.v1";
const CURRENT_USER_KEY = "trelloCloneCurrentUser.v1";
const DEMO_STORAGE_KEY = "trelloCloneDemoState.v1";

/**
 * State shape:
 * {
 *   boards: [{ id, name, lists: [{ id, title, cards: [{ id, title, description }] }] }],
 *   activeBoardId: string
 * }
 */
const state = {
  boards: [],
  activeBoardId: null,
};

// Current authenticated user
let currentUser = null;
// Demo mode flag
let isDemoMode = false;
// Registration in progress flag (prevents onAuthStateChanged race condition)
let isRegistering = false;
// True while sign-in is in progress (stops auth listener from showing auth screen on spurious null)
let isSigningIn = false;

// Active tag filter on current board (array of tag strings; empty = show all)
let activeTagFilter = [];

// Current tags being edited in card modal (array of strings)
let currentCardTags = [];

// ---------- Authentication (Firebase) ----------

// Register a new user with Firebase Authentication
async function registerUser(email, password, confirmPassword) {
  // Validate inputs
  if (!email || !password || !confirmPassword) {
    return { success: false, error: "All fields are required" };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Please enter a valid email address" };
  }

  // Validate password length
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters" };
  }

  // Check if passwords match
  if (password !== confirmPassword) {
    return { success: false, error: "Passwords do not match" };
  }
  if (!window.firebaseAuth || !window.firebaseDb) {
    return { success: false, error: "Sign-up is not available. Try demo mode." };
  }

  try {
    isRegistering = true;
    // Create user with Firebase Auth
    const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(
      email.toLowerCase(),
      password
    );
    const userId = userCredential.user.uid;

    // Create user document in Firestore
    await window.firebaseDb.collection('users').doc(userId).set({
      email: email.toLowerCase(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Create initial state document so initApp() (called by register button handler) finds it and avoids race
    const defaultBoardId = uid();
    await window.firebaseDb.collection('users').doc(userId).collection('data').doc('state').set({
      boards: [
        {
          id: defaultBoardId,
          name: "My first board",
          lists: [
            { id: uid(), title: "To do", cards: [] },
            { id: uid(), title: "In progress", cards: [] },
            { id: uid(), title: "Done", cards: [] },
          ],
        },
      ],
      activeBoardId: defaultBoardId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    let errorMessage = "Registration failed. Please try again.";
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = "An account with this email already exists. Use Sign in instead.";
    } else if (error.code === 'auth/weak-password') {
      errorMessage = "Password is too weak";
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = "Invalid email address";
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = "Too many attempts. Please try again later.";
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = "Network error. Check your internet connection and try again.";
    } else if (error.code === 'permission-denied') {
      errorMessage = "We couldn't set up your account: database permission denied. The app owner needs to publish Firestore rules (see FIREBASE_SETUP.md).";
    } else if (error.code === 'unavailable' || (error.message && error.message.toLowerCase().includes("unavailable"))) {
      errorMessage = "We couldn't reach the server. Check your internet connection and try again.";
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  } finally {
    isRegistering = false;
  }
}

// Send password reset email
async function sendPasswordResetEmail(email) {
  if (!email || !email.trim()) {
    return { success: false, error: "Please enter your email address" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { success: false, error: "Please enter a valid email address" };
  }
  if (!window.firebaseAuth) {
    return { success: false, error: "Password reset is not available" };
  }
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const continueUrl = typeof window !== "undefined" && window.location.origin
      ? window.location.origin + "/"
      : undefined;
    const actionCodeSettings = continueUrl
      ? { url: continueUrl, handleCodeInApp: false }
      : undefined;
    await window.firebaseAuth.sendPasswordResetEmail(normalizedEmail, actionCodeSettings);
    return { success: true };
  } catch (error) {
    let errorMessage = "Could not send reset email. Please try again.";
    if (error.code === "auth/user-not-found") {
      errorMessage = "No account found with this email address.";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "Invalid email address.";
    } else if (error.code === "auth/unauthorized-domain") {
      errorMessage = "This app domain is not authorized for password reset. Ask the app owner to add it in Firebase Console → Authentication → Authorized domains.";
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

// Login user with Firebase Authentication
async function loginUser(email, password) {
  // Validate inputs
  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }
  if (!window.firebaseAuth) {
    return { success: false, error: "Sign-in is not available. Try demo mode." };
  }

  try {
    // Sign in with Firebase Auth (listener will then call showAppContent + initApp)
    const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(
      email.toLowerCase(),
      password
    );

    currentUser = {
      uid: userCredential.user.uid,
      email: userCredential.user.email
    };

    return { success: true };
  } catch (error) {
    let errorMessage = "Invalid email or password";
    if (error.code === 'auth/user-not-found') {
      errorMessage = "No account found with this email";
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = "Incorrect password";
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = "Invalid email address";
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = "This account has been disabled";
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = "Too many attempts. Please try again later.";
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = "Network error. Check your internet connection and try again.";
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

// Logout user
function logoutUser() {
  if (isDemoMode) {
    exitDemoMode();
    return;
  }
  if (window.firebaseAuth) {
    window.firebaseAuth.signOut().catch((error) => console.error("Logout error:", error));
  }
  currentUser = null;
  isDemoMode = false;
  showAuthScreen();
}

// Get current authenticated user from Firebase
function getCurrentUser() {
  const authUser = window.firebaseAuth.currentUser;
  if (authUser) {
    return {
      uid: authUser.uid,
      email: authUser.email
    };
  }
  return null;
}

// Listen for auth state changes
function setupAuthListener() {
  window.firebaseAuth.onAuthStateChanged(async (user) => {
    // Don't interfere if in demo mode
    if (isDemoMode) {
      return;
    }

    if (user) {
      isSigningIn = false; // sign-in completed
      currentUser = {
        uid: user.uid,
        email: user.email
      };
      isDemoMode = false; // Ensure demo mode is off
      if (userEmailDisplay) {
        userEmailDisplay.textContent = user.email;
      }
      // Hide demo banner if visible
      const demoBanner = document.getElementById("demo-banner");
      if (demoBanner) {
        demoBanner.classList.add("hidden");
      }
      // During registration, defer showAppContent/initApp to the register button handler (avoids race with Firestore setup)
      if (isRegistering) {
        return;
      }
      showAppContent();
      try {
        await initApp();
      } catch (err) {
        showAppLoadError(getFriendlyLoadError(err));
      }
    } else {
      // Don't show auth screen if we're in the middle of signing in (avoids race where listener fires with null)
      if (isSigningIn) {
        return;
      }
      currentUser = null;
      isDemoMode = false;
      showAuthScreen();
    }
  });
}

// Show login panel (auth screen visible, Sign in tab active)
function showLoginScreen() {
  const authScreen = document.getElementById("auth-screen");
  const loginPanel = document.getElementById("login-screen");
  const registerPanel = document.getElementById("register-screen");
  const appContent = document.getElementById("app-content");
  const tabSignin = document.getElementById("auth-tab-signin");
  const tabSignup = document.getElementById("auth-tab-signup");
  if (authScreen) authScreen.classList.remove("hidden");
  if (loginPanel) loginPanel.classList.remove("hidden");
  if (registerPanel) registerPanel.classList.add("hidden");
  if (appContent) appContent.classList.add("hidden");
  if (tabSignin) tabSignin.classList.add("active");
  if (tabSignup) tabSignup.classList.remove("active");
}

// Show register panel (auth screen visible, Sign up tab active)
function showRegisterScreen() {
  const authScreen = document.getElementById("auth-screen");
  const loginPanel = document.getElementById("login-screen");
  const registerPanel = document.getElementById("register-screen");
  const appContent = document.getElementById("app-content");
  const tabSignin = document.getElementById("auth-tab-signin");
  const tabSignup = document.getElementById("auth-tab-signup");
  if (authScreen) authScreen.classList.remove("hidden");
  if (loginPanel) loginPanel.classList.add("hidden");
  if (registerPanel) registerPanel.classList.remove("hidden");
  if (appContent) appContent.classList.add("hidden");
  if (tabSignin) tabSignin.classList.remove("active");
  if (tabSignup) tabSignup.classList.add("active");
}

// Show auth screen (default: Sign in tab)
function showAuthScreen() {
  showLoginScreen();
}

// Show app content (board), hide auth
function showAppContent() {
  const authScreen = document.getElementById("auth-screen");
  const appContent = document.getElementById("app-content");
  if (authScreen) authScreen.classList.add("hidden");
  if (appContent) appContent.classList.remove("hidden");
}

// Check authentication status (Firebase handles this via auth state listener)
function checkAuth() {
  return currentUser !== null;
}

// ---------- Utilities ----------

function uid() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 8)
  ).toUpperCase();
}

// Firestore state management
let stateUnsubscribe = null;

async function saveState() {
  // Demo mode: save to localStorage
  if (isDemoMode) {
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Error saving demo state:", error);
    }
    return;
  }

  // Firebase mode: save to Firestore
  if (!currentUser || !currentUser.uid) {
    return;
  }

  try {
    // Save state to Firestore
    await window.firebaseDb.collection('users').doc(currentUser.uid).collection('data').doc('state').set({
      boards: state.boards,
      activeBoardId: state.activeBoardId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Trigger backup check if backup is configured
    if (backupDirectoryHandle) {
      checkAndPerformBackup().catch(err => {
        console.error("Backup check failed:", err);
      });
    }
  } catch (error) {
    console.error("Error saving state:", error);
    if (error.code === "permission-denied") {
      showFirestorePermissionBanner();
    }
  }
}

async function loadState() {
  // Demo mode: load from localStorage
  if (isDemoMode) {
    try {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.boards)) {
          state.boards = parsed.boards;
          state.activeBoardId = parsed.activeBoardId || (parsed.boards[0] && parsed.boards[0].id) || null;
        }
      }
    } catch (error) {
      console.error("Error loading demo state:", error);
    }
    return;
  }

  // Firebase mode: load from Firestore
  if (!currentUser || !currentUser.uid) {
    return;
  }

  var stateRef = window.firebaseDb.collection('users').doc(currentUser.uid).collection('data').doc('state');

  var listenerRetryCount = 0;
  var maxListenerRetries = 2;

  function attachStateListener() {
    if (stateUnsubscribe) {
      stateUnsubscribe();
    }
    stateUnsubscribe = stateRef.onSnapshot(
      (doc) => {
        // Reset retry count on successful snapshot
        listenerRetryCount = 0;
        if (doc.exists) {
          const data = doc.data();
          if (data && Array.isArray(data.boards)) {
            const newBoards = JSON.stringify(data.boards);
            const currentBoards = JSON.stringify(state.boards);
            if (newBoards !== currentBoards) {
              state.boards = data.boards;
              state.activeBoardId = data.activeBoardId || (data.boards[0] && data.boards[0].id) || null;
              render();
            }
          }
        }
      },
      async (err) => {
        console.error("Firestore snapshot error:", err && err.code, err && err.message);
        if (err && err.code === "permission-denied" && listenerRetryCount < maxListenerRetries) {
          listenerRetryCount++;
          console.log("Retrying snapshot listener after token refresh (attempt " + listenerRetryCount + ")");
          // Unsubscribe the failed listener
          if (stateUnsubscribe) {
            stateUnsubscribe();
            stateUnsubscribe = null;
          }
          // Wait and refresh token before retry
          await new Promise(function(r) { setTimeout(r, 1000); });
          if (window.firebaseAuth && window.firebaseAuth.currentUser) {
            try { await window.firebaseAuth.currentUser.getIdToken(true); } catch (_) {}
          }
          // Small additional delay after token refresh
          await new Promise(function(r) { setTimeout(r, 500); });
          attachStateListener();
        } else if (err && err.code === "permission-denied") {
          showFirestorePermissionBanner();
        }
      }
    );
  }

  async function tryLoadState() {
    const stateDoc = await stateRef.get();
    if (stateDoc.exists) {
      const data = stateDoc.data();
      if (data && Array.isArray(data.boards)) {
        state.boards = data.boards;
        state.activeBoardId = data.activeBoardId || (data.boards[0] && data.boards[0].id) || null;
      }
    }
    attachStateListener();
  }

  var lastError = null;
  var attempt = 0;
  var maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      await tryLoadState();
      break;
    } catch (error) {
      lastError = error;
      console.error("Firestore loadState error:", error && error.code, error && error.message, "path: users/" + currentUser.uid + "/data/state");
      if (error && error.code === "permission-denied" && attempt < maxAttempts - 1) {
        attempt++;
        var delay = attempt === 1 ? 800 : 1200;
        await new Promise(function (r) { setTimeout(r, delay); });
        if (window.firebaseAuth && window.firebaseAuth.currentUser) {
          try { await window.firebaseAuth.currentUser.getIdToken(true); } catch (_) {}
        }
      } else {
        if (error && error.code === "permission-denied") {
          showFirestorePermissionBanner();
        } else {
          throw error;
        }
        break;
      }
    }
  }
}

/** Return a user-friendly message when sign-in succeeded but loading the board failed */
function getFriendlyLoadError(error) {
  if (!error) return "We couldn't load your board. Please refresh the page or try again.";
  const code = error.code || "";
  const msg = (error.message || "").toLowerCase();
  if (code === "permission-denied" || msg.includes("permission")) {
    return "We couldn't load your board. Please refresh the page or try again.";
  }
  if (code === "unavailable" || msg.includes("unavailable") || msg.includes("network")) {
    return "We couldn't reach the server. Check your internet connection and try again.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network error")) {
    return "Network error. Check your connection and try again.";
  }
  return "We couldn't load your board. Please refresh the page or try again. If it keeps happening, check your connection.";
}

/** Show a dismissible banner at the top of the app when the board failed to load after sign-in */
function showAppLoadError(message) {
  var existing = document.getElementById("app-load-error-banner");
  if (existing) {
    existing.querySelector(".app-load-error-text").textContent = message;
    existing.classList.remove("hidden");
    return;
  }
  const banner = document.createElement("div");
  banner.id = "app-load-error-banner";
  banner.className = "app-load-error-banner";
  banner.style.cssText = "position:fixed;top:0;left:0;right:0;background:#b91c1c;color:#fff;padding:10px 16px;text-align:center;font-size:13px;z-index:1000;line-height:1.4;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;";
  const text = document.createElement("span");
  text.className = "app-load-error-text";
  text.textContent = message || "We couldn't load your board. Please refresh the page or try again.";
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "btn btn-ghost";
  dismiss.style.cssText = "color:#fff;border:1px solid rgba(255,255,255,0.6);padding:4px 10px;";
  dismiss.textContent = "Dismiss";
  dismiss.addEventListener("click", function () {
    banner.classList.add("hidden");
  });
  banner.appendChild(text);
  banner.appendChild(dismiss);
  document.body.appendChild(banner);
}

function showFirestorePermissionBanner() {
  if (document.getElementById("firestore-permission-banner")) return;
  const banner = document.createElement("div");
  banner.id = "firestore-permission-banner";
  banner.style.cssText = "position:fixed;top:0;left:0;right:0;background:#b91c1c;color:#fff;padding:10px 16px;text-align:center;font-size:13px;z-index:1000;line-height:1.4;";
  banner.textContent = "We couldn't load your board. Please refresh the page or try again.";
  document.body.appendChild(banner);
}

// ---------- Demo Mode ----------

async function enterDemoMode() {
  try {
    // Avoid double-entry if already in demo mode and app is visible
    const appContent = document.getElementById("app-content");
    if (isDemoMode && appContent && !appContent.classList.contains("hidden")) {
      return;
    }
    isDemoMode = true;
    currentUser = { email: "demo@example.com", uid: "demo" };

    // Show app first so user sees something immediately
    showAppContent();

    // Show demo banner
    const demoBanner = document.getElementById("demo-banner");
    if (demoBanner) {
      demoBanner.classList.remove("hidden");
    }

    // Update user display
    if (userEmailDisplay) {
      userEmailDisplay.textContent = "Demo Mode";
    }

    // Initialize app (load state, create default board if needed, render)
    await initApp();
  } catch (error) {
    console.error("Demo mode error:", error);
    isDemoMode = false;
    currentUser = null;
    showAuthScreen();
    alert("Could not start demo mode: " + (error.message || String(error)));
  }
}

// Expose for inline onclick (must be set before any code that might throw)
window.enterDemoMode = enterDemoMode;

function exitDemoMode() {
  isDemoMode = false;
  currentUser = null;
  
  const demoBanner = document.getElementById("demo-banner");
  if (demoBanner) {
    demoBanner.classList.add("hidden");
  }
  
  if (confirm("Clear demo data? Your current board data will be reset.")) {
    localStorage.removeItem(DEMO_STORAGE_KEY);
  }
  
  // Stay on board – re-enter demo mode (login flow disabled)
  enterDemoMode();
}

function getActiveBoard() {
  return state.boards.find((b) => b.id === state.activeBoardId) || null;
}

/** Returns unique tag strings from all cards on the board */
function getBoardTags(board) {
  if (!board || !board.lists) return [];
  const set = new Set();
  board.lists.forEach((list) => {
    (list.cards || []).forEach((card) => {
      (card.tags || []).forEach((t) => {
        const tag = String(t).trim();
        if (tag) set.add(tag);
      });
    });
  });
  return Array.from(set).sort();
}

/** Render tag chips in card modal; currentCardTags is the source of truth */
function renderCardTagChips() {
  if (!cardTagsChips) return;
  cardTagsChips.innerHTML = "";
  currentCardTags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = tag;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "tag-chip-remove";
    remove.setAttribute("aria-label", "Remove tag");
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      currentCardTags = currentCardTags.filter((t) => t !== tag);
      renderCardTagChips();
    });
    chip.appendChild(remove);
    cardTagsChips.appendChild(chip);
  });
}

/** Render filter bar: all board tags as toggle chips + Clear */
function renderFilterBar() {
  const board = getActiveBoard();
  if (!filterBar || !filterTagsContainer || !filterClearBtn) return;

  const tags = getBoardTags(board);
  if (tags.length === 0) {
    filterBar.classList.add("hidden");
    return;
  }
  filterBar.classList.remove("hidden");

  filterTagsContainer.innerHTML = "";
  tags.forEach((tag) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "filter-tag";
    if (activeTagFilter.includes(tag)) chip.classList.add("active");
    chip.textContent = tag;
    chip.addEventListener("click", () => {
      if (activeTagFilter.includes(tag)) {
        activeTagFilter = activeTagFilter.filter((t) => t !== tag);
      } else {
        activeTagFilter = [...activeTagFilter, tag];
      }
      render();
    });
    filterTagsContainer.appendChild(chip);
  });

  if (activeTagFilter.length > 0) {
    filterClearBtn.classList.remove("hidden");
  } else {
    filterClearBtn.classList.add("hidden");
  }
}

// ---------- Backup Management ----------

const BACKUP_DB_NAME = "trelloBackupDB";
const BACKUP_DB_VERSION = 1;
const BACKUP_STORE_NAME = "backupHandle";
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LAST_BACKUP_KEY = "trelloLastBackup";

let backupDirectoryHandle = null;

// Initialize IndexedDB for storing directory handle
async function initBackupDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_DB_NAME, BACKUP_DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
        db.createObjectStore(BACKUP_STORE_NAME);
      }
    };
  });
}

// Load directory handle from IndexedDB
async function loadBackupDirectory() {
  try {
    if (!backupStatus || !backupFolderBtn) return null;
    if (!('showDirectoryPicker' in window)) {
      backupStatus.textContent = "⚠️ Not supported";
      backupStatus.classList.add("pending");
      backupFolderBtn.disabled = true;
      return null;
    }

    const db = await initBackupDB();
    const transaction = db.transaction([BACKUP_STORE_NAME], "readonly");
    const store = transaction.objectStore(BACKUP_STORE_NAME);
    const request = store.get("directoryHandle");
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const handle = request.result;
        if (handle) {
          backupDirectoryHandle = handle;
          updateBackupStatus();
          resolve(handle);
        } else {
          backupStatus.textContent = "No folder selected";
          backupStatus.classList.remove("active", "pending");
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error("Failed to load backup directory:", error);
    backupStatus.textContent = "Error loading";
    backupStatus.classList.add("pending");
    return null;
  }
}

// Save directory handle to IndexedDB
async function saveBackupDirectory(handle) {
  try {
    const db = await initBackupDB();
    const transaction = db.transaction([BACKUP_STORE_NAME], "readwrite");
    const store = transaction.objectStore(BACKUP_STORE_NAME);
    await store.put(handle, "directoryHandle");
    backupDirectoryHandle = handle;
    updateBackupStatus();
  } catch (error) {
    console.error("Failed to save backup directory:", error);
    alert("Failed to save backup folder selection.");
  }
}

// Select backup directory
async function selectBackupDirectory() {
  try {
    if (!('showDirectoryPicker' in window)) {
      alert("File System Access API is not supported in your browser. Please use Chrome, Edge, or Opera.");
      return;
    }

    const handle = await window.showDirectoryPicker({
      mode: "readwrite",
      startIn: "documents",
    });
    
    await saveBackupDirectory(handle);
    alert("Backup folder selected! Automatic daily backups are now enabled.");
    
    // Perform immediate backup
    await performBackup();
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Failed to select backup directory:", error);
      alert("Failed to select backup folder. Please try again.");
    }
  }
}

// Update backup status display
function updateBackupStatus() {
  if (!backupStatus) return;
  if (!backupDirectoryHandle) {
    backupStatus.textContent = "No folder";
    backupStatus.classList.remove("active", "pending");
    return;
  }

  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  if (lastBackup) {
    const lastBackupTime = new Date(parseInt(lastBackup));
    const now = new Date();
    const hoursSinceBackup = (now - lastBackupTime) / (1000 * 60 * 60);
    
    if (hoursSinceBackup < 24) {
      const hoursAgo = Math.floor(hoursSinceBackup);
      backupStatus.textContent = `✓ Backed up ${hoursAgo}h ago`;
      backupStatus.classList.add("active");
      backupStatus.classList.remove("pending");
    } else {
      backupStatus.textContent = "⚠️ Backup due";
      backupStatus.classList.add("pending");
      backupStatus.classList.remove("active");
    }
  } else {
    backupStatus.textContent = "✓ Ready";
    backupStatus.classList.add("active");
    backupStatus.classList.remove("pending");
  }
}

// Perform backup to selected directory
async function performBackup() {
  if (!backupDirectoryHandle) {
    return false;
  }

  try {
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      boards: state.boards,
      activeBoardId: state.activeBoardId,
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const filename = `trello-backup-${timestamp}.json`;
    
    // Create or get file handle
    const fileHandle = await backupDirectoryHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(jsonString);
    await writable.close();
    
    // Update last backup time
    localStorage.setItem(LAST_BACKUP_KEY, Date.now().toString());
    updateBackupStatus();
    
    console.log(`Backup saved: ${filename}`);
    return true;
  } catch (error) {
    console.error("Backup failed:", error);
    backupStatus.textContent = "✗ Backup failed";
    backupStatus.classList.add("pending");
    backupStatus.classList.remove("active");
    return false;
  }
}

// Check if backup is due and perform it
async function checkAndPerformBackup() {
  if (!backupDirectoryHandle) {
    return;
  }

  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  if (!lastBackup) {
    // First backup
    await performBackup();
    return;
  }

  const lastBackupTime = parseInt(lastBackup);
  const now = Date.now();
  const timeSinceLastBackup = now - lastBackupTime;

  if (timeSinceLastBackup >= BACKUP_INTERVAL_MS) {
    await performBackup();
  }
}

// Clean up old backups (keep last 30 days)
async function cleanupOldBackups() {
  if (!backupDirectoryHandle) {
    return;
  }

  try {
    const files = [];
    for await (const [name, handle] of backupDirectoryHandle.entries()) {
      if (handle.kind === "file" && name.startsWith("trello-backup-") && name.endsWith(".json")) {
        const file = await handle.getFile();
        files.push({
          name,
          handle,
          date: file.lastModified,
        });
      }
    }

    // Sort by date (newest first)
    files.sort((a, b) => b.date - a.date);

    // Keep last 30 backups, delete older ones
    const keepCount = 30;
    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      for (const file of toDelete) {
        try {
          await backupDirectoryHandle.removeEntry(file.name);
          console.log(`Deleted old backup: ${file.name}`);
        } catch (error) {
          console.error(`Failed to delete ${file.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Failed to cleanup old backups:", error);
  }
}

// ---------- Email Functionality ----------

async function getEmailSettings() {
  // Demo mode: use localStorage
  if (isDemoMode) {
    try {
      const raw = localStorage.getItem(`${DEMO_STORAGE_KEY}_emailSettings`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (error) {
      console.error("Error loading demo email settings:", error);
    }
    return { defaultRecipient: "" };
  }

  if (!currentUser || !currentUser.uid) {
    return { defaultRecipient: "" };
  }

  try {
    const settingsDoc = await window.firebaseDb.collection('users').doc(currentUser.uid).collection('data').doc('emailSettings').get();
    if (settingsDoc.exists) {
      return settingsDoc.data();
    }
  } catch (error) {
    console.error("Error loading email settings:", error);
  }
  return { defaultRecipient: "" };
}

async function saveEmailSettings(settings) {
  // Demo mode: use localStorage
  if (isDemoMode) {
    try {
      localStorage.setItem(`${DEMO_STORAGE_KEY}_emailSettings`, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving demo email settings:", error);
    }
    return;
  }

  if (!currentUser || !currentUser.uid) {
    return;
  }

  try {
    await window.firebaseDb.collection('users').doc(currentUser.uid).collection('data').doc('emailSettings').set(settings);
  } catch (error) {
    console.error("Error saving email settings:", error);
  }
}

// ---------- Gemini Settings ----------

async function getGeminiSettings() {
  // Demo mode: use localStorage
  if (isDemoMode) {
    try {
      const raw = localStorage.getItem(`${DEMO_STORAGE_KEY}_geminiSettings`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (error) {
      console.error("Error loading demo Gemini settings:", error);
    }
    return { apiKey: "" };
  }

  if (!currentUser || !currentUser.uid) {
    return { apiKey: "" };
  }

  try {
    const settingsDoc = await window.firebaseDb.collection('users').doc(currentUser.uid).collection('data').doc('geminiSettings').get();
    if (settingsDoc.exists) {
      return settingsDoc.data();
    }
  } catch (error) {
    console.error("Error loading Gemini settings:", error);
  }
  return { apiKey: "" };
}

async function saveGeminiSettings(settings) {
  // Demo mode: use localStorage
  if (isDemoMode) {
    try {
      localStorage.setItem(`${DEMO_STORAGE_KEY}_geminiSettings`, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving demo Gemini settings:", error);
    }
    return;
  }

  if (!currentUser || !currentUser.uid) {
    return;
  }

  try {
    await window.firebaseDb.collection('users').doc(currentUser.uid).collection('data').doc('geminiSettings').set(settings);
  } catch (error) {
    console.error("Error saving Gemini settings:", error);
  }
}

// ---------- Gemini API Integration ----------

async function parseTranscriptWithGemini(transcript) {
  const settings = await getGeminiSettings();
  const apiKey = settings.apiKey?.trim();
  
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Please set it in Settings.");
  }

  const prompt = `You are a task extraction assistant. Analyze the following transcript and extract actionable tasks or items that should become kanban cards.

For each task/item you identify, provide:
- A clear, concise title (max 50 characters)
- A description with relevant details from the transcript

Return your response as a JSON array of objects with this exact structure:
[
  {
    "title": "Task title here",
    "description": "Task description with relevant details"
  }
]

If no clear tasks are found, return an empty array: []

Transcript:
${transcript}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from the response (handle cases where Gemini adds markdown formatting)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }
    
    const tasks = JSON.parse(jsonText);
    
    if (!Array.isArray(tasks)) {
      throw new Error("Invalid response format from Gemini");
    }
    
    return tasks;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Failed to parse Gemini response. Please try again.");
    }
    throw error;
  }
}

async function createCardsFromTranscript(transcript) {
  const board = getActiveBoard();
  if (!board) {
    alert("Please select a board first.");
    return;
  }

  if (!board.lists || board.lists.length === 0) {
    alert("Please create at least one list on this board first.");
    return;
  }

  try {
    // Show loading state
    transcriptProcessBtn.disabled = true;
    transcriptProcessBtn.textContent = "Processing...";
    
    const tasks = await parseTranscriptWithGemini(transcript);
    
    if (tasks.length === 0) {
      alert("No tasks were found in the transcript.");
      return;
    }

    // Use the first list as the default list for new cards
    const defaultList = board.lists[0];
    
    // Create cards from parsed tasks
    tasks.forEach(task => {
      if (task.title && task.title.trim()) {
        defaultList.cards.push({
          id: uid(),
          title: task.title.trim(),
          description: task.description?.trim() || "",
          priority: "p2",
          tags: [],
        });
      }
    });

    render();
    alert(`Successfully created ${tasks.length} card(s) from transcript!`);
    
    // Close modal and reset
    transcriptInput.value = "";
    closeModal(transcriptModal);
  } catch (error) {
    console.error("Error processing transcript:", error);
    alert(`Error: ${error.message}`);
  } finally {
    transcriptProcessBtn.disabled = false;
    transcriptProcessBtn.textContent = "Create Cards";
  }
}

async function openEmailModal(card, list, board) {
  const settings = await getEmailSettings();
  emailRecipientInput.value = settings.defaultRecipient || "";
  const priorityLabel = { p0: "P0 Critical", p1: "P1 High", p2: "P2 Medium", p3: "P3 Low", p4: "P4 Lowest" }[card.priority || "p2"] || "P2 Medium";
  emailPreviewTitle.textContent = card.title || "(No title)";
  if (emailPreviewPriority) emailPreviewPriority.textContent = priorityLabel;
  emailPreviewDescription.textContent = card.description || "(No description)";
  emailPreviewList.textContent = list.title || "(Unknown list)";
  emailPreviewBoard.textContent = board.name || "(Unknown board)";
  openModal(emailModal);
  emailRecipientInput.focus();
}

async function sendTaskEmail() {
  const recipient = emailRecipientInput.value.trim();
  if (!recipient) {
    alert("Please enter a recipient email address");
    emailRecipientInput.focus();
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipient)) {
    alert("Please enter a valid email address");
    emailRecipientInput.focus();
    return;
  }

  if (!emailCardContext) return;

  const { boardId, listId, cardId } = emailCardContext;
  const board = state.boards.find((b) => b.id === boardId);
  if (!board) return;
  const list = board.lists.find((l) => l.id === listId);
  if (!list) return;
  const card = list.cards.find((c) => c.id === cardId);
  if (!card) return;

  // Save recipient as default for next time
  const settings = await getEmailSettings();
  settings.defaultRecipient = recipient;
  await saveEmailSettings(settings);

  const priorityLabel = { p0: "P0 Critical", p1: "P1 High", p2: "P2 Medium", p3: "P3 Low", p4: "P4 Lowest" }[card.priority || "p2"] || "P2 Medium";
  const subject = encodeURIComponent(`Task: ${card.title}`);
  const body = encodeURIComponent(
    `Task Details:\n\n` +
    `Title: ${card.title}\n` +
    `Priority: ${priorityLabel}\n` +
    `Description: ${card.description || "(No description)"}\n` +
    `List: ${list.title}\n` +
    `Board: ${board.name}\n\n` +
    `---\n` +
    `This task was sent from your Trello Clone board.`
  );

  // Create mailto link
  const mailtoLink = `mailto:${recipient}?subject=${subject}&body=${body}`;
  
  // Open email client
  window.location.href = mailtoLink;

  // Close modal
  emailCardContext = null;
  closeModal(emailModal);
}

// ---------- Export / Import ----------

function exportBoards() {
  try {
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      boards: state.boards,
      activeBoardId: state.activeBoardId,
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `trello-boards-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export failed:", error);
    alert("Failed to export boards. Please try again.");
  }
}

function importBoards() {
  importFileInput.click();
}

function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      
      // Validate the imported data structure
      if (!importedData || !Array.isArray(importedData.boards)) {
        throw new Error("Invalid file format");
      }
      
      // Ask user if they want to replace or merge
      const replace = confirm(
        "Import boards?\n\n" +
        "OK = Replace all current boards\n" +
        "Cancel = Merge with existing boards"
      );
      
      if (replace) {
        // Replace all boards
        state.boards = importedData.boards;
        state.activeBoardId = importedData.activeBoardId || 
          (importedData.boards[0] && importedData.boards[0].id) || 
          null;
      } else {
        // Merge boards (add imported boards to existing ones)
        importedData.boards.forEach(board => {
          // Generate new IDs for imported boards to avoid conflicts
          const newBoardId = uid();
          
          // Update list IDs
          board.lists.forEach(list => {
            const newListId = uid();
            list.id = newListId;
            
            // Update card IDs
            list.cards.forEach(card => {
              card.id = uid();
            });
          });
          
          board.id = newBoardId;
          state.boards.push(board);
        });
        
        // Set active board to first imported board if no active board exists
        if (!state.activeBoardId && importedData.boards.length > 0) {
          state.activeBoardId = state.boards[state.boards.length - 1].id;
        }
      }
      
      // Reset file input
      importFileInput.value = "";
      
      render();
      alert(`Successfully imported ${importedData.boards.length} board(s)!`);
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import boards. Please check that the file is a valid JSON export.");
      importFileInput.value = "";
    }
  };
  
  reader.onerror = () => {
    alert("Failed to read the file. Please try again.");
    importFileInput.value = "";
  };
  
  reader.readAsText(file);
}

// ---------- DOM Refs ----------

// Auth elements
const loginScreen = document.getElementById("login-screen");
const registerScreen = document.getElementById("register-screen");
const loginEmailInput = document.getElementById("login-email-input");
const loginPasswordInput = document.getElementById("login-password-input");
const registerEmailInput = document.getElementById("register-email-input");
const registerPasswordInput = document.getElementById("register-password-input");
const registerConfirmPasswordInput = document.getElementById("register-confirm-password-input");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const goToLoginBtn = document.getElementById("go-to-login-btn");
const goToRegisterBtn = document.getElementById("go-to-register-btn");
const demoBtn = document.getElementById("demo-btn");
const demoBtnRegister = document.getElementById("demo-btn-register");
const loginError = document.getElementById("login-error");
const registerError = document.getElementById("register-error");
const logoutBtn = document.getElementById("logout-btn");
const userEmailDisplay = document.getElementById("user-email-display");

const boardContainer = document.getElementById("board-container");
const boardSelect = document.getElementById("board-select");
const currentBoardName = document.getElementById("current-board-name");
const addBoardBtn = document.getElementById("add-board-btn");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFileInput = document.getElementById("import-file-input");
const backupFolderBtn = document.getElementById("backup-folder-btn");
const backupStatus = document.getElementById("backup-status");

// Modals
const backdrop = document.getElementById("modal-backdrop");

const boardModal = document.getElementById("board-modal");
const boardModalTitle = document.getElementById("board-modal-title");
const boardNameInput = document.getElementById("board-name-input");
const boardCancelBtn = document.getElementById("board-cancel-btn");
const boardSaveBtn = document.getElementById("board-save-btn");

const listModal = document.getElementById("list-modal");
const listModalTitle = document.getElementById("list-modal-title");
const listTitleInput = document.getElementById("list-title-input");
const listCancelBtn = document.getElementById("list-cancel-btn");
const listSaveBtn = document.getElementById("list-save-btn");

const cardModal = document.getElementById("card-modal");
const cardModalTitle = document.getElementById("card-modal-title");
const cardTitleInput = document.getElementById("card-title-input");
const cardDescriptionInput = document.getElementById("card-description-input");
const cardPriorityInput = document.getElementById("card-priority-input");
const cardTagsChips = document.getElementById("card-tags-chips");
const cardTagInput = document.getElementById("card-tag-input");
const cardCancelBtn = document.getElementById("card-cancel-btn");
const cardSaveBtn = document.getElementById("card-save-btn");

const filterBar = document.getElementById("filter-bar");
const filterTagsContainer = document.getElementById("filter-tags-container");
const filterClearBtn = document.getElementById("filter-clear-btn");

const emailModal = document.getElementById("email-modal");
const emailRecipientInput = document.getElementById("email-recipient-input");
const emailPreviewTitle = document.getElementById("email-preview-title");
const emailPreviewPriority = document.getElementById("email-preview-priority");
const emailPreviewDescription = document.getElementById("email-preview-description");
const emailPreviewList = document.getElementById("email-preview-list");
const emailPreviewBoard = document.getElementById("email-preview-board");
const emailCancelBtn = document.getElementById("email-cancel-btn");
const emailSendBtn = document.getElementById("email-send-btn");
const emailSettingsBtn = document.getElementById("email-settings-btn");

const transcriptModal = document.getElementById("transcript-modal");
const transcriptInput = document.getElementById("transcript-input");
const transcriptCancelBtn = document.getElementById("transcript-cancel-btn");
const transcriptProcessBtn = document.getElementById("transcript-process-btn");
const transcriptBtn = document.getElementById("transcript-btn");

const settingsModal = document.getElementById("settings-modal");
const geminiApiKeyInput = document.getElementById("gemini-api-key-input");
const settingsCancelBtn = document.getElementById("settings-cancel-btn");
const settingsSaveBtn = document.getElementById("settings-save-btn");
const settingsBtn = document.getElementById("settings-btn");

const pomodoroModal = document.getElementById("pomodoro-modal");
const pomodoroPhaseEl = document.getElementById("pomodoro-phase");
const pomodoroTimeEl = document.getElementById("pomodoro-time");
const pomodoroWidget = document.getElementById("pomodoro-widget");
const pomodoroStartPauseBtn = document.getElementById("pomodoro-start-pause");
const pomodoroResetBtn = document.getElementById("pomodoro-reset");
const pomodoroSettingsBtn = document.getElementById("pomodoro-settings-btn");
const pomodoroWorkMinutesInput = document.getElementById("pomodoro-work-minutes");
const pomodoroRestMinutesInput = document.getElementById("pomodoro-rest-minutes");
const pomodoroModalCancelBtn = document.getElementById("pomodoro-modal-cancel");
const pomodoroModalSaveBtn = document.getElementById("pomodoro-modal-save");

const resetPasswordModal = document.getElementById("reset-password-modal");
const resetPasswordEmailInput = document.getElementById("reset-password-email-input");
const resetPasswordMessage = document.getElementById("reset-password-message");
const resetPasswordSendBtn = document.getElementById("reset-password-send-btn");
const resetPasswordCancelBtn = document.getElementById("reset-password-cancel-btn");
const forgotPasswordBtn = document.getElementById("forgot-password-btn");

// Context for editing
let editingBoardId = null;
let editingListId = null;
let editingCardContext = null; // { boardId, listId, cardId | null }
let emailCardContext = null; // { boardId, listId, cardId }

// ---------- Modal Helpers ----------

function openModal(modal) {
  backdrop.classList.remove("hidden");
  modal.classList.remove("hidden");
  if (modal === resetPasswordModal) {
    backdrop.classList.add("modal-over-auth");
    modal.classList.add("modal-over-auth");
  }
}

function closeModal(modal) {
  modal.classList.add("hidden");
  if (modal === resetPasswordModal) {
    backdrop.classList.remove("modal-over-auth");
    modal.classList.remove("modal-over-auth");
  }
  // hide backdrop if all modals closed
  if (boardModal.classList.contains("hidden") &&
      listModal.classList.contains("hidden") &&
      cardModal.classList.contains("hidden") &&
      emailModal.classList.contains("hidden") &&
      transcriptModal.classList.contains("hidden") &&
      settingsModal.classList.contains("hidden") &&
      (pomodoroModal && pomodoroModal.classList.contains("hidden")) &&
      (resetPasswordModal && resetPasswordModal.classList.contains("hidden"))) {
    backdrop.classList.add("hidden");
    backdrop.classList.remove("modal-over-auth");
  }
}

// ---------- Render ----------

function render() {
  renderBoardSelect();
  renderBoard();
  saveState();
}

function renderBoardSelect() {
  boardSelect.innerHTML = "";

  if (state.boards.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No boards yet";
    boardSelect.appendChild(opt);
    boardSelect.disabled = true;
    currentBoardName.textContent = "";
    return;
  }

  boardSelect.disabled = false;
  state.boards.forEach((board) => {
    const opt = document.createElement("option");
    opt.value = board.id;
    opt.textContent = board.name;
    if (board.id === state.activeBoardId) {
      opt.selected = true;
    }
    boardSelect.appendChild(opt);
  });

  const active = getActiveBoard();
  currentBoardName.textContent = active ? active.name : "";
}

function renderBoard() {
  boardContainer.innerHTML = "";
  const board = getActiveBoard();

  if (!board) {
    const msg = document.createElement("div");
    msg.className = "board-empty-message";
    msg.textContent = "Create a board to get started.";
    boardContainer.appendChild(msg);
    return;
  }

  renderFilterBar();

  const cardMatchesFilter = (card) => {
    if (activeTagFilter.length === 0) return true;
    const tags = card.tags || [];
    return tags.some((t) => activeTagFilter.includes(String(t).trim()));
  };

  board.lists.forEach((list) => {
    const listEl = document.createElement("section");
    listEl.className = "list";
    listEl.dataset.listId = list.id;

    const header = document.createElement("header");
    header.className = "list-header";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = list.title;

    const actions = document.createElement("div");
    actions.className = "list-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.innerHTML = "✎";
    editBtn.title = "Rename list";
    editBtn.addEventListener("click", () => {
      editingListId = list.id;
      listModalTitle.textContent = "Rename list";
      listTitleInput.value = list.title;
      openModal(listModal);
      listTitleInput.focus();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.innerHTML = "✕";
    delBtn.title = "Delete list";
    delBtn.addEventListener("click", () => {
      if (!confirm("Delete this list and all its cards?")) return;
      const b = getActiveBoard();
      b.lists = b.lists.filter((l) => l.id !== list.id);
      render();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    header.appendChild(title);
    header.appendChild(actions);

    const cardList = document.createElement("div");
    cardList.className = "card-list drop-zone";
    cardList.dataset.listId = list.id;

    const cardsToShow = list.cards.filter(cardMatchesFilter);

    cardsToShow.forEach((card) => {
      const cardEl = document.createElement("article");
      cardEl.className = "card";
      cardEl.draggable = true;
      cardEl.dataset.cardId = card.id;
      cardEl.dataset.listId = list.id;

      const priority = card.priority || "p2";
      cardEl.dataset.priority = priority;

      const headerRow = document.createElement("div");
      headerRow.className = "card-header-row";
      const titleEl = document.createElement("div");
      titleEl.className = "card-title";
      titleEl.textContent = card.title;
      const priorityBadge = document.createElement("span");
      priorityBadge.className = "card-priority card-priority--" + priority;
      priorityBadge.textContent = "P" + priority.slice(1);
      priorityBadge.title = { p0: "Critical", p1: "High", p2: "Medium", p3: "Low", p4: "Lowest" }[priority] || "Medium";
      headerRow.appendChild(titleEl);
      headerRow.appendChild(priorityBadge);
      cardEl.appendChild(headerRow);

      if (card.description && card.description.trim()) {
        const descEl = document.createElement("div");
        descEl.className = "card-description";
        descEl.textContent = card.description;
        cardEl.appendChild(descEl);
      }

      const cardTags = card.tags || [];
      if (cardTags.length > 0) {
        const tagsWrap = document.createElement("div");
        tagsWrap.className = "card-tags";
        cardTags.forEach((t) => {
          const tagChip = document.createElement("span");
          tagChip.className = "card-tag";
          tagChip.textContent = String(t).trim();
          tagsWrap.appendChild(tagChip);
        });
        cardEl.appendChild(tagsWrap);
      }

      const footer = document.createElement("div");
      footer.className = "card-footer";

      const editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.innerHTML = "✎";
      editBtn.title = "Edit card";
      editBtn.addEventListener("click", () => {
        editingCardContext = {
          boardId: board.id,
          listId: list.id,
          cardId: card.id,
        };
        cardModalTitle.textContent = "Edit card";
        cardTitleInput.value = card.title;
        cardDescriptionInput.value = card.description || "";
        cardPriorityInput.value = card.priority || "p2";
        currentCardTags = (card.tags && card.tags.length) ? [...card.tags] : [];
        renderCardTagChips();
        if (cardTagInput) cardTagInput.value = "";
        openModal(cardModal);
        cardTitleInput.focus();
      });

      const emailBtn = document.createElement("button");
      emailBtn.className = "icon-btn";
      emailBtn.innerHTML = "✉";
      emailBtn.title = "Email task";
      emailBtn.addEventListener("click", () => {
        emailCardContext = {
          boardId: board.id,
          listId: list.id,
          cardId: card.id,
        };
        openEmailModal(card, list, board);
      });

      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn";
      delBtn.innerHTML = "✕";
      delBtn.title = "Delete card";
      delBtn.addEventListener("click", () => {
        if (!confirm("Delete this card?")) return;
        const b = getActiveBoard();
        const listRef = b.lists.find((l) => l.id === list.id);
        listRef.cards = listRef.cards.filter((c) => c.id !== card.id);
        render();
      });

      footer.appendChild(editBtn);
      footer.appendChild(emailBtn);
      footer.appendChild(delBtn);
      cardEl.appendChild(footer);

      setupCardDragEvents(cardEl);
      cardList.appendChild(cardEl);
    });

    const addCardBtn = document.createElement("button");
    addCardBtn.className = "btn add-card-btn";
    addCardBtn.textContent = "+ Add card";
    addCardBtn.addEventListener("click", () => {
      editingCardContext = {
        boardId: board.id,
        listId: list.id,
        cardId: null,
      };
      cardModalTitle.textContent = "New card";
      cardTitleInput.value = "";
      cardDescriptionInput.value = "";
      cardPriorityInput.value = "p2";
      currentCardTags = [];
      renderCardTagChips();
      if (cardTagInput) cardTagInput.value = "";
      openModal(cardModal);
      cardTitleInput.focus();
    });

    setupDropZone(cardList);

    listEl.appendChild(header);
    listEl.appendChild(cardList);
    listEl.appendChild(addCardBtn);

    boardContainer.appendChild(listEl);
  });

  // Add-list column
  const addListCol = document.createElement("section");
  addListCol.className = "add-list-column";

  const addListBtn = document.createElement("button");
  addListBtn.className = "btn add-list-button";
  addListBtn.textContent = "+ Add list";
  addListBtn.addEventListener("click", () => {
    editingListId = null;
    listModalTitle.textContent = "New list";
    listTitleInput.value = "";
    openModal(listModal);
    listTitleInput.focus();
  });

  addListCol.appendChild(addListBtn);
  boardContainer.appendChild(addListCol);
}

// ---------- Drag and Drop ----------

let draggedCard = null;

function setupCardDragEvents(cardEl) {
  cardEl.addEventListener("dragstart", (e) => {
    draggedCard = cardEl;
    cardEl.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });

  cardEl.addEventListener("dragend", () => {
    if (draggedCard) {
      draggedCard.classList.remove("dragging");
    }
    draggedCard = null;
    document
      .querySelectorAll(".drop-zone.active")
      .forEach((el) => el.classList.remove("active"));
  });
}

function setupDropZone(zone) {
  zone.addEventListener("dragover", (e) => {
    if (!draggedCard) return;
    e.preventDefault();
    zone.classList.add("active");

    const afterElement = getDragAfterElement(zone, e.clientY);
    if (!afterElement) {
      zone.appendChild(draggedCard);
    } else {
      zone.insertBefore(draggedCard, afterElement);
    }
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("active");
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("active");
    if (!draggedCard) return;

    const sourceListId = draggedCard.dataset.listId;
    const cardId = draggedCard.dataset.cardId;
    const targetListId = zone.dataset.listId;
    if (!targetListId) return;

    const board = getActiveBoard();
    const sourceList = board.lists.find((l) => l.id === sourceListId);
    const targetList = board.lists.find((l) => l.id === targetListId);
    if (!sourceList || !targetList) return;

    const cardIndex = sourceList.cards.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;

    const [card] = sourceList.cards.splice(cardIndex, 1);

    // compute new index from DOM
    const children = Array.from(zone.querySelectorAll(".card"));
    const newIndex = children.findIndex((el) => el.dataset.cardId === cardId);
    if (newIndex === -1 || newIndex >= targetList.cards.length) {
      targetList.cards.push(card);
    } else {
      targetList.cards.splice(newIndex, 0, card);
    }

    render();
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".card:not(.dragging)"),
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

// ---------- Auth Events ----------

// Resolve id from clicked element (clicking button text can make e.target a child without id)
function getClickedId(e) {
  const el = e.target && e.target.closest ? e.target.closest("[id]") : e.target;
  return el ? el.id : null;
}

document.addEventListener("click", async (e) => {
  const id = getClickedId(e);
  if (!id) return;

  if (id === "go-to-register-btn" || id === "auth-tab-signup") {
    e.preventDefault();
    showRegisterScreen();
    return;
  }
  if (id === "go-to-login-btn" || id === "auth-tab-signin") {
    e.preventDefault();
    showLoginScreen();
    return;
  }
  if (id === "demo-btn" || id === "demo-btn-register") {
    e.preventDefault();
    e.stopPropagation();
    try {
      await enterDemoMode();
    } catch (err) {
      console.error("Demo mode error:", err);
      alert("Could not start demo mode: " + (err && err.message ? err.message : String(err)));
      showAuthScreen();
    }
    return;
  }
  if (id === "forgot-password-btn") {
    e.preventDefault();
    const emailEl = document.getElementById("login-email-input");
    const resetEmailEl = document.getElementById("reset-password-email-input");
    const resetMsgEl = document.getElementById("reset-password-message");
    if (resetEmailEl) resetEmailEl.value = emailEl ? emailEl.value.trim() : "";
    if (resetMsgEl) {
      resetMsgEl.textContent = "";
      resetMsgEl.classList.add("hidden");
      resetMsgEl.classList.remove("auth-error", "auth-success");
    }
    openModal(resetPasswordModal);
    if (resetEmailEl) resetEmailEl.focus();
    return;
  }
  if (id === "login-btn") {
    e.preventDefault();
    const emailEl = document.getElementById("login-email-input");
    const passwordEl = document.getElementById("login-password-input");
    const errEl = document.getElementById("login-error");
    const email = emailEl ? emailEl.value.trim() : "";
    const password = passwordEl ? passwordEl.value : "";
    if (errEl) {
      errEl.textContent = "";
      errEl.classList.add("hidden");
    }
    isSigningIn = true;
    try {
      const result = await loginUser(email, password);
      if (result.success) {
        try {
          showAppContent();
          await initApp();
        } catch (loadErr) {
          var loadBanner = document.getElementById("app-load-error-banner");
          if (loadBanner) loadBanner.classList.add("hidden");
          showAuthScreen();
          showLoginScreen();
          if (errEl) {
            errEl.textContent = getFriendlyLoadError(loadErr);
            errEl.classList.remove("hidden");
          }
        }
      } else if (errEl) {
        errEl.textContent = result.error;
        errEl.classList.remove("hidden");
      }
    } finally {
      // Clear after a short delay so any delayed auth listener callback doesn't override
      setTimeout(function () { isSigningIn = false; }, 500);
    }
    return;
  }
  if (id === "register-btn") {
    e.preventDefault();
    const emailEl = document.getElementById("register-email-input");
    const passwordEl = document.getElementById("register-password-input");
    const confirmEl = document.getElementById("register-confirm-password-input");
    const errEl = document.getElementById("register-error");
    const email = emailEl ? emailEl.value.trim() : "";
    const password = passwordEl ? passwordEl.value : "";
    const confirmPassword = confirmEl ? confirmEl.value : "";
    if (errEl) {
      errEl.textContent = "";
      errEl.classList.add("hidden");
    }
    const result = await registerUser(email, password, confirmPassword);
    if (result.success) {
      const loginResult = await loginUser(email, password);
      if (loginResult.success) {
        try {
          showAppContent();
          await initApp();
        } catch (loadErr) {
          var loadBanner = document.getElementById("app-load-error-banner");
          if (loadBanner) loadBanner.classList.add("hidden");
          showAuthScreen();
          showRegisterScreen();
          if (errEl) {
            errEl.textContent = getFriendlyLoadError(loadErr);
            errEl.classList.remove("hidden");
          }
        }
      } else if (errEl) {
        errEl.textContent = loginResult.error;
        errEl.classList.remove("hidden");
      }
    } else if (errEl) {
      errEl.textContent = result.error;
      errEl.classList.remove("hidden");
    }
    return;
  }
});

// Enter key: submit login or register when in auth form
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const target = e.target;
  if (target && (target.id === "login-email-input" || target.id === "login-password-input")) {
    document.getElementById("login-btn")?.click();
    return;
  }
  if (target && target.id === "register-confirm-password-input") {
    document.getElementById("register-btn")?.click();
  }
});

// Handle logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (isDemoMode) {
      exitDemoMode();
    } else {
      if (confirm("Are you sure you want to logout?")) {
        logoutUser();
      }
    }
  });
}

// Reset password: send link
if (resetPasswordSendBtn) {
  resetPasswordSendBtn.addEventListener("click", async () => {
    const email = resetPasswordEmailInput ? resetPasswordEmailInput.value.trim() : "";
    if (!resetPasswordMessage) return;
    resetPasswordMessage.textContent = "";
    resetPasswordMessage.classList.add("hidden");

    resetPasswordSendBtn.disabled = true;
    resetPasswordSendBtn.textContent = "Sending…";
    const result = await sendPasswordResetEmail(email);
    resetPasswordSendBtn.disabled = false;
    resetPasswordSendBtn.textContent = "Send reset link";

    if (result.success) {
      resetPasswordMessage.textContent = "If an account exists, we sent a reset link to that email. Check your inbox and spam, and allow a few minutes for delivery.";
      resetPasswordMessage.classList.remove("hidden", "auth-error");
      resetPasswordMessage.classList.add("auth-success");
    } else {
      resetPasswordMessage.textContent = result.error;
      resetPasswordMessage.classList.remove("auth-success");
      resetPasswordMessage.classList.add("auth-error");
      resetPasswordMessage.classList.remove("hidden");
    }
  });
}

// Reset password modal: Cancel
if (resetPasswordCancelBtn) {
  resetPasswordCancelBtn.addEventListener("click", () => closeModal(resetPasswordModal));
}

// ---------- Events ----------

addBoardBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  editingBoardId = null;
  boardModalTitle.textContent = "New board";
  boardNameInput.value = "";
  openModal(boardModal);
  boardNameInput.focus();
});

exportBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  exportBoards();
});

importBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  importBoards();
});

importFileInput.addEventListener("change", handleFileImport);

backupFolderBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  await selectBackupDirectory();
});

boardSelect.addEventListener("change", (e) => {
  const id = e.target.value;
  state.activeBoardId = id || null;
  activeTagFilter = [];
  render();
});

backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) {
    const modals = [boardModal, listModal, cardModal, emailModal, transcriptModal, settingsModal];
    if (pomodoroModal) modals.push(pomodoroModal);
    if (resetPasswordModal) modals.push(resetPasswordModal);
    modals.forEach((m) => {
      if (m) {
        m.classList.add("hidden");
        if (m === resetPasswordModal) m.classList.remove("modal-over-auth");
      }
    });
    backdrop.classList.add("hidden");
    backdrop.classList.remove("modal-over-auth");
  }
});

// Prevent modal content clicks from closing the modal
[boardModal, listModal, cardModal, emailModal, transcriptModal, settingsModal, pomodoroModal, resetPasswordModal].filter(Boolean).forEach((modal) => {
  const content = modal.querySelector(".modal-content");
  if (content) {
    content.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
});

boardCancelBtn.addEventListener("click", () => closeModal(boardModal));
listCancelBtn.addEventListener("click", () => closeModal(listModal));
cardCancelBtn.addEventListener("click", () => closeModal(cardModal));
emailCancelBtn.addEventListener("click", () => {
  emailCardContext = null;
  closeModal(emailModal);
});
emailSendBtn.addEventListener("click", sendTaskEmail);

emailSettingsBtn.addEventListener("click", async () => {
  const settings = await getEmailSettings();
  const currentEmail = settings.defaultRecipient || "";
  const newEmail = prompt("Enter default recipient email address:", currentEmail);
  if (newEmail !== null) {
    if (newEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail.trim())) {
        alert("Invalid email address format");
        return;
      }
    }
    settings.defaultRecipient = newEmail.trim();
    await saveEmailSettings(settings);
    alert("Email settings saved!");
  }
});

transcriptBtn.addEventListener("click", () => {
  transcriptInput.value = "";
  openModal(transcriptModal);
  transcriptInput.focus();
});

transcriptCancelBtn.addEventListener("click", () => {
  transcriptInput.value = "";
  closeModal(transcriptModal);
});

transcriptProcessBtn.addEventListener("click", async () => {
  const transcript = transcriptInput.value.trim();
  if (!transcript) {
    alert("Please paste a transcript first.");
    transcriptInput.focus();
    return;
  }
  await createCardsFromTranscript(transcript);
});

// Allow Enter key to submit transcript
transcriptInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    const transcript = transcriptInput.value.trim();
    if (transcript) {
      await createCardsFromTranscript(transcript);
    }
  }
});

settingsBtn.addEventListener("click", async () => {
  const settings = await getGeminiSettings();
  geminiApiKeyInput.value = settings.apiKey || "";
  openModal(settingsModal);
  geminiApiKeyInput.focus();
});

settingsCancelBtn.addEventListener("click", () => {
  closeModal(settingsModal);
});

settingsSaveBtn.addEventListener("click", async () => {
  const apiKey = geminiApiKeyInput.value.trim();
  const settings = { apiKey };
  await saveGeminiSettings(settings);
  alert("Settings saved!");
  closeModal(settingsModal);
});

// Pomodoro events
if (pomodoroStartPauseBtn) {
  pomodoroStartPauseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    pomodoroStartPause();
  });
}
if (pomodoroResetBtn) {
  pomodoroResetBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    pomodoroReset();
  });
}
if (pomodoroSettingsBtn) {
  pomodoroSettingsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pomodoroWorkMinutesInput) pomodoroWorkMinutesInput.value = pomodoroWorkMinutes;
    if (pomodoroRestMinutesInput) pomodoroRestMinutesInput.value = pomodoroRestMinutes;
    openModal(pomodoroModal);
    if (pomodoroWorkMinutesInput) pomodoroWorkMinutesInput.focus();
  });
}
if (pomodoroModalCancelBtn) {
  pomodoroModalCancelBtn.addEventListener("click", () => closeModal(pomodoroModal));
}
if (pomodoroModalSaveBtn) {
  pomodoroModalSaveBtn.addEventListener("click", () => {
    const work = parseInt(pomodoroWorkMinutesInput.value, 10);
    const rest = parseInt(pomodoroRestMinutesInput.value, 10);
    if (isNaN(work) || work < 1 || work > 60) {
      alert("Work duration must be between 1 and 60 minutes.");
      return;
    }
    if (isNaN(rest) || rest < 0 || rest > 30) {
      alert("Rest duration must be between 0 and 30 minutes.");
      return;
    }
    pomodoroWorkMinutes = work;
    pomodoroRestMinutes = rest;
    savePomodoroSettings(pomodoroWorkMinutes, pomodoroRestMinutes);
    initPomodoro();
    closeModal(pomodoroModal);
  });
}

boardSaveBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  const name = boardNameInput.value.trim();
  if (!name) {
    alert("Please enter a board name");
    return;
  }

  if (editingBoardId) {
    const board = state.boards.find((b) => b.id === editingBoardId);
    if (board) board.name = name;
  } else {
    const id = uid();
    state.boards.push({
      id,
      name,
      lists: [],
    });
    state.activeBoardId = id;
  }

  editingBoardId = null;
  closeModal(boardModal);
  render();
});

listSaveBtn.addEventListener("click", () => {
  const title = listTitleInput.value.trim();
  if (!title) return;

  const board = getActiveBoard();
  if (!board) return;

  if (editingListId) {
    const list = board.lists.find((l) => l.id === editingListId);
    if (list) list.title = title;
  } else {
    board.lists.push({
      id: uid(),
      title,
      cards: [],
    });
  }

  editingListId = null;
  closeModal(listModal);
  render();
});

if (filterClearBtn) {
  filterClearBtn.addEventListener("click", () => {
    activeTagFilter = [];
    render();
  });
}

if (cardTagInput) {
  cardTagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = cardTagInput.value.trim().replace(/,/g, "").trim();
      if (tag && !currentCardTags.includes(tag)) {
        currentCardTags = [...currentCardTags, tag];
        renderCardTagChips();
      }
      cardTagInput.value = "";
    }
  });
}

cardSaveBtn.addEventListener("click", () => {
  const title = cardTitleInput.value.trim();
  const description = cardDescriptionInput.value.trim();
  if (!title || !editingCardContext) return;

  const { boardId, listId, cardId } = editingCardContext;
  const board = state.boards.find((b) => b.id === boardId);
  if (!board) return;
  const list = board.lists.find((l) => l.id === listId);
  if (!list) return;

  const priority = cardPriorityInput ? cardPriorityInput.value : "p2";
  const tags = [...new Set(currentCardTags.map((t) => String(t).trim()).filter(Boolean))];
  if (cardId) {
    const card = list.cards.find((c) => c.id === cardId);
    if (card) {
      card.title = title;
      card.description = description;
      card.priority = priority;
      card.tags = tags;
    }
  } else {
    list.cards.push({
      id: uid(),
      title,
      description,
      priority,
      tags,
    });
  }

  editingCardContext = null;
  closeModal(cardModal);
  render();
});

// ---------- World Clock ----------

const worldClockTimezones = [
  { city: 'New York', tz: 'America/New_York' },
  { city: 'London', tz: 'Europe/London' },
  { city: 'Tokyo', tz: 'Asia/Tokyo' },
  { city: 'Sydney', tz: 'Australia/Sydney' },
  { city: 'Los Angeles', tz: 'America/Los_Angeles' },
  { city: 'Dubai', tz: 'Asia/Dubai' },
];

function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function formatDate(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = days[date.getDay()];
  const month = months[date.getMonth()];
  const dateNum = date.getDate();
  return `${day}, ${month} ${dateNum}`;
}

function updateWorldClock() {
  const container = document.getElementById('world-clock-clocks');
  if (!container) return;

  container.innerHTML = '';

  worldClockTimezones.forEach(({ city, tz }) => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      });

      const parts = formatter.formatToParts(now);
      const timeStr = `${parts.find(p => p.type === 'hour').value}:${parts.find(p => p.type === 'minute').value}:${parts.find(p => p.type === 'second').value}`;
      const dateStr = `${parts.find(p => p.type === 'weekday').value}, ${parts.find(p => p.type === 'month').value} ${parts.find(p => p.type === 'day').value}`;

      const clockEl = document.createElement('div');
      clockEl.className = 'world-clock-item';
      clockEl.innerHTML = `
        <div class="world-clock-city">${city}</div>
        <div class="world-clock-time">${timeStr}</div>
        <div class="world-clock-date">${dateStr}</div>
      `;
      container.appendChild(clockEl);
    } catch (error) {
      console.error(`Error formatting time for ${city}:`, error);
    }
  });
}

function getWorldClockVisible() {
  try {
    const stored = localStorage.getItem(WORLD_CLOCK_VISIBLE_KEY);
    if (stored === null) return true;
    return stored === "true";
  } catch (e) {
    return true;
  }
}

function setWorldClockVisible(visible) {
  try {
    localStorage.setItem(WORLD_CLOCK_VISIBLE_KEY, visible ? "true" : "false");
  } catch (e) {
    // ignore
  }
}

function applyWorldClockVisibility() {
  const container = document.getElementById("world-clock-container");
  const showBar = document.getElementById("world-clock-show-bar");
  const visible = getWorldClockVisible();
  if (container) {
    if (visible) {
      container.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
  }
  if (showBar) {
    if (visible) {
      showBar.classList.add("hidden");
    } else {
      showBar.classList.remove("hidden");
    }
  }
}

function initWorldClock() {
  const container = document.getElementById("world-clock-container");
  if (!container) return;

  applyWorldClockVisibility();

  const hideBtn = document.getElementById("world-clock-hide-btn");
  const showBtn = document.getElementById("world-clock-show-btn");
  if (hideBtn) {
    hideBtn.addEventListener("click", () => {
      setWorldClockVisible(false);
      applyWorldClockVisibility();
    });
  }
  if (showBtn) {
    showBtn.addEventListener("click", () => {
      setWorldClockVisible(true);
      applyWorldClockVisibility();
    });
  }

  // Update immediately
  updateWorldClock();

  // Update every second
  setInterval(updateWorldClock, 1000);
}

// ---------- Pomodoro Timer ----------

let pomodoroWorkMinutes = 25;
let pomodoroRestMinutes = 5;
let pomodoroRemainingSeconds = 25 * 60;
let pomodoroPhase = "focus"; // "focus" | "rest"
let pomodoroIntervalId = null;
let pomodoroRunning = false;

function getPomodoroSettings() {
  try {
    const raw = localStorage.getItem(POMODORO_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.workMinutes === "number" && typeof parsed.restMinutes === "number") {
        return { workMinutes: parsed.workMinutes, restMinutes: parsed.restMinutes };
      }
    }
  } catch (e) {
    console.warn("Pomodoro settings load error:", e);
  }
  return { workMinutes: 25, restMinutes: 5 };
}

function savePomodoroSettings(workMinutes, restMinutes) {
  try {
    localStorage.setItem(POMODORO_SETTINGS_KEY, JSON.stringify({ workMinutes, restMinutes }));
  } catch (e) {
    console.warn("Pomodoro settings save error:", e);
  }
}

function formatPomodoroTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function updatePomodoroDisplay() {
  if (!pomodoroPhaseEl || !pomodoroTimeEl || !pomodoroWidget) return;
  pomodoroPhaseEl.textContent = pomodoroPhase === "focus" ? "Focus" : "Rest";
  pomodoroTimeEl.textContent = formatPomodoroTime(pomodoroRemainingSeconds);
  pomodoroWidget.classList.toggle("rest", pomodoroPhase === "rest");
  pomodoroWidget.classList.toggle("running", pomodoroRunning);
  if (pomodoroStartPauseBtn) {
    pomodoroStartPauseBtn.textContent = pomodoroRunning ? "⏸" : "▶";
    pomodoroStartPauseBtn.title = pomodoroRunning ? "Pause" : "Start";
  }
}

function startPomodoroRest() {
  pomodoroPhase = "rest";
  pomodoroRemainingSeconds = pomodoroRestMinutes * 60;
  updatePomodoroDisplay();
  if (pomodoroRunning) {
    pomodoroIntervalId = setInterval(pomodoroTick, 1000);
  }
}

function startPomodoroFocus() {
  pomodoroPhase = "focus";
  pomodoroRemainingSeconds = pomodoroWorkMinutes * 60;
  updatePomodoroDisplay();
  if (pomodoroRunning) {
    pomodoroIntervalId = setInterval(pomodoroTick, 1000);
  }
}

function pomodoroTick() {
  pomodoroRemainingSeconds -= 1;
  if (pomodoroRemainingSeconds <= 0) {
    if (pomodoroIntervalId) {
      clearInterval(pomodoroIntervalId);
      pomodoroIntervalId = null;
    }
    if (pomodoroPhase === "focus") {
      startPomodoroRest();
    } else {
      startPomodoroFocus();
    }
    return;
  }
  updatePomodoroDisplay();
}

function pomodoroStartPause() {
  pomodoroRunning = !pomodoroRunning;
  if (pomodoroRunning) {
    pomodoroIntervalId = setInterval(pomodoroTick, 1000);
  } else {
    if (pomodoroIntervalId) {
      clearInterval(pomodoroIntervalId);
      pomodoroIntervalId = null;
    }
  }
  updatePomodoroDisplay();
}

function pomodoroReset() {
  pomodoroRunning = false;
  if (pomodoroIntervalId) {
    clearInterval(pomodoroIntervalId);
    pomodoroIntervalId = null;
  }
  pomodoroPhase = "focus";
  pomodoroRemainingSeconds = pomodoroWorkMinutes * 60;
  updatePomodoroDisplay();
}

function initPomodoro() {
  const settings = getPomodoroSettings();
  pomodoroWorkMinutes = settings.workMinutes;
  pomodoroRestMinutes = settings.restMinutes;
  pomodoroPhase = "focus";
  pomodoroRemainingSeconds = pomodoroWorkMinutes * 60;
  pomodoroRunning = false;
  if (pomodoroIntervalId) {
    clearInterval(pomodoroIntervalId);
    pomodoroIntervalId = null;
  }
  updatePomodoroDisplay();
}

// ---------- Init ----------

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function initApp() {
  // Resolve required elements by ID so demo mode works even if script failed before DOM refs
  var boardBtn = addBoardBtn || document.getElementById("add-board-btn");
  var boardModalEl = boardModal || document.getElementById("board-modal");
  var boardSaveBtnEl = boardSaveBtn || document.getElementById("board-save-btn");
  if (!boardBtn || !boardModalEl || !boardSaveBtnEl) {
    console.error("Required DOM elements not found");
    return;
  }

  // Initialize world clock
  initWorldClock();

  // Initialize Pomodoro timer
  initPomodoro();

  // Ensure auth token is ready before first Firestore read (avoids permission-denied on fast login / page load)
  if (window.firebaseAuth && window.firebaseAuth.currentUser) {
    try {
      await window.firebaseAuth.currentUser.getIdToken(true);
      // Wait for token to propagate so Firestore accepts the first request
      await new Promise(function(r) { setTimeout(r, 600); });
    } catch (_) {}
  }

  await loadState();

  // For new sign-ups the default board is created in registerUser(); existing users may have no state yet
  if (state.boards.length === 0) {
    const defaultBoardId = uid();
    state.boards.push({
      id: defaultBoardId,
      name: "My first board",
      lists: [
        { id: uid(), title: "To do", cards: [] },
        { id: uid(), title: "In progress", cards: [] },
        { id: uid(), title: "Done", cards: [] },
      ],
    });
    state.activeBoardId = defaultBoardId;
    await saveState(); // Save default board to Firestore
  }

  // Initialize backup system
  await loadBackupDirectory();
  updateBackupStatus();
  
  // Check if backup is due
  await checkAndPerformBackup();
  
  // Cleanup old backups
  await cleanupOldBackups();

  render();
  
  // Check for backup every hour
  setInterval(async () => {
    await checkAndPerformBackup();
    await cleanupOldBackups();
  }, 60 * 60 * 1000); // Check every hour
}

async function init() {
  var versionEl = document.getElementById("app-version");
  if (versionEl) versionEl.textContent = "v" + APP_VERSION;

  var errEl = document.getElementById("login-error");
  var regErrEl = document.getElementById("register-error");
  if (errEl) errEl.textContent = "";
  if (regErrEl) regErrEl.textContent = "";

  try {
    if (SKIP_LOGIN_OPEN_KANBAN) {
      // Bypass auth: open directly on kanban (demo mode, localStorage).
      await enterDemoMode();
      return;
    }
    if (window.firebaseAuth) {
      setupAuthListener();
      // HTML defaults to kanban; show login until auth state is known.
      showAuthScreen();
    } else {
      enterDemoMode();
    }
  } catch (err) {
    console.warn("Init error:", err);
    enterDemoMode();
  }
}


