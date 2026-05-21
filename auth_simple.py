import pytest

# Simulated authentication function
def login(username, password):
    valid_username = "admin"
    valid_password = "password123"

    if username == valid_username and password == valid_password:
        return "Login successful"
    else:
        return "Invalid username or password"


# Test: valid authentication
def test_login_valid():
    result = login("admin", "password123")
    assert result == "Login successful"


# Test: invalid authentication (wrong password)
def test_login_invalid_password():
    result = login("admin", "wrongpass")
    assert result == "Invalid username or password"


# Test: invalid authentication (wrong username)
def test_login_invalid_username():
    result = login("user", "password123")
    assert result == "Invalid username or password"


# Test: invalid authentication (empty fields)
def test_login_empty_fields():
    result = login("", "")
    assert result == "Invalid username or password"
