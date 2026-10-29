/* Dati statici: marche/modelli, regioni, preset e la "roulette" delle auto. */
(function (root) {
  // Nomi modello scritti come li usa AutoScout24 (gli slug vengono generati da qui).
  // a = alias usati per riconoscere la marca nel testo libero.
  // ilp = nome marca su ilParking quando diverso.
  var MAKES = [
    { n: 'Abarth', m: ['500', '595', '695', 'Grande Punto', '124 Spider'] },
    { n: 'Alfa Romeo', a: ['alfa', 'alfaromeo'], m: ['147', '156', '159', '166', 'GT', 'GTV', 'Spider', 'Brera', 'MiTo', 'Giulietta', 'Giulia', 'Stelvio', 'Tonale', '4C', '33', '75', '164'] },
    { n: 'Audi', m: ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'TT', 'R8', 'S3', 'RS3', 'S4', 'RS4', 'RS6', '80', '100'] },
    { n: 'BMW', m: ['Serie 1', 'Serie 2', 'Serie 3', 'Serie 4', 'Serie 5', 'Serie 6', 'Serie 7', 'X1', 'X3', 'X5', 'X6', 'Z3', 'Z4', 'M2', 'M3', 'M4', 'M5', 'i3'] },
    { n: 'Citroen', a: ['citroën'], m: ['C1', 'C3', 'C4', 'C5', 'Saxo', 'Xsara', 'DS3', 'Berlingo', 'C4 Picasso', '2CV'] },
    { n: 'Cupra', m: ['Formentor', 'Born', 'Leon', 'Ateca'] },
    { n: 'Dacia', m: ['Sandero', 'Duster', 'Logan', 'Spring', 'Jogger'] },
    { n: 'Ferrari', m: ['360', 'F430', '458', '488', 'California', 'Roma'] },
    { n: 'Fiat', m: ['500', 'Panda', 'Punto', 'Grande Punto', 'Uno', 'Tipo', 'Bravo', 'Stilo', 'Seicento', 'Cinquecento', 'Multipla', 'Doblò', 'Coupé', 'Barchetta', '500X', '500L', '124 Spider', 'Croma', 'Marea'] },
    { n: 'Ford', m: ['Fiesta', 'Focus', 'Puma', 'Kuga', 'Mondeo', 'Ka', 'Mustang', 'C-Max', 'S-Max', 'Ranger', 'EcoSport', 'Escort', 'Sierra'] },
    { n: 'Honda', m: ['Civic', 'Jazz', 'CR-V', 'HR-V', 'Accord', 'S2000', 'Prelude', 'Integra', 'CR-Z', 'NSX'] },
    { n: 'Hyundai', m: ['i10', 'i20', 'i30', 'Tucson', 'Kona', 'Ioniq', 'Santa Fe', 'Coupé'] },
    { n: 'Jaguar', m: ['XE', 'XF', 'XJ', 'F-Type', 'F-Pace', 'X-Type', 'S-Type', 'XK'] },
    { n: 'Jeep', m: ['Renegade', 'Compass', 'Wrangler', 'Cherokee', 'Grand Cherokee', 'Avenger'] },
    { n: 'Kia', m: ['Picanto', 'Rio', 'Ceed', 'Sportage', 'Niro', 'Stonic', 'Stinger', 'Sorento', 'XCeed'] },
    { n: 'Lamborghini', a: ['lambo'], m: ['Gallardo', 'Huracan', 'Urus', 'Aventador'] },
    { n: 'Lancia', m: ['Ypsilon', 'Delta', 'Musa', 'Thema', 'Lybra', 'Kappa', 'Thesis', 'Fulvia', 'Phedra'] },
    { n: 'Land Rover', a: ['landrover', 'land'], m: ['Defender', 'Discovery', 'Discovery Sport', 'Freelander', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'] },
    { n: 'Lexus', m: ['IS 200', 'IS 300', 'CT 200h', 'NX 300', 'RX 450h', 'UX 250h'] },
    { n: 'Maserati', m: ['Ghibli', 'Levante', 'Quattroporte', 'GranTurismo', '3200 GT'] },
    { n: 'Mazda', m: ['2', '3', '6', 'CX-3', 'CX-30', 'CX-5', 'MX-5', 'RX-8', 'RX-7', 'MX-30'] },
    { n: 'Mercedes-Benz', a: ['mercedes', 'merc', 'mb', 'benz'], ilp: 'mercedes', m: ['Classe A', 'Classe B', 'Classe C', 'Classe E', 'Classe S', 'Classe G', 'Classe V', 'CLA', 'CLK', 'CLS', 'SLK', 'Classe SL', 'Classe M', 'GLA', 'GLC', 'GLE', 'Vito', '190'] },
    { n: 'MINI', a: ['mini'], m: ['Cooper', 'Cooper S', 'One', 'Countryman', 'Clubman', 'John Cooper Works'] },
    { n: 'Mitsubishi', m: ['Lancer', 'Pajero', 'Outlander', 'Space Star', 'ASX', 'Colt', '3000 GT', 'L200'] },
    { n: 'Nissan', m: ['Micra', 'Juke', 'Qashqai', 'X-Trail', '350Z', '370Z', 'GT-R', 'Leaf', 'Navara', 'Skyline', '200 SX', 'Patrol'] },
    { n: 'Opel', m: ['Corsa', 'Astra', 'Insignia', 'Mokka', 'Crossland', 'Grandland', 'Zafira', 'Meriva', 'Tigra', 'Calibra', 'Adam', 'Karl', 'Speedster', 'GT'] },
    { n: 'Peugeot', m: ['106', '107', '108', '205', '206', '207', '208', '306', '307', '308', '406', '407', '508', '2008', '3008', '5008', 'RCZ'] },
    { n: 'Porsche', m: ['911', 'Boxster', 'Cayman', 'Cayenne', 'Macan', 'Panamera', '944', '924', '928', 'Taycan'] },
    { n: 'Renault', m: ['Clio', 'Twingo', 'Megane', 'Captur', 'Kadjar', 'Scenic', 'Laguna', 'Kangoo', 'Zoe', 'Austral', 'Arkana', 'Espace'] },
    { n: 'Saab', m: ['9-3', '9-5', '900', '9000', '96', '99'] },
    { n: 'Seat', m: ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco', 'Mii', 'Altea', 'Toledo', 'Cordoba'] },
    { n: 'Skoda', a: ['škoda'], m: ['Fabia', 'Octavia', 'Superb', 'Kodiaq', 'Karoq', 'Kamiq', 'Citigo', 'Yeti', 'Scala', 'Enyaq'] },
    { n: 'smart', a: ['smart'], m: ['forTwo', 'forFour'] },
    { n: 'Subaru', m: ['Impreza', 'Forester', 'Outback', 'Legacy', 'XV', 'BRZ'] },
    { n: 'Suzuki', m: ['Swift', 'Vitara', 'Jimny', 'Ignis', 'S-Cross', 'Splash', 'Alto', 'Samurai', 'SX4', 'Celerio'] },
    { n: 'Tesla', m: ['Model 3', 'Model S', 'Model X', 'Model Y'] },
    { n: 'Toyota', m: ['Yaris', 'Yaris Cross', 'Aygo', 'Aygo X', 'Corolla', 'Auris', 'C-HR', 'RAV4', 'Prius', 'GT86', 'Supra', 'Celica', 'MR 2', 'Land Cruiser', 'Hilux'] },
    { n: 'Volkswagen', a: ['vw', 'wolkswagen', 'volkswaghen'], m: ['Golf', 'Polo', 'Passat', 'Tiguan', 'T-Roc', 'T-Cross', 'up!', 'Scirocco', 'Touran', 'Touareg', 'Maggiolino', 'New Beetle', 'Lupo', 'Fox', 'Arteon', 'Sharan', 'ID.3', 'Corrado', 'Bora', 'Caddy', 'Transporter', 'Multivan'] },
    { n: 'Volvo', m: ['XC40', 'XC60', 'XC90', 'V40', 'V60', 'V70', 'V90', 'S40', 'S60', 'S80', 'C30', 'C70', '240', '850', '940'] }
  ];

  // Alias modello -> nome modello (per riconoscere "93", "serie3", "mx5", "rav4"...).
  // Il riconoscimento ignora già spazi/trattini, qui servono solo i casi speciali.
  var MODEL_ALIASES = {
    'Mercedes-Benz': { 'classe a': 'Classe A', 'classe c': 'Classe C', 'clk': 'CLK', 'sl': 'Classe SL', 'ml': 'Classe M', 'w124': 'Classe E', 'gwagon': 'Classe G' },
    'Volkswagen': { 'up': 'up!', 'beetle': 'New Beetle', 'maggiolone': 'Maggiolino', 'id3': 'ID.3' },
    'Fiat': { 'doblo': 'Doblò', 'coupe': 'Coupé', '600': 'Seicento' },
    'Hyundai': { 'coupe': 'Coupé' },
    'BMW': { 'e46': 'Serie 3', 'e90': 'Serie 3', 'e36': 'Serie 3', 'e39': 'Serie 5', 'e60': 'Serie 5' }
  };

  // Slug che non seguono la regola standard, per sito (verificati a mano sui siti).
  // 'Marca' -> slug marca, 'Marca|Modello' -> slug modello, null = il sito non ha quel modello
  // (si cerca solo la marca e l'app avvisa di mettere il modello a mano).
  var SLUG_FIX = {
    autoscout: { 'Ford|Ka': 'ka-ka+' },
    autosupermarket: {
      'Mercedes-Benz': 'mercedes',
      'Mercedes-Benz|CLA': 'classe-cla', 'Mercedes-Benz|CLK': 'classe-clk', 'Mercedes-Benz|CLS': 'classe-cls',
      'Mercedes-Benz|SLK': 'classe-slk', 'Mercedes-Benz|GLA': 'classe-gla', 'Mercedes-Benz|GLC': 'classe-glc',
      'Mercedes-Benz|GLE': 'classe-gle',
      'Audi|RS3': 'rs-3', 'Audi|RS4': 'rs-4', 'Audi|RS6': 'rs-6',
      'Lexus|IS 200': 'is', 'Lexus|IS 300': 'is', 'Lexus|CT 200h': 'ct', 'Lexus|NX 300': 'nx', 'Lexus|RX 450h': 'rx', 'Lexus|UX 250h': 'ux',
      'MINI|Cooper': 'mini', 'MINI|Countryman': 'mini-countryman', 'MINI|Clubman': 'mini-clubman', 'MINI|John Cooper Works': null,
      'Citroen|DS3': null, 'Maserati|3200 GT': null
    }
  };

  // CAP del capoluogo (per AutoScout24, che cerca per CAP + raggio).
  var REGIONS = [
    { k: 'liguria', n: 'Liguria', cap: '16121', r: 100 },
    { k: 'piemonte', n: 'Piemonte', cap: '10121', r: 100 },
    { k: 'lombardia', n: 'Lombardia', cap: '20121', r: 100 },
    { k: 'valle-d-aosta', n: "Valle d'Aosta", cap: '11100', r: 50 },
    { k: 'trentino-alto-adige', n: 'Trentino-Alto Adige', cap: '38122', r: 100 },
    { k: 'veneto', n: 'Veneto', cap: '30121', r: 100 },
    { k: 'friuli-venezia-giulia', n: 'Friuli-Venezia Giulia', cap: '33100', r: 100 },
    { k: 'emilia-romagna', n: 'Emilia-Romagna', cap: '40121', r: 150 },
    { k: 'toscana', n: 'Toscana', cap: '50121', r: 100 },
    { k: 'umbria', n: 'Umbria', cap: '06121', r: 70 },
    { k: 'marche', n: 'Marche', cap: '60121', r: 100 },
    { k: 'lazio', n: 'Lazio', cap: '00184', r: 100 },
    { k: 'abruzzo', n: 'Abruzzo', cap: '65121', r: 100 },
    { k: 'molise', n: 'Molise', cap: '86100', r: 50 },
    { k: 'campania', n: 'Campania', cap: '80133', r: 100 },
    { k: 'puglia', n: 'Puglia', cap: '70121', r: 150 },
    { k: 'basilicata', n: 'Basilicata', cap: '85100', r: 70 },
    { k: 'calabria', n: 'Calabria', cap: '88100', r: 150 },
    { k: 'sicilia', n: 'Sicilia', cap: '90133', r: 200 },
    { k: 'sardegna', n: 'Sardegna', cap: '09124', r: 200 }
  ];

  var FUELS = [
    { k: 'benzina', n: 'Benzina', e: '⛽' },
    { k: 'diesel', n: 'Diesel', e: '🛢️' },
    { k: 'gpl', n: 'GPL', e: '🔵' },
    { k: 'metano', n: 'Metano', e: '🟢' },
    { k: 'ibrida', n: 'Ibrida', e: '🔋' },
    { k: 'elettrica', n: 'Elettrica', e: '⚡' }
  ];

  var GEARS = [
    { k: 'manuale', n: 'Manuale', e: '🕹️' },
    { k: 'automatico', n: 'Automatico', e: '🅰️' }
  ];

  var BODIES = [
    { k: 'citycar', n: 'City car', e: '🚗' },
    { k: 'berlina', n: 'Berlina', e: '🚘' },
    { k: 'sw', n: 'Station wagon', e: '🧳' },
    { k: 'coupe', n: 'Coupé', e: '🏎️' },
    { k: 'cabrio', n: 'Cabrio', e: '☀️' },
    { k: 'suv', n: 'SUV / 4x4', e: '🏔️' }
  ];

  var SORTS = [
    { k: 'rilevanza', n: 'Rilevanza' },
    { k: 'prezzo', n: 'Prezzo più basso' },
    { k: 'recenti', n: 'Ultimi annunci' },
    { k: 'km', n: 'Meno km' }
  ];

  // Preset veloci: sovrascrivono solo i campi indicati.
  var PRESETS = [
    { id: 'saab', n: 'Saab gang', e: '✈️', s: { make: 'Saab', model: '', pmax: 8000 } },
    { id: 'young', n: 'Youngtimer < 5k', e: '📼', s: { pmax: 5000, ymin: 1990, ymax: 2005 } },
    { id: 'neo', n: 'Neopatentato', e: '🔰', s: { pmax: 7000, cvmax: 95, ymin: 2008 } },
    { id: 'cabrio', n: 'Cabrio estiva', e: '☀️', s: { body: 'cabrio', pmax: 10000 } },
    { id: 'coupe', n: 'Coupé tamarra', e: '🏎️', s: { body: 'coupe', cvmin: 180 } },
    { id: 'macina', n: 'Macina km', e: '🛢️', s: { fuel: 'diesel', body: 'sw', pmax: 6000 } },
    { id: '4x4', n: 'Fuoristrada', e: '🏔️', s: { body: 'suv', gear: 'manuale', pmax: 12000 } },
    { id: 'cheap', n: 'Rottame chic < 2k', e: '🪙', s: { pmax: 2000 } }
  ];

  // La roulette: auto da appassionati, con range indicativi (prezzi molto spannometrici).
  var ROULETTE = [
    { make: 'Saab', model: '9-3', kw: 'viggen', e: '✈️', y: [1999, 2002], p: [8000, 25000], f: 'Prende il nome dal caccia Saab 37 Viggen.' },
    { make: 'Saab', model: '9-3', kw: 'aero', e: '✈️', y: [2003, 2011], p: [3000, 12000], f: 'L\'Aero top di gamma ha il 2.8 V6 turbo da 250-280 CV.' },
    { make: 'Saab', model: '900', e: '✈️', y: [1979, 1993], p: [4000, 18000], f: 'La chiave si gira tra i sedili, vicino alla leva del cambio.' },
    { make: 'Saab', model: '9-5', kw: 'aero', e: '✈️', y: [2000, 2009], p: [2500, 9000], f: 'Comoda, robusta e spesso sottovalutata: regina delle autostrade.' },
    { make: 'Mazda', model: 'MX-5', e: '🌀', y: [1990, 2005], p: [4000, 12000], f: 'Secondo il Guinness è la spider a due posti più venduta della storia.' },
    { make: 'Mazda', model: 'RX-8', e: '🔺', y: [2003, 2012], p: [3500, 10000], f: 'Motore rotativo Renesis e porte posteriori controvento.' },
    { make: 'BMW', model: 'M3', e: '🔵', y: [2000, 2006], p: [20000, 45000], f: 'La E46 M3 monta il sei in linea S54 da 343 CV.' },
    { make: 'BMW', model: 'Serie 3', kw: '330', e: '🔵', y: [1998, 2006], p: [3000, 10000], f: 'La E46 330: sei cilindri in linea aspirato, trazione posteriore.' },
    { make: 'BMW', model: 'Serie 5', kw: '530d', e: '🔵', y: [1998, 2004], p: [3000, 9000], f: 'La E39 530d ha il sei in linea diesel M57, quasi indistruttibile.' },
    { make: 'BMW', model: 'Z3', e: '🕶️', y: [1996, 2002], p: [5000, 15000], f: 'È la BMW di James Bond in GoldenEye (1995).' },
    { make: 'Honda', model: 'Civic', kw: 'type r', e: '🔴', y: [2001, 2011], p: [6000, 18000], f: 'La EP3 Type R era costruita a Swindon, in Inghilterra.' },
    { make: 'Honda', model: 'S2000', e: '🔴', y: [1999, 2009], p: [15000, 35000], f: 'Il quattro cilindri F20C gira fino a 9.000 giri.' },
    { make: 'Peugeot', model: '205', kw: 'gti', e: '🦁', y: [1984, 1994], p: [7000, 20000], f: 'Una delle hot hatch simbolo degli anni 80.' },
    { make: 'Peugeot', model: '306', kw: 'gti', e: '🦁', y: [1996, 2001], p: [3000, 10000], f: 'La GTI-6 ha il cambio a sei marce.' },
    { make: 'Fiat', model: 'Coupé', e: '🇮🇹', y: [1994, 2000], p: [5000, 15000], f: 'Esterni disegnati da Chris Bangle, interni da Pininfarina.' },
    { make: 'Fiat', model: 'Panda', kw: '4x4', e: '🐑', y: [1983, 2003], p: [2500, 8000], f: 'La prima Panda 4x4 è nata con la trazione Steyr-Puch.' },
    { make: 'Fiat', model: 'Uno', kw: 'turbo', e: '💨', y: [1985, 1994], p: [4000, 12000], f: 'La Uno Turbo i.e. era una delle utilitarie più veloci del suo periodo.' },
    { make: 'Lancia', model: 'Delta', kw: 'integrale', e: '🏆', y: [1987, 1994], p: [30000, 80000], f: 'Sei titoli costruttori WRC di fila, dal 1987 al 1992.' },
    { make: 'Lancia', model: 'Delta', e: '🏆', y: [2008, 2014], p: [3000, 9000], f: 'La terza serie: lusso compatto italiano, spesso con buoni allestimenti.' },
    { make: 'Alfa Romeo', model: '147', kw: 'gta', e: '🍀', y: [2002, 2010], p: [6000, 15000], f: 'Sotto il cofano c\'è il V6 "Busso" 3.2 da 250 CV.' },
    { make: 'Alfa Romeo', model: 'GTV', e: '🍀', y: [1995, 2005], p: [4000, 12000], f: 'Disegnata da Enrico Fumia per Pininfarina.' },
    { make: 'Alfa Romeo', model: '156', e: '🍀', y: [1997, 2007], p: [1500, 6000], f: 'Auto dell\'anno in Europa nel 1998.' },
    { make: 'Alfa Romeo', model: 'Giulietta', kw: 'quadrifoglio', e: '🍀', y: [2010, 2020], p: [8000, 20000], f: 'La QV monta il 1750 TBi turbo benzina.' },
    { make: 'Toyota', model: 'MR 2', e: '🎯', y: [1990, 2007], p: [5000, 15000], f: 'Motore centrale e trazione posteriore, a prezzi da utilitaria.' },
    { make: 'Toyota', model: 'Celica', e: '🎯', y: [1994, 2006], p: [2500, 8000], f: 'Le Celica GT-Four hanno corso e vinto nel WRC.' },
    { make: 'Toyota', model: 'GT86', e: '🎯', y: [2012, 2021], p: [14000, 25000], f: 'Il boxer è di origine Subaru: è gemella della BRZ.' },
    { make: 'Toyota', model: 'Supra', e: '🐉', y: [1993, 2002], p: [40000, 120000], f: 'La MK4 ha il mitico sei in linea 2JZ. Sogno, non budget.' },
    { make: 'Subaru', model: 'Impreza', e: '⭐', y: [1996, 2010], p: [4000, 20000], f: 'Motore boxer e trazione integrale, il rally nel DNA.' },
    { make: 'Mitsubishi', model: 'Lancer', kw: 'evo', e: '⭐', y: [1998, 2015], p: [15000, 45000], f: 'La Evo ha vinto quattro titoli piloti WRC con Tommi Mäkinen.' },
    { make: 'Audi', model: 'TT', e: '⭕', y: [1998, 2006], p: [3000, 10000], f: 'La prima TT (8N) deriva dalla piattaforma della Golf IV.' },
    { make: 'Porsche', model: 'Boxster', e: '🐎', y: [1996, 2004], p: [10000, 22000], f: 'La 986 è stata la Porsche che ha rilanciato il marchio negli anni 90.' },
    { make: 'Volvo', model: '850', e: '🧱', y: [1992, 1997], p: [2000, 9000], f: 'Nel 1994 ha corso nel BTCC anche in versione station wagon.' },
    { make: 'Volvo', model: '240', e: '🧱', y: [1975, 1993], p: [3000, 10000], f: 'Il "mattone" svedese: prodotto per quasi 20 anni.' },
    { make: 'Mercedes-Benz', model: 'Classe E', kw: 'w124', e: '⭐', y: [1985, 1996], p: [3000, 12000], f: 'La E 500 W124 veniva assemblata insieme a Porsche.' },
    { make: 'Mercedes-Benz', model: 'SLK', e: '⭐', y: [1996, 2004], p: [3000, 9000], f: 'Il tetto rigido Vario-roof si ripiega nel bagagliaio.' },
    { make: 'Volkswagen', model: 'Golf', kw: 'r32', e: '🐺', y: [2002, 2009], p: [9000, 20000], f: 'La R32 ha il VR6 3.2 e la trazione integrale.' },
    { make: 'Volkswagen', model: 'Golf', kw: 'gti', e: '🐺', y: [2004, 2012], p: [5000, 14000], f: 'La GTI Mk5 ha riportato il nome GTI ai fasti di un tempo.' },
    { make: 'Volkswagen', model: 'Scirocco', e: '🐺', y: [2008, 2017], p: [6000, 16000], f: 'Il nome viene da un vento che soffia sul Mediterraneo.' },
    { make: 'Renault', model: 'Clio', kw: 'rs', e: '🟡', y: [2000, 2012], p: [3500, 12000], f: 'Le Clio RS sono tra le hot hatch più divertenti di sempre.' },
    { make: 'Renault', model: 'Megane', kw: 'rs', e: '🟡', y: [2004, 2018], p: [6000, 20000], f: 'Le Mégane RS hanno fatto più volte il record al Nürburgring per le trazioni anteriori.' },
    { make: 'Ford', model: 'Focus', kw: 'rs', e: '🔷', y: [2009, 2011], p: [18000, 35000], f: 'La RS Mk2 ha il cinque cilindri 2.5 turbo di origine Volvo.' },
    { make: 'Ford', model: 'Fiesta', kw: 'st', e: '🔷', y: [2005, 2018], p: [4000, 14000], f: 'Piccola, leggera e cattiva: amata da chi va in pista.' },
    { make: 'MINI', model: 'Cooper S', e: '🇬🇧', y: [2002, 2006], p: [2500, 7000], f: 'La R53 ha il compressore volumetrico: fischia che è una meraviglia.' },
    { make: 'Nissan', model: '350Z', e: '🗾', y: [2003, 2009], p: [9000, 20000], f: 'V6 VQ35 aspirato e trazione posteriore.' },
    { make: 'Opel', model: 'Calibra', e: '⚡', y: [1990, 1997], p: [3000, 10000], f: 'Al lancio era una delle auto più aerodinamiche al mondo (Cx 0,26).' },
    { make: 'Suzuki', model: 'Jimny', e: '🐐', y: [1998, 2018], p: [4000, 12000], f: 'Piccolo, leggero e capace di andare dove i SUV si piantano.' },
    { make: 'Land Rover', model: 'Defender', e: '🦬', y: [1990, 2016], p: [15000, 45000], f: 'Erede diretto della Land Rover Series del 1948.' },
    { make: 'Lexus', model: 'IS 200', e: '🎌', y: [1999, 2005], p: [2500, 7000], f: 'Sei cilindri in linea e trazione posteriore, Toyota-proof.' },
    { make: 'Citroen', model: 'Saxo', kw: 'vts', e: '🧨', y: [1996, 2003], p: [2000, 7000], f: 'Leggerissima: la VTS pesa meno di una tonnellata.' },
    { make: 'Jaguar', model: 'XK', e: '🐆', y: [1996, 2014], p: [10000, 30000], f: 'Inglese, lunga e bassa: da cruising notturno.' }
  ];

  var data = { MAKES: MAKES, MODEL_ALIASES: MODEL_ALIASES, SLUG_FIX: SLUG_FIX, REGIONS: REGIONS, FUELS: FUELS, GEARS: GEARS, BODIES: BODIES, SORTS: SORTS, PRESETS: PRESETS, ROULETTE: ROULETTE };
  root.CA_DATA = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof window !== 'undefined' ? window : globalThis);
