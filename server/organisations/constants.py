from enum import Enum


class OrganisationMemberRole(Enum):
    ADMIN = "admin"
    REGULAR = "regular"
    GUEST = "guest"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]
