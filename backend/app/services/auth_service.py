from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import hash_password, verify_password, create_access_token


def register_user(db: Session, data: UserCreate) -> User:
    # Check if email already exists
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username already exists
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    # Create new user with hashed password
    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        # Privileges come from Project.owner_id, never from client registration data.
        role="member",
        full_name=data.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login_user(db: Session, email: str, password: str) -> dict:
    # Find user by email
    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    
    # Check password
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Create and return token (user.id is now UUID, convert to string for JWT)
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}
