Software Requirements Specification (SRS)
Auth Simple Python Console Application

Executive Summary
This document specifies the functional and non-functional requirements for a lightweight, in-memory, SHA-256 based authentication demo implemented in Python (auth_simple.py). The system provides a simulated user database with hashed passwords, a hashing function, an authentication check, and a French-language login user interface. When executed as a script, the application automatically launches the interactive login flow. The solution is intended for development, demonstration, and QA validation of authentication concepts, hashing usage, and simple UI messaging.

1. Functional Requirements
Each requirement below includes an ID, title, description, priority, category, acceptance criteria, and related code references.

REQ-001 — Simulated user database with hashed passwords
- Description: Maintain an in-memory mapping of username to the SHA-256 hash of the user’s password. The database is pre-populated with two users: 'admin' with password 'admin123' and 'user' with password 'user123'.
- Priority: High
- Category: Data Processing
- Acceptance Criteria:
  - The users_db contains keys 'admin' and 'user'.
  - The stored values are SHA-256 hashes of 'admin123' and 'user123' respectively.
  - There is no plaintext password stored in the code; only hashed values are kept in memory.
- Related Code: users_db, hash_password

REQ-002 — Password hashing function
- Description: Provide a function hash_password(password) that returns the SHA-256 hexadecimal digest of the given password.
- Priority: High
- Category: Data Processing
- Acceptance Criteria:
  - hash_password('admin123') equals the stored hash for admin in the database.
  - hash_password('') returns the SHA-256 hash for an empty string (64 hex characters).
  - The implementation uses hashlib.sha256 with .encode() before hashing.
- Related Code: hash_password

REQ-003 — User authentication check
- Description: Authenticate credentials by verifying that the username exists in the simulated database and that the SHA-256 hash of the provided password matches the stored hash. Returns true for valid credentials and false otherwise.
- Priority: High
- Category: Business Logic
- Acceptance Criteria:
  - authenticate('admin', 'admin123') returns True.
  - authenticate('user', 'user123') returns True.
  - authenticate('admin', 'wrong') returns False.
  - authenticate('nonexistent', 'any') returns False.
- Related Code: authenticate

REQ-004 — Login user interface flow
- Description: Provide an interactive login flow via the login() function that prints a header, prompts for username and password, calls authentication, and prints a success or failure message in French.
- Priority: High
- Category: UI
- Acceptance Criteria:
  - Program prints '=== AUTHENTIFICATION ===' and prompts 'Nom d'utilisateur: ' and 'Mot de passe: '.
  - On successful authentication, prints ' Connexion r?ussie !' (Note: the actual string contains a non-ASCII character; the expected output is the provided accented phrase).
  - On failed authentication, prints ' Identifiants incorrects'.
- Related Code: login

REQ-005 — Application entry point behavior
- Description: When the module is run as the main program, automatically invoke the login() function to start the interactive authentication session.
- Priority: High
- Category: UI
- Acceptance Criteria:
  - The code path __name__ == '__main__' triggers login().
- Related Code: __main__, login

2. Non-Functional Requirements
- Performance
  - In-memory data store and hashing operations must complete within a few milliseconds for typical inputs; no disk I/O is involved during authentication.
- Security
  - Passwords must never be stored in plaintext; only SHA-256 hashes are stored and compared.
  - All password handling must rely on hash_password() for hashing and comparison.
- Reliability
  - The authentication flow should deterministically return True/False for given inputs, with no random or non-deterministic behavior.
- Usability
  - The login prompt and header are presented in a concise, clear manner; messages are in French, as specified.
- Portability
  - The solution uses only standard Python libraries (hashlib); runs on Python 3.x environments.
- Maintainability
  - Functions are named clearly (hash_password, authenticate, login) and are separated by responsibilities to simplify unit testing and future enhancements.
- Documentation
  - The SRS and in-code documentation (where applicable) should reflect the data model (users_db) and the hashing approach.
- Observability
  - Console outputs are the primary means of user feedback; no external logging framework is required for this scope.

3. Business Rules
BR-001 — Access control via existing usernames and correct password hash
- Rule: Only existing usernames in the users_db can attempt authentication and must provide the correct password hash for access.
- Implementation: In authenticate(username, password), the system first checks membership of username in users_db; if present, it hashes the provided password using hash_password and compares it to the stored hash. Access is granted only if hashes match.
- Validation: Return value is True only when username exists and the hashed input password equals the stored hash; otherwise False.

BR-002 — Hash-based password handling
- Rule: All password handling must operate on hashed values; plaintext passwords are never stored or compared.
- Implementation: Password literals in code are hashed at storage time; authentication uses hash_password to compare hashes, never compares plaintexts.
- Validation: Accounts for both admin and user rely on hashed verification; any plaintext password comparison should be avoided.

4. Data Requirements
- Data Model
  - users_db: A dictionary mapping username (string) to password_hash (string).
  - Pre-populated users:
    - 'admin' -> SHA-256('admin123')
    - 'user' -> SHA-256('user123')
- Hashing
  - Function: hash_password(password) -> str
  - Hashing algorithm: SHA-256
  - Encoding: password.encode() before hashing
- Data Integrity
  - Passwords stored are hashes only; no plaintext passwords are stored in memory.
  - All password verifications use hash_password and hash comparison against users_db.

