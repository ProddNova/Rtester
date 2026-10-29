/* Dati statici: marche/modelli, regioni, alimentazioni, eccezioni sugli URL dei siti. */
(function (root) {
  // Nomi modello scritti come li usa AutoScout24 (gli slug vengono generati da qui).
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
      'Citroen|DS3': null, 'Maserati|3200 GT': null,
      'Mazda|2': 'mazda2', 'Mazda|3': 'mazda3', 'Mazda|6': 'mazda6',
      'Porsche|944': '924-944', 'Porsche|924': '924-944', 'Skoda|Enyaq': 'enyaq-iv',
      'Audi|80': null, 'Audi|100': null, 'BMW|M2': null, 'BMW|M3': null, 'BMW|M4': null, 'BMW|M5': null,
      'Saab|99': null, 'Toyota|MR 2': null, 'Volvo|850': null, 'Volvo|940': null
    },
    automobile: {
      'Lexus|IS 200': 'is', 'Lexus|IS 300': 'is', 'Lexus|CT 200h': 'ct', 'Lexus|NX 300': 'nx', 'Lexus|RX 450h': 'rx', 'Lexus|UX 250h': 'ux',
      'Mercedes-Benz|CLK': 'classe_clk', 'Mercedes-Benz|Classe SL': 'serie_sl',
      'Citroen|2CV': '2_cv', 'Citroen|DS3': null, 'Maserati|3200 GT': null, 'Toyota|Aygo X': null, 'Volkswagen|up!': null,
      'Lancia|Kappa': 'k', 'MINI|Countryman': 'mini_countryman', 'MINI|Clubman': 'mini_clubman',
      'BMW|M2': null, 'Nissan|Skyline': null, 'Saab|99': null, 'Skoda|Enyaq': null, 'Volvo|940': null
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
    { k: 'benzina', n: 'Benzina' },
    { k: 'diesel', n: 'Diesel' },
    { k: 'gpl', n: 'GPL' },
    { k: 'metano', n: 'Metano' },
    { k: 'ibrida', n: 'Ibrida' },
    { k: 'elettrica', n: 'Elettrica' }
  ];

  var GEARS = [
    { k: 'manuale', n: 'Manuale' },
    { k: 'automatico', n: 'Automatico' }
  ];

  var BODIES = [
    { k: 'citycar', n: 'City car' },
    { k: 'berlina', n: 'Berlina' },
    { k: 'sw', n: 'Station wagon' },
    { k: 'coupe', n: 'Coupé' },
    { k: 'cabrio', n: 'Cabrio' },
    { k: 'suv', n: 'SUV / 4x4' }
  ];

  var data = { MAKES: MAKES, SLUG_FIX: SLUG_FIX, REGIONS: REGIONS, FUELS: FUELS, GEARS: GEARS, BODIES: BODIES };
  root.CA_DATA = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof window !== 'undefined' ? window : globalThis);
