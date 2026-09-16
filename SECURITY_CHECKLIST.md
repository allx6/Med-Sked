# MedSked Security Checklist

This checklist records only evidence obtained during the September 16, 2026 verification pass. `Runtime Verified` means an actual request or executable test ran successfully; source inspection alone is not marked as runtime evidence.

| Control | Implemented | Runtime Verified | Evidence |
| --- | --- | --- | --- |
| bcrypt password hashing | Yes | Partial | `authRoutes.js` uses `bcrypt.hash` and `bcrypt.compare`; Atlas hash inspection was not completed |
| JWT authentication | Yes | Yes | Registration/login succeeded; protected request without a token returned `401` |
| Input validation | Yes | Yes | Invalid medication payload returned `400`; negative refill validation is enforced by route code |
| RBAC | Yes | Partial | Role and caregiver permission middleware are present; complete caregiver matrix was not completed |
| Patient ownership | Yes | Yes | Cross-account medication lookup returned non-disclosing `404` |
| Caregiver scoping | Yes | Partial | Active-relationship and patient-ID checks are present; unrelated-caregiver live test was not completed |
| BOLA prevention | Yes | Yes | User A could not retrieve User B's medication; no unauthorized mutation was observed |
| Authentication rate limiting | Yes | Yes | Seven failed synthetic logins returned `401, 401, 401, 429, 429, 429, 429`; limit is 5 per 15 minutes and successful requests are skipped |
| AES-256-GCM field encryption | Yes | Yes | Atlas round-trip stored ciphertext and returned decrypted notification text; modified ciphertext was rejected |
| Helmet | Yes | Not completed | `helmet()` is installed and mounted globally; clean header capture was blocked by the terminal prompt |
| CORS | Yes | Not completed | `cors()` is mounted globally; unauthorized-Origin runtime behavior still needs a clean HTTP-client check |
| Generic error handling | Yes | Not completed | Sanitized 404/error handlers are present; final runtime response check still needs a clean terminal |

## Local Configuration Blocker

The current local `backend/.env` has `MONGODB_URI` and `JWT_SECRET`, but no `ENCRYPTION_KEY`. Normal startup now fails fast until this is added:

```env
ENCRYPTION_KEY=YOUR_BASE64_32_BYTE_KEY
```

Use a locally generated base64 value that decodes to exactly 32 bytes. Never print, commit, or return the value. `backend/.env.example` contains placeholders only, and `.env` is ignored by Git.

## Professor Evidence Status

- Hashed password: NOT READY for Atlas screenshot until a synthetic user's password field is inspected and the value is redacted in shared evidence.
- Invalid payload blocked: READY, with a live `400` result.
- BOLA/ownership blocked: READY, with a live non-disclosing `404` result.
- Authentication rate limiting: READY, with a live `429` result and documented threshold.