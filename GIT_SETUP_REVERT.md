# How to Revert Git Configuration Changes

This document explains how to undo the personal GitHub account setup for this repository if you experience any issues (like constant GitHub account prompts in VSCode).

## What Was Changed

1. **SSH Key Created**: A new SSH key was generated at `~/.ssh/id_ed25519_personal`
2. **SSH Config Created**: An SSH config file was created at `~/.ssh/config` with a `github-personal` alias
3. **Local Git Config**: This repository's git user was set to:
   - Name: CharlieGitDB
   - Email: charliedeveloperaccess@gmail.com
4. **Remote URL**: This repository's remote was configured to use the personal SSH key via the `github-personal` alias

## How to Revert Everything

### Step 1: Restore Git User to Work Account

```bash
# Remove local git config (will revert to global config)
git config --local --unset user.name
git config --local --unset user.email

# Verify it now uses your global config
git config user.name
git config user.email
```

### Step 2: Change Remote Back to HTTPS (or Work SSH)

**Option A: Switch to HTTPS (Recommended)**
```bash
# Replace YOUR_USERNAME and YOUR_REPO with actual values
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Verify
git remote -v
```

**Option B: Switch to Default SSH**
```bash
# Replace YOUR_USERNAME and YOUR_REPO with actual values
git remote set-url origin git@github.com:YOUR_USERNAME/YOUR_REPO.git

# Verify
git remote -v
```

### Step 3: Remove SSH Configuration

**Option A: Remove Just the Personal Alias (Safest)**
```bash
# Edit the SSH config file
nano ~/.ssh/config
# Or on Windows with VSCode:
code ~/.ssh/config

# Delete these lines:
# Host github-personal
#     HostName github.com
#     User git
#     IdentityFile ~/.ssh/id_ed25519_personal
#     IdentitiesOnly yes
```

**Option B: Remove Entire SSH Config (If It Was Empty Before)**
```bash
rm ~/.ssh/config
```

### Step 4: (Optional) Remove the SSH Key

If you want to completely remove the personal SSH key:

```bash
# Remove the private key
rm ~/.ssh/id_ed25519_personal

# Remove the public key
rm ~/.ssh/id_ed25519_personal.pub

# Remove from GitHub
# Go to: https://github.com/settings/keys
# Find the key labeled for this project and delete it
```

## Quick Revert (All Steps at Once)

```bash
# 1. Remove local git config
git config --local --unset user.name
git config --local --unset user.email

# 2. Switch to HTTPS (replace YOUR_USERNAME/YOUR_REPO)
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# 3. Remove SSH config
rm ~/.ssh/config

# 4. (Optional) Remove SSH keys
rm ~/.ssh/id_ed25519_personal
rm ~/.ssh/id_ed25519_personal.pub
```

## Verify Everything is Reverted

```bash
# Check git user (should show work account)
git config user.name
git config user.email

# Check remote URL (should be HTTPS or work SSH)
git remote -v

# Check SSH config (should not exist or not have github-personal)
cat ~/.ssh/config

# Check SSH keys (should not exist)
ls -la ~/.ssh/id_ed25519_personal*
```

## Troubleshooting

### Still Getting Account Prompts?

1. Check Windows Credential Manager:
   - Search for "Credential Manager" in Windows
   - Go to "Windows Credentials"
   - Remove any GitHub-related credentials
   - Try git operations again

2. Clear VSCode's GitHub authentication:
   - In VSCode: `Ctrl+Shift+P`
   - Type: "GitHub: Logout"
   - Sign back in with your work account

3. Restart VSCode and try again

### Need More Help?

- GitHub's official guide on multiple accounts: https://docs.github.com/en/authentication
- Git credential helper docs: https://git-scm.com/docs/gitcredentials

## Notes

- These changes only affected THIS repository locally
- Your global git config remains unchanged (work account)
- Other repositories were not affected
- Removing the SSH key from your local machine does NOT remove it from GitHub - do that manually at https://github.com/settings/keys
