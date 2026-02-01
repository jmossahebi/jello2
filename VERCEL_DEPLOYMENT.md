# Vercel Deployment Guide

Step-by-step guide to deploy your Kanban app to Vercel with Firebase integration.

## Prerequisites

- ✅ Firebase project set up (see below if not done)
- ✅ Firebase config ready
- ✅ GitHub account (recommended) or Vercel CLI

---

## Part 1: Firebase Setup

### 1.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name → **"Create project"**
4. Skip Google Analytics (optional) → **"Continue"**

### 1.2 Enable Authentication

1. Left sidebar → **Authentication** → **"Get started"**
2. Go to **"Sign-in method"** tab
3. Click **"Email/Password"** → Toggle **"Enable"** → **"Save"**

### 1.3 Create Firestore Database

1. Left sidebar → **Firestore Database** → **"Create database"**
2. Select **"Start in test mode"**
3. Choose location (closest to your users)
4. Click **"Enable"**

### 1.4 Get Firebase Config

1. Click **gear icon** ⚙️ → **"Project settings"**
2. Scroll to **"Your apps"** → Click **Web icon** (`</>`)
3. Register app (nickname: "Kanban App")
4. **Copy the `firebaseConfig` object**

### 1.5 Update Your Config File

Open `firebase-config.js` and replace with your actual config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",  // Your actual values
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### 1.6 Set Firestore Security Rules

1. Firebase Console → **Firestore Database** → **Rules** tab
2. Replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /data/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **"Publish"**

---

## Part 2: Get Your Project on GitHub

### Step 1: Create a GitHub Account (if needed)

