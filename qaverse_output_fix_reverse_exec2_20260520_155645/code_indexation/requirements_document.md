# Software Requirements Specification (SRS)

Executive Summary
- This document describes the requirements, rules, data flows, and technical specifications for a small in-memory authentication flow implemented in Python (auth_simple.py).
- The system provides a hash-based password mechanism (SHA-256), an in-memory user store, credential authentication, a French-language login user interface, and an automatic login flow when the module is executed as the main program.
- All requirements are derived directly from the source analysis and mapped to testable acceptance criteria to guide development and QA.

1) Functional Requirements
- REQ-001: Hash password using SHA-256
  - Description: The system must provide a function hash_password(password) that returns the SHA-256 hexadecimal digest of the input password.
  - Priority: High
  - Category: data_processing
  - Acceptance Criteria:
    - hash_password('any_password') returns a 64-character hexadecimal string
    - hash_password(password) equals hashlib.sha256(password.encode()).hexdigest()
  - Related Code: hash_password

- REQ-002: In-memory user credential store
  - Description: Maintain an in-memory dictionary (users_db) that maps usernames to their corresponding password hashes for authentication.
  - Priority: High
  - Category: data_processing
  - Acceptance Criteria:
    - Users 'admin' and 'user' exist in the store
    - Stored passwords are hashes, not plaintext
    - The store is in-memory and not persisted to disk
  - Related Code: users_db

- REQ-003: Authenticate credentials
  - Description: The function authenticate(username, password) must validate that the username exists and the hashed input password matches the stored hash.
  - Priority: High
  - Category: business_logic
  - Acceptance Criteria:
    - Returns True for valid username and correct password
    - Returns False if the username does not exist or the password is incorrect
  - Related Code: authenticate

- REQ-004: Login flow and user interaction
  - Description: The function login() must present a username and password prompt (in French), call the authentication logic, and print a success or failure message accordingly.
  - Priority: High
  - Category: ui
  - Acceptance Criteria:
    - Prompts shown: 'Nom d'utilisateur' and 'Mot de passe'
    - On success, prints 'Connexion réussie !'
    - On failure, prints 'Identifiants incorrects'
  - Related Code: login

- REQ-005: Script entry point starts login flow
  - Description: When the module is executed as the main program, the login flow (login()) must be started automatically.
  - Priority: Medium
  - Category: integration
  - Acceptance Criteria:
    - Running the script directly calls login()
    - No automatic login occurs when the module is imported
  - Related Code: __main__

2) Non-Functional Requirements
- Security and cryptography
  - Hash passwords using SHA-256; do not store plaintext passwords.
  - Authentication compares the hash of the input password to the stored hash.
- Data persistence and lifecycle
  - The user store (users_db) resides in memory only; data is lost when the process ends.
- Usability and localization
  - The login prompts are in French to support Francophone users.
- Performance and scalability
  - The system is designed for small in-memory usage; performance impact is negligible given the scale.
- Reliability and fault tolerance
  - Authentication returns a boolean result without throwing exceptions for common input errors.
- Portability and dependencies
  - Implemented in Python; relies on standard library (hashlib). No external dependencies.
- Maintainability
  - Clear separation between hashing, authentication, and login UI; unit-testable components.

3) Business Rules
- BR-001: Password hashing and authentication consistency
  - Rule: Passwords are stored as SHA-256 hashes and compared by hashing the input password during authentication.
  - Implementation: The in-memory store holds password hashes (hashes in users_db) and authenticate() compares the stored hash with hash_password(input_password).
  - Validation: Authentication succeeds only if the input password hashes to the same value as the stored hash for the given username.

4) Data Requirements
- Data model
  - users_db: A Python in-memory dictionary mapping username (string) to password_hash (string).
- Data contents
  - At minimum, usernames 'admin' and 'user' must exist in the store with their corresponding password hashes (not stored in plaintext).
- Data lifecycle and retention
  - Data is ephemeral and only persists for the lifetime of the running process; no disk persistence.
- Data security
  - Passwords are stored as SHA-256 hashes; there is no explicit salt handling in the described design.

5) Integration Requirements
- Module interactions
  - hash_password(password) is used to compute a password hash.
  - authenticate(username, password) uses the user store to verify credentials by comparing the stored hash with hash_password(input_password).
  - login() uses input prompts and prints results; it calls authenticate() as part of its flow.
  - When the module is executed as __main__, the login() function is invoked automatically.
