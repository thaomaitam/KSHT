# Changelog

## [1.5.1] - 2026-01-08

### Added
- **Amount in Words Input**: New input field "Cộng Thành Tiền (viết bằng chữ)" in order form. Type amount in words before printing, or leave empty for manual handwriting after printing.
- **Signature Section**: Added dual-column signature area at the bottom of thermal receipt:
  - "Người Nhận Hàng" (left column)
  - "Người Viết Hoá Đơn" (right column)
  - Each with "(Ký, ghi rõ họ tên)" instruction and space for signing.

### Changed
- **Thermal Receipt Font Sizes**: Optimized for 80mm thermal paper readability:
  - Shop header: 18px (bold, uppercase)
  - Shop address & phone: 11px
  - Bank account info: 10px
  - "ĐƠN HÀNG" title: 15px
  - Customer name: 12px (bold)
  - Customer SĐT & address: 11px
  - Product name: 12px
  - Product details (SL x Đơn giá): 11px
  - Product total: 12px
  - "TỔNG CỘNG" label: 13px
  - Total amount: 16px (bold)
  - Amount in words: 11px (italic)
  - Notes: 11px
  - Signatures: 11px (title), 9px (instruction)
  - Footer: 11px / 10px
- **Layout Adjustments**: 
  - Reduced margins and padding for compact bill layout
  - Price column right padding: 13px (prevents "đ" truncation)
  - Signature area height reduced from 60px to 50px


## [1.5.0] - 2026-01-07

### Added
- **Quick Order Creation from Customer List**: Added "Create Order" button (FilePlus icon) to each customer in the customer list. Clicking it automatically populates customer information and switches to the order form, streamlining the workflow for repeat customers.

### Changed
- **Thermal Receipt Layout (80mm)**:
  - Increased base font size to 12px for better readability
  - Centered customer information section with border frame
  - Moved product name to its own full-width line to prevent truncation of long names
  - Quantity × Price and Total now appear on the second line together
  - Adjusted right padding (13px for items, 10px for total) to prevent currency symbol "đ" from being cut off
  - Moved notes section below the total amount
  - Added bank account information from settings (dynamic, customizable)
  - Changed total section from dark background to bordered design for better thermal printer compatibility
- **Order History Icons**: Changed "Recreate Order" icon from Copy to RotateCcw for clearer semantic meaning
- **Button Order**: Moved thermal print button to the top of action lists for easier access

### Fixed
- **Thermal Receipt Printing**: Fixed price display being cut off at the right edge due to insufficient margin

---

## [1.4.0] - 2025-12-20

### Added
- **Invoice Image Export (PNG)**: When creating or printing an invoice, the system now generates a PNG image that can be right-clicked to copy and send directly to customers via Zalo/Messenger. A print button is also available for PDF printing.
  - Works in both "Create Order" and "Order History" tabs

### Changed
- **Mobile Manual Entry Layout**: The manual entry form (for items not in product list) now uses horizontal scrolling on mobile devices, making it easier to input all fields without awkward wrapping.

---

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
