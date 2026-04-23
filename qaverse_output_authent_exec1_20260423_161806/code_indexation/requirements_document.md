Software Requirements Specification (SRS)
Project: French-localized CLI authentication (auth_simple.py)
Date: 2026-04-23
Author: Analysis Output

1) Executive Summary
This document defines the functional and non-functional requirements for a simple, in-memory, password-authenticated CLI application implemented in Python (auth_simple.py). The system provides:
- An in-memory user credential store using SHA-256 hashes (no salt).
- A hash_password(password) function to compute SHA-256 hex digests.
- An authenticate(username, password) function that verifies credentials against the in-memory store.
- A command-line login flow with prompts and messages localized in French.
- A script entry point (main) that automatically triggers the login flow when executed directly, and does not trigger when imported as a module.
- Clear security caveats and limitations suitable for demonstration purposes (not production-ready).

2) Functional Requirements
Note: Each requirement is identified by REQ-001 through REQ-007 with priority, category, and acceptance criteria. Related code references are provided where applicable.

- REQ-001: In-memory user credential store with hashed passwords
  - Priority: High
  - Category: Data Processing
  - Description: The system maintains a simulated in-memory user database that maps usernames to their SHA-256 password hashes.
  - Acceptance Criteria:
    - A dictionary exists mapping usernames (e.g., 'admin', 'user') to their SHA-256 password hashes.
    - The authentication logic relies on comparing hashed input passwords to stored hashes.
  - Related code: users_db

- REQ-002: Password hashing function
  - Priority: High
  - Category: Data Processing
  - Description: Provide a function hash_password(password) that returns the SHA-256 hex digest of the given password.
  - Acceptance Criteria:
    - Given any password string, hash_password(password) returns the correct SHA-256 hex digest.
    - The function is used consistently for both input password processing and comparison against stored hashes.
  - Related code: hash_password

- REQ-003: User authentication
  - Priority: High
  - Category: Business Logic
  - Description: Authenticate a user by verifying that the provided username exists and the SHA-256 hash of the provided password matches the stored hash.
  - Acceptance Criteria:
    - authenticate('admin', 'admin123') returns True.
    - authenticate('user', 'user123') returns True.
    - Authenticate with an unknown username or incorrect password returns False.
  - Related code: authenticate, hash_password, users_db

- REQ-004: CLI login flow with French prompts
  - Priority: High
  - Category: UI
  - Description: Provide a command-line login flow that prompts for username and password using French labels and prints appropriate success or failure messages.
  - Acceptance Criteria:
    - Prompts shown are 'Nom d'utilisateur: ' and 'Mot de passe: '.
    - On successful authentication, prints ' Connexion r\u00e9ussie !' (Connexion réussie !).
    - On failed authentication, prints ' Identifiants incorrects'.
  - Related code: login

- REQ-005: Script entry point to trigger login
  - Priority: Medium
  - Category: Integration
  - Description: When the module is executed as the main program, it should initiate the login flow automatically.
  - Acceptance Criteria:
    - Running the file directly (not imported) starts the login process via login().
    - No login is triggered when the module is imported by another module.
  - Related code: __main__ guard, login

- REQ-006: UI localization and messaging
  - Priority: Low
  - Category: UI
  - Description: User prompts and messages are localized to French and are exactly as defined in the code.
  - Acceptance Criteria:
    - Prompts and messages match the French text used in the code.
    - No additional localization logic is introduced beyond the existing strings.
  - Related code: login, print statements

- REQ-007: Security considerations (not production-ready)
  - Priority: Low
  - Category: Business Logic
  - Description: This implementation uses SHA-256 without a salt and stores credentials in memory; it is not suitable for production use without enhancements.
  - Acceptance Criteria:
    - Code explicitly relies on unsalted SHA-256 hashes stored in memory.
    - No rate limiting, no account lockout, and no persistent credential store are implemented.
  - Related code: hash_password, users_db, __main__ guard

3) Non-Functional Requirements
- NFR-01: Security
  - The system uses unsalted SHA-256 hashes stored in memory. This design is explicitly non-production-ready; no salts, peppering, or persistent secure storage are implemented.
- NFR-02: Usability
  - The CLI prompts and messages are presented in French and are stable as defined, requiring no additional localization logic.
