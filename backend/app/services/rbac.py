from fastapi import HTTPException, status

from app.models.entities import RoleEnum, User


PERMISSIONS = {
    RoleEnum.ADMIN: {"*"},
    RoleEnum.MANAGER: {
        "center:read",
        "center:write",
        "dos:read",
        "dos:upload",
        "dos:edit",
        "dos:write",
        "rate:update",
        "ai:query",
        "ai:run",
        "audit:read_limited",
        "test:read",
        "test:write",
    },
    RoleEnum.EDITOR: {"center:read", "dos:edit", "rate:update", "audit:read_limited", "test:read", "test:write"},
    RoleEnum.VIEWER: {"center:read", "dos:read", "search:read", "test:read"},
    RoleEnum.AI_SYSTEM: {"dos:read", "ai:analyze", "audit:write"},
}


def require_permission(user: User, permission: str) -> None:
    granted = PERMISSIONS.get(user.role, set())
    if "*" in granted or permission in granted:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
