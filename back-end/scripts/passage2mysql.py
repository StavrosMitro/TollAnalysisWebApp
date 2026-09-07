#!/usr/bin/env python3
import sys
import pandas as pd
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
import os
import csv
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

# Insert data into Transceiver table
def insert_transceiver(cursor, tag_ref, company_id, balance):
    # Check if tagRef already exists
    cursor.execute("SELECT COUNT(*) FROM Transceiver WHERE tagRef = %s", (tag_ref,))
    count = cursor.fetchone()[0]
    
    if count == 0:
        query = """
        INSERT INTO Transceiver (tagRef, company_id, balance) 
        VALUES (%s, %s, %s)
        """
        cursor.execute(query, (tag_ref, company_id, balance))
        print(f"Inserted tagRef: {tag_ref}, company_id: {company_id}, balance: {balance}")
    else:
        print(f"Duplicate tagRef found: {tag_ref}, skipping insert.")

# Insert data into Passages and handle logic
def insert_data(cursor, conn, df):
    try:
        # Deactivate previous debts before inserting new data
        cursor.execute("""UPDATE Debt SET is_active = 0;""")
        
        for _, row in df.iterrows():
            cursor.execute(
                """SELECT passage_id FROM Passages WHERE timestamp=%s AND tollID=%s AND tagRef=%s AND tagHomeID=%s AND charge=%s""",
                (row['timestamp'], row['tollID'], row['tagRef'], row['tagHomeID'], row['charge'])
            )
            checker = cursor.fetchone()
            if checker:
                continue  # Skip if entry already exists in Passages
            
            # Insert new passage
            cursor.execute(
                """INSERT IGNORE INTO Passages (timestamp, tollID, tagRef, tagHomeID, charge)
                VALUES (%s, %s, %s, %s, %s)""",
                (row['timestamp'], row['tollID'], row['tagRef'], row['tagHomeID'], row['charge'])
            )
            
            # Update balance in Transceiver
            cursor.execute(
                """UPDATE Transceiver SET balance = balance - %s WHERE tagRef=%s""",
                (row['charge'], row['tagRef'])
            )

            # Retrieve company_id from Transceiver for tagRef
            cursor.execute("""SELECT company_id FROM Transceiver WHERE tagRef = %s""", (row['tagRef'],))
            transceiver_company = cursor.fetchone()
            if not transceiver_company:
                print(f"No company found for tagRef: {row['tagRef']}")
                continue
            transceiver_company = transceiver_company[0]

            # Retrieve OpID from Toll for tollID
            cursor.execute("""SELECT OpID FROM Toll WHERE Toll_id = %s""", (row['tollID'],))
            toll_op_id = cursor.fetchone()
            if not toll_op_id:
                print(f"No OpID found for Toll_id: {row['tollID']}")
                continue
            toll_op_id = toll_op_id[0]

            # Insert Debt if companies are different
            if transceiver_company != toll_op_id:
                cursor.execute(
                    """INSERT INTO Debt (toll_id, tagRef, debtor_company_id, creditor_company_id, timestamp, amount)
                    VALUES (%s, %s, %s, %s, %s, %s)""",
                    (row['tollID'], row['tagRef'], transceiver_company, toll_op_id, row['timestamp'], row['charge'])
                )

            # Update TotalDebts table with the latest debt summary
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

if __name__ == "__main__":
    # Establish database connection
    conn = get_db_connection()
    cursor = conn.cursor()

    # CSV file path is passed as an argument to the script
    csv_file_path = sys.argv[1]

    # Insert Transceiver data
    with open(csv_file_path, mode='r') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            tag_ref = row['tagRef']
            tag_home_id = row['tagHomeID']
            # Random balance for the transceiver between 0 and 80
            balance = round(random.uniform(0, 80), 2)
            insert_transceiver(cursor, tag_ref, tag_home_id, balance)

    # Process Passages data
    try:
        data = pd.read_csv(csv_file_path)
        insert_data(cursor, conn, data)
    except Exception as e:
        print(f"Failed to process CSV: {e}")

    # Close connection
    cursor.close()
    conn.close()
