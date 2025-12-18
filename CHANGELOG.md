# Changelog

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
