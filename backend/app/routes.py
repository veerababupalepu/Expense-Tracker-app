from flask import Blueprint, request, jsonify
from datetime import datetime
from . import get_db_connection


api_bp = Blueprint("api", __name__)


def validate_expense_payload(data, partial=False):
    required = ["title", "amount", "date", "category"]
    errors = {}
    if not partial:
        for key in required:
            if key not in data or (isinstance(data[key], str) and not data[key].strip()):
                errors[key] = "This field is required."
    if "amount" in data:
        try:
            amount = float(data["amount"])
            if amount < 0:
                errors["amount"] = "Amount must be non-negative."
        except (ValueError, TypeError):
            errors["amount"] = "Amount must be a valid number."
    if "date" in data:
        try:
            # Accept YYYY-MM-DD
            datetime.strptime(data["date"], "%Y-%m-%d")
        except Exception:
            errors["date"] = "Date must be in YYYY-MM-DD format."
    return errors


@api_bp.get("/expenses")
def list_expenses():
    category = request.args.get("category")
    query = "SELECT id, title, amount, date, category, type FROM expenses"
    params = []
    if category:
        query += " WHERE category=%s"
        params.append(category)
    query += " ORDER BY date DESC, id DESC"

    conn = get_db_connection()
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
    finally:
        conn.close()
    return jsonify(rows)


@api_bp.post("/expenses")
def create_expense():
    data = request.get_json(silent=True) or {}
    errors = validate_expense_payload(data)
    if errors:
        return jsonify({"errors": errors}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO expenses (title, amount, date, category, type)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    data["title"].strip(),
                    float(data["amount"]),
                    data["date"],
                    data["category"].strip(),
                    data.get("type", "expense"),  # expense or income
                ),
            )
            new_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()
    return jsonify({"id": new_id}), 201


@api_bp.put("/expenses/<int:expense_id>")
def update_expense(expense_id: int):
    data = request.get_json(silent=True) or {}
    errors = validate_expense_payload(data, partial=True)
    if errors:
        return jsonify({"errors": errors}), 400

    fields = []
    params = []
    for key in ["title", "amount", "date", "category", "type"]:
        if key in data:
            fields.append(f"{key}=%s")
            params.append(data[key])
    if not fields:
        return jsonify({"error": "No fields to update"}), 400
    params.append(expense_id)

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE expenses SET {', '.join(fields)} WHERE id=%s", params)
        conn.commit()
    finally:
        conn.close()
    return jsonify({"id": expense_id})


@api_bp.delete("/expenses/<int:expense_id>")
def delete_expense(expense_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM expenses WHERE id=%s", (expense_id,))
        conn.commit()
    finally:
        conn.close()
    return ("", 204)


@api_bp.get("/summary")
def summary():
    conn = get_db_connection()
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute(
                """
                SELECT
                    SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
                    SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
                FROM expenses
                """
            )
            row = cur.fetchone() or {"income": 0, "expense": 0}
            income = float(row.get("income") or 0)
            expense = float(row.get("expense") or 0)
            balance = income - expense

            cur.execute(
                "SELECT category, SUM(amount) as total FROM expenses WHERE type='expense' GROUP BY category"
            )
            by_category = cur.fetchall() or []
    finally:
        conn.close()
    return jsonify({"income": income, "expense": expense, "balance": balance, "byCategory": by_category})




