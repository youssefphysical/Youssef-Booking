# Branch Protection — `main`

Repository: `youssefphysical/Youssef-Booking`  
Branch: `main`

## Active settings

| Setting | Value |
|---------|-------|
| `required_status_checks.strict` | `true` |
| `required_status_checks.contexts` | `["Playwright e2e"]` |
| `enforce_admins` | **`true`** — repo owners/admins **cannot** bypass required checks |
| `required_pull_request_reviews.required_approving_review_count` | `1` |
| `required_pull_request_reviews.dismiss_stale_reviews` | `true` |
| `allow_force_pushes` | `false` |
| `allow_deletions` | `false` |

`enforce_admins: true` was set via the GitHub API on 2026-05-28. Any PR targeting
`main` that has a failing "Playwright e2e" check cannot be merged — even by the repo
owner.

## Verification

```bash
# Read current protection (requires a token with repo scope)
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/youssefphysical/Youssef-Booking/branches/main/protection \
  | jq '{enforce_admins: .enforce_admins.enabled, required_checks: .required_status_checks.contexts}'
# Expected output:
# {
#   "enforce_admins": true,
#   "required_checks": ["Playwright e2e"]
# }
```

## Re-applying (if the rule is ever reset)

```bash
curl -X PUT \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/youssefphysical/Youssef-Booking/branches/main/protection \
  -d '{
    "required_status_checks": { "strict": true, "contexts": ["Playwright e2e"] },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": false,
      "require_last_push_approval": false,
      "required_approving_review_count": 1
    },
    "restrictions": null
  }'
```

The required GitHub token needs `repo` (or `administration:write`) scope on this
repository to modify branch protection rules.
