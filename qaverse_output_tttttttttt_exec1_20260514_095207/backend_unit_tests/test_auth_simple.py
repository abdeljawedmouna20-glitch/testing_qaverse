import pytest

def test_hash_password_matches_users_db():
    import auth_simple
    assert auth_simple.hash_password("admin123") == auth_simple.users_db["admin"]

def test_authenticate_valid_user_correct_password():
    import auth_simple
    assert auth_simple.authenticate("admin", "admin123") is True

def test_authenticate_valid_user_wrong_password():
    import auth_simple
    assert auth_simple.authenticate("admin", "wrong") is False

def test_authenticate_unknown_user():
    import auth_simple
    assert auth_simple.authenticate("ghost", "any") is False

def test_authenticate_none_password_raises():
    import auth_simple
    with pytest.raises(AttributeError):
        auth_simple.authenticate("admin", None)

def test_login_success_output(monkeypatch, capsys):
    inputs = iter(["admin", "admin123"])
    def mock_input(prompt=None):
        return next(inputs)
    monkeypatch.setattr("builtins.input", mock_input)
    import auth_simple
    auth_simple.login()
    captured = capsys.readouterr()
    assert " Connexion réussie !" in captured.out

def test_login_failure_output(monkeypatch, capsys):
    inputs = iter(["admin", "wrong"])
    def mock_input(prompt=None):
        return next(inputs)
    monkeypatch.setattr("builtins.input", mock_input)
    import auth_simple
    auth_simple.login()
    captured = capsys.readouterr()
    assert " Identifiants incorrects" in captured.out

def test_login_success_with_mock(monkeypatch):
    inputs = iter(["user", "anything"])
    def mock_input(prompt=None):
        return next(inputs)
    monkeypatch.setattr("builtins.input", mock_input)
    import auth_simple
    monkeypatch.setattr(auth_simple, "authenticate", lambda u, p: True)
    auth_simple.login()
    # If authenticate is mocked to return True, the success message should appear
    import sys
    captured = pytest.MonkeyPatch().context()
    # Use capsys by re-importing to verify output
    from pytest import capture  # type: ignore
    with capture() as cap:
        auth_simple.login()
    output = cap.readouterr().out
    assert " Connexion réussie !" in output

def test_login_failure_with_mock(monkeypatch, capsys):
    inputs = iter(["user", "wrong"])
    def mock_input(prompt=None):
        return next(inputs)
    monkeypatch.setattr("builtins.input", mock_input)
    import auth_simple
    monkeypatch.setattr(auth_simple, "authenticate", lambda u, p: False)
    auth_simple.login()
    captured = capsys.readouterr()
    assert " Identifiants incorrects" in captured.out