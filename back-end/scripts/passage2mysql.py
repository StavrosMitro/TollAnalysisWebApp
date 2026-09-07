#!/usr/bin/env python3
import sys
import pandas as pd
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
import os
import random

# Load environment variables from .env file
load_dotenv()

# Helper function to establish the database connection
def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host=os.getenv('HOST'),
            user=os.getenv('DUSER'),
            password=os.getenv('PASSWORD'),
            database=os.getenv('DATABASE')
        )
        return conn
    except Error as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)

CHUNK_SIZE = 1000


def select_existing_keys(cursor, table, columns, rows):
    """Return existing composite keys for the current chunk."""
    if not rows:
        return set()

    row_placeholder = "(" + ", ".join(["%s"] * len(columns)) + ")"
    placeholders = ", ".join([row_placeholder] * len(rows))
    query = (
        f"SELECT {', '.join(columns)} FROM {table} "
        f"WHERE ({', '.join(columns)}) IN ({placeholders})"
    )
    values = [value for row in rows for value in row]
    cursor.execute(query, values)
    return {tuple(result) for result in cursor.fetchall()}


def insert_data(cursor, conn, csv_file_path):
    try:
        # Deactivate previous debts before inserting new data
        cursor.execute("""UPDATE Debt SET is_active = 0;""")

        for chunk in pd.read_csv(csv_file_path, chunksize=CHUNK_SIZE):
            rows = list(chunk.itertuples(index=False, name=None))
            columns = list(chunk.columns)
            index = {column: position for position, column in enumerate(columns)}

            # Add only new transceivers in one database round trip.
            transceiver_rows = {}
            for row in rows:
                tag_ref = row[index['tagRef']]
                transceiver_rows.setdefault(
                    tag_ref,
                    (tag_ref, row[index['tagHomeID']], round(random.uniform(0, 80), 2))
                )
            cursor.execute(
                "SELECT tagRef FROM Transceiver WHERE tagRef IN ({})".format(
                    ", ".join(["%s"] * len(transceiver_rows))
                ),
                list(transceiver_rows),
            )
            existing_transceivers = {result[0] for result in cursor.fetchall()}
            new_transceivers = [
                value for tag_ref, value in transceiver_rows.items()
                if tag_ref not in existing_transceivers
            ]
            if new_transceivers:
                cursor.executemany(
                    """INSERT INTO Transceiver (tagRef, company_id, balance)
                    VALUES (%s, %s, %s)""",
                    new_transceivers,
                )

            passage_rows = [
                (
                    row[index['timestamp']], row[index['tollID']],
                    row[index['tagRef']], row[index['tagHomeID']], row[index['charge']]
                )
                for row in rows
            ]
            existing_passages = select_existing_keys(
                cursor,
                'Passages',
                ['timestamp', 'tollID', 'tagRef', 'tagHomeID', 'charge'],
                passage_rows,
            )
            new_passages = [row for row in passage_rows if row not in existing_passages]
            if not new_passages:
                continue

            cursor.executemany(
                """INSERT IGNORE INTO Passages (timestamp, tollID, tagRef, tagHomeID, charge)
                VALUES (%s, %s, %s, %s, %s)""",
                new_passages,
            )

            cursor.executemany(
                "UPDATE Transceiver SET balance = balance - %s WHERE tagRef = %s",
                [(row[4], row[2]) for row in new_passages],
            )

            tag_refs = list({row[2] for row in new_passages})
            toll_ids = list({row[1] for row in new_passages})
            cursor.execute(
                "SELECT tagRef, company_id FROM Transceiver WHERE tagRef IN ({})".format(
                    ", ".join(["%s"] * len(tag_refs))
                ),
                tag_refs,
            )
            transceiver_companies = dict(cursor.fetchall())
            cursor.execute(
                "SELECT Toll_id, OpID FROM Toll WHERE Toll_id IN ({})".format(
                    ", ".join(["%s"] * len(toll_ids))
                ),
                toll_ids,
            )
            toll_operators = dict(cursor.fetchall())

            debt_rows = []
            for row in new_passages:
                transceiver_company = transceiver_companies.get(row[2])
                toll_op_id = toll_operators.get(row[1])
                if not transceiver_company or not toll_op_id:
                    continue
                if transceiver_company != toll_op_id:
                    debt_rows.append((row[1], row[2], transceiver_company, toll_op_id, row[0], row[4]))

            if debt_rows:
                cursor.executemany(
                    """INSERT INTO Debt (toll_id, tagRef, debtor_company_id, creditor_company_id, timestamp, amount)
                    VALUES (%s, %s, %s, %s, %s, %s)""",
                    debt_rows,
                )

            cursor.execute(
                """
                UPDATE TotalDebts td
                JOIN (
                    SELECT debtor_company_id, creditor_company_id, SUM(amount) AS total_amount
                    FROM Debt
                    WHERE is_active = 1
                    GROUP BY debtor_company_id, creditor_company_id
                ) AS debt_summary
                ON td.debtor_company_id = debt_summary.debtor_company_id
                AND td.creditor_company_id = debt_summary.creditor_company_id
                SET td.total_amount = debt_summary.total_amount;
                """
            )

        # Commit all changes after processing
        conn.commit()
        print("OK, queries executed without error")

    except Error as e:
        print(f"Error: {e}")
        conn.rollback()
        raise

if __name__ == "__main__":
    # Establish database connection
    conn = get_db_connection()
    cursor = conn.cursor()

    # CSV file path is passed as an argument to the script
    csv_file_path = sys.argv[1]

    try:
        insert_data(cursor, conn, csv_file_path)
    except Exception as e:
        print(f"Failed to process CSV: {e}")
        sys.exit(1)

    # Close connection
    cursor.close()
    conn.close()
