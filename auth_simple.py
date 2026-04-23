import hashlib

# Base de données simulée (username: password hash)
users_db = {
    "admin": hashlib.sha256("admin123".encode()).hexdigest(),
    "user": hashlib.sha256("user123".encode()).hexdigest()
}

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def authenticate(username, password):
    if username in users_db:
        hashed_input = hash_password(password)
        if users_db[username] == hashed_input:
            return True
    return False

def login():
    print("=== AUTHENTIFICATION ===")
    username = input("Nom d'utilisateur: ")
    password = input("Mot de passe: ")

    if authenticate(username, password):
        print(" Connexion réussie !")
    else:
        print(" Identifiants incorrects")

if __name__ == "__main__":
    login()