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
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT_ID.appspot.com",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID"
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
