# Quick Deployment Checklist

Use this checklist to ensure everything is set up correctly before and after deployment.

## Pre-Deployment Checklist

- [ ] Firebase project created
- [ ] Email/Password authentication enabled in Firebase Console
- [ ] Firestore database created (test mode is OK initially)
- [ ] Firebase config copied from Firebase Console
- [ ] `firebase-config.js` updated with actual config values
- [ ] Firestore security rules configured and published
- [ ] Tested locally (can create account, login, create boards)

## Deployment Steps (Vercel)

- [ ] Code pushed to GitHub (or ready for Vercel CLI)
- [ ] Created Vercel account and connected GitHub
- [ ] Imported repository in Vercel
- [ ] Configured project (Framework: Other, no build command)
- [ ] Deployed to Vercel
- [ ] Received Vercel deployment URL

## Post-Deployment Checklist

- [ ] Added Vercel domain to Firebase Authorized Domains
  - Firebase Console > Authentication > Settings > Authorized domains
  - Add: `your-project.vercel.app`
- [ ] Tested authentication (create account, login, logout)
- [ ] Tested database operations (create/edit/delete boards, lists, cards)
- [ ] Verified data persists after page refresh
- [ ] Checked browser console for errors (F12)
- [ ] Tested on multiple devices/browsers (if applicable)

## Common Issues to Check

- [ ] No "unauthorized-domain" errors
- [ ] No "permission denied" errors in Firestore
- [ ] Firebase API calls working (check Network tab)
- [ ] HTTPS enabled (required for Firebase)
- [ ] All file paths are relative (not absolute)

## Security Checklist

- [ ] Firestore security rules published
- [ ] Rules restrict access to authenticated users only
- [ ] Users can only access their own data
- [ ] No sensitive data exposed in client-side code

---

**Quick Test:**
1. Visit your deployed site
2. Create an account
3. Create a board with a list and card
4. Refresh the page
5. Data should still be there ✅

If all checks pass, your app is ready! 🎉