- Interfaces
  - Public functions: hash_password(password: str) -> str, authenticate(username: str, password: str) -> bool, login() -> None
  - Data: users_db (in-memory dict) accessible within the module scope
- Testing and validation considerations
  - Tests should mock input() for login(), verify printed messages, and verify authentication results for various username/password combinations.
  - Tests should confirm that __main__ triggers login() while importing does not.

6) User Stories (Agile format)
- US-001: User can authenticate with username and password
  - Description: As a user, I want to login with a username and password so that I can authenticate to the system.
  - Acceptance Criteria:
    - Given valid credentials, When I attempt to login, Then I see 'Connexion réussie !'
    - Given invalid credentials, When I attempt to login, Then I see 'Identifiants incorrects'
  - Related Requirements: REQ-001, REQ-003, REQ-004

- US-002: Developer can run login flow directly
  - Description: As a developer, I want the login flow to start automatically when the script is run directly to ease testing.
  - Acceptance Criteria:
    - When the script is executed as __main__, login() is invoked
    - Login prompts appear and authentication flow executes
  - Related Requirements: REQ-005, REQ-004

7) Acceptance Criteria (BDD format where applicable)
- US-001 - Scenario: Successful login
  - Given a valid username and password existing in the in-memory store
  - When the user runs login() and provides the credentials
  - Then the system prints "Connexion réussie !" and authentication returns True

- US-001 - Scenario: Failed login due to invalid password
  - Given a valid username with a wrong password
  - When the user runs login() and provides the invalid password
  - Then the system prints "Identifiants incorrects" and authentication returns False

- US-002 - Scenario: Automatic login on direct script execution
  - Given the module is executed as the main program
  - When the program starts
  - Then login() is invoked and prompts are shown

8) Technical Specifications
- System overview
  - A small, single-module Python application (auth_simple.py) that provides:
    - A password hashing function
    - An in-memory user store with username-to-hash mappings
    - An authentication function that validates credentials
    - A French-language login user interface
    - An automatic login trigger when executed as the main program
- Architecture and components
  - Components:
    - hash_password(password: str) -> str
    - users_db: Dict[str, str] — in-memory mapping of username to password_hash
    - authenticate(username: str, password: str) -> bool
    - login() -> None — prompts for username and password in French; prints success/failure
    - __main__ entry point — invokes login() on direct script execution
- Data structures
  - users_db: { "admin": "<hash>", "user": "<hash>" } with hashes produced by hash_password(...)
- Interfaces and APIs
  - Public API:
    - hash_password(password: str) -> str
    - authenticate(username: str, password: str) -> bool
    - login() -> None
  - Data API:
    - users_db: Dict[str, str]
- Error handling and validation
  - authenticate returns False for non-existent users or mismatched passwords
  - login() handles standard input prompts; any unexpected exceptions should be surfaced during development and testing
- Security considerations
  - Passwords are hashed using SHA-256; no salts are applied in this design
  - No persistence beyond process lifetime; in-memory store ensures quick resets but requires re-seeding on restart
- Testing considerations
  - Unit tests for hash_password using known vectors
  - Unit tests for authenticate with valid/invalid credentials
  - Integration tests for login() with mocked input() and captured output
  - Tests to verify __main__ triggers login() and __init__ import does not
- Development and deployment
  - Language: Python 3.x
  - Standard library: hashlib, built-ins
  - No external dependencies

9) Dependencies and Constraints
- Dependencies
  - Python standard library (hashlib)
  - No external database or file I/O; in-memory store is by design
- Constraints
  - Data is ephemeral; on process restart all user data must be reinitialized or re-seeded
  - Passwords are stored as SHA-256 hashes without salting
  - UI prompts are in French; internationalization beyond the given prompts is not implemented
- Assumptions
  - The in-memory store is pre-seeded with at least 'admin' and 'user' accounts
  - The security model is suitable for demonstration or testing purposes, not production-grade authentication

Notes for Development and QA
- Provide seed data for users_db before tests; ensure hash_password is used to create password hashes for test accounts.
- Verify that __main__ behavior is isolated to direct script execution (e.g., if imported, login() should not run automatically).
- Include unit tests for each functional requirement to guard against regressions (hashing, authentication, CLI flow).
- Consider extending with salting and iteration in a future iteration to improve security.

This SRS is derived from the per-file analysis of auth_simple.py and maps concrete, testable requirements to support development, QA, and future enhancements. If you want, I can transform this into a lightweight test plan or generate example test cases (in both unit-test and BDD styles) aligned with your preferred testing framework.