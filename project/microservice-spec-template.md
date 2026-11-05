# Microservice Specification Template

## 1. Service Overview
**Service Name:** `[service-name]`  
**Domain:** `[business-domain]`  
**Owner/Team:** `[team-name]`  
**Version:** `[version]`

### Purpose
Brief description of what this service does and why it exists.

### Key Responsibilities
- Responsibility 1
- Responsibility 2
- Responsibility 3

---

## 2. Business Scope & Definition

### Business Context
Describe the business problem this service solves and its role in the larger system.

### Bounded Context
Define the boundaries of this service's domain:
- **In Scope:** What this service handles
- **Out of Scope:** What this service does NOT handle
- **Dependencies:** Other services/systems this relies on

### Business Rules
1. **Rule Name/ID:** Description of the business rule
   - Condition: When does this apply?
   - Action: What happens?
   - Priority: Critical/High/Medium/Low

### Domain Terminology
| Term | Definition | Example |
|------|------------|---------|
| Term1 | What it means in this context | Sample value |
| Term2 | What it means in this context | Sample value |

---

## 3. Functional Requirements

### Use Cases
#### UC-001: [Use Case Name]
- **Actor:** Who initiates this?
- **Preconditions:** What must be true before?
- **Main Flow:** Step-by-step normal flow
- **Alternative Flows:** What are the variations?
- **Postconditions:** What's true after success?

### API Endpoints

#### Endpoint 1: [HTTP Method] /path/to/resource
**Purpose:** What this endpoint does

**Request:**
```json
{
  "field1": "string",
  "field2": 123,
  "nested": {
    "field3": true
  }
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "field1": "value"
  }
}
```

**Response (Error - 4xx/5xx):**
```json
{
  "status": "error",
  "errorCode": "ERR_CODE",
  "message": "Human readable message",
  "details": {}
}
```

---

## 4. Validation Rules

### Input Validations

#### Endpoint/Operation: [Name]
| Field | Type | Required | Validation Rule | Error Code |
|-------|------|----------|-----------------|------------|
| email | string | Yes | Valid email format, max 255 chars | VAL_001 |
| age | integer | No | Min: 0, Max: 150 | VAL_002 |
| status | enum | Yes | One of: [ACTIVE, INACTIVE, PENDING] | VAL_003 |

### Business Validations
| Validation ID | Description | Trigger Condition | Error Code |
|---------------|-------------|-------------------|------------|
| BV_001 | User cannot create more than 5 items | Item count >= 5 | BUS_001 |
| BV_002 | Order total must exceed minimum | Total < $10 | BUS_002 |

### Cross-field Validations
- **CV_001:** If field A is X, then field B must be Y
- **CV_002:** Start date must be before end date

---

## 5. Error Codes & Handling

### Error Code Convention
Format: `[CATEGORY]_[NUMBER]`
- **VAL_xxx:** Validation errors (400)
- **AUTH_xxx:** Authentication errors (401)
- **AUTHZ_xxx:** Authorization errors (403)
- **RES_xxx:** Resource not found (404)
- **BUS_xxx:** Business logic errors (422)
- **SYS_xxx:** System/infrastructure errors (500)

### Error Catalog
| Code | HTTP Status | Message | Description | Retry? |
|------|-------------|---------|-------------|--------|
| VAL_001 | 400 | Invalid email format | Email doesn't match pattern | No |
| AUTH_001 | 401 | Invalid credentials | Username/password incorrect | No |
| BUS_001 | 422 | Quota exceeded | User exceeded allowed limit | No |
| SYS_001 | 500 | Database connection failed | Cannot reach DB | Yes |
| SYS_002 | 503 | Service temporarily unavailable | Circuit breaker open | Yes |

### Error Response Structure
```json
{
  "status": "error",
  "errorCode": "CODE",
  "message": "User-friendly message",
  "timestamp": "ISO-8601",
  "path": "/api/endpoint",
  "details": {
    "field": "fieldName",
    "reason": "Specific reason"
  },
  "traceId": "correlation-id"
}
```

---

## 6. Data Structure & Schema

### Database Tables

#### Table: `users`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL | Unique identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL | Last update timestamp |
| status | ENUM | NOT NULL, DEFAULT 'ACTIVE' | User status |

**Indexes:**
- `idx_email` on `email`
- `idx_status_created` on `(status, created_at)`

**Relationships:**
- Foreign key to `organizations(id)`

#### Table: `orders`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL | Order ID |
| user_id | UUID | FK, NOT NULL | Reference to users |
| total | DECIMAL(10,2) | NOT NULL | Order total |
| status | VARCHAR(50) | NOT NULL | Order status |

### Domain Models

