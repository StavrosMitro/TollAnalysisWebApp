import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../api/config';

// Mapping of codes to Greek labels
const namesMapping = {
  AM: 'Αυτοκινητόδρομος Αιγαίου',
  EG: 'Εγνατία Οδός',
  KO: 'Κεντρική Οδός',
  MO: 'Μορέας',
  NAO: 'Αττική Οδός',
  NO: 'Νέα Οδός',
  OO: 'Ολυμπία Οδός',
  GE: 'Γέφυρα',
};

// DebtSection Component
const DebtSection = ({ title, html, sectionKey }) => {
  const handleDownload = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${sectionKey}_debts.html`;
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href); // Clean up the URL object
  };

  return (
    <div className="p-6 border rounded-lg shadow-sm" style={{ flex: '1', margin: '0 8px' }}>
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-green-500 text-white rounded shadow hover:bg-green-600 transition-colors"
        >
          Download HTML
        </button>
      </div>
      <div className="mt-4">
        <iframe
          srcDoc={html}
          style={{
            width: '600px',
            height: '620px',
            border: '1px solid lightgray',
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
          title={`${title} View`}
        />
      </div>
    </div>
  );
};

// CsvSection Component with Download CSV Button and Greek Translations
const CsvSection = ({ title, csvData }) => {
  if (!csvData) {
    return <p>Δεν υπάρχουν διαθέσιμα δεδομένα CSV.</p>;
  }

  const rows = csvData
    .split('\n')
    .filter((row) => row.trim() !== '') // Remove empty rows
    .map((row) => row.split(','));

  if (rows.length === 0) {
    return <p>Δεν υπάρχουν διαθέσιμα δεδομένα CSV.</p>;
  }

  const filteredRows = rows.filter((row, rowIndex) => {
    if (rowIndex === 0) return true;
    return row.some((cell) => cell.trim() !== '0');
  });

  if (filteredRows.length <= 1) {
    return <p>Δεν υπάρχουν δεδομένα για εμφάνιση.</p>;
  }

  // Function to handle CSV download with Greek headers
  const handleDownload = () => {
    // Replace English headers with Greek headers
    const greekHeaders = ['Οφειλέτης', 'Δανειστής', 'Ποσό (€)'];
    const dataRows = filteredRows.slice(1).map((row) => {
      const [debtor, creditor, amount] = row;
      const translatedDebtor = namesMapping[debtor.trim()] || debtor;
      const translatedCreditor = namesMapping[creditor.trim()] || creditor;
      return [translatedDebtor, translatedCreditor, amount];
    });

    const csvContent = [greekHeaders.join(','), ...dataRows.map(row => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Generate a safe filename by removing special characters and spaces
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeTitle}.csv`;
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up the URL object
  };

  return (
    <div className="p-6 border rounded-lg shadow-sm" style={{ marginTop: '2rem' }}>
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      {/* Download CSV Button */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-green-500 text-white rounded shadow hover:bg-green-600 transition-colors"
        >
          Κατέβασμα CSV
        </button>
      </div>
      {/* CSV Data Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {/* Replace English headers with Greek headers */}
              <th
                style={{
                  border: '1px solid #ddd',
                  padding: '8px',
                  backgroundColor: '#f2f2f2',
                  
                }}
              >
                Οφειλέτης
              </th>
              <th
                style={{
                  border: '1px solid #ddd',
                  padding: '8px',
                  backgroundColor: '#f2f2f2',
                }}
              >
                Δανειστής
              </th>
              <th
                style={{
                  border: '1px solid #ddd',
                  padding: '8px',
                  backgroundColor: '#f2f2f2',
                }}
              >
                Ποσό (€)
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.slice(1).map((row, rowIndex) => {
              const [debtor, creditor, amount] = row;
              const translatedDebtor = namesMapping[debtor.trim()] || debtor;
              const translatedCreditor = namesMapping[creditor.trim()] || creditor;
              return (
                <tr key={rowIndex}>
                  <td
                    style={{
                      border: '1px solid #ddd',
                      padding: '8px',
                    }}
                  >
                    {translatedDebtor}
                  </td>
                  <td
                    style={{
                      border: '1px solid #ddd',
                      padding: '8px',
                    }}
                  >
                    {translatedCreditor}
                  </td>
                  <td
                    style={{
                      border: '1px solid #ddd',
                      padding: '8px',
                    }}
                  >
                    {amount.trim() === '0' ? '' : amount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// DebtsPage Component
const DebtsPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // New state for admin check

  const navigate = useNavigate(); // Hook for navigation

  useEffect(() => {
    checkTokenAndFetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkTokenAndFetchData = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      // No token found, redirect to login
      navigate('/login');
      return;
    }

    try {
      // Decode the token to get payload
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;

      if (payload.exp && payload.exp < currentTime) {
        // Token expired
        alert('Η συνεδρία σας έχει λήξει. Παρακαλώ συνδεθείτε ξανά.');
        handleLogout();
        return;
      }

      // Set isAdmin if user_email is admin@yme.gov.gr
      if (payload.user_email === 'admin@yme.gov.gr') {
        setIsAdmin(true);
      }

      // Fetch debt data for all users
      fetchDebtData();
    } catch (err) {
      console.error('Invalid token:', err);
      alert('Μη έγκυρο token. Παρακαλώ συνδεθείτε ξανά.');
      handleLogout();
    }
  };

  // Function to handle logout (remove token and redirect to login)
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const fetchDebtData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Δεν βρέθηκε το token. Παρακαλώ συνδεθείτε ξανά.');
      }

      const response = await fetch(apiUrl('/get_debts_optimization'), {
        headers: {
          'Content-Type': 'application/json',
          'x-observatory-auth': token,
        },
      });

      if (response.status === 200) {
        const result = await response.json();
        setData(result);
      } else if (response.status === 204) {
        setError('Δεν επιστράφηκαν δεδομένα για τα κριτήρια που δώσατε.');
      } else {
        handleSpecificError(response.status);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSpecificError = (statusCode) => {
    let message = '';
    switch (statusCode) {
      case 400:
        message = 'Άκυρο αίτημα. Παρακαλώ ελέγξτε τις εισροές σας.';
        break;
      case 401:
        message = 'Μη εξουσιοδοτημένο αίτημα. Παρακαλώ συνδεθείτε ξανά.';
        handleLogout();
        break;
      case 403:
        message = 'Απαγορεύεται η πρόσβαση. Δεν έχετε τα απαραίτητα δικαιώματα.';
        break;
      case 404:
        message = 'Ο ζητούμενος πόρος δεν βρέθηκε.';
        break;
      case 500:
        message = 'Προέκυψε σφάλμα στον διακομιστή. Παρακαλώ δοκιμάστε ξανά αργότερα.';
        break;
      default:
        message = `Προέκυψε μη αναμενόμενο σφάλμα. Κωδικός κατάστασης: ${statusCode}`;
        break;
    }
    throw new Error(message);
  };

  const handleCancelDebts = async () => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Δεν βρέθηκε το token. Παρακαλώ συνδεθείτε ξανά.');
      }

      const response = await fetch(apiUrl('/cancel_debts'), {
        method: 'PATCH', // Changed from 'POST' to 'PATCH'
        headers: {
          'Content-Type': 'application/json',
          'x-observatory-auth': token,
        },
      });

      if (response.status === 200) {
        await response.json();
        alert('Η ακύρωση ολοκληρώθηκε επιτυχώς.');
        fetchDebtData();
      } else if (response.status === 204) {
        alert('Δεν υπάρχουν διαθέσιμα δεδομένα προς ακύρωση.');
      } else {
        handleSpecificError(response.status);
      }
    } catch (err) {
      console.error(err);
      alert(`Σφάλμα: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <p>Φόρτωση...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          color: 'red',
        }}
      >
        <p>Σφάλμα: {error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '2rem',
        }}
      >
        Οφειλές
      </h1>

      {/* === HTML and CSV Sections (Visible to All Users) === */}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
        <DebtSection title="Αρχικές Οφειλές" html={data.html.html1} sectionKey="initial" />
        <DebtSection title="Τελικές Οφειλές" html={data.html.html2} sectionKey="final" />
      </div>

      <CsvSection title="Δεδομένα οφειλών" csvData={data.csv} />

      {/* === Cancel Debts Section (Visible Only to Admin) === */}
      {isAdmin && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            onClick={handleCancelDebts}
            className="px-6 py-3 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition-colors"
            disabled={isProcessing}
          >
            {isProcessing ? 'Επεξεργασία...' : 'Ακύρωση Οφειλών'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DebtsPage;
