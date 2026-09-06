#!/usr/bin/env python3
import mysql.connector
from mysql.connector import Error
import heapq
import sys
import os
from dotenv import load_dotenv
import csv

# Load environment variables from .env file
load_dotenv()

# Output directory resolved relative to THIS file (never the caller's CWD).
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.environ.get(
    "DEBT_FIGURES_DIR", os.path.join(SCRIPT_DIR, "..", "debt_figures")
)

class Solution:
    def __init__(self):
        self.minQ = []
        self.maxQ = []

    def constructMinMaxQ(self, amount):
        for company, net_amount in amount.items():
            if net_amount == 0:
                continue
            if net_amount > 0:
                heapq.heappush(self.maxQ, (company, net_amount))
            else:
                heapq.heappush(self.minQ, (company, net_amount))

    def solveTransaction(self):
        while self.minQ and self.maxQ:
            maxCreditEntry = heapq.heappop(self.maxQ)
            maxDebitEntry = heapq.heappop(self.minQ)

            transaction_val = maxCreditEntry[1] + maxDebitEntry[1]

            debtor = maxDebitEntry[0]
            creditor = maxCreditEntry[0]
            owed_amount = 0

            if transaction_val == 0:
                owed_amount = maxCreditEntry[1]
            elif transaction_val < 0:
                owed_amount = maxCreditEntry[1]
                heapq.heappush(self.minQ, (debtor, transaction_val))
            else:
                owed_amount = -maxDebitEntry[1]
                heapq.heappush(self.maxQ, (creditor, transaction_val))

            try:
                conn = mysql.connector.connect(
                    host=os.getenv('HOST'),
                    user=os.getenv('DUSER'),
                    password=os.getenv('PASSWORD'),
                    database=os.getenv('DATABASE')
                )
                cursor = conn.cursor()

                cursor.execute("""UPDATE TotalDebts SET total_amount = %s WHERE debtor_company_id = %s AND creditor_company_id = %s""",
                               (owed_amount, debtor, creditor))
                conn.commit()
                cursor.close()
                conn.close()

            except Error as e:
                print(f"Error: {e}")
                sys.exit(1)

    def minCashFlow(self, graph):
        amount = {company: 0 for company in graph}

        for debtor, creditors in graph.items():
            for creditor, amt in creditors.items():
                amount[debtor] -= amt
                amount[creditor] += amt

        self.constructMinMaxQ(amount)
        self.solveTransaction()


def fill_graph(graph):
    try:
        conn = mysql.connector.connect(
            host=os.getenv('HOST'),
            user=os.getenv('DUSER'),
            password=os.getenv('PASSWORD'),
            database=os.getenv('DATABASE')
        )
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM TotalDebts")
        results = cursor.fetchall()

        for row in results:
            debtor = row['debtor_company_id']
            creditor = row['creditor_company_id']
            amount = float(row['total_amount'])

            if debtor not in graph:
                graph[debtor] = {}
            graph[debtor][creditor] = amount

        cursor.execute("""UPDATE TotalDebts SET total_amount = 0.00""")
        conn.commit()
        cursor.close()
        conn.close()

    except Error as e:
        print(f"Error: {e}")
        sys.exit(1)


from pyvis.network import Network

def visualize_graph(graph, title, filename):
    """Visualize the graph using Pyvis for a stunning, interactive experience."""
    # Create a Pyvis Network instance
    net = Network(height="750px", width="100%", bgcolor="#222222", font_color="white", directed=True)
    
    # Add nodes and edges to the network
    for debtor, creditors in graph.items():
        for creditor, amount in creditors.items():
            if amount > 0:
                # Add nodes
                net.add_node(debtor, label=debtor, title=f"Node: {debtor}", color="#87CEEB")
                net.add_node(creditor, label=creditor, title=f"Node: {creditor}", color="#FF69B4")
                # Add edges with weight as title (tooltip) and amount as label over the edge
                net.add_edge(debtor, creditor, value=amount, title=f"Weight: {amount}", label=str(amount))

    # Set physics to make the graph dynamic and fancy
    net.set_options("""
    var options = {
      "nodes": {
        "shape": "dot",
        "size": 16,
        "font": {
          "size": 20
        }
      },
      "edges": {
        "color": {
          "inherit": true
        },
        "smooth": {
          "type": "dynamic"
        },
        "label": {
          "font": {
            "size": 18,
            "color": "white"
          }
        }
      },
      "physics": {
        "enabled": true,
        "barnesHut": {
          "gravitationalConstant": -20000,
          "springLength": 100
        }
      }
    }
    """)

    # Save the graph to an HTML file
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.abspath(os.path.join(OUTPUT_DIR, f"{filename}.html"))
    net.save_graph(output_path)
    print(output_path)  # Print only the absolute path


if __name__ == "__main__":
    graph1 = {}
    graph2 = {}

    fill_graph(graph1)

    S = Solution()
    S.minCashFlow(graph1)

    fill_graph(graph2)
    visualize_graph(graph1, "Initial Debt Graph", "initial_debts")
    visualize_graph(graph2, "Final Debt Graph", "final_debts")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    filename = "graph2"  # Name for the CSV file
    output_path = os.path.abspath(os.path.join(OUTPUT_DIR, f"{filename}.csv"))

    # Flatten and write graph2 to the CSV
    with open(output_path, mode='w', newline='') as file:
        writer = csv.writer(file)
        
        # Write the header
        writer.writerow(["Debtor", "Creditor", "Amount"])
        
        # Write the rows
        for debtor, creditors in graph2.items():
            for creditor, amount in creditors.items():
                if amount != 0.0:
                    writer.writerow([debtor, creditor, amount])

    print(output_path)  # Print only the absolute path
