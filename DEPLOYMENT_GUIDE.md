# Deployment Guide: Hosting Your Kanban App

This guide will walk you through deploying your Trello clone app to a hosting service and ensuring Firebase (authentication and database) works correctly.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Firebase Setup](#firebase-setup)
3. [Configure Firebase in Your App](#configure-firebase-in-your-app)
4. [Set Up Firestore Security Rules](#set-up-firestore-security-rules)
5. [Choose a Hosting Service](#choose-a-hosting-service)
6. [Deployment Options](#deployment-options)
7. [Testing Your Deployment](#testing-your-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A Firebase account (free tier is sufficient)
- Your project files ready to deploy
- A hosting service account (all options below have free tiers)

---

## Firebase Setup

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or select an existing project
3. Enter a project name (e.g., "kanban-app")
4. Follow the setup wizard:
   - Disable Google Analytics (optional, for simplicity)
   - Click **"Create project"**
   - Wait for project creation to complete

### Step 2: Enable Authentication

1. In Firebase Console, navigate to **Authentication** (left sidebar)
2. Click **"Get started"** if you haven't enabled it yet
3. Go to the **"Sign-in method"** tab
4. Click on **"Email/Password"**
5. Toggle **"Enable"** and click **"Save"**

### Step 3: Create Firestore Database

1. In Firebase Console, navigate to **Firestore Database** (left sidebar)
2. Click **"Create database"**
3. Choose **"Start in test mode"** (we'll configure security rules later)
4. Select a database location (choose the closest to your users)
5. Click **"Enable"**

### Step 4: Get Your Firebase Configuration

1. In Firebase Console, click the **gear icon** ⚙️ next to "Project Overview"
2. Select **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **Web icon** (`</>`)
5. Register your app:
   - Enter an app nickname (e.g., "Kanban Web App")
   - **Do NOT** check "Also set up Firebase Hosting" (we'll use a different host)
   - Click **"Register app"**
6. Copy the `firebaseConfig` object that appears

---

## Configure Firebase in Your App

1. Open `firebase-config.js` in your project
2. Replace the placeholder values with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",  // Your actual API key
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

firebase.initializeApp(firebaseConfig);
window.firebaseAuth = firebase.auth();
window.firebaseDb = firebase.firestore();
```

**⚠️ Important:** Your Firebase config will be visible in the browser. This is normal and safe - Firebase security is handled through security rules, not by hiding the config.

---

## Set Up Firestore Security Rules

**This is critical for security!** Without proper rules, anyone can access your database.

1. In Firebase Console, go to **Firestore Database** > **Rules** tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - users can only access their own document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // User's data subcollection
      match /data/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Allow users to read/write their own boards data
    // Adjust this based on your actual data structure
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **"Publish"**

**Note:** The last rule (`match /{document=**}`) allows authenticated users to read/write all documents. For production, you may want to restrict this further based on your data structure.

---

## Choose a Hosting Service

Here are the best options for hosting a static site with Firebase:

| Service | Free Tier | Ease of Use | Best For |
|---------|-----------|-------------|----------|
| **Netlify** | ✅ Generous | ⭐⭐⭐⭐⭐ | Quickest deployment |
| **Vercel** | ✅ Generous | ⭐⭐⭐⭐⭐ | Modern workflows |
| **Firebase Hosting** | ✅ Generous | ⭐⭐⭐⭐ | Firebase integration |
| **GitHub Pages** | ✅ Free | ⭐⭐⭐ | Simple static sites |

---

## Deployment Options

### Option 1: Netlify (Recommended - Easiest)

#### Method A: Drag & Drop (Quickest)

1. Go to [Netlify](https://www.netlify.com/) and sign up/login
2. Make sure your `firebase-config.js` has your actual Firebase config
3. In Netlify dashboard, drag and drop your entire project folder onto the deploy area
4. Netlify will automatically deploy your site
5. You'll get a URL like `https://random-name-123.netlify.app`
6. Test your app - try logging in and creating a board

#### Method B: Git Integration (Better for updates)

1. Push your project to GitHub (create a repo and push)
2. In Netlify, click **"Add new site"** > **"Import an existing project"**
3. Connect to GitHub and select your repository
4. Configure build settings:
   - **Build command:** Leave empty (no build needed)
   - **Publish directory:** `.` (root directory)
5. Click **"Deploy site"**
6. Your site will auto-deploy on every git push

#### Custom Domain (Optional)

1. In Netlify, go to **Site settings** > **Domain management**
2. Click **"Add custom domain"**
3. Follow the instructions to configure DNS

---

### Option 2: Vercel

1. Go to [Vercel](https://vercel.com/) and sign up/login
2. Click **"Add New Project"**
3. Import your GitHub repository (or use Vercel CLI)
4. Configure:
   - **Framework Preset:** Other
   - **Root Directory:** `.` (or leave default)
   - **Build Command:** Leave empty
   - **Output Directory:** `.`
5. Click **"Deploy"**
6. Your site will be live at `https://your-project.vercel.app`

**Using Vercel CLI:**
```bash
npm i -g vercel
cd "/Users/Jamie.Mossahebi/Desktop/Cursor Test"
vercel
```

---

### Option 3: Firebase Hosting

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase Hosting in your project:
   ```bash
   cd "/Users/Jamie.Mossahebi/Desktop/Cursor Test"
   firebase init hosting
   ```
   
   When prompted:
   - **What do you want to use as your public directory?** → `.` (or `public` if you prefer)
   - **Configure as a single-page app?** → `No`
   - **Set up automatic builds?** → `No`
   - **File public/index.html already exists. Overwrite?** → `No`

4. Deploy:
   ```bash
   firebase deploy --only hosting
   ```

5. Your site will be live at `https://your-project-id.web.app`

---

### Option 4: GitHub Pages

1. Push your project to a GitHub repository
2. Go to your repository on GitHub
3. Click **Settings** > **Pages**
4. Under **Source**, select:
   - **Branch:** `main` (or `master`)
   - **Folder:** `/ (root)`
5. Click **Save**
6. Your site will be live at `https://your-username.github.io/repo-name`

**Note:** GitHub Pages serves over HTTP by default. Firebase requires HTTPS for some features, so you may need to configure a custom domain with HTTPS.

---

## Testing Your Deployment

After deploying, test these critical functions:

### 1. Test Authentication
- ✅ Visit your deployed site
- ✅ Try creating a new account
- ✅ Try logging in with that account
- ✅ Try logging out

### 2. Test Database Operations
- ✅ Create a new board
- ✅ Add lists to the board
- ✅ Add cards to lists
- ✅ Edit cards
- ✅ Delete cards/lists/boards
- ✅ Refresh the page - data should persist

### 3. Test Multi-Device Sync
- ✅ Open your app on two different devices/browsers
- ✅ Log in with the same account on both
- ✅ Create/edit data on one device
- ✅ Verify it appears on the other device (may take a few seconds)

### 4. Check Browser Console
- ✅ Open browser DevTools (F12)
- ✅ Check the Console tab for any errors
- ✅ Check the Network tab for Firebase API calls

---

## Troubleshooting

### Issue: "Firebase: Error (auth/network-request-failed)"

**Solution:**
- Check your internet connection
- Verify Firebase config values are correct
- Check browser console for specific error messages
- Ensure your hosting service allows Firebase API calls (most do by default)

### Issue: "Firebase: Error (auth/unauthorized-domain)"

**Solution:**
1. Go to Firebase Console > **Authentication** > **Settings** > **Authorized domains**
2. Add your hosting domain (e.g., `your-app.netlify.app`)
3. Click **"Add"**

### Issue: "Permission denied" when accessing Firestore

**Solution:**
- Check your Firestore security rules (see [Set Up Firestore Security Rules](#set-up-firestore-security-rules))
- Ensure rules are published
- Verify you're logged in (check `request.auth != null`)

### Issue: Data not syncing across devices

**Solution:**
- Verify you're logged in with the same account on both devices
- Check Firestore rules allow read/write for authenticated users
- Check browser console for errors
- Ensure Firebase config is identical on both devices

### Issue: Site shows blank page

**Solution:**
- Check browser console for JavaScript errors
- Verify all file paths are correct (use relative paths)
- Ensure `index.html` is in the root directory
- Check hosting service logs for errors

### Issue: Firebase config not working

**Solution:**
- Double-check all config values are correct (no extra spaces/quotes)
- Verify you copied the config from the correct Firebase project
- Clear browser cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check that Firebase SDK scripts are loading (Network tab in DevTools)

---

## Security Checklist

Before going live, ensure:

- ✅ Firestore security rules are configured and published
- ✅ Only authenticated users can access data
- ✅ Users can only access their own data
- ✅ Firebase config is correct
- ✅ Authorized domains are set in Firebase Console
- ✅ HTTPS is enabled (most hosting services do this automatically)

---

## Updating Your Deployment

### Netlify/Vercel (Git Integration)
1. Make changes locally
2. Commit and push to GitHub
3. Deployment happens automatically

### Netlify (Drag & Drop)
1. Make changes locally
2. Drag and drop the folder again
3. Netlify will create a new deployment

### Firebase Hosting
```bash
firebase deploy --only hosting
```

### GitHub Pages
1. Make changes locally
2. Commit and push to GitHub
3. GitHub Pages updates automatically (may take a few minutes)

---

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Netlify Documentation](https://docs.netlify.com/)
- [Vercel Documentation](https://vercel.com/docs)
- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)

---

## Need Help?

If you encounter issues:
1. Check the browser console for error messages
2. Review Firebase Console logs (Firestore > Usage tab)
3. Check your hosting service's deployment logs
4. Verify all configuration values are correct

Good luck with your deployment! 🚀

