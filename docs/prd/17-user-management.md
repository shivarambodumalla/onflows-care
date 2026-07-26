# Part 17 — User Management

## Objective

Control who can do what, and be able to prove afterwards what they did.

## Users

List with name, email, role, branches and last-active time. The current user is badged; inactive accounts are marked rather than hidden, because an account that vanished from the list is an account nobody audits.

Create and edit in a drawer: name, email, phone, role, branches, and specialisation for doctors. The drawer shows a **plain-language summary of what the selected role can do**, so assigning a role does not require reading a permission matrix.

## Roles

The permission matrix, rendered from `src/data/permissions.ts` — the same module the application enforces with. A matrix maintained separately from the code is a matrix that is wrong within a month.

Grouped by area, with a column per role and an explicit granted/withheld mark for every permission. Never a blank cell: blank is ambiguous between "no" and "not considered".

## Sessions

Live sessions with user, device, IP, sign-in time and last-seen. The current device is badged and cannot be terminated from here.

Ending a session signs that device out. Deactivating a user **revokes all of their sessions at once** — a deactivation that leaves an active session open is not a deactivation.

## Audit logs

Delegates to the audit trail (Part 11), which is the same event stream filtered to security-sensitive actions. Reachable from Timeline for owners and admins.

## Business rules

- Only the **owner** can change roles. An admin who could promote themselves is not a meaningful boundary.
- A user cannot deactivate themselves.
- Owners and admins see all branches regardless of their branch list; the drawer says so rather than letting the field imply otherwise.
- Deactivated users keep their history — timeline events still name them.
- User creation, edits, role changes, activation, deactivation and session termination are all audited with field-level changes.

## Permissions

| Action | Owner | Admin | Manager | Doctor | Receptionist |
|---|:--:|:--:|:--:|:--:|:--:|
| View users | ● | ● | ● | · | · |
| Create / edit | ● | ● | · | · | · |
| Change roles | ● | · | · | · | · |
| End sessions | ● | ● | · | · | · |
| View audit trail | ● | ● | · | · | · |

## Production note

This prototype has no authentication — the role switcher stands in for signing in. Production needs real identity, and the permission matrix must be enforced server-side. The client copy shapes the interface; it is not the security boundary.

## Acceptance criteria

1. The matrix renders every permission with an explicit mark for every role.
2. The matrix cannot disagree with enforced behaviour, because both read the same module.
3. Only an owner can change a role; the field is disabled with an explanation otherwise.
4. Deactivating a user ends all their sessions.
5. The current session cannot be terminated from the sessions list.
6. Every user-management action appears in the audit trail with before/after values.
7. Managers can view users but not modify them.
