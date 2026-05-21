import hashlib
import pytest


def test_hash_password_consistency():
    import auth_simple as auth
    assert auth.hash_password("admin123") == auth.users_db["admin"]


def test_authenticate_success_and_failure():
    import auth_simple as auth
    # Correct credentials
    assert auth.authenticate("admin", "admin123") is True
    assert auth.authenticate("user", "user123") is True

    # Incorrect password
    assert auth.authenticate("admin", "wrong") is False

    # Unknown user
    assert auth.authenticate("unknown", "nopass") is False

    # Edge case: empty password
    assert auth.authenticate("admin", "") is False

    # Edge case: empty username
    assert auth.authenticate("", "admin123") is False


def test_authenticate_with_patched_users_db(monkeypatch):
    import auth_simple as auth
    fake_db = {"alice": hashlib.sha256("secret".encode()).hexdigest()}
    monkeypatch.setattr(auth, "users_db", fake_db, raising=False)

    assert auth.authenticate("alice", "secret") is True
    assert auth.authenticate("alice", "wrong") is False
    assert auth.authenticate("bob", "secret") is False


def test_login_success(monkeypatch, capsys):
    import auth_simple as auth
    inputs = iter(["admin", "admin123"])

    def fake_input(prompt=None):
        return next(inputs)

    monkeypatch.setattr("builtins.input", fake_input)
    auth.login()
    captured = capsys.readouterr()
    assert " Connexion réussie" in captured.out


def test_login_failure(monkeypatch, capsys):
    import auth_simple as auth
    inputs = iter(["admin", "wrongpass"])

    def fake_input(prompt=None):
        return next(inputs)

    monkeypatch.setattr("builtins.input", fake_input)
    auth.login()
    captured = capsys.readouterr()
    assert " Identifiants incorrects" in captured.out