1. Go to [github.com](https://github.com) and sign up for a free account
2. Verify your email address

### Step 2: Create a New Repository

1. Log in to GitHub
2. Click the **"+"** icon in the top right → **"New repository"**
3. Fill in the details:
   - **Repository name:** `kanban-app` (or any name you prefer)
   - **Description:** (optional) "Trello-style Kanban board with Firebase"
   - **Visibility:** Choose **Public** (free) or **Private** (if you have GitHub Pro)
   - **DO NOT** check "Initialize with README" (we already have files)
   - **DO NOT** add .gitignore or license (we'll handle this)
4. Click **"Create repository"**

### Step 3: Push Your Code to GitHub

Open your terminal and run these commands:

#### 3.1 Navigate to Your Project

```bash
cd "/Users/Jamie.Mossahebi/Desktop/Cursor Test"
```

#### 3.2 Initialize Git (if not already done)

```bash
git init
```

#### 3.3 Verify .gitignore

A `.gitignore` file is already included in your project to exclude unnecessary files (node_modules, OS files, etc.). If you need to add more patterns, edit the `.gitignore` file.

#### 3.4 Stage All Files

```bash
git add .
```

#### 3.5 Make Your First Commit

```bash
git commit -m "Initial commit: Kanban app with Firebase integration"
```

#### 3.6 Rename Branch to Main (if needed)

```bash
git branch -M main
```

#### 3.7 Connect to GitHub Repository

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

**Example:**
```bash
git remote add origin https://github.com/jamie-mossahebi/kanban-app.git
```

#### 3.8 Push to GitHub

```bash
git push -u origin main
```

You'll be prompted for your GitHub username and password. For password, use a **Personal Access Token** (not your GitHub password):

**To create a Personal Access Token:**
1. GitHub → Click your profile picture → **Settings**
2. Left sidebar → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)**
4. Click **"Generate new token"** → **"Generate new token (classic)"**
5. Give it a name: "Vercel Deployment"
6. Select scopes: Check **`repo`** (full control of private repositories)
7. Click **"Generate token"**
8. **Copy the token immediately** (you won't see it again!)
9. Use this token as your password when pushing

#### 3.9 Verify Upload

1. Go to your GitHub repository page
2. You should see all your files: `index.html`, `main.js`, `styles.css`, `firebase-config.js`, etc.
3. ✅ Your code is now on GitHub!

---

## Part 3: Deploy to Vercel

### Option A: Deploy via GitHub (Recommended)

#### Step 1: Connect Vercel to GitHub

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** or **"Log In"**
3. Choose **"Continue with GitHub"** (recommended - easier integration)
4. Authorize Vercel to access your GitHub repositories

#### Step 2: Import Your Repository

1. In Vercel dashboard, click **"Add New Project"**
2. You'll see a list of your GitHub repositories
3. Find and click on your repository (e.g., `kanban-app`)
4. Click **"Import"**

#### Step 3: Configure Project Settings

Vercel should auto-detect your project, but verify these settings:

- **Framework Preset:** `Other` (or leave as detected)
- **Root Directory:** `./` (leave default - root directory)
- **Build Command:** (leave empty - no build needed for static site)
- **Output Directory:** `./` (leave default)
- **Install Command:** (leave empty)

**Note:** If you see a `vercel.json` file, Vercel will use those settings automatically.

#### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for deployment (~30-60 seconds)
3. Watch the build logs in real-time
4. Once complete, you'll see: **"Congratulations! Your project has been deployed."**
5. Your live URL will be: `https://your-project.vercel.app`
6. Click the URL to visit your site!

**🎉 Your app is now live!**

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login:
```bash
vercel login
```

3. Deploy:
```bash
cd "/Users/Jamie.Mossahebi/Desktop/Cursor Test"
vercel
```

4. Follow prompts:
   - **Set up and deploy?** → `Y`
   - **Which scope?** → Select your account
   - **Link to existing project?** → `N`
   - **Project name?** → (press Enter for default)
   - **Directory?** → `./` (press Enter)
   - **Override settings?** → `N`

5. Your site will be live at the provided URL

---

## Part 4: Configure Firebase for Production

### Add Authorized Domain

**Critical step!** Without this, authentication won't work.

1. Firebase Console → **Authentication** → **Settings** tab
2. Scroll to **"Authorized domains"**
3. Click **"Add domain"**
4. Enter your Vercel domain: `your-project.vercel.app`
5. Click **"Add"**
6. If you have a custom domain, add that too

---

## Part 5: Test Your Deployment

### Quick Test Checklist

1. ✅ Visit your Vercel URL
2. ✅ Create a new account (test email/password)
3. ✅ Login with that account
4. ✅ Create a board
5. ✅ Add lists and cards
6. ✅ Refresh page - data should persist
7. ✅ Open browser console (F12) - check for errors
8. ✅ Test logout/login again

### Multi-Device Test

1. Open app on two different devices/browsers
2. Login with same account on both
3. Create/edit data on one device
4. Verify it syncs to the other device

---

## Part 6: Custom Domain (Optional)

1. In Vercel dashboard → Your project → **Settings** → **Domains**
2. Enter your domain (e.g., `kanban.yourdomain.com`)
3. Follow DNS configuration instructions
4. Wait for DNS propagation (5-60 minutes)
5. Add the custom domain to Firebase Authorized Domains too

---

## Troubleshooting

### ❌ "Firebase: Error (auth/unauthorized-domain)"

**Fix:** Add your Vercel domain to Firebase Authorized Domains
- Firebase Console → Authentication → Settings → Authorized domains

### ❌ "Permission denied" in Firestore

**Fix:** Check Firestore security rules are published
- Firebase Console → Firestore Database → Rules → Click "Publish"

### ❌ Blank page after deployment

**Fix:** 
- Check browser console for errors
- Verify `index.html` is in root directory
- Check Vercel deployment logs (in Vercel dashboard)

### ❌ Data not saving

**Fix:**
- Verify Firebase config is correct
- Check browser console for Firebase errors
- Ensure you're logged in
- Verify Firestore rules allow writes

### ❌ Build errors

**Fix:**
- Vercel should auto-detect static site
- If issues, check **Settings** → **Build & Development Settings**
- Ensure **Output Directory** is `.` or empty

---

## Updating Your Site

### Automatic Updates (GitHub Integration)

1. Make changes locally
2. Commit and push:
```bash
git add .
git commit -m "Update description"
git push
```
3. Vercel automatically deploys (check Vercel dashboard)

### Manual Update (CLI)

```bash
vercel --prod
```

---

## Vercel Dashboard Features

- **Deployments:** See all deployments and rollback if needed
- **Analytics:** View site performance (may require upgrade)
- **Logs:** Check deployment and runtime logs
- **Settings:** Configure environment variables, domains, etc.

---

## Environment Variables (If Needed)

If you need to hide Firebase config (not necessary, but possible):

1. Vercel Dashboard → Project → **Settings** → **Environment Variables**
2. Add variables:
   - `VITE_FIREBASE_API_KEY` = your API key
   - etc.
3. Update `firebase-config.js` to read from `process.env`

**Note:** For static sites, environment variables are exposed in the client bundle anyway, so this doesn't add security. Firebase security comes from Firestore rules.

---

## Quick Reference

| Task | Location |
|------|----------|
| Firebase Config | `firebase-config.js` |
| Firebase Console | [console.firebase.google.com](https://console.firebase.google.com/) |
| Vercel Dashboard | [vercel.com/dashboard](https://vercel.com/dashboard) |
| GitHub Repository | [github.com/YOUR_USERNAME/YOUR_REPO](https://github.com) |
| Add Authorized Domain | Firebase → Auth → Settings → Authorized domains |
| View Deployments | Vercel Dashboard → Your Project → Deployments |
| View Logs | Vercel Dashboard → Your Project → Deployments → Click deployment → Logs |

### GitHub Commands Quick Reference

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit changes
git commit -m "Your commit message"

# Connect to GitHub (first time only)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git push -u origin main

# For future updates
git add .
git commit -m "Update description"
git push
```

### Common GitHub Issues

**Issue: "remote origin already exists"**
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

**Issue: "Authentication failed"**
- Use Personal Access Token instead of password
- Create token: GitHub → Settings → Developer settings → Personal access tokens

**Issue: "Permission denied"**
- Make sure you have write access to the repository
- Check that you're using the correct repository URL

---

## Success Checklist

### Firebase Setup
- [ ] Firebase project created
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] `firebase-config.js` updated with real config
- [ ] Security rules published

### GitHub Setup
- [ ] GitHub account created
- [ ] New repository created on GitHub
- [ ] Git initialized in project folder (`git init`)
- [ ] Files committed (`git commit`)
- [ ] Repository connected (`git remote add origin`)
- [ ] Code pushed to GitHub (`git push`)
- [ ] Verified files appear on GitHub

### Vercel Deployment
- [ ] Vercel account created (connected with GitHub)
- [ ] Repository imported in Vercel
- [ ] Project configured (Framework: Other)
- [ ] Deployment successful
- [ ] Received Vercel URL

### Post-Deployment
- [ ] Vercel domain added to Firebase Authorized Domains
- [ ] Tested authentication (create account, login)
- [ ] Tested database (create boards, lists, cards)
- [ ] Verified data persists after refresh
- [ ] No errors in browser console
- [ ] Tested on multiple devices (if applicable)

**Once all checked, you're live! 🎉**

---

## Need Help?

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Firebase Docs:** [firebase.google.com/docs](https://firebase.google.com/docs)
- **Check Vercel Logs:** Dashboard → Deployments → Click deployment → Logs tab
- **Check Browser Console:** F12 → Console tab

