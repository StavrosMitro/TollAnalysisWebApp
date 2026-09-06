import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './StatsDashboard.css'; // Ensure this CSS file exists for styling
import { API_BASE_URL } from '../api/config';

const AnalysisDashboard = () => {
  const navigate = useNavigate();

  // Options used in some of the tabs
  const operationOptions = [
    { value: 'AM', label: 'Αυτοκινητόδρομος Αιγαίου' },
    { value: 'EG', label: 'Εγνατία Οδός' },
    { value: 'KO', label: 'Κεντρική Οδός' },
    { value: 'MO', label: 'Μορέας' },
    { value: 'NAO', label: 'Αττική Οδός' },
    { value: 'NO', label: 'Νέα Οδός' },
    { value: 'OO', label: 'Ολυμπία Οδός' },
    { value: 'GE', label: 'Γέφυρα' },
  ];

  // Toll station mapping for the TollStationPasses tab
  const tollNameMapping = {
    AM01: "Σταθμός Διοδίων Κλειδίου Μετωπικά (Προς Αθήνα)",
    AM02: "Σταθμός Διοδίων Κλειδίου Μετωπικά (Προς Θεσσαλονίκη)",
    AM03: "Σταθμός Διοδίων Μακρυχωρίου Μετωπικά (Προς Αθήνα)",
    AM04: "Σταθμός Διοδίων Μακρυχωρίου Μετωπικά (Προς Θεσσαλονίκη)",
    AM05: "Σταθμός Διοδίων Μοσχοχωρίου Μετωπικά (Προς Αθήνα)",
    AM06: "Σταθμός Διοδίων Μοσχοχωρίου Μετωπικά (Προς Θεσσαλονίκη)",
    AM07: "Σταθμός Διοδίων Λεπτοκαρυάς Μετωπικά (Προς Αθήνα)",
    AM08: "Σταθμός Διοδίων Λεπτοκαρυάς Μετωπικά (Προς Θεσσαλονίκη)",
    AM09: "Σταθμός Διοδίων Πελασγίας Μετωπικά (Προς Αθήνα)",
    AM10: "Σταθμός Διοδίων Πελασγίας Μετωπικά (Προς Θεσσαλονίκη)",
    AM11: "Σταθμός Διοδίων Γυρτώνης Πλευρικά (Από Αθήνα)",
    AM12: "Σταθμός Διοδίων Γυρτώνης Πλευρικά (Προς Αθήνα)",
    AM13: "Σταθμός Διοδίων Ευαγγελισμού Πλευρικά (Από Θεσσαλονίκη)",
    AM14: "Σταθμός Διοδίων Ευαγγελισμού Πλευρικά (Προς Θεσσαλονίκη)",
    AM15: "Σταθμός Διοδίων Κιλελέρ Πλευρικά (Από Αθήνα)",
    AM16: "Σταθμός Διοδίων Κιλελέρ Πλευρικά (Προς Αθήνα)",
    AM17: "Σταθμός Διοδίων Μακρυχωρίου Πλευρικά (Από Αθήνα)",
    AM18: "Σταθμός Διοδίων Μεγάλου Μοναστηρίου Πλευρικά (Από Αθήνα)",
    AM19: "Σταθμός Διοδίων Μεγάλου Μοναστηρίου Πλευρικά (Προς Αθήνα)",
    AM20: "Σταθμός Διοδίων Πυργετού Πλευρικά (Προς Αθήνα)",
    AM21: "Σταθμός Διοδίων Πυργετού Πλευρικά (Προς Θεσσαλονίκη)",
    AM22: "Σταθμός Διοδίων Βελεστίνου Πλευρικά (Από Αθήνα)",
    AM23: "Σταθμός Διοδίων Βελεστίνου Πλευρικά (Προς Αθήνα)",
    AM24: "Σταθμός Διοδίων Βελεστίνου Πλευρικά (Προς Αθήνα)",
    AM25: "Σταθμός Διοδίων Λεπτοκαρυάς Πλευρικά (Από Θεσσαλονίκη)",
    AM26: "Σταθμός Διοδίων Λεπτοκαρυάς Πλευρικά (Προς Θεσσαλονίκη)",
    AM27: "Σταθμός Διοδίων Πλαταμώνα Πλευρικά (Από Αθήνα)",
    AM28: "Σταθμός Διοδίων Πλαταμώνα Πλευρικά (Προς Αθήνα)",
    AM29: "Σταθμός Διοδίων Γλύφας Πλευρικά (Από Θεσσαλονίκη)",
    AM30: "Σταθμός Διοδίων Γλύφας Πλευρικά (Προς Θεσσαλονίκη)",
    EG01: "Σταθμός Διοδίων Σήραγγας Ακτίου Μετωπικά (Προς Αγρίνιο)",
    EG02: "Σταθμός Διοδίων Σήραγγας Ακτίου Μετωπικά (Προς Πρέβεζα)",
    EG03: "Σταθμός Διοδίων Αρδανίου Μετωπικά (Προς Ηγουμενίτσα)",
    EG04: "Σταθμός Διοδίων Αρδανίου Μετωπικά (Προς Κήπους)",
    EG05: "Σταθμός Διοδίων Μεστής Μετωπικά (Προς Αλεξ/πολη)",
    EG06: "Σταθμός Διοδίων Μεστής Μετωπικά (Προς Ηγουμενίτσα)",
    EG07: "Σταθμός Διοδίων Ανάληψης Μετωπικά (Προς Αλεξ/πολη)",
    EG08: "Σταθμός Διοδίων Ανάληψης Μετωπικά (Προς Ηγουμενίτσα)",
    EG09: "Σταθμός Διοδίων Ασπροβάλτας Μετωπικά (Προς Αλεξανδρούπολη)",
    EG10: "Σταθμός Διοδίων Ασπροβάλτας Μετωπικά (Προς Ηγουμενίτσα)",
    EG11: "Σταθμός Διοδίων Θεσσαλονίκης Μετωπικά (Προς Αλεξανδρούπολη)",
    EG12: "Σταθμός Διοδίων Θεσσαλονίκης Μετωπικά (Προς Ηγουμενίτσα)",
    EG13: "Σταθμός Διοδίων Μαλγάρων Μετωπικά (Προς Αθήνα)",
    EG14: "Σταθμός Διοδίων Μαλγάρων Μετωπικά (Προς Θεσσαλονίκη)",
    EG15: "Σταθμός Διοδίων Παμβώτιδας Μετωπικά (Προς Αλεξ/πολη)",
    EG16: "Σταθμός Διοδίων Παμβώτιδας Μετωπικά (Προς Ηγουμενίτσα)",
    EG17: "Σταθμός Διοδίων Τύριας Μετωπικά (Προς Αλεξ/πολη)",
    EG18: "Σταθμός Διοδίων Τύριας Μετωπικά (Προς Ηγουμενίτσα)",
    EG19: "Σταθμός Διοδίων Καβάλας Μετωπικά (Προς Αλεξ/πολη)",
    EG20: "Σταθμός Διοδίων Καβάλας Μετωπικά (Προς Ηγουμενίτσα)",
    EG21: "Σταθμός Διοδίων Μουσθένης Μετωπικά (Προς Αλεξ/πολη)",
    EG22: "Σταθμός Διοδίων Μουσθένης Μετωπικά (Προς Ηγουμενίτσα)",
    EG23: "Σταθμός Διοδίων Ιεροπηγής Μετωπικά (Προς Κρυσταλλοπηγή)",
    EG24: "Σταθμός Διοδίων Ιεροπηγής Μετωπικά (Προς Σιάτιστα)",
    EG25: "Σταθμός Διοδίων Ευζώνων Μετωπικά (Προς Μάλγαρα)",
    EG26: "Σταθμός Διοδίων Ευζώνων Μετωπικά (Προς Σύνορα)",
    EG27: "Σταθμός Διοδίων Πολύμυλου Μετωπικά (Προς Αλεξ/πολη)",
    EG28: "Σταθμός Διοδίων Πολύμυλου Μετωπικά (Προς Ηγουμενίτσα)",
    EG29: "Σταθμός Διοδίων Σιάτιστας Μετωπικά (Προς Αλεξ/πολη)",
    EG30: "Σταθμός Διοδίων Σιάτιστας Μετωπικά (Προς Ηγουμενίτσα)",
    EG31: "Σταθμός Διοδίων Ίασμου Μετωπικά (Προς Αλεξ/πολη)",
    EG32: "Σταθμός Διοδίων Ίασμου Μετωπικά (Προς Ηγουμενίτσα)",
    EG33: "Σταθμός Διοδίων Προμαχώνα Μετωπικά (Προς Προμαχώνα)",
    EG34: "Σταθμός Διοδίων Προμαχώνα Μετωπικά (Προς Σέρρες)",
    EG35: "Σταθμός Διοδίων Στρυμονικού Μετωπικά (Προς Θεσσαλονίκη)",
    EG36: "Σταθμός Διοδίων Στρυμονικού Μετωπικά (Προς Σέρρες)",
    EG37: "Σταθμός Διοδίων Μαλακασίου Μετωπικά (Προς Αλεξ/πολη)",
    EG38: "Σταθμός Διοδίων Μαλακασίου Μετωπικά (Προς Ηγουμενίτσα)",
    EG39: "Σταθμός Διοδίων Μεστής Πλευρικά (Από Αλεξ/πολη)",
    EG40: "Σταθμός Διοδίων Μεστής Πλευρικά (Προς Αλεξ/πολη)",
    EG41: "Σταθμός Διοδίων Βαϊοχωρίου Πλευρικά (Από Αλεξ/πολη)",
    EG42: "Σταθμός Διοδίων Βαϊοχωρίου Πλευρικά (Προς Αλεξ/πολη)",
    EG43: "Σταθμός Διοδίων Λαγκαδά Πλευρικά (Είσοδος Προς Ηγουμενίτσα)",
    EG44: "Σταθμός Διοδίων Λαγκαδά Πλευρικά (Είσοδος Προς Ηγουμενίτσα)",
    EG45: "Σταθμός Διοδίων Λαγκαδά Πλευρικά (Έξοδος Από Ηγουμενίτσα)",
    EG46: "Σταθμός Διοδίων Ασπροβάλτας Πλευρικά (Από Ηγουμενίτσα)",
    EG47: "Σταθμός Διοδίων Ασπροβάλτας Πλευρικά (Προς Ηγουμενίτσα)",
    EG48: "Σταθμός Διοδίων Προφήτη Πλευρικά (Από Αλεξ/πολη)",
    EG49: "Σταθμός Διοδίων Προφήτη Πλευρικά (Προς Αλεξ/πολη)",
    EG50: "Σταθμός Διοδίων Αγίου Ανδρέα Πλευρικά (Από Αλεξ/πολη)",
    EG51: "Σταθμός Διοδίων Αγίου Ανδρέα Πλευρικά (Προς Αλεξ/πολη)",
    EG52: "Σταθμός Διοδίων Άσπρων Χωμάτων Πλευρικά (Από Ηγουμενίτσα)",
    EG53: "Σταθμός Διοδίων Άσπρων Χωμάτων Πλευρικά (Προς Ηγουμενίτσα)",
    EG54: "Σταθμός Διοδίων Ελευθερούπολης Πλευρικά (Από Αλεξ/πολη)",
    EG55: "Σταθμός Διοδίων Ελευθερούπολης Πλευρικά (Προς Αλεξ/πολη)",
    EG56: "Σταθμός Διοδίων Μουσθένης Πλευρικά (Από Ηγουμενίτσα)",
    EG57: "Σταθμός Διοδίων Μουσθένης Πλευρικά (Προς Ηγουμενίτσα)",
    EG58: "Σταθμός Διοδίων Γαληψού Ορφανίου Πλευρικά (Από Ηγουμενίτσα)",
    EG59: "Σταθμός Διοδίων Γαληψού Ορφανίου Πλευρικά (Προς Ηγουμενίτσα)",
    EG60: "Σταθμός Διοδίων Πολυκάστρου Πλευρικά (Από Πολύκαστρο)",
    EG61: "Σταθμός Διοδίων Πολυκάστρου Πλευρικά (Προς Πολύκαστρο)",
    EG62: "Σταθμός Διοδίων Καλαμιάς Πλευρικά (Από Αλεξ/πολη)",
    EG63: "Σταθμός Διοδίων Καλαμιάς Πλευρικά (Προς Αλεξ/πολη)",
    EG64: "Σταθμός Διοδίων Σιάτιστας Ανατολικά Πλευρικά (Από Ηγουμενίτσα)",
    EG65: "Σταθμός Διοδίων Σιάτιστας Ανατολικά Πλευρικά (Προς Ηγουμενίτσα)",
    EG66: "Σταθμός Διοδίων Βαφέικων Πλευρικά (Από Ηγουμενίτσα Προς Ξάνθη)",
    EG67: "Σταθμός Διοδίων Βαφέικων Πλευρικά (Από Ηγουμενίτσα Προς Πόρτο Λάγος)",
    EG68: "Σταθμός Διοδίων Βαφέικων Πλευρικά (Από Ξάνθη Προς Ηγουμενίτσα)",
    EG69: "Σταθμός Διοδίων Βαφέικων Πλευρικά (Από Πόρτο Λάγος Προς Ηγουμενίτσα)",
    EG70: "Σταθμός Διοδίων Ίασμου Πλευρικά (Από Αλεξ/πολη)",
    EG71: "Σταθμός Διοδίων Ίασμου Πλευρικά (Προς Αλεξ/πολη)",
    EG72: "Σταθμός Διοδίων ΒΙ.ΠΕ. Κομοτηνής Πλευρικά (Από Ηγουμενίτσα)",
    EG73: "Σταθμός Διοδίων ΒΙ.ΠΕ. Κομοτηνής Πλευρικά (Προς Ηγουμενίτσα)",
    EG74: "Σταθμός Διοδίων Παναγιάς Πλευρικά",
    GE01: "Σταθμός Διοδίων Γέφυρας Ρίου Αντιρρίου Μετωπικά (Προς Αντίρριο)",
    GE02: "Σταθμός Διοδίων Γέφυρας Ρίου Αντιρρίου Μετωπικά (Προς Ρίο)",
    KO01: "Σταθμός Διοδίων Σοφάδων Μετωπικά (Προς Λαμία)",
    KO02: "Σταθμός Διοδίων Σοφάδων Μετωπικά (Προς Τρίκαλα)",
    KO03: "Σταθμός Διοδίων Τρικάλων Μετωπικά (Προς Λαμία)",
    KO04: "Σταθμός Διοδίων Τρικάλων Μετωπικά (Προς Τρίκαλα)",
    KO05: "Σταθμός Διοδίων Αγίας Τριάδας Μετωπικά (Προς Αθήνα)",
    KO06: "Σταθμός Διοδίων Αγίας Τριάδας Μετωπικά (Προς Θεσσαλονίκη)",
    KO07: "Σταθμός Διοδίων Λειανοκλαδίου Μετωπικά (Προς Λαμία)",
    KO08: "Σταθμός Διοδίων Λειανοκλαδίου Μετωπικά (Προς Τρίκαλα)",
    KO09: "Σταθμός Διοδίων Μαυρομαντήλας Μετωπικά (Προς Αθήνα)",
    KO10: "Σταθμός Διοδίων Μαυρομαντήλας Μετωπικά (Προς Θεσσαλονίκη)",
    KO11: "Σταθμός Διοδίων Ανάβρας Πλευρικά (Από Λαμία)",
    KO12: "Σταθμός Διοδίων Ανάβρας Πλευρικά (Προς Λαμία)",
    KO13: "Σταθμός Διοδίων Προαστίου Πλευρικά (Από Λαμία)",
    KO14: "Σταθμός Διοδίων Προαστίου Πλευρικά (Προς Λαμία)",
    KO15: "Σταθμός Διοδίων Καλαμπάκας Πλευρικά (Από Καλαμπάκα)",
    KO16: "Σταθμός Διοδίων Καλαμπάκας Πλευρικά (Προς Καλαμπάκα)",
    KO17: "Σταθμός Διοδίων Τρικάλων Πλευρικά (Από Τρίκαλα)",
    KO18: "Σταθμός Διοδίων Τρικάλων Πλευρικά (Προς Τρίκαλα)",
    KO19: "Σταθμός Διοδίων Αγίας Μαρίνας Πλευρικά (Από Θεσ/νίκη)",
    KO20: "Σταθμός Διοδίων Αγίας Μαρίνας Πλευρικά (Προς Θεσ/νίκη)",
    KO21: "Σταθμός Διοδίων Θερμοπυλών Πλευρικά (Από Θεσσαλονίκη)",
    KO22: "Σταθμός Διοδίων Θερμοπυλών Πλευρικά (Προς Θεσσαλονίκη)",
    KO23: "Σταθμός Διοδίων Μώλου Πλευρικά (Από Αθήνα)",
    KO24: "Σταθμός Διοδίων Μώλου Πλευρικά (Προς Αθήνα)",
    KO25: "Σταθμός Διοδίων Στυλίδας Πλευρικά (Από Θεσσαλονίκη)",
    KO26: "Σταθμός Διοδίων Στυλίδας Πλευρικά (Προς Θεσσαλονίκη)",
    MO01: "Σταθμός Διοδίων Βελιγοστής Μετωπικά (Προς Καλαμάτα)",
    MO02: "Σταθμός Διοδίων Βελιγοστής Μετωπικά (Προς Κόρινθο)",
    MO03: "Σταθμός Διοδίων Γέφυρας Μάναρη Μετωπικά (Προς Καλαμάτα)",
    MO04: "Σταθμός Διοδίων Γέφυρας Μάναρη Μετωπικά (Προς Κόρινθο)",
    MO05: "Σταθμός Διοδίων Νεστάνης Μετωπικά (Προς Καλαμάτα)",
    MO06: "Σταθμός Διοδίων Νεστάνης Μετωπικά (Προς Κόρινθο)",
    MO07: "Σταθμός Διοδίων Πετρίνας Μετωπικά (Προς Κόρινθο-Καλαμάτα)",
    MO08: "Σταθμός Διοδίων Πετρίνας Μετωπικά (Προς Σπάρτη)",
    MO09: "Σταθμός Διοδίων Σπαθοβουνίου Μετωπικά (Προς Καλαμάτα)",
    MO10: "Σταθμός Διοδίων Σπαθοβουνίου Μετωπικά (Προς Κόρινθο)",
    MO11: "Σταθμός Διοδίων Καλαμάτας Μετωπικά (Προς Καλαμάτα)",
    MO12: "Σταθμός Διοδίων Καλαμάτας Μετωπικά (Προς Κόρινθο)",
    MO13: "Σταθμός Διοδίων Αρφαρών Πλευρικά (Από Κόρινθο)",
    MO14: "Σταθμός Διοδίων Αρφαρών Πλευρικά (Προς Κόρινθο)",
    MO15: "Σταθμός Διοδίων Θουρίας Πλευρικά (Από Καλαμάτα)",
    MO16: "Σταθμός Διοδίων Θουρίας Πλευρικά (Προς Καλαμάτα)",
    MO17: "Σταθμός Διοδίων Παραδείσιων Πλευρικά (Από Καλαμάτα)",
    MO18: "Σταθμός Διοδίων Παραδείσιων Πλευρικά (Προς Καλαμάτα)",
    NAO01: "Σταθμός Διοδίων Αγίας Παρασκευής Πλευρικά (Προς Καρέα)",
    NAO02: "Σταθμός Διοδίων Αγίας Παρασκευής Πλευρικά (Προς Παλλήνη)",
    NAO03: "Σταθμός Διοδίων Δημόκριτου Πλευρικά (Προς Παλλήνη)",
    NAO04: "Σταθμός Διοδίων Ανθούσας Πλευρικά (Προς Ελευσίνα)",
    NAO05: "Σταθμός Διοδίων Περιφεριακής Αιγάλεω Πλευρικά (Προς Αεροδρόμιο)",
    NAO06: "Σταθμός Διοδίων Περιφεριακής Αιγάλεω Πλευρικά (Προς Ελευσίνα)",
    NAO07: "Σταθμός Διοδίων Ασπροπύργου Πλευρικά (Προς Αεροδρόμιο)",
    NAO08: "Σταθμός Διοδίων Ασπροπύργου Πλευρικά (Προς Ελευσίνα)",
    NAO09: "Σταθμός Διοδίων Λεωφ. Δουκίσσης Πλακεντίας Πλευρικά (Προς Αεροδρόμιο)",
    NAO10: "Σταθμός Διοδίων Λεωφ. Δουκίσσης Πλακεντίας Πλευρικά (Προς Ελευσίνα)",
    NAO11: "Σταθμός Διοδίων Λεωφ. Κηφισίας Πλευρικά (Προς Αεροδρόμιο)",
    NAO12: "Σταθμός Διοδίων Λεωφ. Πεντέλης Πλευρικά (Προς Αεροδρόμιο)",
    NAO13: "Σταθμός Διοδίων Λεωφ. Πεντέλης Πλευρικά (Προς Ελευσίνα)",
    NAO14: "Σταθμός Διοδίων Γλυκών Νερών Πλευρικά (Προς Καρέα)",
    NAO15: "Σταθμός Διοδίων Γλυκών Νερών Πλευρικά (Προς Παλλήνη)",
    NAO16: "Σταθμός Διοδίων Λεωφ. Δημοκρατίας Πλευρικά (Προς Αεροδρόμιο)",
    NAO17: "Σταθμός Διοδίων Λεωφ. Δημοκρατίας Πλευρικά (Προς Ελευσίνα)",
    NAO18: "Σταθμός Διοδίων Λεωφ. Ηρακλείου Πλευρικά (Προς Αεροδρόμιο)",
    NAO19: "Σταθμός Διοδίων Λεωφ. Ηρακλείου Πλευρικά (Προς Ελευσίνα)",
    NAO20: "Σταθμός Διοδίων Λεωφ. Κύμης Πλευρικά (Προς Αεροδρόμιο)",
    NAO21: "Σταθμός Διοδίων Λεωφ. Κύμης Πλευρικά (Προς Ελευσίνα)",
    NAO22: "Σταθμός Διοδίων Λεωφ. Φυλής Πλευρικά (Προς Αεροδρόμιο)",
    NAO23: "Σταθμός Διοδίων Λεωφ. Φυλής Πλευρικά (Προς Ελευσίνα)",
    NAO24: "Σταθμός Διοδίων Κορωπίου Μετωπικά (Προς Ελευσίνα)",
    NAO25: "Σταθμός Διοδίων Λεωφ. Κηφισίας Πλευρικά (Προς Αεροδρόμιο)",
    NAO26: "Σταθμός Διοδίων Λεωφ. Κηφισίας Πλευρικά (Προς Ελευσίνα)",
    NAO27: "Σταθμός Διοδίων Αθηνών-Λαμίας Πλευρικά (Από Αθήνα Προς Αεροδρόμιο)",
    NAO28: "Σταθμός Διοδίων Αθηνών-Λαμίας Πλευρικά (Από Αθήνα Προς Ελευσίνα)",
    NAO29: "Σταθμός Διοδίων Αθηνών-Λαμίας Πλευρικά (Από Λαμία Προς Αεροδρόμιο)",
    NAO30: "Σταθμός Διοδίων Αθηνών-Λαμίας Πλευρικά (Από Λαμία Προς Ελευσίνα)",
    NAO31: "Σταθμός Διοδίων Παιανίας Πλευρικά (Προς Αεροδρόμιο)",
    NAO32: "Σταθμός Διοδίων Παιανίας Πλευρικά (Προς Ελευσίνα)",
    NAO33: "Σταθμός Διοδίων Λεωφ. Μαραθώνος Πλευρικά (Προς Αεροδρόμιο)",
    NAO34: "Σταθμός Διοδίων Λεωφ. Μαραθώνος Πλευρικά (Προς Ελευσίνα)",
    NAO35: "Σταθμός Διοδίων Παλλήνης Πλευρικά (Προς Καρέα)",
    NAO36: "Σταθμός Διοδίων Κατεχάκη Μετωπικά (Προς Παλλήνη)",
    NAO37: "Σταθμός Διοδίων Παπάγου Πλευρικά (Προς Καρέα)",
    NAO38: "Σταθμός Διοδίων Παπάγου Πλευρικά (Προς Παλλήνη)",
    NAO39: "Σταθμός Διοδίων Ρουπακίου Μετωπικά (Προς Αεροδρόμιο)",
    NAO40: "Σταθμός Διοδίων Κάντζας Πλευρικά (Προς Αεροδρόμιο)",
    NAO41: "Σταθμός Διοδίων Κάντζας Πλευρικά (Προς Ελευσίνα)",
    NO01: "Σταθμός Διοδίων Αγγελόκαστρου Μετωπικά (Προς Ιωάννινα)",
    NO02: "Σταθμός Διοδίων Αγγελόκαστρου Μετωπικά (Προς Ρίο)",
    NO03: "Σταθμός Διοδίων Κλόκοβας Μετωπικά (Προς Ιωάννινα)",
    NO04: "Σταθμός Διοδίων Κλόκοβας Μετωπικά (Προς Ρίο)",
    NO05: "Σταθμός Διοδίων Μενιδίου Μετωπικά (Προς Ιωάννινα)",
    NO06: "Σταθμός Διοδίων Μενιδίου Μετωπικά (Προς Ρίο)",
    NO07: "Σταθμός Διοδίων Αφιδνών Μετωπικά (Προς Αθήνα)",
    NO08: "Σταθμός Διοδίων Αφιδνών Μετωπικά (Προς Θεσσαλονίκη)",
    NO09: "Σταθμός Διοδίων Θήβας Μετωπικά (Προς Αθήνα)",
    NO10: "Σταθμός Διοδίων Θήβας Μετωπικά (Προς Θεσσαλονίκη)",
    NO11: "Σταθμός Διοδίων Τερόβου Μετωπικά (Προς Ιωάννινα)",
    NO12: "Σταθμός Διοδίων Τερόβου Μετωπικά (Προς Ρίο)",
    NO13: "Σταθμός Διοδίων Τραγάνας Μετωπικά (Προς Αθήνα)",
    NO14: "Σταθμός Διοδίων Τραγάνας Μετωπικά (Προς Θεσσαλονίκη)",
    NO15: "Σταθμός Διοδίων Γαβρολίμνης Πλευρικά (Από Ιωάννινα)",
    NO16: "Σταθμός Διοδίων Γαβρολίμνης Πλευρικά (Προς Ιωάννινα)",
    NO17: "Σταθμός Διοδίων Μεσολογγίου Πλευρικά (Από Ιωάννινα)",
    NO18: "Σταθμός Διοδίων Μεσολογγίου Πλευρικά (Προς Ιωάννινα)",
    NO19: "Σταθμός Διοδίων Κουβαρά Πλευρικά (Από Ιωάννινα)",
    NO20: "Σταθμός Διοδίων Κουβαρά Πλευρικά (Προς Ιωάννινα)",
    NO21: "Σταθμός Διοδίων Άρτας Πλευρικά (Από Ιωάννινα)",
    NO22: "Σταθμός Διοδίων Άρτας Πλευρικά (Προς Ιωάννινα)",
    NO23: "Σταθμός Διοδίων Καπανδριτίου Πλευρικά (Από Θεσσαλονίκη)",
    NO24: "Σταθμός Διοδίων Καπανδριτίου Πλευρικά (Προς Θεσσαλονίκη)",
    NO25: "Σταθμός Διοδίων Μαλακάσας Πλευρικά (Από Θεσσαλονίκη)",
    NO26: "Σταθμός Διοδίων Μαλακάσας Πλευρικά (Προς Θεσσαλονίκη)",
    NO27: "Σταθμός Διοδίων Θήβας Πλευρικά (Από Θεσσαλονίκη)",
    NO28: "Σταθμός Διοδίων Θήβας Πλευρικά (Προς Θεσσαλονίκη)",
    NO29: "Σταθμός Διοδίων Οινοφύτων Πλευρικά (Από Θεσσαλονίκη)",
    NO30: "Σταθμός Διοδίων Οινοφύτων Πλευρικά (Προς Θεσσαλονίκη)",
    NO31: "Σταθμός Διοδίων Γοργόμυλου Πλευρικά (Από Ρίο)",
    NO32: "Σταθμός Διοδίων Γοργόμυλου Πλευρικά (Προς Ρίο)",
    NO33: "Σταθμός Διοδίων Τραγάνας Πλευρικά (Από Θεσσαλονίκη)",
    NO34: "Σταθμός Διοδίων Τραγάνας Πλευρικά (Προς Θεσσαλονίκη)",
    OO01: "Σταθμός Διοδίων Ελευσίνας Μετωπικά (Προς Αθήνα)",
    OO02: "Σταθμός Διοδίων Ελευσίνας Μετωπικά (Προς Πάτρα)",
    OO03: "Σταθμός Διοδίων Ρίου Μετωπικά (Προς Αθήνα)",
    OO04: "Σταθμός Διοδίων Ρίου Μετωπικά (Προς Πάτρα)",
    OO05: "Σταθμός Διοδίων Ελαιώνα Μετωπικά (Προς Αθήνα)",
    OO06: "Σταθμός Διοδίων Ελαιώνα Μετωπικά (Προς Πάτρα)",
    OO07: "Σταθμός Διοδίων Ισθμίων Μετωπικά (Προς Αθήνα)",
    OO08: "Σταθμός Διοδίων Ισθμίων Μετωπικά (Προς Πάτρα)",
    OO09: "Σταθμός Διοδίων Κιάτου Μετωπικά (Προς Αθήνα)",
    OO10: "Σταθμός Διοδίων Κιάτου Μετωπικά (Προς Πάτρα)",
    OO11: "Σταθμός Διοδίων Νέας Περάμου Πλευρικά (Από Πάτρα)",
    OO12: "Σταθμός Διοδίων Νέας Περάμου Πλευρικά (Προς Πάτρα)",
    OO13: "Σταθμός Διοδίων Πάχης Πλευρικά (Από Πάτρα)",
    OO14: "Σταθμός Διοδίων Πάχης Πλευρικά (Προς Πάτρα)",
    OO15: "Σταθμός Διοδίων Δρεπάνου Πλευρικά (Από Αθήνα)",
    OO16: "Σταθμός Διοδίων Δρεπάνου Πλευρικά (Προς Αθήνα)",
    OO17: "Σταθμός Διοδίων Ακράτας Πλευρικά (Από Αθήνα)",
    OO18: "Σταθμός Διοδίων Ακράτας Πλευρικά (Προς Αθήνα)",
    OO19: "Σταθμός Διοδίων Καλαβρύτων Πλευρικά (Από Αθήνα)",
    OO20: "Σταθμός Διοδίων Καλαβρύτων Πλευρικά (Προς Αθήνα)",
    OO21: "Σταθμός Διοδίων Αγίων Θεοδώρων Πλευρικά (Από Αθήνα)",
    OO22: "Σταθμός Διοδίων Αγίων Θεοδώρων Πλευρικά (Προς Αθήνα)",
    OO23: "Σταθμός Διοδίων Δερβενίου Πλευρικά (Από Αθήνα)",
    OO24: "Σταθμός Διοδίων Δερβενίου Πλευρικά (Προς Αθήνα)",
    OO25: "Σταθμός Διοδίων Ζευγολατιού Πλευρικά (Από Αθήνα)",
    OO26: "Σταθμός Διοδίων Ζευγολατιού Πλευρικά (Προς Αθήνα)",
    OO27: "Σταθμός Διοδίων Κιάτου Πλευρικά (Από Πάτρα)",
    OO28: "Σταθμός Διοδίων Κιάτου Πλευρικά (Προς Πάτρα)",
  };

  // Convert the tollNameMapping object to an array of options
  const tollOptions = Object.entries(tollNameMapping).map(([key, value]) => ({
    value: key,
    label: value,
  }));

  // Shared states
  const [activeTab, setActiveTab] = useState('PassAnalysis'); // Default active tab
  const [format, setFormat] = useState('json');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Authentication check on mount
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Helper functions to format dates
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (`0${d.getMonth() + 1}`).slice(-2);
    const day = (`0${d.getDate()}`).slice(-2);
    return `${year}${month}${day}`;
  };

  const displayDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = (`0${d.getDate()}`).slice(-2);
    const month = (`0${d.getMonth() + 1}`).slice(-2);
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Handler for tab switching
  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    setError('');
  };

  // ==================== PassAnalysis States and Handlers ====================
  const [passAnalysisState, setPassAnalysisState] = useState({
    stationOpID: '',
    tagOpID: '',
    dateFrom: null,
    dateTo: null,
    data: null,
    csvData: '',
  });

  const handlePassAnalysisChange = (e) => {
    const { name, value } = e.target;
    setPassAnalysisState((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handlePassAnalysisDateChange = (name, date) => {
    setPassAnalysisState((prevState) => ({
      ...prevState,
      [name]: date,
    }));
  };

  const handlePassAnalysisSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPassAnalysisState((prevState) => ({
      ...prevState,
      data: null,
      csvData: '',
    }));
    setLoading(true);

    const { stationOpID, tagOpID, dateFrom, dateTo } = passAnalysisState;

    if (!stationOpID || !tagOpID || !dateFrom || !dateTo) {
      setError('Όλα τα πεδία είναι υποχρεωτικά.');
      setLoading(false);
      return;
    }

    const formattedDateFrom = formatDate(dateFrom);
    const formattedDateTo = formatDate(dateTo);
    const dateRegex = /^\d{8}$/;
    if (!dateRegex.test(formattedDateFrom) || !dateRegex.test(formattedDateTo)) {
      setError('Οι ημερομηνίες πρέπει να είναι στη μορφή YYYYMMDD.');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Δεν βρέθηκε το token. Παρακαλώ συνδεθείτε ξανά.');
        handleLogout();
        return;
      }
      const url = `${API_BASE_URL}/passAnalysis/${stationOpID}/${tagOpID}/${formattedDateFrom}/${formattedDateTo}`;
      const response = await axios.get(url, {
        params: { format },
        headers: {
          'Content-Type': 'application/json',
          'x-observatory-auth': token,
        },
        responseType: format === 'csv' ? 'blob' : 'json',
      });

      if (response.status === 200) {
        if (format === 'json') {
          setPassAnalysisState((prevState) => ({
            ...prevState,
            data: response.data,
          }));
        } else if (format === 'csv') {
          if (response.data instanceof Blob) {
            const csvUrl = window.URL.createObjectURL(
              new Blob([response.data], { type: 'text/csv' })
            );
            setPassAnalysisState((prevState) => ({
              ...prevState,
              csvData: csvUrl,
            }));
          } else {
            setError('Μη αναμενόμενη μορφή δεδομένων CSV.');
          }
        }
      } else if (response.status === 204) {
        setError('Δεν επιστράφηκαν δεδομένα για τα κριτήρια που δώσατε.');
      }
    } catch (err) {
      if (err.response) {
        switch (err.response.status) {
          case 400:
            setError('Άκυρο αίτημα. Παρακαλώ ελέγξτε τις εισροές σας.');
            break;
          case 401:
            setError('Μη εξουσιοδοτημένο αίτημα. Παρακαλώ συνδεθείτε ξανά.');
            handleLogout();
            break;
          case 404:
            setError('Η ζητούμενη πόρος δεν βρέθηκε. Παρακαλώ ελέγξτε τις παραμέτρους σας.');
            break;
          case 500:
            setError('Προέκυψε σφάλμα στον διακομιστή. Παρακαλώ δοκιμάστε ξανά αργότερα.');
            break;
          default:
            setError(err.response.data?.error || 'Προέκυψε μη αναμενόμενο σφάλμα.');
        }
      } else if (err.request) {
        setError('Δεν ήταν δυνατή η σύνδεση με τον διακομιστή. Παρακαλώ ελέγξτε τη σύνδεσή σας.');
      } else {
        setError('Προέκυψε σφάλμα κατά την εκκίνηση του αιτήματος.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ==================== ChargesBy States and Handlers ====================
  const [chargesByState, setChargesByState] = useState({
    tollOpID: '',
    dateFrom: null,
    dateTo: null,
    data: null,
    csvData: '',
  });

  const handleChargesByChange = (e) => {
    const { name, value } = e.target;
    setChargesByState((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleChargesByDateChange = (name, date) => {
    setChargesByState((prevState) => ({
      ...prevState,
      [name]: date,
    }));
  };

  const handleChargesBySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setChargesByState((prevState) => ({
      ...prevState,
      data: null,
      csvData: '',
    }));
    setLoading(true);

    const { tollOpID, dateFrom, dateTo } = chargesByState;
    if (!tollOpID || !dateFrom || !dateTo) {
      setError('Όλα τα πεδία είναι υποχρεωτικά.');
      setLoading(false);
      return;
    }

    const formattedDateFrom = formatDate(dateFrom);
    const formattedDateTo = formatDate(dateTo);
    const dateRegex = /^\d{8}$/;
    if (!dateRegex.test(formattedDateFrom) || !dateRegex.test(formattedDateTo)) {
      setError('Οι ημερομηνίες πρέπει να είναι στη μορφή YYYYMMDD.');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Δεν βρέθηκε το token. Παρακαλώ συνδεθείτε ξανά.');
        handleLogout();
        return;
      }
      const url = `${API_BASE_URL}/chargesBy/${tollOpID}/${formattedDateFrom}/${formattedDateTo}`;
      const response = await axios.get(url, {
        params: { format },
        headers: {
          'Content-Type': 'application/json',
          'x-observatory-auth': token,
        },
        responseType: format === 'csv' ? 'blob' : 'json',
      });

      if (response.status === 200) {
        if (format === 'json') {
          setChargesByState((prevState) => ({
            ...prevState,
            data: response.data,
          }));
        } else if (format === 'csv') {
          if (response.data instanceof Blob) {
            const csvUrl = window.URL.createObjectURL(
              new Blob([response.data], { type: 'text/csv' })
            );
            setChargesByState((prevState) => ({
              ...prevState,
              csvData: csvUrl,
            }));
          } else {
            setError('Μη αναμενόμενη μορφή δεδομένων CSV.');
          }
        }
      } else if (response.status === 204) {
        setError('Δεν επιστράφηκαν δεδομένα για τα κριτήρια που δώσατε.');
      }
    } catch (err) {
      if (err.response) {
        switch (err.response.status) {
          case 400:
            setError('Άκυρο αίτημα. Παρακαλώ ελέγξτε τις εισροές σας.');
            break;
          case 401:
            setError('Μη εξουσιοδοτημένο αίτημα. Παρακαλώ συνδεθείτε ξανά.');
            handleLogout();
            break;
          case 404:
            setError('Η ζητούμενη πόρος δεν βρέθηκε. Παρακαλώ ελέγξτε τις παραμέτρους σας.');
            break;
          case 500:
            setError('Προέκυψε σφάλμα στον διακομιστή. Παρακαλώ δοκιμάστε ξανά αργότερα.');
            break;
          default:
            setError(err.response.data?.error || 'Προέκυψε μη αναμενόμενο σφάλμα.');
        }
      } else if (err.request) {
        setError('Δεν ήταν δυνατή η σύνδεση με τον διακομιστή. Παρακαλώ ελέγξτε τη σύνδεσή σας.');
      } else {
        setError('Προέκυψε σφάλμα κατά την εκκίνηση του αιτήματος.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ==================== PassesCost States and Handlers ====================
  const [passesCostState, setPassesCostState] = useState({
    tollOpID: '',
    tagOpID: '',
    dateFrom: null,
    dateTo: null,
    data: null,
    csvData: '',
  });

  const handlePassesCostChange = (e) => {
    const { name, value } = e.target;
    setPassesCostState((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handlePassesCostDateChange = (name, date) => {
    setPassesCostState((prevState) => ({
      ...prevState,
      [name]: date,
    }));
  };

  const handlePassesCostSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPassesCostState((prevState) => ({
      ...prevState,
      data: null,
      csvData: '',
    }));
    setLoading(true);

    const { tollOpID, tagOpID, dateFrom, dateTo } = passesCostState;
    if (!tollOpID || !tagOpID || !dateFrom || !dateTo) {
      setError('Όλα τα πεδία είναι υποχρεωτικά.');
      setLoading(false);
      return;
    }

    const formattedDateFrom = formatDate(dateFrom);
    const formattedDateTo = formatDate(dateTo);
    const dateRegex = /^\d{8}$/;
    if (!dateRegex.test(formattedDateFrom) || !dateRegex.test(formattedDateTo)) {
      setError('Οι ημερομηνίες πρέπει να είναι στη μορφή YYYYMMDD.');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Δεν βρέθηκε το token. Παρακαλώ συνδεθείτε ξανά.');
        handleLogout();
        return;
      }
      const url = `${API_BASE_URL}/passesCost/${tollOpID}/${tagOpID}/${formattedDateFrom}/${formattedDateTo}`;
      const response = await axios.get(url, {
        params: { format },
        headers: {
          'Content-Type': 'application/json',
          'x-observatory-auth': token,
        },
        responseType: format === 'csv' ? 'blob' : 'json',
      });

      if (response.status === 200) {
        if (format === 'json') {
          setPassesCostState((prevState) => ({
            ...prevState,
            data: response.data,
          }));
        } else if (format === 'csv') {
          if (response.data instanceof Blob) {
            const csvUrl = window.URL.createObjectURL(
              new Blob([response.data], { type: 'text/csv' })
            );
            setPassesCostState((prevState) => ({
              ...prevState,
              csvData: csvUrl,
            }));
          } else {
            setError('Μη αναμενόμενη μορφή δεδομένων CSV.');
          }
        }
      } else if (response.status === 204) {
        setError('Δεν επιστράφηκαν δεδομένα για τα κριτήρια που δώσατε.');
      }
    } catch (err) {
      if (err.response) {
        switch (err.response.status) {
          case 400:
            setError('Άκυρο αίτημα. Παρακαλώ ελέγξτε τις εισροές σας.');
            break;
          case 401:
            setError('Μη εξουσιοδοτημένο αίτημα. Παρακαλώ συνδεθείτε ξανά.');
            handleLogout();
            break;
          case 404:
            setError('Η ζητούμενη πόρος δεν βρέθηκε. Παρακαλώ ελέγξτε τις παραμέτρους σας.');
            break;
          case 500:
            setError('Προέκυψε σφάλμα στον διακομιστή. Παρακαλώ δοκιμάστε ξανά αργότερα.');
            break;
          default:
            setError(err.response.data?.error || 'Προέκυψε μη αναμενόμενο σφάλμα.');
        }
      } else if (err.request) {
        setError('Δεν ήταν δυνατή η σύνδεση με τον διακομιστή. Παρακαλώ ελέγξτε τη σύνδεσή σας.');
      } else {
        setError('Προέκυψε σφάλμα κατά την εκκίνηση του αιτήματος.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ==================== TollStationPasses States and Handlers ====================
  const [tollStationPassesState, setTollStationPassesState] = useState({
    tollStationID: '',
    dateFrom: null,
    dateTo: null,
    data: null,
    csvData: '',
  });

  const handleTollStationPassesChange = (e) => {
    const { name, value } = e.target;
    setTollStationPassesState((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleTollStationPassesDateChange = (name, date) => {
    setTollStationPassesState((prevState) => ({
      ...prevState,
      [name]: date,
    }));
  };

  const handleTollStationPassesSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setTollStationPassesState((prevState) => ({
      ...prevState,
      data: null,
      csvData: '',
    }));
    setLoading(true);

    const { tollStationID, dateFrom, dateTo } = tollStationPassesState;
    if (!tollStationID || !dateFrom || !dateTo) {
      setError('Όλα τα πεδία είναι υποχρεωτικά.');
      setLoading(false);
      return;
    }

    const formattedDateFrom = formatDate(dateFrom);
    const formattedDateTo = formatDate(dateTo);
    const dateRegex = /^\d{8}$/;
    if (!dateRegex.test(formattedDateFrom) || !dateRegex.test(formattedDateTo)) {
      setError('Οι ημερομηνίες πρέπει να είναι στη μορφή YYYYMMDD.');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Δεν βρέθηκε το token. Παρακαλώ συνδεθείτε ξανά.');
        handleLogout();
        return;
      }
      const url = `${API_BASE_URL}/tollStationPasses/${tollStationID}/${formattedDateFrom}/${formattedDateTo}`;
      const response = await axios.get(url, {
        params: { format },
        headers: {
          'Content-Type': 'application/json',
          'x-observatory-auth': token,
        },
        responseType: format === 'csv' ? 'blob' : 'json',
      });

      if (response.status === 200) {
        if (format === 'json') {
          setTollStationPassesState((prevState) => ({
            ...prevState,
            data: response.data,
          }));
        } else if (format === 'csv') {
          if (response.data instanceof Blob) {
            const csvUrl = window.URL.createObjectURL(
              new Blob([response.data], { type: 'text/csv' })
            );
            setTollStationPassesState((prevState) => ({
              ...prevState,
              csvData: csvUrl,
            }));
          } else {
            setError('Μη αναμενόμενη μορφή δεδομένων CSV.');
          }
        }
      } else if (response.status === 204) {
        setError('Δεν επιστράφηκαν δεδομένα για τα κριτήρια που δώσατε.');
      }
    } catch (err) {
      if (err.response) {
        switch (err.response.status) {
          case 400:
            setError('Άκυρο αίτημα. Παρακαλώ ελέγξτε τις εισροές σας.');
            break;
          case 401:
            setError('Μη εξουσιοδοτημένο αίτημα. Παρακαλώ συνδεθείτε ξανά.');
            handleLogout();
            break;
          case 404:
            setError('Η ζητούμενη πόρος δεν βρέθηκε. Παρακαλώ ελέγξτε τις παραμέτρους σας.');
            break;
          case 500:
            setError('Προέκυψε σφάλμα στον διακομιστή. Παρακαλώ δοκιμάστε ξανά αργότερα.');
            break;
          default:
            setError(err.response.data?.error || 'Προέκυψε μη αναμενόμενο σφάλμα.');
        }
      } else if (err.request) {
        setError('Δεν ήταν δυνατή η σύνδεση με τον διακομιστή. Παρακαλώ ελέγξτε τη σύνδεσή σας.');
      } else {
        setError('Προέκυψε σφάλμα κατά την εκκίνηση του αιτήματος.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analysis-dashboard-container">
      <h2>Δεδομένα</h2>
      <div className="tabs">
        <button
          className={activeTab === 'PassAnalysis' ? 'active' : ''}
          onClick={() => handleTabClick('PassAnalysis')}
        >
          Ανάλυση Διελεύσεων
        </button>
        <button
          className={activeTab === 'ChargesBy' ? 'active' : ''}
          onClick={() => handleTabClick('ChargesBy')}
        >
          Ανάλυση Χρεώσεων
        </button>
        <button
          className={activeTab === 'PassesCost' ? 'active' : ''}
          onClick={() => handleTabClick('PassesCost')}
        >
          Κόστος Διέλευσης
        </button>
        <button
          className={activeTab === 'TollStationPasses' ? 'active' : ''}
          onClick={() => handleTabClick('TollStationPasses')}
        >
          Διελεύσεις Σταθμών Διοδίων
        </button>
      </div>

      <div className="tab-content">
        {/* ==================== PassAnalysis Tab ==================== */}
        {activeTab === 'PassAnalysis' && (
          <div className="analysis-section">
            <h3>Ανάλυση Διελεύσεων</h3>
            <form onSubmit={handlePassAnalysisSubmit}>
              <div className="form-group">
                <label>Κωδικός Λειτουργού Σταθμού:</label>
                <select
                  name="stationOpID"
                  value={passAnalysisState.stationOpID}
                  onChange={handlePassAnalysisChange}
                  required
                >
                  <option value="">-- Επιλέξτε Σταθμό --</option>
                  {operationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Κωδικός Παρόχου Ετικέτας:</label>
                <select
                  name="tagOpID"
                  value={passAnalysisState.tagOpID}
                  onChange={handlePassAnalysisChange}
                  required
                >
                  <option value="">-- Επιλέξτε Ετικέτα --</option>
                  {operationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Ημερομηνία Από:</label>
                <ReactDatePicker
                  selected={passAnalysisState.dateFrom}
                  onChange={(date) => handlePassAnalysisDateChange('dateFrom', date)}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/yyyy"
                  className="date-picker-input"
                  maxDate={new Date()}
                  required
                />
              </div>

              <div className="form-group">
                <label>Ημερομηνία Έως:</label>
                <ReactDatePicker
                  selected={passAnalysisState.dateTo}
                  onChange={(date) => handlePassAnalysisDateChange('dateTo', date)}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/yyyy"
                  className="date-picker-input"
                  minDate={passAnalysisState.dateFrom}
                  maxDate={new Date()}
                  required
                />
              </div>

              <div className="form-group">
                <label>Μορφή:</label>
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Φόρτωση...' : 'Εμφάνιση Δεδομένων'}
              </button>
            </form>

            {error && <div className="error-message">{error}</div>}

            {format === 'json' && passAnalysisState.data && (
              <div className="results-section">
                <h4>Δεδομένα Ανάλυσης Περασμάτων</h4>
                <p>
                  <strong>ID Λειτουργού Σταθμού:</strong> {passAnalysisState.data.stationOpID}
                </p>
                <p>
                  <strong>ID Παρόχου Ετικέτας:</strong> {passAnalysisState.data.tagOpID}
                </p>
                <p>
                  <strong>Χρονική Σήμανση Αιτήματος:</strong> {passAnalysisState.data.requestTimestamp}
                </p>
                <p>
                  <strong>Περίοδος Από:</strong> {displayDate(passAnalysisState.data.periodFrom)}
                </p>
                <p>
                  <strong>Περίοδος Έως:</strong> {displayDate(passAnalysisState.data.periodTo)}
                </p>
                <p>
                  <strong>Αριθμός Διελεύσεων:</strong> {passAnalysisState.data.nPasses}
                </p>
                {Array.isArray(passAnalysisState.data.passList) && passAnalysisState.data.passList.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Δείκτης Διέλευσης</th>
                        <th>ID Διέλευσης</th>
                        <th>ID Σταθμού</th>
                        <th>Χρονική Σήμανση</th>
                        <th>ID Ετικέτας</th>
                        <th>Κόστος Διέλευσης</th>
                      </tr>
                    </thead>
                    <tbody>
                      {passAnalysisState.data.passList.map((pass) => (
                        <tr key={pass.passID}>
                          <td>{pass.passIndex}</td>
                          <td>{pass.passID}</td>
                          <td>{pass.stationID}</td>
                          <td>{pass.timestamp}</td>
                          <td>{pass.tagID}</td>
                          <td>
                            {typeof pass.passCharge === 'number'
                              ? pass.passCharge.toFixed(2)
                              : '0.00'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>Δεν υπάρχουν διαθέσιμα δεδομένα περασμάτων.</p>
                )}
              </div>
            )}

            {format === 'csv' && passAnalysisState.csvData && (
              <div className="csv-download-section">
                <h4>Λήψη CSV</h4>
                <a
                  href={passAnalysisState.csvData}
                  download={`analysis_${passAnalysisState.stationOpID}_${passAnalysisState.tagOpID}_${formatDate(
                    passAnalysisState.dateFrom
                  )}_${formatDate(passAnalysisState.dateTo)}.csv`}
                  className="download-link"
                >
                  Κατεβάστε το CSV
                </a>
              </div>
            )}
          </div>
        )}

        {/* ==================== ChargesBy Tab ==================== */}
        {activeTab === 'ChargesBy' && (
          <div className="analysis-section">
            <h3>Ανάλυση Χρεώσεων</h3>
            <form onSubmit={handleChargesBySubmit}>
              <div className="form-group">
                <label>Κωδικός Λειτουργού Εισόδου:</label>
                <select
                  name="tollOpID"
                  value={chargesByState.tollOpID}
                  onChange={handleChargesByChange}
                  required
                >
                  <option value="">-- Επιλέξτε Λειτουργό --</option>
                  {operationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Ημερομηνία Από:</label>
                <ReactDatePicker
                  selected={chargesByState.dateFrom}
                  onChange={(date) => handleChargesByDateChange('dateFrom', date)}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/yyyy"
                  className="date-picker-input"
                  maxDate={new Date()}
                  required
                />
              </div>

              <div className="form-group">
                <label>Ημερομηνία Έως:</label>
                <ReactDatePicker
                  selected={chargesByState.dateTo}
                  onChange={(date) => handleChargesByDateChange('dateTo', date)}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/yyyy"
                  className="date-picker-input"
                  minDate={chargesByState.dateFrom}
                  maxDate={new Date()}
                  required
                />
              </div>

              <div className="form-group">
                <label>Μορφή:</label>
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Φόρτωση...' : 'Εμφάνιση Δεδομένων'}
              </button>
            </form>

            {error && <div className="error-message">{error}</div>}

            {format === 'json' && chargesByState.data && (
  <div className="results-section">
    <h4>Δεδομένα Χρεώσεων</h4>
    <p>
      <strong>ID Λειτουργού Εισόδου:</strong> {chargesByState.data.tollOpID}
    </p>
    <p>
      <strong>Χρονική Σήμανση Αιτήματος:</strong> {chargesByState.data.requestTimestamp}
    </p>
    <p>
      <strong>Περίοδος Από:</strong> {displayDate(chargesByState.data.periodFrom)}
    </p>
    <p>
      <strong>Περίοδος Έως:</strong> {displayDate(chargesByState.data.periodTo)}
    </p>
    {Array.isArray(chargesByState.data.vOpList) && chargesByState.data.vOpList.length > 0 && (
      <>
        <h5>Λίστα Επισκέψεων:</h5>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID Επισκέπτη Λειτουργού</th>
              <th>Αριθμός Διελεύσεων</th>
              <th>Κόστος Διέλευσης</th>
            </tr>
          </thead>
          <tbody>
            {chargesByState.data.vOpList.map((vOp, index) => (
              <tr key={index}>
                <td>{vOp.visitingOpID}</td>
                <td>{vOp.nPasses}</td>
                <td>{parseFloat(vOp.passesCost).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          <strong>Συνολικό Κόστος Διέλευσης:</strong>{' '}
          {chargesByState.data.vOpList
            .reduce((total, vOp) => total + parseFloat(vOp.passesCost || "0"), 0)
            .toFixed(2)}
        </p>
      </>
    )}
  </div>
)}


            {format === 'csv' && chargesByState.csvData && (
              <div className="csv-download-section">
                <h4>Λήψη CSV</h4>
                <a
                  href={chargesByState.csvData}
                  download={`chargesBy_${chargesByState.tollOpID}_${formatDate(chargesByState.dateFrom)}_${formatDate(chargesByState.dateTo)}.csv`}
                  className="download-link"
                >
                  Κατεβάστε το CSV
                </a>
              </div>
            )}
          </div>
        )}

        {/* ==================== PassesCost Tab ==================== */}
        {activeTab === 'PassesCost' && (
          <div className="analysis-section">
            <h3>Κόστος Διέλευσης</h3>
            <form onSubmit={handlePassesCostSubmit}>
              <div className="form-group">
                <label>Κωδικός Λειτουργού Εισόδου:</label>
                <select
                  name="tollOpID"
                  value={passesCostState.tollOpID}
                  onChange={handlePassesCostChange}
                  required
                >
                  <option value="">-- Επιλέξτε Λειτουργό --</option>
                  {operationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Κωδικός Παρόχου Ετικέτας:</label>
                <select
                  name="tagOpID"
                  value={passesCostState.tagOpID}
                  onChange={handlePassesCostChange}
                  required
                >
                  <option value="">-- Επιλέξτε Παρόχο Ετικέτας --</option>
                  {operationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Ημερομηνία Από:</label>
                <ReactDatePicker
                  selected={passesCostState.dateFrom}
                  onChange={(date) => handlePassesCostDateChange('dateFrom', date)}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Επιλέξτε ημερομηνία"
                  className="date-picker-input"
                  maxDate={new Date()}
                  required
                />
              </div>

              <div className="form-group">
                <label>Ημερομηνία Έως:</label>
                <ReactDatePicker
                  selected={passesCostState.dateTo}
                  onChange={(date) => handlePassesCostDateChange('dateTo', date)}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/yyyy"
                  className="date-picker-input"
                  minDate={passesCostState.dateFrom}
                  maxDate={new Date()}
                  required
                />
              </div>

              <div className="form-group">
                <label>Μορφή:</label>
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Φόρτωση...' : 'Εμφάνιση Δεδομένων'}
              </button>
            </form>

            {error && <div className="error-message">{error}</div>}

            {format === 'json' && passesCostState.data && (
              <div className="results-section">
                <h4>Δεδομένα Κόστους Διέλευσης</h4>
                <p>
                  <strong>ID Λειτουργού Εισόδου:</strong> {passesCostState.data.tollOpID}
                </p>
                <p>
                  <strong>ID Παρόχου Ετικέτας:</strong> {passesCostState.data.tagOpID}
                </p>
                <p>
                  <strong>Χρονική Σήμανση Αιτήματος:</strong> {passesCostState.data.requestTimestamp}
                </p>
                <p>
                  <strong>Περίοδος Από:</strong> {displayDate(passesCostState.data.periodFrom)}
                </p>
                <p>
                  <strong>Περίοδος Έως:</strong> {displayDate(passesCostState.data.periodTo)}
                </p>
                <p>
                  <strong>Αριθμός Διελεύσεων:</strong> {passesCostState.data.nPasses}
                </p>
                <p>
                  <strong>Κόστος Διέλευσης:</strong>{' '}
                  {typeof passesCostState.data.passesCost === 'number'
                    ? passesCostState.data.passesCost.toFixed(2)
                    : '0.00'}
                </p>
              </div>
            )}

            {format === 'csv' && passesCostState.csvData && (
              <div className="csv-download-section">
                <h4>Λήψη CSV</h4>
                <a
                  href={passesCostState.csvData}
                  download={`passesCost_${passesCostState.tollOpID}_${passesCostState.tagOpID}_${formatDate(
                    passesCostState.dateFrom
                  )}_${formatDate(passesCostState.dateTo)}.csv`}
                  className="download-link"
                >
                  Κατεβάστε το CSV
                </a>
              </div>
            )}
          </div>
        )}

        {/* ==================== TollStationPasses Tab ==================== */}
        {activeTab === 'TollStationPasses' && (
          <div className="analysis-section">
            <h3>Διελεύσεις Σταθμών Διοδίων</h3>
            <form onSubmit={handleTollStationPassesSubmit}>
              <div className="form-group">
                <label>Σταθμός Διοδίου:</label>
                <select
                  name="tollStationID"
                  value={tollStationPassesState.tollStationID}
                  onChange={handleTollStationPassesChange}
                  required
                >
                  <option value="">-- Επιλέξτε Σταθμό Διοδίου --</option>
                  {tollOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Ημερομηνία Από:</label>
                <ReactDatePicker
                  selected={tollStationPassesState.dateFrom}
                  onChange={(date) => handleTollStationPassesDateChange('dateFrom', date)}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/yyyy"
                  className="date-picker-input"
                  maxDate={new Date()}
                  required
                />
              </div>

              <div className="form-group">
                <label>Ημερομηνία Έως:</label>
                <ReactDatePicker
                  selected={tollStationPassesState.dateTo}
                  onChange={(date) => handleTollStationPassesDateChange('dateTo', date)}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/yyyy"
                  className="date-picker-input"
                  minDate={tollStationPassesState.dateFrom}
                  maxDate={new Date()}
                  required
                />
              </div>

              <div className="form-group">
                <label>Μορφή:</label>
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Φόρτωση...' : 'Εμφάνιση Δεδομένων'}
              </button>
            </form>

            {error && <div className="error-message">{error}</div>}

            {format === 'json' && tollStationPassesState.data && (
              <div className="results-section">
                <h4>Δεδομένα Διελεύσεων Σταθμών Διοδίων</h4>
                <p>
                  <strong>ID Σταθμού :</strong> {tollStationPassesState.data.stationID}
                </p>
                <p>
                  <strong>Λειτουργός Σταθμού:</strong> {tollStationPassesState.data.stationOperator}
                </p>
                <p>
                  <strong>Χρονική Σήμανση Αιτήματος:</strong> {tollStationPassesState.data.requestTimestamp}
                </p>
                <p>
                  <strong>Περίοδος Από:</strong> {displayDate(tollStationPassesState.data.periodFrom)}
                </p>
                <p>
                  <strong>Περίοδος Έως:</strong> {displayDate(tollStationPassesState.data.periodTo)}
                </p>
                <p>
                  <strong>Αριθμός Διελεύσεων:</strong> {tollStationPassesState.data.nPasses}
                </p>
                {Array.isArray(tollStationPassesState.data.passList) && tollStationPassesState.data.passList.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Δείκτης Διέλευσης</th>
                        <th>ID Διέλευσης</th>
                        <th>Χρονική Σήμανση</th>
                        <th>ID Ετικέτας</th>
                        <th>Πάροχος Ετικέτας</th>
                        <th>Τύπος Διέλευσης</th>
                        <th>Κόστος Διέλευσης</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tollStationPassesState.data.passList.map((pass) => (
                        <tr key={pass.passID}>
                          <td>{pass.passIndex}</td>
                          <td>{pass.passID}</td>
                          <td>{pass.timestamp}</td>
                          <td>{pass.tagID}</td>
                          <td>{pass.tagProvider}</td>
                          <td>{pass.passType}</td>
                          <td>
                            {typeof pass.passCharge === 'number'
                              ? pass.passCharge.toFixed(2)
                              : '0.00'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>Δεν υπάρχουν διαθέσιμα δεδομένα περασμάτων.</p>
                )}
              </div>
            )}

            {format === 'csv' && tollStationPassesState.csvData && (
              <div className="csv-download-section">
                <h4>Λήψη CSV</h4>
                <a
                  href={tollStationPassesState.csvData}
                  download={`tollStationPasses_${tollStationPassesState.tollStationID}_${formatDate(
                    tollStationPassesState.dateFrom
                  )}_${formatDate(tollStationPassesState.dateTo)}.csv`}
                  className="download-link"
                >
                  Κατεβάστε το CSV
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisDashboard;