#### Entity: User
```typescript
interface User {
  id: string;              // UUID
  email: string;           // Valid email
  firstName: string;       // 1-100 chars
  lastName: string;        // 1-100 chars
  status: UserStatus;      // ACTIVE | INACTIVE | SUSPENDED
  createdAt: Date;
  updatedAt: Date;
}
```

#### Value Object: Address
```typescript
interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;        // ISO 3166-1 alpha-2
}
```

### Event Schemas

#### Event: UserCreated
```json
{
  "eventId": "uuid",
  "eventType": "UserCreated",
  "timestamp": "ISO-8601",
  "version": "1.0",
  "payload": {
    "userId": "uuid",
    "email": "string",
    "createdAt": "ISO-8601"
  }
}
```

---

## 7. Non-Functional Requirements

### Performance
- **Response Time:** 95th percentile < 200ms
- **Throughput:** Handle X requests/second
- **Concurrent Users:** Support Y simultaneous users

### Scalability
- Horizontal scaling: Yes/No
- Expected growth: X% per month
- Peak load: Y times normal load

### Availability & Reliability
- **SLA:** 99.9% uptime
- **RTO:** Recovery Time Objective
- **RPO:** Recovery Point Objective

### Security
- Authentication: JWT/OAuth2/API Key
- Authorization: RBAC/ABAC
- Data encryption: At rest/in transit
- PII handling: What data is sensitive?

### Observability
- **Logging:** What events to log?
- **Metrics:** What to measure?
- **Tracing:** Distributed tracing requirements
- **Alerting:** What conditions trigger alerts?

---

## 8. Dependencies & Integrations

### Upstream Dependencies (Services this depends on)
| Service | Purpose | Protocol | Fallback Strategy |
|---------|---------|----------|-------------------|
| Auth Service | User authentication | REST/gRPC | Return 503 |
| Payment Gateway | Process payments | REST | Queue for retry |

### Downstream Consumers (Services that depend on this)
| Service | What they consume | Protocol |
|---------|-------------------|----------|
| Notification Service | User events | Event bus |
| Analytics Service | User activity | Event bus |

### External APIs
| API | Purpose | Rate Limit | Error Handling |
|-----|---------|------------|----------------|
| Stripe | Payment processing | 100/sec | Exponential backoff |

---

## 9. Data Flow & Sequence Diagrams

### Flow 1: [Process Name]
```
1. User → API Gateway
2. API Gateway → Auth Service (validate token)
3. Auth Service → API Gateway (token valid)
4. API Gateway → This Service
5. This Service → Database (query)
6. This Service → Event Bus (publish event)
7. This Service → API Gateway (response)
8. API Gateway → User
```

### State Transitions
```
[DRAFT] → [PENDING] → [APPROVED] → [ACTIVE]
              ↓
          [REJECTED]
```

---

## 10. Testing Requirements

### Unit Test Coverage
- Target: >80% code coverage
- Critical paths: 100% coverage

### Integration Test Scenarios
1. **Scenario 1:** Happy path end-to-end
2. **Scenario 2:** Error handling
3. **Scenario 3:** Concurrent requests

### Edge Cases to Test
- Empty input
- Null/undefined values
- Maximum length inputs
- Special characters
- Concurrent modifications
- Timeout scenarios

---

## 11. Migration & Deployment

### Database Migrations
- Migration strategy: Forward-only/reversible
- Backward compatibility: How many versions?
- Data migration scripts needed?

### Deployment Strategy
- Blue-green/Canary/Rolling
- Rollback procedure
- Feature flags needed?

### Configuration
| Config Key | Type | Default | Description |
|------------|------|---------|-------------|
| DB_HOST | string | localhost | Database host |
| MAX_CONNECTIONS | integer | 100 | Connection pool size |

---

## 12. Open Questions & Decisions

### Decisions Made
| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|------------------------|
| 2026-11-05 | Use PostgreSQL | ACID compliance needed | MongoDB, DynamoDB |

### Open Questions
- [ ] Question 1: Should we cache X?
- [ ] Question 2: What's the retention policy?
- [ ] Question 3: How to handle timezone conversions?

### Risks & Assumptions
- **Risk:** Database might become bottleneck → **Mitigation:** Add read replicas
- **Assumption:** Traffic will be evenly distributed → **Validation:** Monitor patterns

---

## 13. References & Links

- Architecture Decision Records: [link]
- API Documentation: [link]
- Monitoring Dashboard: [link]
- Source Code Repository: [link]
- Design Docs: [link]

---

## Appendix

### A. Sample Data
Example valid requests/responses for testing

### B. Glossary
Terms specific to this service

### C. Change Log
| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-11-05 | Initial draft | Team |
