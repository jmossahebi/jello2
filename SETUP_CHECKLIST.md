# Sign-In Setup Checklist

This document outlines what's been fixed and what you need to do to enable full authentication.

## ✅ What's Been Fixed in the Code

### 1. Authentication Flow Enabled
- **File**: `index.html` and `main.js`
- **Change**: Set `SKIP_LOGIN_OPEN_KANBAN = false`
- **Effect**: The login/register screen now shows instead of opening directly to Kanban
- **Status**: ✅ DONE

### 2. Register Button Handler Fixed
- **File**: `main.js`
- **Issue**: Register handler was calling `loginUser()` after `registerUser()`, but `registerUser()` already signs in the user via `createUserWithEmailAndPassword()`
- **Fix**: Removed redundant `loginUser()` call. Now button handler directly calls `showAppContent()` and `initApp()`
- **Effect**: Cleaner flow, no duplicate sign-in attempts
- **Status**: ✅ DONE

### 3. Firebase Configuration
- **File**: `firebase-config.js`
- **Status**: ✅ Already configured with project ID `jello-3b04a`
- **Action**: No changes needed

### 4. Firestore Rules
- **File**: `firestore.rules`
- **Status**: ✅ Rules file is correct and secure
- **Action**: **YOU MUST DEPLOY THESE** (see below)

## ⚠️ What You Need to Do

### Step 1: Deploy Firestore Rules
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **jello-3b04a**
3. Navigate to: **Firestore Database** → **Rules**
4. Replace the rules with contents of `firestore.rules` from this project
5. Click **Publish**
6. Wait for confirmation: "Rules published"

**Why**: Without published rules, Firestore will deny all read/write requests with "permission-denied" errors. Users won't be able to sign up because the app can't create their Firestore documents.

### Step 2: Add Authorized Domains
1. In Firebase Console, go to: **Authentication** → **Settings**
2. Scroll to: **Authorized domains**
3. Add your domains:
   - For local testing: `localhost` (and `127.0.0.1` if needed)
   - For Vercel: Your Vercel domain (e.g., `jello2.vercel.app`)
   - For custom domain: Your custom domain

**Why**: Firebase will block password reset emails and some auth flows if the domain isn't authorized.

### Step 3: Test the Flow
1. Local testing:
   - Run: `npm run start`
   - Navigate to: `http://localhost:3000`
   - Should see login/register screen (not kanban board)
   - Try signing up with a test email and password

2. Vercel testing:
   - Push changes to GitHub: `git push origin main`
   - Vercel will auto-deploy if configured
   - Navigate to your Vercel URL
   - Test sign-up and sign-in flow

## Expected Flow After Setup

### Sign-Up
1. User enters email and password on "Sign up" tab
2. Clicks "Sign up" button
3. registerUser() creates auth user and Firestore documents
4. User is signed in automatically
5. App loads the default board (created during sign-up)
6. User sees Kanban board with "My first board"

### Sign-In
1. User enters email and password on "Sign in" tab
2. Clicks "Sign in" button
3. loginUser() signs in the user
4. Auth listener fires, calls initApp()
5. App loads user's boards from Firestore
6. User sees their Kanban board

## Troubleshooting

### "We couldn't load your board" Error
This means authentication succeeded but Firestore is rejecting the request.
- **Likely cause**: Firestore rules not deployed
- **Fix**: Deploy rules from Step 1 above

### "Permission denied" in browser console
- **Check 1**: Navigate to Firebase → Firestore → Rules
- **Check 2**: Verify the rules from `firestore.rules` are published
- **Check 3**: Verify `firestore.rules` rules match expected format (lines 95-104 in FIREBASE_SETUP.md)

### Sign-up fails with error message
- **Email already in use**: Try different email
- **Password too weak**: Use at least 6 characters
- **Database permission denied**: Deploy Firestore rules (Step 1)
- **Network error**: Check internet connection

### Password reset doesn't work
- **Check**: Is the domain in Authorized Domains? (Step 2)
- **Check**: Domain must match exactly (e.g., `yourapp.vercel.app`, not `www.yourapp.vercel.app`)

## Files Modified

```
✅ index.html - SKIP_LOGIN_OPEN_KANBAN = false
✅ main.js - SKIP_LOGIN_OPEN_KANBAN = false + register handler fix
✅ .firebaserc - Added project ID for Firebase CLI
```

## Next Steps

1. **Now**: Deploy Firestore rules (see Step 1 above)
2. **Test**: Run `npm run start` and test sign-up
3. **Deploy**: Push to GitHub (git push origin main)
4. **Monitor**: Check Vercel deployment status
5. **Add domain**: Add your Vercel domain to Firebase Authorized Domains

Once these steps are complete, full authentication should work! 🎉
