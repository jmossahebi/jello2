# Firebase Setup Instructions

This app now uses Firebase for authentication and data storage, enabling multi-device sync.

---

## Fix: "Firestore permission denied"

If you see **"Firestore permission denied"** in the app:

1. Open [Firebase Console](https://console.firebase.google.com/) and select your project (e.g. **jello-3b04a**).
2. Go to **Firestore Database** → **Rules**.
3. Replace the rules with the contents of **`firestore.rules`** in this project (or paste the rules from **Step 6** below).
4. Click **Publish** (not just Save). Wait for "Rules published" to confirm.

After publishing, reload the app. Only authenticated users can read/write their own data; the rules must be published for the app to work.

### Still not working?

- **Check the Rules tab**: Make sure you're editing rules for the **(default)** database, not a named database.
- **Confirm Publish**: After editing, you must click **Publish**. The rules editor shows a "Publish" button at the top.
- **App Check**: If you enabled App Check for Firestore, either register this app in App Check (Debug/Release tokens) or temporarily disable App Check for Firestore so the app can connect.
- **Browser console**: Open DevTools → Console. Look for `Firestore loadState error:` to see the exact path and error; the path should be `users/<your-uid>/data/state`.
- **Same project**: Your `firebase-config.js` projectId (e.g. `jello-3b04a`) must match the Firebase project where you published the rules.

---

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password** authentication
3. Click "Save"

### Password reset emails

For "Forgot password?" to deliver emails:

1. **Authorized domains**  
   Go to **Authentication** → **Settings** → **Authorized domains**.  
   Add every domain where the app runs (e.g. `localhost` for local dev, and your production domain like `yourapp.vercel.app`). If the domain is missing, Firebase may not send the email or will return an error.

2. **Check spam**  
   Reset emails often land in spam, especially with the default Firebase sender. Ask users to check spam and wait a few minutes.

3. **Optional: custom sender**  
   In **Authentication** → **Templates**, edit the "Password reset" template and use "Customize domain" to send from your own domain once verified. This can improve deliverability.

## Step 3: Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Choose **Start in test mode** (for development)
4. Select a location for your database
5. Click "Enable"

## Step 4: Get Your Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app (give it a nickname)
5. Copy the Firebase configuration object

## Step 5: Configure the App

1. Open `firebase-config.js` in your project
2. Replace the placeholder values with your Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Step 6: Set Firestore Security Rules (Important!)

1. In Firebase Console, go to **Firestore Database** > **Rules**
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /data/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

3. Click "Publish"

## Step 7: Deploy Your App

Your app is now ready! You can deploy it to:
- **Netlify**: Drag and drop your folder
- **Vercel**: Connect your GitHub repo
- **GitHub Pages**: Push to GitHub and enable Pages
- **Firebase Hosting**: Use `firebase deploy` (requires Firebase CLI)

## Features Enabled

✅ **Multi-device sync**: Your boards sync across all devices in real-time  
✅ **Secure authentication**: Firebase handles password security  
✅ **Cloud storage**: All data stored in Firestore  
✅ **Automatic backups**: Data is automatically backed up in the cloud  

## Free Tier Limits

Firebase offers a generous free tier:
- **Authentication**: 50,000 monthly active users
- **Firestore**: 1 GB storage, 50K reads/day, 20K writes/day

This is more than enough for personal use!

