# Use Customer as the authorization boundary

Customer is the highest ownership and authorization boundary, replacing the proposed Organization/Tenant terminology. A user receives access through Customer Membership, global ADMIN users may access every Customer, and CUSTOMER users have read-only access only to their memberships; every backend resource lookup must enforce this boundary rather than trusting a customer identifier supplied by the frontend.

