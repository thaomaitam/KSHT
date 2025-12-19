# Changelog

## [1.3.0] - 2025-12-19

### Changed
- **Default Light Theme**: App now defaults to light theme. Only switches to dark when user explicitly chooses it (removed system preference auto-detection).
- **Order Form Quantity**: Quantity input field now starts empty instead of defaulting to 1, allowing direct input without needing to clear first.
- **Persistent Admin Session**: Admin login session is now preserved when closing the browser. Previously, closing the browser required re-login.

### Fixed
- **Quantity Input UX**: Fixed the quantity field in order form where users had to select-all before typing a new number. Now the field can be cleared completely.

---

## [1.2.0] - 2025-12-18

### Added
- **Fuzzy Search Algorithm**: Upgraded the customer-facing product search with intelligent matching.
  - Supports Vietnamese without diacritics (e.g., "co son" finds "Cọ sơn")
  - Matches product names, descriptions, and variant sizes (e.g., "3 inch")
  - Results sorted by relevance score
- Created `utils/searchUtils.ts` with `normalizeVietnamese()`, `tokenize()`, and `fuzzyScoreProduct()` functions.

### Fixed
- **Cart Button**: Fixed "XEM GIỎ HÀNG" button in product modal not opening the cart drawer.
- **Product Variant Selection**: Fixed issue where clicking a product with multiple variants in the order form would only add the first variant. Now it expands to show all variants for selection.


---

## [1.1.0] - 2025-12-18

### Added
- **Dynamic Column Visibility**: The "Số cuộn" (Rolls) and "Số kí" (Weight) columns in the order table now automatically show/hide based on whether any item in the current order uses them.
- **Independent Manual Entry**: Toggles for "Số cuộn" and "Số kí" in the manual entry section now only affect the current input row. Once an item is added to the table, its structure is preserved regardless of subsequent toggle changes.

### Fixed
- **PDF Invoice Accuracy**: Updated PDF generation to dynamically include "Số cuộn" and "Số kí" columns, ensuring the printed invoice matches the UI and explains the total calculation correctly.
- **Profit Calculation**: Fixed cost calculation in the Profit tab to account for rolls and weight. Revenue now correctly subtracts discounts for a true net profit figure.
- **Reports Tab Stability**: Fixed a critical white screen crash in the Reports tab caused by missing data props. Added comprehensive safety checks for all data processing.
- **Dynamic Reports**: Replaced hardcoded placeholder data in the Reports tab with real-time calculations from orders and transactions, including a 7-day revenue chart and dynamic income/expense ratios.

### Changed
- Refined UI labels in the order form to clarify manual entry behavior.
- Improved data resilience across business tabs to prevent crashes with empty or partial data.