- NFR-03: Reliability
  - The authentication process is deterministic for given inputs; the in-memory store is ephemeral and resets when the process ends.
- NFR-04: Maintainability
  - The code is modularized with a small surface area (hash_password, authenticate, login). Clear function boundaries support future enhancements (e.g., salting, persistent storage).
- NFR-05: Portability/Compatibility
  - Implemented in Python (assumed Python 3.x). Uses standard library only (hashlib); no external dependencies required beyond the standard library.
- NFR-06: Performance
  - The in-memory approach and SHA-256 hashing are inexpensive for the small user set; performance is sufficient for demonstration purposes.
- NFR-07: Accessibility
  - No explicit accessibility features are provided beyond standard terminal prompts; this should be revisited for screen reader compatibility if required.

4) Business Rules
- BR-001: Password storage policy
  - Rule: Passwords are stored as SHA-256 hashes without salts in an in-memory store.
  - Implementation: In code, the users_db maps usernames to hashlib.sha256(password).hexdigest(). The authentication path hashes the input password and compares to the stored value.
  - Validation: Authentication succeeds only when the input password hash equals the corresponding stored hash; otherwise it fails.
- BR-002: Security posture disclaimer
  - Rule: This implementation is not production-ready due to absence of salt, rate limiting, and persistent secure storage.
  - Implementation: Commentary and REQ-007 indicate the lack of salting and other hardening measures.
  - Validation: Security reviews should flag the absence of salt and anti-br brute-force measures; any production deployment should address these concerns.

5) Data Requirements
- Data Elements
  - users_db: An in-memory dictionary mapping usernames (strings) to SHA-256 hex digest strings.
  - hash_password(password): Function returning a hex digest string representing the SHA-256 hash of the input password.
- Data Lifespan
  - All data resides in memory and exists only during program execution.
- Data Privacy and Security
  - Passwords are not stored in plaintext; they are stored as hashes. No salts or peppering are applied in current design.
- Data Flow Reference
  - User input -> login() -> hash_password(password) -> users_db[username] -> comparison -> authentication result -> output messages.

6) Integration Requirements
- Internal Modules
  - hashlib is used for hashing (hash_password implementation).
- External Dependencies
  - External API calls: There is an API dependency listed as "external_api_calls" in the provided analysis, but the code snippet does not demonstrate any real external API usage. If such calls exist in the broader project, they must be clearly versioned, secured, and accessible in the deployment environment.
- Entry points and execution flow
  - login() is the core CLI flow invoked by the __main__ guard when the module is executed directly.
  - When the module is imported, login() must not be automatically triggered.
- Data Interfaces
  - No external data interfaces are defined; all data resides in the in-memory store during runtime.

7) User Stories (Agile format)
- US-001: User login with valid credentials
  - As a user, I want to log in using a username and password so that I can access the system.
  - Acceptance Criteria:
    - Given a valid username and password, when I attempt to log in, authentication succeeds and the system prints ' Connexion r\u00e9ussie !' (Connexion réussie !).
  - Related Requirements: REQ-003, REQ-004
- US-002: Password hashing is used for authentication
  - As a developer, I want the system to hash passwords with SHA-256 before comparing, so that plaintext passwords are not stored or compared directly.
  - Acceptance Criteria:
    - Given any password, hash_password(password) produces a SHA-256 hex digest that is used for comparison against stored hashes.
  - Related Requirements: REQ-002, REQ-003
- US-003: French CLI prompts and feedback
  - As a user, I want to see login prompts and results in French, aligning with the UI language of the application.
  - Acceptance Criteria:
    - Prompts and messages shown match the strings in the code: 'Nom d'utilisateur: ', 'Mot de passe: ', '=== AUTHENTIFICATION ===', ' Connexion r\u00e9ussie !', ' Identifiants incorrects'.
  - Related Requirements: REQ-004, REQ-006

8) Acceptance Criteria (BDD format)
- REQ-003 BDD acceptance
  - Given a known username and correct password
  - When authenticate(username, password) is called
  - Then the result is True
- REQ-003 negative case
  - Given a known username with an incorrect password or an unknown username
  - When authenticate(username, password) is called
  - Then the result is False
