```python
from flask import Blueprint, request, jsonify
from datetime import datetime
from . import get_db_connection


api_bp = Blueprint("api", __name__)


# ============================================================
# VALIDATION
# ============================================================

VALID_TYPES = {"income", "expense"}


def validate_expense_payload(data, partial=False):

    required_fields = [
        "title",
        "amount",
        "date",
        "category"
    ]

    errors = {}

    # --------------------------------------------------------
    # Required fields
    # --------------------------------------------------------

    if not partial:

        for field in required_fields:

            if field not in data:

                errors[field] = "This field is required."

            elif (
                isinstance(data[field], str)
                and not data[field].strip()
            ):

                errors[field] = "This field is required."


    # --------------------------------------------------------
    # Title
    # --------------------------------------------------------

    if "title" in data:

        if not isinstance(data["title"], str):

            errors["title"] = "Title must be text."

        elif not data["title"].strip():

            errors["title"] = "Title cannot be empty."

        elif len(data["title"].strip()) > 255:

            errors["title"] = (
                "Title must be less than 255 characters."
            )


    # --------------------------------------------------------
    # Amount
    # --------------------------------------------------------

    if "amount" in data:

        try:

            amount = float(data["amount"])

            if amount <= 0:

                errors["amount"] = (
                    "Amount must be greater than 0."
                )

        except (
            ValueError,
            TypeError
        ):

            errors["amount"] = (
                "Amount must be a valid number."
            )


    # --------------------------------------------------------
    # Date
    # --------------------------------------------------------

    if "date" in data:

        try:

            datetime.strptime(
                str(data["date"]),
                "%Y-%m-%d"
            )

        except (
            ValueError,
            TypeError
        ):

            errors["date"] = (
                "Date must be in YYYY-MM-DD format."
            )


    # --------------------------------------------------------
    # Category
    # --------------------------------------------------------

    if "category" in data:

        if not isinstance(
            data["category"],
            str
        ):

            errors["category"] = (
                "Category must be text."
            )

        elif not data["category"].strip():

            errors["category"] = (
                "Category cannot be empty."
            )

        elif len(
            data["category"].strip()
        ) > 100:

            errors["category"] = (
                "Category must be less than 100 characters."
            )


    # --------------------------------------------------------
    # Transaction type
    # --------------------------------------------------------

    if "type" in data:

        transaction_type = str(
            data["type"]
        ).lower().strip()

        if transaction_type not in VALID_TYPES:

            errors["type"] = (
                "Type must be either income or expense."
            )

    return errors


# ============================================================
# HELPER
# ============================================================

def get_expense_by_id(expense_id):

    conn = get_db_connection()

    try:

        with conn.cursor(
            dictionary=True
        ) as cur:

            cur.execute(
                """
                SELECT
                    id,
                    title,
                    amount,
                    date,
                    category,
                    type
                FROM expenses
                WHERE id = %s
                """,
                (expense_id,)
            )

            return cur.fetchone()

    finally:

        conn.close()


# ============================================================
# GET ALL EXPENSES
# ============================================================

@api_bp.get("/expenses")
def list_expenses():

    category = request.args.get(
        "category"
    )

    transaction_type = request.args.get(
        "type"
    )

    search = request.args.get(
        "search",
        ""
    ).strip()

    # Pagination
    try:

        page = max(
            int(request.args.get("page", 1)),
            1
        )

    except ValueError:

        page = 1

    try:

        limit = min(
            max(
                int(
                    request.args.get(
                        "limit",
                        100
                    )
                ),
                1
            ),
            500
        )

    except ValueError:

        limit = 100


    offset = (
        page - 1
    ) * limit


    # --------------------------------------------------------
    # Build query
    # --------------------------------------------------------

    query = """
        SELECT
            id,
            title,
            amount,
            DATE_FORMAT(date, '%Y-%m-%d') AS date,
            category,
            type
        FROM expenses
        WHERE 1=1
    """

    params = []


    # Category filter
    if category:

        query += """
            AND category = %s
        """

        params.append(
            category
        )


    # Type filter
    if transaction_type:

        if transaction_type not in VALID_TYPES:

            return jsonify({
                "error": (
                    "Type must be either "
                    "income or expense."
                )
            }), 400

        query += """
            AND type = %s
        """

        params.append(
            transaction_type
        )


    # Search
    if search:

        query += """
            AND (
                title LIKE %s
                OR category LIKE %s
            )
        """

        search_value = f"%{search}%"

        params.extend([
            search_value,
            search_value
        ])


    # Sort
    query += """
        ORDER BY date DESC, id DESC
        LIMIT %s OFFSET %s
    """

    params.extend([
        limit,
        offset
    ])


    conn = get_db_connection()

    try:

        with conn.cursor(
            dictionary=True
        ) as cur:

            cur.execute(
                query,
                params
            )

            rows = cur.fetchall()

    finally:

        conn.close()


    return jsonify(rows)


# ============================================================
# CREATE EXPENSE
# ============================================================

@api_bp.post("/expenses")
def create_expense():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    errors = validate_expense_payload(
        data
    )

    if errors:

        return jsonify({
            "errors": errors
        }), 400


    title = data["title"].strip()

    amount = float(
        data["amount"]
    )

    date = data["date"]

    category = data["category"].strip()

    transaction_type = (
        str(
            data.get(
                "type",
                "expense"
            )
        )
        .lower()
        .strip()
    )


    conn = get_db_connection()

    try:

        with conn.cursor() as cur:

            cur.execute(
                """
                INSERT INTO expenses
                (
                    title,
                    amount,
                    date,
                    category,
                    type
                )
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    title,
                    amount,
                    date,
                    category,
                    transaction_type
                )
            )

            new_id = cur.lastrowid

        conn.commit()

    finally:

        conn.close()


    return jsonify({
        "message": "Transaction created successfully.",
        "id": new_id
    }), 201


# ============================================================
# GET SINGLE EXPENSE
# ============================================================

@api_bp.get("/expenses/<int:expense_id>")
def get_expense(expense_id):

    expense = get_expense_by_id(
        expense_id
    )

    if not expense:

        return jsonify({
            "error": "Transaction not found."
        }), 404


    return jsonify(
        expense
    )


# ============================================================
# UPDATE EXPENSE
# ============================================================

@api_bp.put(
    "/expenses/<int:expense_id>"
)
def update_expense(
    expense_id: int
):

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    errors = validate_expense_payload(
        data,
        partial=True
    )

    if errors:

        return jsonify({
            "errors": errors
        }), 400


    # Check whether transaction exists
    existing = get_expense_by_id(
        expense_id
    )

    if not existing:

        return jsonify({
            "error": "Transaction not found."
        }), 404


    allowed_fields = [
        "title",
        "amount",
        "date",
        "category",
        "type"
    ]


    fields = []

    params = []


    for field in allowed_fields:

        if field not in data:
            continue


        value = data[field]


        if field == "title":

            value = value.strip()


        elif field == "category":

            value = value.strip()


        elif field == "amount":

            value = float(value)


        elif field == "type":

            value = (
                str(value)
                .lower()
                .strip()
            )


        fields.append(
            f"{field} = %s"
        )

        params.append(
            value
        )


    if not fields:

        return jsonify({
            "error": "No fields to update."
        }), 400


    params.append(
        expense_id
    )


    query = f"""
        UPDATE expenses
        SET {", ".join(fields)}
        WHERE id = %s
    """


    conn = get_db_connection()

    try:

        with conn.cursor() as cur:

            cur.execute(
                query,
                params
            )

        conn.commit()

    finally:

        conn.close()


    updated = get_expense_by_id(
        expense_id
    )


    return jsonify({
        "message": "Transaction updated successfully.",
        "expense": updated
    })


# ============================================================
# DELETE EXPENSE
# ============================================================

@api_bp.delete(
    "/expenses/<int:expense_id>"
)
def delete_expense(
    expense_id: int
):

    existing = get_expense_by_id(
        expense_id
    )

    if not existing:

        return jsonify({
            "error": "Transaction not found."
        }), 404


    conn = get_db_connection()

    try:

        with conn.cursor() as cur:

            cur.execute(
                """
                DELETE FROM expenses
                WHERE id = %s
                """,
                (expense_id,)
            )

        conn.commit()

    finally:

        conn.close()


    return jsonify({
        "message": "Transaction deleted successfully.",
        "id": expense_id
    })


# ============================================================
# SUMMARY
# ============================================================

@api_bp.get("/summary")
def summary():

    conn = get_db_connection()

    try:

        with conn.cursor(
            dictionary=True
        ) as cur:

            # ------------------------------------------------
            # Income / Expense totals
            # ------------------------------------------------

            cur.execute(
                """
                SELECT

                    COALESCE(
                        SUM(
                            CASE
                                WHEN type = 'income'
                                THEN amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS income,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN type = 'expense'
                                THEN amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS expense,

                    COUNT(*) AS transactions

                FROM expenses
                """
            )


            row = (
                cur.fetchone()
                or {}
            )


            income = float(
                row.get(
                    "income",
                    0
                )
                or 0
            )


            expense = float(
                row.get(
                    "expense",
                    0
                )
                or 0
            )


            transactions = int(
                row.get(
                    "transactions",
                    0
                )
                or 0
            )


            balance = (
                income -
                expense
            )


            # ------------------------------------------------
            # Expense by category
            # ------------------------------------------------

            cur.execute(
                """
                SELECT
                    category,
                    SUM(amount) AS total
                FROM expenses
                WHERE type = 'expense'
                GROUP BY category
                ORDER BY total DESC
                """
            )


            by_category =
                cur.fetchall() or []


            # ------------------------------------------------
            # Income by category
            # ------------------------------------------------

            cur.execute(
                """
                SELECT
                    category,
                    SUM(amount) AS total
                FROM expenses
                WHERE type = 'income'
                GROUP BY category
                ORDER BY total DESC
                """
            )


            income_by_category =
                cur.fetchall() or []


            # ------------------------------------------------
            # Monthly statistics
            # ------------------------------------------------

            cur.execute(
                """
                SELECT

                    DATE_FORMAT(
                        date,
                        '%Y-%m'
                    ) AS month,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN type = 'income'
                                THEN amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS income,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN type = 'expense'
                                THEN amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS expense

                FROM expenses

                GROUP BY
                    DATE_FORMAT(
                        date,
                        '%Y-%m'
                    )

                ORDER BY month ASC
                """
            )


            monthly = (
                cur.fetchall()
                or []
            )


            # ------------------------------------------------
            # Top spending categories
            # ------------------------------------------------

            cur.execute(
                """
                SELECT
                    category,
                    SUM(amount) AS total
                FROM expenses
                WHERE type = 'expense'
                GROUP BY category
                ORDER BY total DESC
                LIMIT 5
                """
            )


            top_categories = (
                cur.fetchall()
                or []
            )


            # ------------------------------------------------
            # Latest transactions
            # ------------------------------------------------

            cur.execute(
                """
                SELECT
                    id,
                    title,
                    amount,
                    DATE_FORMAT(
                        date,
                        '%Y-%m-%d'
                    ) AS date,
                    category,
                    type
                FROM expenses
                ORDER BY
                    date DESC,
                    id DESC
                LIMIT 5
                """
            )


            recent_transactions = (
                cur.fetchall()
                or []
            )


    finally:

        conn.close()


    # ========================================================
    # Convert Decimal values to JSON-safe floats
    # ========================================================

    def normalize_rows(rows):

        normalized = []

        for item in rows:

            row = dict(item)

            if "total" in row:

                row["total"] = float(
                    row["total"] or 0
                )

            if "income" in row:

                row["income"] = float(
                    row["income"] or 0
                )

            if "expense" in row:

                row["expense"] = float(
                    row["expense"] or 0
                )

            if "amount" in row:

                row["amount"] = float(
                    row["amount"] or 0
                )

            normalized.append(
                row
            )

        return normalized


    by_category =
        normalize_rows(
            by_category
        )

    income_by_category =
        normalize_rows(
            income_by_category
        )

    monthly =
        normalize_rows(
            monthly
        )

    top_categories =
        normalize_rows(
            top_categories
        )

    recent_transactions =
        normalize_rows(
            recent_transactions
        )


    # ========================================================
    # FINAL RESPONSE
    # ========================================================

    return jsonify({

        "income": income,

        "expense": expense,

        "balance": balance,

        "transactions": transactions,

        "byCategory": by_category,

        "incomeByCategory":
            income_by_category,

        "monthly": monthly,

        "topCategories":
            top_categories,

        "recentTransactions":
            recent_transactions
    })
```
