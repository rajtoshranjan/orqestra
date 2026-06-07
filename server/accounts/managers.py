from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.password_validation import validate_password


class UserManager(BaseUserManager):
    def create_user(self, email: str, password: str = None, **extra_fields):
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)

        # Raise Validation Error invalid password.
        if password:
            validate_password(password)
            user.set_password(password)
        else:
            user.set_unusable_password()

        user.save()
        return user

    def create_superuser(self, email: str, password: str = None, **extra_fields):
        extra_fields.setdefault("is_active", True)
        return self.create_user(email, password, **extra_fields)
