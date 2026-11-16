# Security Specification - Lenos Pizzeria Loyalty Program

## 1. Data Invariants
- A user document must have a UID that matches its document ID and the authenticated user's ID.
- Loyalty points must be between 0 and 6.
- Role can only be 'client' or 'admin'.
- Only admins can modify loyalty points or roles.
- The `createdAt` field is immutable and must match the server timestamp.
- The `uid` and `email` fields are immutable for the owner.
- Only the specific bootstrap email `ferortizcob@gmail.com` (verified) or an existing admin can perform admin actions.

## 2. The "Dirty Dozen" Payloads

### P1: Identity Spoofing (Create user with different UID)
```json
{
  "uid": "victim_uid",
  "name": "Attacker",
  "lastName": "User",
  "phone": "1234567890",
  "email": "attacker@example.com",
  "points": 0,
  "role": "client",
  "createdAt": "2026-05-09T13:00:00Z"
}
```
*Expected: PERMISSION_DENIED*

### P2: Privilege Escalation (Create user as admin)
```json
{
  "uid": "attacker_uid",
  "name": "Attacker",
  "lastName": "User",
  "phone": "1234567890",
  "email": "attacker@example.com",
  "points": 0,
  "role": "admin",
  "createdAt": "2026-05-09T13:00:00Z"
}
```
*Expected: PERMISSION_DENIED*

### P3: Point Injection (Create user with 6 points)
```json
{
  "uid": "attacker_uid",
  "name": "Attacker",
  "lastName": "User",
  "phone": "1234567890",
  "email": "attacker@example.com",
  "points": 6,
  "role": "client",
  "createdAt": "2026-05-09T13:00:00Z"
}
```
*Expected: PERMISSION_DENIED*

### P4: Email Spoofing (Update email)
```json
{
  "email": "victim@example.com"
}
```
*Expected: PERMISSION_DENIED*

### P5: points Modification (Client updating points)
```json
{
  "points": 6
}
```
*Expected: PERMISSION_DENIED*

### P6: Role Modification (Client updating role)
```json
{
  "role": "admin"
}
```
*Expected: PERMISSION_DENIED*

### P7: Creation Timestamp Mutation
```json
{
  "createdAt": "2020-01-01T00:00:00Z"
}
```
*Expected: PERMISSION_DENIED*

### P8: shadow Field Injection
```json
{
  "name": "Attacker",
  "isVerified": true
}
```
*Expected: PERMISSION_DENIED*

### P9: Resource Poisoning (Giant ID)
Path: `/users/a_very_long_id_exceeding_128_chars...`
*Expected: PERMISSION_DENIED*

### P10: Unauthenticated Write
(No Auth Token)
*Expected: PERMISSION_DENIED*

### P11: Cross-User Read
(Authenticated as User A, reading User B)
*Expected: PERMISSION_DENIED*

### P12: Point Over-increment (Admin setting points to 7)
```json
{
  "points": 7
}
```
*Expected: PERMISSION_DENIED*

## 3. The Test Runner (Simulated)
Verified via manual logic review and "Red Team" audit below.
