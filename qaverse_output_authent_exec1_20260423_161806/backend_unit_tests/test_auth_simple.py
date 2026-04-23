import pytest

def test_hash_password_matches_expected():
    from auth_simple import hash_password
    import hashlib as _hashlib
    assert hash_password("admin123") == _hashlib.sha256("admin123".encode()).hexdigest()

def test_authenticate_success():
    from auth_simple import authenticate
    assert authenticate("admin", "admin123") is True

def test_authenticate_wrong_password():
    from auth_simple import authenticate
    assert authenticate("admin", "wrong") is False

def test_authenticate_unknown_user():
    from auth_simple import authenticate
    assert authenticate("unknown", "anything") is False

def test_authenticate_with_empty_user_db(monkeypatch):
    import auth_simple
    monkeypatch.setattr(auth_simple, "users_db", {})
    from auth_simple import authenticate
    assert authenticate("admin", "admin123") is False

def test_login_success_flow(monkeypatch, capsys):
    import auth_simple
    inputs = iter(["admin", "admin123"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(inputs))
    auth_simple.login()
    captured = capsys.readouterr()
    assert "=== AUTHENTIFICATION ===" in captured.out
    assert " Connexion réussie !" in captured.out

def test_login_failure_flow(monkeypatch, capsys):
    import auth_simple
    inputs = iter(["user", "wrong"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(inputs))
    auth_simple.login()
    captured = capsys.readouterr()
    assert "=== AUTHENTIFICATION ===" in captured.out
    assert " Identifiants incorrects" in captured.out

def test_login_empty_credentials_flow(monkeypatch, capsys):
    import auth_simple
    inputs = iter(["", ""])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(inputs))
    auth_simple.login()
    captured = capsys.readouterr()
    assert "=== AUTHENTIFICATION ===" in captured.out
    assert " Identifiants incorrects" in captured.out

def test_hash_password_none_input_raises():
    from auth_simple import hash_password
    with pytest.raises(AttributeError):
        hash_password(None)