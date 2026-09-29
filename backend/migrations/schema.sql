-- ============================================================
-- VH EXPENSE TRACKER DATABASE
-- ============================================================

CREATE DATABASE IF NOT EXISTS expense_tracker
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE expense_tracker;


-- ============================================================
-- EXPENSES / TRANSACTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (

    id INT AUTO_INCREMENT PRIMARY KEY,

    title VARCHAR(255) NOT NULL,

    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,

    date DATE NOT NULL,

    category VARCHAR(100) NOT NULL,

    type ENUM('income', 'expense')
        NOT NULL DEFAULT 'expense',

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_expenses_date
ON expenses(date);

CREATE INDEX idx_expenses_category
ON expenses(category);

CREATE INDEX idx_expenses_type
ON expenses(type);

CREATE INDEX idx_expenses_category_type
ON expenses(category, type);

CREATE INDEX idx_expenses_date_type
ON expenses(date, type);


-- ============================================================
-- OPTIONAL SAMPLE DATA
-- Remove this section if you don't want demo transactions.
-- ============================================================

INSERT INTO expenses
(title, amount, date, category, type)
VALUES

('Monthly Salary', 50000.00, '2026-09-01', 'Salary', 'income'),

('Rent', 12000.00, '2026-09-02', 'Housing', 'expense'),

('Groceries', 3500.00, '2026-09-04', 'Food', 'expense'),

('Electricity Bill', 1800.00, '2026-09-06', 'Bills', 'expense'),

('Freelance Income', 8500.00, '2026-09-08', 'Freelance', 'income'),

('Internet Bill', 999.00, '2026-09-10', 'Bills', 'expense'),

('Travel', 2500.00, '2026-09-12', 'Travel', 'expense'),

('Shopping', 3200.00, '2026-09-15', 'Shopping', 'expense');