- REQ-004 BDD acceptance (successful login)
  - Given any valid credentials
  - When the login flow runs
  - Then the system prints ' Connexion r\u00e9ussie !'
- REQ-004 BDD acceptance (failed login)
  - Given invalid credentials
  - When the login flow runs
  - Then the system prints ' Identifiants incorrects'
- REQ-005 BDD acceptance
  - Given the module is executed as __main__
  - When the module runs
  - Then login() is invoked automatically
- REQ-005 negative acceptance
  - Given the module is imported by another module
  - When the module loads
  - Then no login() invocation occurs

9) Technical Specifications
- Architecture Overview
  - A lightweight, single-module Python CLI application with three core functions:
    - hash_password(password) -> str: Computes the SHA-256 hex digest of the input string.
    - authenticate(username, password) -> bool: Verifies user existence and password hash match against the in-memory store.
    - login() -> None: Interactive CLI flow that prompts for username and password, computes the hash, validates authentication, and prints outcomes in French.
  - Data layer comprises an in-memory dictionary users_db mapping username strings to SHA-256 hex digest strings.
  - Entry point guarded by if __name__ == "__main__": trigger login() flow.
- Data Models
  - users_db: dict[str, str] mapping username -> sha256_hexhash
  - No persistent data model; all data is ephemeral during process lifetime.
- Algorithms
  - hash_password(password): return hashlib.sha256(password.encode('utf-8')).hexdigest()
  - authenticate(username, password):
    - if username not in users_db -> return False
    - input_hash = hash_password(password)
    - return input_hash == users_db[username]
- CLI Interface
  - Prompts:
    - "Nom d'utilisateur: "
    - "Mot de passe: "
  - Output messages:
    - "=== AUTHENTIFICATION ===" (header)
    - " Connexion r\u00e9ussie !" (success)
    - " Identifiants incorrects" (failure)
- Security Considerations
  - Passwords are stored as unsalted SHA-256 hashes in memory.
  - There is no rate limiting, no account lockout, and no persistent credential storage.
  - The implementation is explicitly labeled not production-ready; future enhancements should include salting, peppering, secure storage, and rate limiting.
- Testing Approach
  - Unit tests for hash_password() against known SHA-256 values.
  - Unit tests for authenticate() with valid and invalid credentials.
  - Manual end-to-end tests for login() flow to verify French prompts and messages.
- Internationalization
  - UI text is localized to French; no dynamic localization logic is introduced beyond existing strings.

10) Dependencies and Constraints
- Internal Libraries
  - hashlib (Python standard library)
- External Libraries
  - None required by the code (no third-party packages).
- Internal Modules
  - The module relies on hashlib for hashing; there are no additional internal modules specified beyond the functions described.
- API/External Dependencies
  - The analysis lists an external API dependency named external_api_calls, but the provided code does not demonstrate actual API interactions. If present in the broader project, these Calls should be documented, versioned, and secured appropriately.
- Constraints
  - The system must be executed in an environment where Python 3.x interpreter is available.
  - The in-memory credential store is ephemeral and cleared when the process ends.
  - The UI is strictly French as defined; no dynamic localization is implemented.
  - Security posture is intentionally weak (unsalted hashes, in-memory storage) for demonstration purposes only.

Appendix: Mappings to Analysis Artifacts
- auth_simple.py
  - hash_password(password) function (REQ-002)
  - authenticate(username, password) (REQ-003)
  - login() CLI flow with French prompts (REQ-004)
  - __main__ guard triggering login (REQ-005)
  - In-memory user store (REQ-001)
  - French UI strings and messages (REQ-006)
- Data Flows
  - User input -> login() -> hash_password -> users_db[username] -> comparison -> authentication result -> print messages
- Security Notes
  - REQ-007 and BR-001/BR-002 reflect the security posture and rationale
- User Stories and Acceptance
  - US-001, US-002, US-003 with associated acceptance criteria
  - Acceptance Criteria in BDD format provided for applicable requirements

This SRS provides a complete, actionable blueprint for implementing, testing, and extending the auth_simple.py functionality while clearly documenting scope and limitations for stakeholders and development teams. If you’d like, I can convert this into a conformance checklist or generate example test cases (unit and integration) aligned with the above requirements.