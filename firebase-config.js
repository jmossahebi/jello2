// Firebase Configuration
// Replace these values with your Firebase project configuration
// Get these from: https://console.firebase.google.com/ > Your Project > Project Settings > General > Your apps
//
// IMPORTANT: After deploying, add your hosting domain to Firebase Console:
// Authentication > Settings > Authorized domains > Add domain

(function() {
  try {
    if (typeof firebase === "undefined") {
      window.firebaseAuth = null;
      window.firebaseDb = null;
      return;
    }
    const firebaseConfig = {
      apiKey: "AIzaSyBhzmmdQhcx1OoopE897QVciVNCFKWqW6k",
      authDomain: "jello-3b04a.firebaseapp.com",
      projectId: "jello-3b04a",
      storageBucket: "jello-3b04a.firebasestorage.app",
      messagingSenderId: "132843891625",
      appId: "1:132843891625:web:b26bb2984900568c2772b8",
      measurementId: "G-SZ803Z2LBR"
    };
    // If config is still placeholder, don't init Firebase — app will go straight to demo board
    var isPlaceholder = !firebaseConfig.apiKey || firebaseConfig.apiKey.indexOf("YOUR_") !== -1 ||
      !firebaseConfig.projectId || firebaseConfig.projectId.indexOf("YOUR_") !== -1;
    if (isPlaceholder) {
      window.firebaseAuth = null;
      window.firebaseDb = null;
      return;
    }
    firebase.initializeApp(firebaseConfig);
    window.firebaseAuth = firebase.auth();
    window.firebaseDb = firebase.firestore();
  } catch (e) {
    console.warn("Firebase init failed, demo mode will still work:", e);
    window.firebaseAuth = window.firebaseAuth || null;
    window.firebaseDb = window.firebaseDb || null;
  }
})();
