# Security

Please report vulnerabilities privately through [GitHub security advisories](https://github.com/akhsterminator/firstframe-osint/security/advisories/new), not in public issues.

Things we especially want to hear about:

- Any way an unblurred frame can be stored, served or sent to a third party
- Query injection into Overpass or Nominatim from model output or user input
- Path traversal or arbitrary file reads through the files route or uploads
- Server-side request forgery through the URL fetchers

If you run a public instance, keep `FF_RATE_LIMIT` on: every check spends API credits.
