from enum import Enum
from typing import List, Set


class Role(str, Enum):
    ADMIN = "admin"
    STAFF = "staff"
    CUSTOMER = "customer"


STAFF_AND_ADMIN: Set[Role] = {Role.ADMIN, Role.STAFF}
ADMIN_ONLY: Set[Role] = {Role.ADMIN}
ALL_ROLES: Set[Role] = {Role.ADMIN, Role.STAFF, Role.CUSTOMER}
