---
"fms-core": patch
---

Security: Implement critical security fixes including input validation, path traversal protection, DoS prevention, and secure random generation. Adds IP/port validation, buffer size limits, retry limits, path traversal protection for file operations, and replaces Math.random() with crypto.randomBytes() for cryptographic operations.
