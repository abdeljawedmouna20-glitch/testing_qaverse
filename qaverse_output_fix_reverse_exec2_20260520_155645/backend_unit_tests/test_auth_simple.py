import hashlib
import pytest
import auth_simple

def test_hash_password_matches_expected():
    assert auth_simple.hash_password("admin123") == hashlib.sha256("admin123".encode()).hexdigest()

def test_authenticate_valid_and_invalid():
    assert auth_simple.authenticate("admin", "admin123") is True
    assert auth_simple.authenticate("user", "user123") is True
    assert auth_simple.authenticate("admin", "wrong") is False
    assert auth_simple.authenticate("nonexistent", "anything") is False
    assert auth_simple.authenticate(None, "anything") is False
    assert auth_simple.authenticate("", "") is False

@pytest.mark.parametrize("username,password", [
    ("admin", "admin123"),
    ("user", "user123"),
])
def test_login_success(username, password, monkeypatch, capsys):
    inputs = iter([username, password])
    def fake_input(prompt=''):
        return next(inputs)
    monkeypatch.setattr("builtins.input", fake_input)
    auth_simple.login()
    captured = capsys.readouterr()
    assert "=== AUTHENTIFICATION ===" in captured.out
    assert " Connexion réussie" in captured.out

@pytest.mark.parametrize("username,password", [
    ("admin", "wrong"),
    ("user", "incorrect"),
    ("nonexistent", "any"),
])
def test_login_failure(username, password, monkeypatch, capsys):
    inputs = iter([username, password])
    def fake_input(prompt=''):
        return next(inputs)
    monkeypatch.setattr("builtins.input", fake_input)
    auth_simple.login()
    captured = capsys.readouterr()
    assert "=== AUTHENTIFICATION ===" in captured.out
    assert " Identifiants incorrects" in captured.out