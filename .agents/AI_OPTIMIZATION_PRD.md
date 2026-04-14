# Product Requirements Document (PRD): AI Categorization Optimization

## Objective
Minimize manual data entry and corrections during the receipt review process. The AI should autonomously and accurately extract receipt data, assign correct merchants, and map line items to predefined categories based on historical user behavior.

## Scope
1. **Context-Aware Prompting:** Inject the user's predefined categories and existing vendors into the AI's prompt to restrict its output to valid options.
2. **Predefined Categories:** Hardcode the user's specific Zoho Expense categories (Fresh meat, Frozen, Dairy, Drinks, Rent, Utilities, Supplies, Maintenance).
3. **Continuous Learning Loop:** Build a mechanism to learn from user approvals. When a user approves a receipt, the system maps line-item keywords to the selected categories.
4. **Memory Injection:** Feed the learned keyword-category mappings back into the AI prompt for future receipts.

## Implementation Plan

### Phase 1: Database & Category Setup
- Wipe existing dynamic categories and seed the database with the predefined Zoho categories.
- Create a new database model: `CategoryLearning` (Columns: `id`, `user_id`, `keyword`, `category_id`, `frequency`).

### Phase 2: The Learning Loop (Approval Hook)
- Modify the receipt approval logic (`backend/app/api/review.py`).
- Upon approval, parse line item descriptions to extract meaningful keywords (length > 2, lowercase).
- Upsert these keywords into the `CategoryLearning` table, incrementing the frequency of the keyword-category association.

### Phase 3: AI Prompt Enhancement
- Modify `backend/app/api/receipts.py`.
- Before querying Gemini, fetch:
  1. All valid categories.
  2. All existing vendors.
  3. Top learned keyword mappings for the user (e.g., "Keyword 'milk' is usually 'Dairy'").
- Inject this context into the system prompt. Instruct Gemini to *only* use the provided category IDs/names and to prefer existing vendors.

## Success Metrics
- > 90% reduction in manual category reassignment.
- Zero "Invalid Category" errors when syncing to Zoho.
- AI correctly learns a new mapping after 1-2 manual corrections.
