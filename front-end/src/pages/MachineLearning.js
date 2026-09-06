import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './MachineLearning.css';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';

// Helper function to format dates as dd/mm/yyyy
const formatDate = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

// Helper function to format hour to 24-hour format (HH:MM)
const formatHourTo24h = (hour) => {
  const totalMinutes = Math.round(hour * 60);
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper function to format datetime string to date only (dd/mm/yyyy)
const formatToDateOnly = (dateTimeString) => {
  if (!dateTimeString) return '';
  
  // Split the date and time
  const [datePart] = dateTimeString.split(' ');
  
  // Reformat from yyyy-mm-dd to dd/mm/yyyy
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
};

// Helper function to convert time (e.g., "09:08") to minutes since midnight
const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper function to convert minutes since midnight back to 24-hour format
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// Helper function to parse a date string "yyyy-mm-dd" as a local Date
const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-');
  return new Date(year, month - 1, day);
};

// Full toll name mapping
const tollNameMapping = {
  AM01: "Kleidi Toll Station Front (Towards Athens)",
  AM02: "Kleidi Toll Station Front (Towards Thessaloniki)",
  AM03: "Makryhori Toll Station Front (Towards Athens)",
  AM04: "Makryhori Toll Station Front (Towards Thessaloniki)",
  AM05: "Moschohori Toll Station Front (Towards Athens)",
  AM06: "Moschohori Toll Station Front (Towards Thessaloniki)",
  AM07: "Leptokarya Toll Station Front (Towards Athens)",
  AM08: "Leptokarya Toll Station Front (Towards Thessaloniki)",
  AM09: "Pelassia Toll Station Front (Towards Athens)",
  AM10: "Pelassia Toll Station Front (Towards Thessaloniki)",
  AM11: "Gyrtone Toll Station Side (From Athens)",
  AM12: "Gyrtone Toll Station Side (Towards Athens)",
  AM13: "Evangelismos Toll Station Side (From Thessaloniki)",
  AM14: "Evangelismos Toll Station Side (Towards Thessaloniki)",
  AM15: "Kileler Toll Station Side (From Athens)",
  AM16: "Kileler Toll Station Side (Towards Athens)",
  AM17: "Makryhori Toll Station Side (From Athens)",
  AM18: "Megalou Monastiriou Toll Station Side (From Athens)",
  AM19: "Megalou Monastiriou Toll Station Side (Towards Athens)",
  AM20: "Pyrgetos Toll Station Side (Towards Athens)",
  AM21: "Pyrgetos Toll Station Side (Towards Thessaloniki)",
  AM22: "Velestino Toll Station Side (From Athens)",
  AM23: "Velestino Toll Station Side (Towards Athens)",
  AM24: "Velestino Toll Station Side (Towards Athens)",
  AM25: "Leptokarya Toll Station Side (From Thessaloniki)",
  AM26: "Leptokarya Toll Station Side (Towards Thessaloniki)",
  AM27: "Platamonas Toll Station Side (From Athens)",
  AM28: "Platamonas Toll Station Side (Towards Athens)",
  AM29: "Glyfa Toll Station Side (From Thessaloniki)",
  AM30: "Glyfa Toll Station Side (Towards Thessaloniki)",
  EG01: "Actium Tunnel Toll Station Front (Towards Agrinio)",
  EG02: "Actium Tunnel Toll Station Front (Towards Preveza)",
  EG03: "Ardanio Toll Station Front (Towards Igoumenitsa)",
  EG04: "Ardanio Toll Station Front (Towards Kepoi)",
  EG05: "Mesi Toll Station Front (Towards Alexandroupoli)",
  EG06: "Mesi Toll Station Front (Towards Igoumenitsa)",
  EG07: "Analipsi Toll Station Front (Towards Alexandroupoli)",
  EG08: "Analipsi Toll Station Front (Towards Igoumenitsa)",
  EG09: "Asprovalta Toll Station Front (Towards Alexandroupoli)",
  EG10: "Asprovalta Toll Station Front (Towards Igoumenitsa)",
  EG11: "Thessaloniki Toll Station Front (Towards Alexandroupoli)",
  EG12: "Thessaloniki Toll Station Front (Towards Igoumenitsa)",
  EG13: "Malgara Toll Station Front (Towards Athens)",
  EG14: "Malgara Toll Station Front (Towards Thessaloniki)",
  EG15: "Pamvotida Toll Station Front (Towards Alexandroupoli)",
  EG16: "Pamvotida Toll Station Front (Towards Igoumenitsa)",
  EG17: "Tyrgia Toll Station Front (Towards Alexandroupoli)",
  EG18: "Tyrgia Toll Station Front (Towards Igoumenitsa)",
  EG19: "Kavala Toll Station Front (Towards Alexandroupoli)",
  EG20: "Kavala Toll Station Front (Towards Igoumenitsa)",
  EG21: "Moustheni Toll Station Front (Towards Alexandroupoli)",
  EG22: "Moustheni Toll Station Front (Towards Igoumenitsa)",
  EG23: "Hieropigi Toll Station Front (Towards Krystallopigi)",
  EG24: "Hieropigi Toll Station Front (Towards Siatista)",
  EG25: "Evzones Toll Station Front (Towards Malgara)",
  EG26: "Evzones Toll Station Front (Towards Border)",
  EG27: "Polymylos Toll Station Front (Towards Alexandroupoli)",
  EG28: "Polymylos Toll Station Front (Towards Igoumenitsa)",
  EG29: "Siatista Toll Station Front (Towards Alexandroupoli)",
  EG30: "Siatista Toll Station Front (Towards Igoumenitsa)",
  EG31: "Iasmos Toll Station Front (Towards Alexandroupoli)",
  EG32: "Iasmos Toll Station Front (Towards Igoumenitsa)",
  EG33: "Promachonas Toll Station Front (Towards Promachonas)",
  EG34: "Promachonas Toll Station Front (Towards Serres)",
  EG35: "Strymoniko Toll Station Front (Towards Thessaloniki)",
  EG36: "Strymoniko Toll Station Front (Towards Serres)",
  EG37: "Malakasi Toll Station Front (Towards Alexandroupoli)",
  EG38: "Malakasi Toll Station Front (Towards Igoumenitsa)",
  EG39: "Mesi Toll Station Side (From Alexandroupoli)",
  EG40: "Mesi Toll Station Side (Towards Alexandroupoli)",
  EG41: "Vaiohori Toll Station Side (From Alexandroupoli)",
  EG42: "Vaiohori Toll Station Side (Towards Alexandroupoli)",
  EG43: "Lagkadas Toll Station Side (Entrance Towards Igoumenitsa)",
  EG44: "Lagkadas Toll Station Side (Entrance Towards Igoumenitsa)",
  EG45: "Lagkadas Toll Station Side (Exit From Igoumenitsa)",
  EG46: "Asprovalta Toll Station Side (From Igoumenitsa)",
  EG47: "Asprovalta Toll Station Side (Towards Igoumenitsa)",
  EG48: "Profitis Toll Station Side (From Alexandroupoli)",
  EG49: "Profitis Toll Station Side (Towards Alexandroupoli)",
  EG50: "Agios Andreas Toll Station Side (From Alexandroupoli)",
  EG51: "Agios Andreas Toll Station Side (Towards Alexandroupoli)",
  EG52: "Aspron Xmation Toll Station Side (From Igoumenitsa)",
  EG53: "Aspron Xmation Toll Station Side (Towards Igoumenitsa)",
  EG54: "Eleftheroupoli Toll Station Side (From Alexandroupoli)",
  EG55: "Eleftheroupoli Toll Station Side (Towards Alexandroupoli)",
  EG56: "Moustheni Toll Station Side (From Igoumenitsa)",
  EG57: "Moustheni Toll Station Side (Towards Igoumenitsa)",
  EG58: "Galipsos Orfaniou Toll Station Side (From Igoumenitsa)",
  EG59: "Galipsos Orfaniou Toll Station Side (Towards Igoumenitsa)",
  EG60: "Polykastro Toll Station Side (From Polykastro)",
  EG61: "Polykastro Toll Station Side (Towards Polykastro)",
  EG62: "Kalamia Toll Station Side (From Alexandroupoli)",
  EG63: "Kalamia Toll Station Side (Towards Alexandroupoli)",
  EG64: "Siatista East Toll Station Side (From Igoumenitsa)",
  EG65: "Siatista East Toll Station Side (Towards Igoumenitsa)",
  EG66: "Vafeika Toll Station Side (From Igoumenitsa Towards Xanthi)",
  EG67: "Vafeika Toll Station Side (From Igoumenitsa Towards Porto Lagos)",
  EG68: "Vafeika Toll Station Side (From Xanthi Towards Igoumenitsa)",
  EG69: "Vafeika Toll Station Side (From Porto Lagos Towards Igoumenitsa)",
  EG70: "Iasmos Toll Station Side (From Alexandroupoli)",
  EG71: "Iasmos Toll Station Side (Towards Alexandroupoli)",
  EG72: "VIPE Komotini Toll Station Side (From Igoumenitsa)",
  EG73: "VIPE Komotini Toll Station Side (Towards Igoumenitsa)",
  EG74: "Panagia Toll Station Side",
  GE01: "Rio-Antirrio Bridge Toll Station Front (Towards Antirrio)",
  GE02: "Rio-Antirrio Bridge Toll Station Front (Towards Rio)",
  KO01: "Sofades Toll Station Front (Towards Lamia)",
  KO02: "Sofades Toll Station Front (Towards Trikala)",
  KO03: "Trikala Toll Station Front (Towards Lamia)",
  KO04: "Trikala Toll Station Front (Towards Trikala)",
  KO05: "Agia Triada Toll Station Front (Towards Athens)",
  KO06: "Agia Triada Toll Station Front (Towards Thessaloniki)",
  KO07: "Leianokladi Toll Station Front (Towards Lamia)",
  KO08: "Leianokladi Toll Station Front (Towards Trikala)",
  KO09: "Mavromantiia Toll Station Front (Towards Athens)",
  KO10: "Mavromantiia Toll Station Front (Towards Thessaloniki)",
  KO11: "Anavra Toll Station Side (From Lamia)",
  KO12: "Anavra Toll Station Side (Towards Lamia)",
  KO13: "Proastio Toll Station Side (From Lamia)",
  KO14: "Proastio Toll Station Side (Towards Lamia)",
  KO15: "Kalambaka Toll Station Side (From Kalambaka)",
  KO16: "Kalambaka Toll Station Side (Towards Kalambaka)",
  KO17: "Trikala Toll Station Side (From Trikala)",
  KO18: "Trikala Toll Station Side (Towards Trikala)",
  KO19: "Agia Marina Toll Station Side (From Thessaloniki)",
  KO20: "Agia Marina Toll Station Side (Towards Thessaloniki)",
  KO21: "Thermopylae Toll Station Side (From Thessaloniki)",
  KO22: "Thermopylae Toll Station Side (Towards Thessaloniki)",
  KO23: "Molos Toll Station Side (From Athens)",
  KO24: "Molos Toll Station Side (Towards Athens)",
  KO25: "Stylida Toll Station Side (From Thessaloniki)",
  KO26: "Stylida Toll Station Side (Towards Thessaloniki)",
  MO01: "Veligosti Toll Station Front (Towards Kalamata)",
  MO02: "Veligosti Toll Station Front (Towards Corinth)",
  MO03: "Manari Bridge Toll Station Front (Towards Kalamata)",
  MO04: "Manari Bridge Toll Station Front (Towards Corinth)",
  MO05: "Nestani Toll Station Front (Towards Kalamata)",
  MO06: "Nestani Toll Station Front (Towards Corinth)",
  MO07: "Petrina Toll Station Front (Towards Corinth-Kalamata)",
  MO08: "Petrina Toll Station Front (Towards Sparta)",
  MO09: "Spathovouni Toll Station Front (Towards Kalamata)",
  MO10: "Spathovouni Toll Station Front (Towards Corinth)",
  MO11: "Kalamata Toll Station Front (Towards Kalamata)",
  MO12: "Kalamata Toll Station Front (Towards Corinth)",
  MO13: "Arfara Toll Station Side (From Corinth)",
  MO14: "Arfara Toll Station Side (Towards Corinth)",
  MO15: "Thouria Toll Station Side (From Kalamata)",
  MO16: "Thouria Toll Station Side (Towards Kalamata)",
  MO17: "Paradeisia Toll Station Side (From Kalamata)",
  MO18: "Paradeisia Toll Station Side (Towards Kalamata)",
  NAO01: "Agia Paraskevi Toll Station Side (Towards Karea)",
  NAO02: "Agia Paraskevi Toll Station Side (Towards Pallini)",
  NAO03: "Dimokritou Toll Station Side (Towards Pallini)",
  NAO04: "Anthousa Toll Station Side (Towards Elefsina)",
  NAO05: "Aigaleo Peripheral Toll Station Side (Towards Airport)",
  NAO06: "Aigaleo Peripheral Toll Station Side (Towards Elefsina)",
  NAO07: "Aspropyrgos Toll Station Side (Towards Airport)",
  NAO08: "Aspropyrgos Toll Station Side (Towards Elefsina)",
  NAO09: "Doukissis Plakentias Ave Toll Station Side (Towards Airport)",
  NAO10: "Doukissis Plakentias Ave Toll Station Side (Towards Elefsina)",
  NAO11: "Doukissis Plakentias Ave Toll Station Side (Towards Karea)",
  NAO12: "Penteli Ave Toll Station Side (Towards Airport)",
  NAO13: "Penteli Ave Toll Station Side (Towards Elefsina)",
  NAO14: "Glyka Nera Toll Station Side (Towards Karea)",
  NAO15: "Glyka Nera Toll Station Side (Towards Pallini)",
  NAO16: "Dimokratias Ave Toll Station Side (Towards Airport)",
  NAO17: "Dimokratias Ave Toll Station Side (Towards Elefsina)",
  NAO18: "Irakliou Ave Toll Station Side (Towards Airport)",
  NAO19: "Irakliou Ave Toll Station Side (Towards Elefsina)",
  NAO20: "Kymi Ave Toll Station Side (Towards Airport)",
  NAO21: "Kymi Ave Toll Station Side (Towards Elefsina)",
  NAO22: "Fyli Ave Toll Station Side (Towards Airport)",
  NAO23: "Fyli Ave Toll Station Side (Towards Elefsina)",
  NAO24: "Koropi Toll Station Front (Towards Elefsina)",
  NAO25: "Kifisias Ave Toll Station Side (Towards Airport)",
  NAO26: "Kifisias Ave Toll Station Side (Towards Elefsina)",
  NAO27: "Athens-Lamia Toll Station Side (From Athens Towards Airport)",
  NAO28: "Athens-Lamia Toll Station Side (From Athens Towards Elefsina)",
  NAO29: "Athens-Lamia Toll Station Side (From Lamia Towards Airport)",
  NAO30: "Athens-Lamia Toll Station Side (From Lamia Towards Elefsina)",
  NAO31: "Paiania Toll Station Side (Towards Airport)",
  NAO32: "Paiania Toll Station Side (Towards Elefsina)",
  NAO33: "Marathonos Ave Toll Station Side (Towards Airport)",
  NAO34: "Marathonos Ave Toll Station Side (Towards Elefsina)",
  NAO35: "Pallini Toll Station Side (Towards Karea)",
  NAO36: "Katehaki Toll Station Front (Towards Pallini)",
  NAO37: "Papagou Toll Station Side (Towards Karea)",
  NAO38: "Papagou Toll Station Side (Towards Pallini)",
  NAO39: "Roupakio Toll Station Front (Towards Airport)",
  NAO40: "Kantza Toll Station Side (Towards Airport)",
  NAO41: "Kantza Toll Station Side (Towards Elefsina)",
  NO01: "Angelokastro Toll Station Front (Towards Ioannina)",
  NO02: "Angelokastro Toll Station Front (Towards Rio)",
  NO03: "Klokova Toll Station Front (Towards Ioannina)",
  NO04: "Klokova Toll Station Front (Towards Rio)",
  NO05: "Menidi Toll Station Front (Towards Ioannina)",
  NO06: "Menidi Toll Station Front (Towards Rio)",
  NO07: "Afidnes Toll Station Front (Towards Athens)",
  NO08: "Afidnes Toll Station Front (Towards Thessaloniki)",
  NO09: "Thiva Toll Station Front (Towards Athens)",
  NO10: "Thiva Toll Station Front (Towards Thessaloniki)",
  NO11: "Terovo Toll Station Front (Towards Ioannina)",
  NO12: "Terovo Toll Station Front (Towards Rio)",
  NO13: "Tragana Toll Station Front (Towards Athens)",
  NO14: "Tragana Toll Station Front (Towards Thessaloniki)",
  NO15: "Gavrolimni Toll Station Side (From Ioannina)",
  NO16: "Gavrolimni Toll Station Side (Towards Ioannina)",
  NO17: "Mesologgi Toll Station Side (From Ioannina)",
  NO18: "Mesologgi Toll Station Side (Towards Ioannina)",
  NO19: "Kouvaras Toll Station Side (From Ioannina)",
  NO20: "Kouvaras Toll Station Side (Towards Ioannina)",
  NO21: "Arta Toll Station Side (From Ioannina)",
  NO22: "Arta Toll Station Side (Towards Ioannina)",
  NO23: "Kapandriti Toll Station Side (From Thessaloniki)",
  NO24: "Kapandriti Toll Station Side (Towards Thessaloniki)",
  NO25: "Malakasa Toll Station Side (From Thessaloniki)",
  NO26: "Malakasa Toll Station Side (Towards Thessaloniki)",
  NO27: "Thiva Toll Station Side (From Thessaloniki)",
  NO28: "Thiva Toll Station Side (Towards Thessaloniki)",
  NO29: "Oinofyta Toll Station Side (From Thessaloniki)",
  NO30: "Oinofyta Toll Station Side (Towards Thessaloniki)",
  NO31: "Gorgomylos Toll Station Side (From Rio)",
  NO32: "Gorgomylos Toll Station Side (Towards Rio)",
  NO33: "Tragana Toll Station Side (From Thessaloniki)",
  NO34: "Tragana Toll Station Side (Towards Thessaloniki)",
  OO01: "Elefsina Toll Station Front (Towards Athens)",
  OO02: "Elefsina Toll Station Front (Towards Patra)",
  OO03: "Rio Toll Station Front (Towards Athens)",
  OO04: "Rio Toll Station Front (Towards Patra)",
  OO05: "Elaiona Toll Station Front (Towards Athens)",
  OO06: "Elaiona Toll Station Front (Towards Patra)",
  OO07: "Isthmia Toll Station Front (Towards Athens)",
  OO08: "Isthmia Toll Station Front (Towards Patra)",
  OO09: "Kiato Toll Station Front (Towards Athens)",
  OO10: "Kiato Toll Station Front (Towards Patra)",
  OO11: "Nea Peramos Toll Station Side (From Patra)",
  OO12: "Nea Peramos Toll Station Side (Towards Patra)",
  OO13: "Pachi Toll Station Side (From Patra)",
  OO14: "Pachi Toll Station Side (Towards Patra)",
  OO15: "Drepano Toll Station Side (From Athens)",
  OO16: "Drepano Toll Station Side (Towards Athens)",
  OO17: "Akratas Toll Station Side (From Athens)",
  OO18: "Akratas Toll Station Side (Towards Athens)",
  OO19: "Kalavryta Toll Station Side (From Athens)",
  OO20: "Kalavryta Toll Station Side (Towards Athens)",
  OO21: "Agii Theodori Toll Station Side (From Athens)",
  OO22: "Agii Theodori Toll Station Side (Towards Athens)",
  OO23: "Derveni Toll Station Side (From Athens)",
  OO24: "Derveni Toll Station Side (Towards Athens)",
  OO25: "Zevgolatio Toll Station Side (From Athens)",
  OO26: "Zevgolatio Toll Station Side (Towards Athens)",
  OO27: "Kiato Toll Station Side (From Patra)",
  OO28: "Kiato Toll Station Side (Towards Patra)"
};
export default function MLDashboard() {
  const [loading, setLoading] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState('');
  const [error, setError] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [forecastData, setForecastData] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('AM');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [forecastDate, setForecastDate] = useState('');
  const [selectedFunctionality, setSelectedFunctionality] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const navigate = useNavigate();

  const companies = [
    { value: 'AM', label: 'Αυτοκινητόδρομος Αιγαίου' },
    { value: 'EG', label: 'Εγνατία Οδός' },
    { value: 'KO', label: 'Κεντρική Οδός' },
    { value: 'MO', label: 'Μορέας' },
    { value: 'NAO', label: 'Αττική Οδός' },
    { value: 'NO', label: 'Νέα Οδός' },
    { value: 'OO', label: 'Ολυμπία Οδός' },
    { value: 'GE', label: 'Γέφυρα' },
  ];

  const functionalities = [
    { value: 'predictions', label: 'Πρόβλεψη ώρας αιχμής' },
    { value: 'forecast', label: 'Πρόβλεψη μέγιστης ροής οχημάτων' },
  ];

  // Function to handle logout (remove token and redirect to login)
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Check token validity on component mount
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;

        if (payload.exp && payload.exp < currentTime) {
          alert('Η συνεδρία σας έχει λήξει. Παρακαλώ συνδεθείτε ξανά.');
          handleLogout();
          return;
        }

        if (payload.user_email === 'admin@yme.gov.gr') {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error('Invalid token:', err);
        alert('Μη έγκυρο token. Παρακαλώ συνδεθείτε ξανά.');
        handleLogout();
      }
    };

    checkToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const token = localStorage.getItem('token');

  const trainModels = async () => {
    setLoading(true);
    setTrainingStatus('Training models...');
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/training`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-observatory-auth': token,
        },
      });

      if (response.status === 200) {
        await response.json();
        setTrainingStatus('Training completed successfully');
      } else if (response.status === 204) {
        setError('Η εκπαίδευση ολοκληρώθηκε, αλλά δεν επέστρεψε δεδομένα.');
      } else {
        switch (response.status) {
          case 400:
            throw new Error('Άκυρο αίτημα. Παρακαλώ ελέγξτε τις εισροές σας.');
          case 401:
            throw new Error('Μη εξουσιοδοτημένο αίτημα. Παρακαλώ συνδεθείτε ξανά.');
          case 404:
            throw new Error('Η ζητούμενη πόρος δεν βρέθηκε.');
          case 500:
            throw new Error('Προέκυψε σφάλμα στον διακομιστή. Παρακαλώ δοκιμάστε ξανά αργότερα.');
          default:
            throw new Error('Προέκυψε μη αναμενόμενο σφάλμα.');
        }
      }
    } catch (err) {
      console.error('Error during training:', err);
      setError('Failed to train models: ' + err.message);
      if (err.message.includes('Unauthorized')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const getPredictions = async () => {
    if (!dateRange.from || !dateRange.to) {
      setError('Παρακαλώ επιλέξτε εύρος ημερομηνιών.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fromDate = dateRange.from.replace(/-/g, '');
      const toDate = dateRange.to.replace(/-/g, '');
      const response = await fetch(
        `${API_BASE_URL}/peak_hour/${selectedCompany}/${fromDate}/${toDate}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-observatory-auth': token,
          },
        }
      );

      if (response.status === 200) {
        const data = await response.json();

        // Μετατροπή των αποτελεσμάτων
        const formattedData = data.map((item) => ({
          ...item,
          passage_date: formatToDateOnly(item.passage_date),
          predicted_hour: formatHourTo24h(item.predicted_hour),
          predicted_hour_minutes: timeToMinutes(formatHourTo24h(item.predicted_hour)), // για το γράφημα
        }));

        // Φίλτρο για να απομακρύνουμε τις διπλές εγγραφές (βάσει passage_date)
        const uniqueData = formattedData.filter((item, index, self) =>
          index === self.findIndex((t) => t.passage_date === item.passage_date)
        );

        setPredictions(uniqueData);
      } else if (response.status === 204) {
        setError('Δεν επιστράφηκαν δεδομένα για τα κριτήρια που δώσατε.');
      } else {
        switch (response.status) {
          case 400:
            throw new Error('Άκυρο αίτημα. Παρακαλώ ελέγξτε τις εισροές σας.');
          case 401:
            throw new Error('Μη εξουσιοδοτημένο αίτημα. Παρακαλώ συνδεθείτε ξανά.');
          case 404:
            throw new Error('Η ζητούμενη πόρος δεν βρέθηκε.');
          case 500:
            throw new Error('Προέκυψε σφάλμα στον διακομιστή. Παρακαλώ δοκιμάστε ξανά αργότερα.');
          default:
            throw new Error('Προέκυψε μη αναμενόμενο σφάλμα.');
        }
      }
    } catch (err) {
      console.error('Error fetching predictions:', err);
      setError('Failed to get predictions: ' + err.message);
      if (err.message.includes('Unauthorized')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const getForecast = async () => {
    if (!forecastDate) {
      setError('Παρακαλώ επιλέξτε ημερομηνία πρόβλεψης.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formattedDate = forecastDate.replace(/-/g, '');
      const response = await fetch(
        `${API_BASE_URL}/forecast/${selectedCompany}/${formattedDate}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-observatory-auth': token,
          },
        }
      );

      if (response.status === 200) {
        const data = await response.json();
        const formattedData = data.predictions.map((predictedHour, index) => {
          const tollID = `${selectedCompany}${String(index + 1).padStart(2, '0')}`;
          return {
            tollID: tollID,
            tollName: tollNameMapping[tollID] || tollID,
            predicted_hour: Math.round(predictedHour),
          };
        });

        setForecastData(formattedData);
      } else if (response.status === 204) {
        setError('Δεν επιστράφηκαν δεδομένα για την επιλεγμένη ημερομηνία.');
      } else {
        switch (response.status) {
          case 400:
            throw new Error('Άκυρο αίτημα. Παρακαλώ ελέγξτε τις εισροές σας.');
          case 401:
            throw new Error('Μη εξουσιοδοτημένο αίτημα. Παρακαλώ συνδεθείτε ξανά.');
          case 404:
            throw new Error('Η ζητούμενη πόρος δεν βρέθηκε.');
          case 500:
            throw new Error('Προέκυψε σφάλμα στον διακομιστή. Παρακαλώ δοκιμάστε ξανά αργότερα.');
          default:
            throw new Error('Προέκυψε μη αναμενόμενο σφάλμα.');
        }
      }
    } catch (err) {
      console.error('Error fetching forecast:', err);
      setError('Failed to fetch forecast: ' + err.message);
      if (err.message.includes('Unauthorized')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  // Αποθήκευση της ημερομηνίας σε μορφή "yyyy-mm-dd"
  const handleDatePickerChange = (field, date) => {
    if (!date) return;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedValue = `${year}-${month}-${day}`;
    setDateRange((prev) => ({ ...prev, [field]: formattedValue }));
  };

  const handleForecastDateChange = (date) => {
    if (!date) return;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedValue = `${year}-${month}-${day}`;
    setForecastDate(formattedValue);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Προβλέψεις Κυκλοφορίας</h1>

      {/* Εκπαίδευση Μοντέλων (μόνο για διαχειριστές) */}
      {isAdmin && (
        <div className="mb-8 p-6 border rounded bg-white">
          <h2 className="text-xl font-bold mb-4">Εκπαίδευση Μοντέλων</h2>
          <button
            onClick={trainModels}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Εκπαίδευση...' : 'Εκπαίδευση'}
          </button>
          {trainingStatus && (
            <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded">
              <p>{trainingStatus}</p>
            </div>
          )}
        </div>
      )}

      {/* Επιλογή Πρόβλεψης / Πρόβλεψης */}
      <div className="p-6 border rounded bg-white">
        <h2 className="text-xl font-bold mb-4">Επιλογή Πρόβλεψης</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Πρόβλεψεις</label>
          <select
            value={selectedFunctionality}
            onChange={(e) => setSelectedFunctionality(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Επιλέξτε πρόβλεψη</option>
            {functionalities.map((func) => (
              <option key={func.value} value={func.value}>
                {func.label}
              </option>
            ))}
          </select>
        </div>

        {/* Πρόβλεψη Ώρας Αιχμής */}
        {selectedFunctionality === 'predictions' && (
          <>
            <h2 className="text-xl font-bold mb-4">Πρόβλεψη Ώρας Αιχμής</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Εταιρεία</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  {companies.map((company) => (
                    <option key={company.value} value={company.value}>
                      {company.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="date-inputs">
                <div>
                  <label className="block text-sm font-medium mb-1">Από</label>
                  <ReactDatePicker
                    selected={dateRange.from ? parseLocalDate(dateRange.from) : null}
                    onChange={(date) => handleDatePickerChange('from', date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/mm/yyyy"
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Έως</label>
                  <ReactDatePicker
                    selected={dateRange.to ? parseLocalDate(dateRange.to) : null}
                    onChange={(date) => handleDatePickerChange('to', date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/mm/yyyy"
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={getPredictions}
              disabled={loading}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Γίνεται πρόβλεψη...' : 'Αποτελέσματα πρόβλεψης'}
            </button>
          </>
        )}

        {/* Πρόβλεψη Μέγιστης Ροής Οχημάτων */}
        {selectedFunctionality === 'forecast' && (
          <>
            <h2 className="text-xl font-bold mb-4">Πρόβλεψη Μέγιστης Ροής Οχημάτων</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Εταιρεία</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  {companies.map((company) => (
                    <option key={company.value} value={company.value}>
                      {company.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ημερομηνία</label>
                <ReactDatePicker
                  selected={forecastDate ? parseLocalDate(forecastDate) : null}
                  onChange={handleForecastDateChange}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/yyyy"
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <button
              onClick={getForecast}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Γίνεται πρόβλεψη...' : 'Αποτελέσματα πρόβλεψης'}
            </button>
          </>
        )}

        {/* Εμφάνιση σφάλματος */}
        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 rounded text-red-700">
            {error}
          </div>
        )}

        {/* Αποτελέσματα Πρόβλεψης */}
        {predictions.length > 0 && selectedFunctionality === 'predictions' && (
          <div className="mt-6">
            <h3 className="text-lg font-bold mb-4">Αποτελέσματα Πρόβλεψης</h3>
            <table className="table-auto w-full border-collapse border border-gray-200 text-left">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-4 py-2">Ημερομηνία</th>
                  <th className="border border-gray-200 px-4 py-2">Προβλεπόμενη Ώρα Αιχμής</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((entry, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-4 py-2">{entry.passage_date}</td>
                    <td className="border border-gray-200 px-4 py-2">{entry.predicted_hour}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Γράφημα για τις προβλέψεις */}
            <div className="mt-6">
              <LineChart width={800} height={400} data={predictions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="passage_date" />
                <YAxis domain={[0, 1440]} tickFormatter={minutesToTime} />
                <Tooltip formatter={(value) => minutesToTime(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="predicted_hour_minutes"
                  stroke="#10B981"
                  name="Προβλεπόμενη Ώρα Αιχμής"
                />
              </LineChart>
            </div>

            {/* Disclaimer */}
            <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 rounded text-yellow-700">
              <p>
                <strong>Προσοχή:</strong> Οι προβλέψεις για ημερομηνίες που απέχουν πολύ από την σημερινή ημερομηνία μπορεί να έχουν χαμηλή ακρίβεια.
              </p>
            </div>
          </div>
        )}

        {/* Αποτελέσματα Πρόβλεψης Ροής Οχημάτων */}
        {forecastData.length > 0 && selectedFunctionality === 'forecast' && (
          <div className="mt-6">
            <h3 className="text-lg font-bold mb-4">
              Αποτελέσματα Πρόβλεψης για {formatDate(forecastDate)}
            </h3>
            <table className="table-auto w-full border-collapse border border-gray-200 text-left">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-4 py-2">Όνομα διοδίου</th>
                  <th className="border border-gray-200 px-4 py-2">Προβλεπόμενος αριθμός οχημάτων</th>
                </tr>
              </thead>
              <tbody>
                {forecastData.map((entry, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-4 py-2">{entry.tollName}</td>
                    <td className="border border-gray-200 px-4 py-2">{entry.predicted_hour}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6">
              <LineChart width={800} height={400} data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tollName" tick={false} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="predicted_hour"
                  stroke="#10B981"
                  name="Προβλεπόμενος αριθμός οχημάτων"
                />
              </LineChart>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