5. Integration Requirements
- Internal Module Interactions
  - hash_password(password) computes a hex digest of the input.
  - authenticate(username, password) uses hash_password(password) and compares against users_db[username].
  - login() orchestrates the user interface flow: prints header, prompts for username and password, calls authenticate, and prints the outcome in French.
- Data Flow
  - User input is captured from the console.
  - The password input is passed to authenticate() for verification.
  - The authentication result is rendered to stdout with the appropriate message.
- Entry Point
  - When the module runs as the main program (__name__ == '__main__'), login() is invoked automatically.

6. User Stories (Agile format)
US-001 — User authentication capability
- As a user, I want to log in using a username and password so that the system authenticates valid credentials and denies invalid ones.
- Acceptance Criteria (BDD-style):
  - Given a valid username and correct password (e.g., admin/admin123 or user/user123), authentication succeeds and the login flow indicates success.
  - Given an invalid combination or a non-existent username, authentication fails and the login flow indicates failure.
  - The password verification uses SHA-256 hashing and does not compare plaintext passwords.
- Related Requirements: REQ-003, REQ-004

US-002 — Security-conscious password handling
- As a system administrator, I want the system to use hashed passwords (SHA-256) and not store plaintext passwords in code.
- Acceptance Criteria (BDD-style):
  - Passwords stored in the in-memory database are hashes, not plaintext.
  - The hash_password function is the sole mechanism used to compute password hashes for verification.
- Related Requirements: REQ-001, REQ-002

7. Acceptance Criteria (BDD Scenarios)
- Scenario: Successful authentication
  - Given a username 'admin' and password 'admin123'
  - When authenticate is invoked
  - Then the result is True
- Scenario: Failed authentication with wrong password
  - Given a username 'admin' and password 'wrong'
  - When authenticate is invoked
  - Then the result is False
- Scenario: Non-existent user
  - Given a username 'ghost' and any password
  - When authenticate is invoked
  - Then the result is False
- Scenario: Login UI flow (successful)
  - Given the program is executed
  - When the login flow prompts for username and password
  - And the user provides valid credentials
  - Then the console prints the success message: " Connexion r\u00e9ussie !"
- Scenario: Login UI flow (failure)
  - Given the program is executed
  - When the login flow prompts for username and password
  - And the user provides invalid credentials
  - Then the console prints the failure message: " Identifiants incorrects"
Note: The acceptance messages follow the exact strings described in REQ-004 (including the accented characters).

8. Technical Specifications
- Architecture
  - Single-file Python module (auth_simple.py) implementing:
    - users_db: dict[str, str] with pre-populated hashed values
    - hash_password(password: str) -> str: returns SHA-256 hex digest
    - authenticate(username: str, password: str) -> bool: verifies username exists and password hash matches stored hash
    - login() -> None: console-based interactive UI flow
    - __main__ entry point: if __name__ == '__main__': login()
- Data Model
  - users_db = {
      'admin': hash_password('admin123'),
      'user': hash_password('user123')
    }
- Algorithms and Security
  - SHA-256 used for password hashing
  - Password handling uses hash_password() for all comparisons
  - No plaintext password storage or comparison
- Interfaces
  - Console-based user interface (stdin/stdout)
  - Prompts:
    - Header: "=== AUTHENTIFICATION ===" (as per REQ-004)
    - Username prompt: "Nom d'utilisateur: "
    - Password prompt: "Mot de passe: "
  - Result messages:
    - Success: " Connexion r\u00e9ussie !"
    - Failure: " Identifiants incorrects"
- Testing Considerations
  - Unit tests should cover:
    - hash_password('admin123') matches the stored admin hash
    - hash_password('') returns the correct SHA-256 hash for empty string
    - authenticate with valid credentials returns True
    - authenticate with invalid credentials returns False
  - Manual QA should verify the French UI prompts and messages appear exactly as specified.

9. Dependencies and Constraints
- Dependencies
  - Python standard library: hashlib for SHA-256 hashing
  - No external dependencies required
- Constraints
  - This is an in-memory, non-persistent authentication demo; the user database does not persist beyond runtime.
  - Messages and prompts are targeted to a console-based UI in French, suitable for CLI use.
  - The solution assumes a Python 3.x runtime with standard libraries available.
- Environment Considerations
  - Works in typical development, test, and CI environments that support Python 3.x
  - The security model relies on in-memory hashed values; no database or file I/O is used for credential storage in this scope.

Traceability (optional quick reference)
- REQ-001 ↔ In-memory users_db pre-populated with admin and user
- REQ-002 ↔ hash_password implementation using hashlib.sha256
- REQ-003 ↔ authenticate function validating username existence and password hash match
- REQ-004 ↔ login() UI flow and French prompts/messages
- REQ-005 ↔ __main__ entry triggers login() automatically
- US-001 ↔ REQ-003, REQ-004; validates authentication flow in UI
- US-002 ↔ REQ-001, REQ-002; emphasizes hashed password handling

Notes for Development and QA
- Ensure that the in-memory users_db is initialized at module load time with correct hashed values. The actual hashed values must correspond to admin123 and user123.
- Validate that no plaintext passwords appear in code execution paths related to authentication.
- Confirm the UI messages match the exact strings in the acceptance criteria, including spacing and accents.
- Implement unit tests for hash_password and authenticate to prevent regression.
- For QA, verify behavior when running as a script versus importing as a module (the login() flow should only auto-run when executed as main).

This SRS provides a complete, actionable blueprint for developers and QA engineers to implement, test, and validate the authentication demo described by the provided per-file analysis results.