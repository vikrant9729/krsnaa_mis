"""RBAC Scope Service - Center-level access control."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.entities import Center, RoleEnum, User, UserCenterAssignment


def get_user_center_scope(user: User, db: Session) -> Optional[list[int]]:
    """
    Get list of center IDs a user can access.
    Returns None for ADMIN (access to all centers).
    """
    if user.role == RoleEnum.ADMIN:
        return None  # No restriction
    
    # Get directly assigned centers
    assignments = db.query(UserCenterAssignment.center_id).filter(
        UserCenterAssignment.user_id == user.id
    ).all()
    
    assigned_center_ids = [a[0] for a in assignments]
    
    if not assigned_center_ids:
        return []
    
    # For MANAGER: Include all child centers (hierarchical access)
    if user.role == RoleEnum.MANAGER:
        all_accessible = set(assigned_center_ids)
        
        # Recursively get all child centers
        def get_children(center_id: int):
            children = db.query(Center.id).filter(
                Center.parent_id == center_id
            ).all()
            for child_id in [c[0] for c in children]:
                all_accessible.add(child_id)
                get_children(child_id)
        
        for center_id in assigned_center_ids:
            get_children(center_id)
        
        return list(all_accessible)
    
    # For EDITOR and VIEWER: Only assigned centers
    return assigned_center_ids


def check_center_access(user: User, center_id: int, db: Session) -> bool:
    """Check if user has access to a specific center."""
    if user.role == RoleEnum.ADMIN:
        return True
    
    scope = get_user_center_scope(user, db)
    return center_id in scope if scope else False


def assign_center_to_user(
    db: Session,
    user_id: int,
    center_id: int,
) -> UserCenterAssignment:
    """Assign a center to a user."""
    # Check if already assigned
    existing = db.query(UserCenterAssignment).filter(
        UserCenterAssignment.user_id == user_id,
        UserCenterAssignment.center_id == center_id,
    ).first()
    
    if existing:
        return existing
    
    assignment = UserCenterAssignment(
        user_id=user_id,
        center_id=center_id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    
    return assignment


def remove_center_from_user(
    db: Session,
    user_id: int,
    center_id: int,
) -> bool:
    """Remove center assignment from user."""
    assignment = db.query(UserCenterAssignment).filter(
        UserCenterAssignment.user_id == user_id,
        UserCenterAssignment.center_id == center_id,
    ).first()
    
    if not assignment:
        return False
    
    db.delete(assignment)
    db.commit()
    return True


def get_user_assigned_centers(
    db: Session,
    user_id: int,
) -> list[Center]:
    """Get all centers assigned to a user."""
    assignments = db.query(UserCenterAssignment).filter(
        UserCenterAssignment.user_id == user_id
    ).all()
    
    center_ids = [a.center_id for a in assignments]
    
    if not center_ids:
        return []
    
    return db.query(Center).filter(Center.id.in_(center_ids)).all()
