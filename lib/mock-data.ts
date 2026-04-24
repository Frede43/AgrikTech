// AgriConnect Burundi — Mock data for the Farmer Dashboard

export const farmer = {
  name: "Pascal Niyonkuru",
  province: "Kayanza",
  commune: "Butaganzwa",
  phone: "+257 79 123 456",
  memberSince: "2023",
  rating: 4.8,
  totalReviews: 127,
  avatar: "/farmer-avatar.jpg",
};

export const walletData = {
  balance: 1_847_500, // BIF
  pendingPayout: 312_000,
  lastTransfer: "2025-02-18",
  lumicashNumber: "+257 79 123 456",
};

export const salesWeekly = [
  { week: "S1 Jan", amount: 245_000 },
  { week: "S2 Jan", amount: 310_000 },
  { week: "S3 Jan", amount: 180_000 },
  { week: "S4 Jan", amount: 420_000 },
  { week: "S1 Fév", amount: 390_000 },
  { week: "S2 Fév", amount: 510_000 },
  { week: "S3 Fév", amount: 475_000 },
  { week: "S4 Fév", amount: 620_000 },
];

export const pendingOrders = [
  {
    id: "CMD-2891",
    buyer: "Hôtel Source du Nil",
    items: "Tomates cerises (15kg) + Poivrons (8kg)",
    total: 87_500,
    status: "preparation",
    dueDate: "Demain 08h00",
  },
  {
    id: "CMD-2892",
    buyer: "Supermarché Tanganyika",
    items: "Haricots verts (50kg)",
    total: 175_000,
    status: "pickup",
    dueDate: "Auj. 14h00",
  },
  {
    id: "CMD-2893",
    buyer: "Restaurant Kiriri",
    items: "Bananier plantain (30kg)",
    total: 54_000,
    status: "transit",
    dueDate: "Demain 10h00",
  },
];

export const sokoLivePrices = [
  { product: "Tomates", price: 2_500, unit: "kg", trend: "up", change: 8 },
  { product: "Pommes de terre", price: 1_200, unit: "kg", trend: "stable", change: 0 },
  { product: "Haricots verts", price: 3_500, unit: "kg", trend: "up", change: 12 },
  { product: "Bananier plantain", price: 1_800, unit: "kg", trend: "down", change: -5 },
  { product: "Maïs", price: 850, unit: "kg", trend: "up", change: 3 },
  { product: "Poivrons rouges", price: 4_200, unit: "kg", trend: "stable", change: 0 },
  { product: "Oignons", price: 2_100, unit: "kg", trend: "down", change: -8 },
  { product: "Aubergines", price: 2_800, unit: "kg", trend: "up", change: 6 },
];

export const weatherData = {
  location: "Kayanza, Burundi",
  current: {
    temp: 22,
    condition: "Partiellement nuageux",
    humidity: 68,
    wind: 12,
    icon: "cloud-sun",
  },
  forecast: [
    { day: "Jeu", icon: "cloud-rain", high: 20, low: 15, rain: 80 },
    { day: "Ven", icon: "cloud-rain", high: 18, low: 14, rain: 90 },
    { day: "Sam", icon: "cloud-sun", high: 23, low: 16, rain: 20 },
    { day: "Dim", icon: "sun", high: 25, low: 17, rain: 5 },
    { day: "Lun", icon: "sun", high: 26, low: 18, rain: 0 },
  ],
};

export const agriTips = [
  {
    id: 1,
    type: "alert",
    title: "Forte pluie prévue demain sur Kayanza",
    body: "Récoltez vos tomates aujourd'hui avant les précipitations. Risque de pourriture si laissées sur pied.",
    urgency: "high",
  },
  {
    id: 2,
    type: "tip",
    title: "Moment idéal pour récolter vos haricots",
    body: "Avec les prix en hausse de 12% sur le marché, c'est le moment optimal pour vendre vos haricots verts.",
    urgency: "medium",
  },
  {
    id: 3,
    type: "tip",
    title: "Conseil fertilisation",
    body: "Après les pluies de ce weekend, appliquez un engrais azoté léger sur vos cultures de maïs pour maximiser le rendement.",
    urgency: "low",
  },
  {
    id: 4,
    type: "market",
    title: "Opportunité de marché — Bujumbura",
    body: "Le Supermarché Tanganyika cherche 200kg de pommes de terre par semaine. Contactez l'agent AgriConnect.",
    urgency: "medium",
  },
];

export const products = [
  {
    id: "P001",
    name: "Tomates cerises",
    category: "Légumes",
    price: 2_800,
    unit: "kg",
    stock: 85,
    minStock: 20,
    harvestDate: "2025-02-26",
    image: "/products/tomatoes.jpg",
    status: "active",
    sold: 210,
  },
  {
    id: "P002",
    name: "Pommes de terre",
    category: "Tubercules",
    price: 1_200,
    unit: "kg",
    stock: 320,
    minStock: 50,
    harvestDate: "2025-02-20",
    image: "/products/potatoes.jpg",
    status: "active",
    sold: 480,
  },
  {
    id: "P003",
    name: "Haricots verts",
    category: "Légumes",
    price: 3_500,
    unit: "kg",
    stock: 12,
    minStock: 30,
    harvestDate: "2025-02-24",
    image: "/products/beans.jpg",
    status: "low-stock",
    sold: 95,
  },
  {
    id: "P004",
    name: "Bananier plantain",
    category: "Fruits",
    price: 1_800,
    unit: "kg",
    stock: 0,
    minStock: 20,
    harvestDate: "2025-02-15",
    image: "/products/banana.jpg",
    status: "out-of-stock",
    sold: 340,
  },
  {
    id: "P005",
    name: "Poivrons rouges",
    category: "Légumes",
    price: 4_200,
    unit: "kg",
    stock: 44,
    minStock: 10,
    harvestDate: "2025-02-25",
    image: "/products/peppers.jpg",
    status: "active",
    sold: 67,
  },
  {
    id: "P006",
    name: "Oignons",
    category: "Légumes",
    price: 2_100,
    unit: "kg",
    stock: 190,
    minStock: 40,
    harvestDate: "2025-02-18",
    image: "/products/onions.jpg",
    status: "active",
    sold: 520,
  },
];

export const transactions = [
  {
    id: "TXN-7841",
    date: "2025-02-28",
    type: "sale",
    buyer: "Hôtel Source du Nil",
    items: "Tomates cerises — 20kg",
    gross: 56_000,
    commission: 2_800,
    net: 53_200,
    status: "paid",
  },
  {
    id: "TXN-7840",
    date: "2025-02-27",
    type: "sale",
    buyer: "Supermarché Tanganyika",
    items: "Pommes de terre — 100kg",
    gross: 120_000,
    commission: 6_000,
    net: 114_000,
    status: "paid",
  },
  {
    id: "TXN-7839",
    date: "2025-02-27",
    type: "payout",
    buyer: "Vers Lumicash",
    items: "Transfert portefeuille",
    gross: 200_000,
    commission: 0,
    net: -200_000,
    status: "completed",
  },
  {
    id: "TXN-7838",
    date: "2025-02-26",
    type: "sale",
    buyer: "Restaurant Kiriri",
    items: "Bananier plantain — 30kg",
    gross: 54_000,
    commission: 2_700,
    net: 51_300,
    status: "paid",
  },
  {
    id: "TXN-7837",
    date: "2025-02-25",
    type: "sale",
    buyer: "Coopérative Muramvya",
    items: "Haricots verts — 25kg",
    gross: 87_500,
    commission: 4_375,
    net: 83_125,
    status: "pending",
  },
  {
    id: "TXN-7836",
    date: "2025-02-24",
    type: "sale",
    buyer: "Hôtel Bora Bora",
    items: "Poivrons rouges — 15kg + Oignons — 30kg",
    gross: 126_000,
    commission: 6_300,
    net: 119_700,
    status: "paid",
  },
  {
    id: "TXN-7835",
    date: "2025-02-22",
    type: "payout",
    buyer: "Vers Lumicash",
    items: "Transfert portefeuille",
    gross: 350_000,
    commission: 0,
    net: -350_000,
    status: "completed",
  },
  {
    id: "TXN-7834",
    date: "2025-02-21",
    type: "sale",
    buyer: "Supermarché Tanganyika",
    items: "Tomates cerises — 40kg",
    gross: 112_000,
    commission: 5_600,
    net: 106_400,
    status: "paid",
  },
];

export const formatBIF = (amount: number) => {
  return new Intl.NumberFormat("fr-BI", {
    style: "currency",
    currency: "BIF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// ─── Buyer flow data ──────────────────────────────────────────────────────────

export const categories = [
  { id: "legumes", label: "Légumes", icon: "🥦", count: 42 },
  { id: "fruits", label: "Fruits", icon: "🍌", count: 18 },
  { id: "tubercules", label: "Tubercules", icon: "🥔", count: 12 },
  { id: "cereales", label: "Céréales", icon: "🌽", count: 9 },
  { id: "herbes", label: "Herbes", icon: "🌿", count: 7 },
];

export const buyerProducts = [
  {
    id: "BP001",
    name: "Tomates cerises Bio",
    farmer: "Pascal Niyonkuru",
    province: "Kayanza",
    price: 2_800,
    unit: "kg",
    minOrder: 5,
    stock: 85,
    rating: 4.9,
    reviews: 127,
    harvestedAt: "Il y a 6 heures",
    category: "legumes",
    bio: true,
    image: "/products/tomatoes.jpg",
    description: "Tomates cerises cultivées sans pesticides sur les collines de Kayanza. Récoltées à la main, livrables dès demain matin.",
    traceability: {
      planted: "15 Janvier 2025",
      harvested: "28 Février 2025",
      certifiedBy: "AgriConnect Vérifié",
      coordinates: "Kayanza, Butaganzwa (-3.12, 29.63)",
    },
  },
  {
    id: "BP002",
    name: "Pommes de terre Rutoke",
    farmer: "Générose Hakizimana",
    province: "Muramvya",
    price: 1_200,
    unit: "kg",
    minOrder: 20,
    stock: 320,
    rating: 4.7,
    reviews: 89,
    harvestedAt: "Il y a 2 jours",
    category: "tubercules",
    bio: false,
    image: "/products/potatoes.jpg",
    description: "Variété Rutoke, idéale pour la friture et la soupe. Stockées en entrepôt frais à Muramvya.",
    traceability: {
      planted: "1 Décembre 2024",
      harvested: "20 Février 2025",
      certifiedBy: "AgriConnect Vérifié",
      coordinates: "Muramvya, Kiganda (-3.27, 29.60)",
    },
  },
  {
    id: "BP003",
    name: "Haricots verts frais",
    farmer: "Jean-Pierre Nkurunziza",
    province: "Ngozi",
    price: 3_500,
    unit: "kg",
    minOrder: 10,
    stock: 40,
    rating: 4.8,
    reviews: 54,
    harvestedAt: "Il y a 12 heures",
    category: "legumes",
    bio: true,
    image: "/products/beans.jpg",
    description: "Haricots verts de première fraîcheur, récoltés ce matin à Ngozi. Parfaits pour les restaurants et hôtels.",
    traceability: {
      planted: "20 Janvier 2025",
      harvested: "28 Février 2025",
      certifiedBy: "AgriConnect Vérifié",
      coordinates: "Ngozi, Kiremba (-2.91, 29.83)",
    },
  },
  {
    id: "BP004",
    name: "Maïs séché local",
    farmer: "Aline Nzeyimana",
    province: "Gitega",
    price: 850,
    unit: "kg",
    minOrder: 50,
    stock: 500,
    rating: 4.6,
    reviews: 201,
    harvestedAt: "Il y a 5 jours",
    category: "cereales",
    bio: false,
    image: "/products/maize.jpg",
    description: "Maïs jaune séché au soleil, idéal pour la farine de bugali. Disponible en grande quantité.",
    traceability: {
      planted: "10 Novembre 2024",
      harvested: "22 Février 2025",
      certifiedBy: "AgriConnect Vérifié",
      coordinates: "Gitega, Bururi (-3.43, 29.93)",
    },
  },
  {
    id: "BP005",
    name: "Bananier plantain",
    farmer: "Pierre Ndayishimiye",
    province: "Bubanza",
    price: 1_800,
    unit: "kg",
    minOrder: 15,
    stock: 200,
    rating: 4.5,
    reviews: 73,
    harvestedAt: "Il y a 1 jour",
    category: "fruits",
    bio: false,
    image: "/products/banana.jpg",
    description: "Plantains mûrs à point, cultivés dans la plaine de l'Imbo. Idéal pour la cuisine locale.",
    traceability: {
      planted: "1 Octobre 2024",
      harvested: "27 Février 2025",
      certifiedBy: "AgriConnect Vérifié",
      coordinates: "Bubanza, Gihanga (-3.10, 29.38)",
    },
  },
  {
    id: "BP006",
    name: "Poivrons rouges",
    farmer: "Pascal Niyonkuru",
    province: "Kayanza",
    price: 4_200,
    unit: "kg",
    minOrder: 5,
    stock: 44,
    rating: 4.9,
    reviews: 38,
    harvestedAt: "Il y a 8 heures",
    category: "legumes",
    bio: true,
    image: "/products/peppers.jpg",
    description: "Poivrons rouges charnus, variété locale à forte teneur en vitamine C. Bio certifié.",
    traceability: {
      planted: "15 Janvier 2025",
      harvested: "28 Février 2025",
      certifiedBy: "AgriConnect Vérifié",
      coordinates: "Kayanza, Butaganzwa (-3.12, 29.63)",
    },
  },
];

export const promotions = [
  { id: 1, title: "Tomates fraîches — Récolte du jour", subtitle: "Livraison gratuite sur Bujumbura", badge: "Promo" },
  { id: 2, title: "Achetez local, mangez frais", subtitle: "Traçabilité garantie de la ferme à l'assiette", badge: "Nouveau" },
  { id: 3, title: "Commandes groupées pour hôtels", subtitle: "Réductions à partir de 50 kg", badge: "Pro" },
];

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
};

export const sampleCart: CartItem[] = [
  { productId: "BP001", name: "Tomates cerises Bio", price: 2_800, unit: "kg", quantity: 10 },
  { productId: "BP003", name: "Haricots verts frais", price: 3_500, unit: "kg", quantity: 15 },
  { productId: "BP005", name: "Bananier plantain", price: 1_800, unit: "kg", quantity: 20 },
];

export type OrderStatus = "preparation" | "pickup" | "transit" | "delivered";

export const activeOrder = {
  id: "CMD-2894",
  placedAt: "Aujourd'hui 09h14",
  estimatedDelivery: "Aujourd'hui 15h00",
  farmer: "Pascal Niyonkuru — Kayanza",
  driver: "Théodore Manirambona",
  driverPhone: "+257 76 456 789",
  items: "Tomates cerises 10kg + Haricots verts 15kg + Bananier 20kg",
  total: 116_000,
  status: "transit" as OrderStatus,
  steps: [
    { key: "preparation", label: "Préparation chez le fermier", done: true, time: "09h14" },
    { key: "pickup", label: "Ramassage par le transporteur", done: true, time: "11h30" },
    { key: "transit", label: "En route vers chez vous", done: false, time: "En cours" },
    { key: "delivered", label: "Livraison effectuée", done: false, time: "~15h00" },
  ],
};

// ─── Logistics flow data ──────────────────────────────────────────────────────

export const driver = {
  name: "Théodore Manirambona",
  phone: "+257 76 456 789",
  vehicle: "Moto — Bujumbura BJ-4821",
  zone: "Bujumbura — Kayanza",
  rating: 4.7,
  completedDeliveries: 312,
};

export const collectionsToday = [
  {
    id: "COL-501",
    farmer: "Pascal Niyonkuru",
    address: "Butaganzwa, Kayanza",
    distance: "2.3 km",
    items: "Tomates cerises — 25 kg + Poivrons — 8 kg",
    weight: "33 kg",
    orderId: "CMD-2891",
    buyer: "Hôtel Source du Nil",
    pickupTime: "12h00",
    status: "pending",
    priority: "high",
    coordinates: "(-3.12, 29.63)",
  },
  {
    id: "COL-502",
    farmer: "Générose Hakizimana",
    address: "Kiganda, Muramvya",
    distance: "5.8 km",
    items: "Pommes de terre — 50 kg",
    weight: "50 kg",
    orderId: "CMD-2892",
    buyer: "Supermarché Tanganyika",
    pickupTime: "13h30",
    status: "pending",
    priority: "medium",
    coordinates: "(-3.27, 29.60)",
  },
  {
    id: "COL-503",
    farmer: "Jean-Pierre Nkurunziza",
    address: "Kiremba, Ngozi",
    distance: "8.1 km",
    items: "Haricots verts — 30 kg",
    weight: "30 kg",
    orderId: "CMD-2893",
    buyer: "Restaurant Kiriri",
    pickupTime: "14h00",
    status: "collected",
    priority: "low",
    coordinates: "(-2.91, 29.83)",
  },
];

// ─── Admin flow data ──────────────────────────────────────────────────────────

export const adminKpis = {
  gmv: 48_720_000,          // Gross Merchandise Value (BIF) this month
  gmvGrowth: 18,            // % vs last month
  activeFarmers: 342,
  farmerGrowth: 24,
  activeOrders: 87,
  ordersGrowth: 11,
  disputeRate: 2.4,         // % of orders
  totalPayouts: 32_140_000, // BIF paid out to farmers this month
};

export const gmvMonthly = [
  { month: "Sep", gmv: 22_400_000, orders: 312 },
  { month: "Oct", gmv: 28_100_000, orders: 401 },
  { month: "Nov", gmv: 31_500_000, orders: 462 },
  { month: "Déc", gmv: 27_800_000, orders: 389 },
  { month: "Jan", gmv: 38_200_000, orders: 547 },
  { month: "Fév", gmv: 41_300_000, orders: 612 },
  { month: "Mar", gmv: 48_720_000, orders: 689 },
];

export const provinceStockData = [
  { province: "Bujumbura", farmers: 78, stock_tons: 42, orders_pending: 24, lat: -3.38, lng: 29.36, level: "high" },
  { province: "Kayanza", farmers: 61, stock_tons: 58, orders_pending: 18, lat: -3.02, lng: 29.63, level: "high" },
  { province: "Ngozi", farmers: 44, stock_tons: 34, orders_pending: 12, lat: -2.91, lng: 29.83, level: "medium" },
  { province: "Gitega", farmers: 55, stock_tons: 47, orders_pending: 15, lat: -3.43, lng: 29.93, level: "high" },
  { province: "Muramvya", farmers: 32, stock_tons: 22, orders_pending: 7, lat: -3.27, lng: 29.60, level: "medium" },
  { province: "Muyinga", farmers: 28, stock_tons: 18, orders_pending: 5, lat: -2.85, lng: 30.34, level: "medium" },
  { province: "Kirundo", farmers: 19, stock_tons: 11, orders_pending: 3, lat: -2.58, lng: 30.10, level: "low" },
  { province: "Bubanza", farmers: 14, stock_tons: 9, orders_pending: 2, lat: -3.10, lng: 29.38, level: "low" },
  { province: "Rutana", farmers: 11, stock_tons: 6, orders_pending: 1, lat: -3.93, lng: 29.99, level: "low" },
];

export const topFarmers = [
  { name: "Pascal Niyonkuru", province: "Kayanza", gmv: 4_820_000, orders: 87, rating: 4.9, status: "verified" },
  { name: "Générose Hakizimana", province: "Muramvya", gmv: 3_210_000, orders: 64, rating: 4.7, status: "verified" },
  { name: "Aline Nzeyimana", province: "Gitega", gmv: 2_940_000, orders: 58, rating: 4.6, status: "verified" },
  { name: "Jean-Pierre Nkurunziza", province: "Ngozi", gmv: 2_180_000, orders: 42, rating: 4.8, status: "verified" },
  { name: "Pierre Ndayishimiye", province: "Bubanza", gmv: 1_760_000, orders: 31, rating: 4.5, status: "pending" },
];

export const adminDisputes = [
  {
    id: "DIS-221",
    orderId: "CMD-2871",
    date: "2025-03-01",
    buyer: "Hôtel Source du Nil",
    farmer: "Pascal Niyonkuru",
    reason: "Produits endommagés à la livraison",
    detail: "Tomates cerises 20kg reçues avec 30% de fruits écrasés. Photos transmises.",
    amount: 56_000,
    refundRequested: 16_800,
    status: "open",
    priority: "high",
    driver: "Théodore Manirambona",
  },
  {
    id: "DIS-220",
    orderId: "CMD-2865",
    date: "2025-02-28",
    buyer: "Restaurant Kiriri",
    farmer: "Générose Hakizimana",
    reason: "Quantité incorrecte reçue",
    detail: "Commande de 50kg de pommes de terre — seulement 42kg livrés. Manque de 8kg.",
    amount: 60_000,
    refundRequested: 9_600,
    status: "in-review",
    priority: "medium",
    driver: "Emmanuel Nkurunziza",
  },
  {
    id: "DIS-219",
    orderId: "CMD-2852",
    date: "2025-02-26",
    buyer: "Supermarché Tanganyika",
    farmer: "Aline Nzeyimana",
    reason: "Produit non conforme à la description",
    detail: "Maïs séché livré avec taux d'humidité trop élevé (>18%). Non utilisable pour farine.",
    amount: 85_000,
    refundRequested: 85_000,
    status: "resolved",
    resolution: "Remboursement Lumicash 85 000 BIF effectué.",
    priority: "high",
    driver: "Théodore Manirambona",
  },
  {
    id: "DIS-218",
    orderId: "CMD-2844",
    date: "2025-02-25",
    buyer: "Hôtel Bora Bora",
    farmer: "Jean-Pierre Nkurunziza",
    reason: "Livraison non effectuée",
    detail: "Commande CMD-2844 jamais livrée. Transporteur injoignable après 14h.",
    amount: 42_000,
    refundRequested: 42_000,
    status: "resolved",
    resolution: "Remboursement complet + pénalité livreur appliquée.",
    priority: "high",
    driver: "Didier Hakizimana",
  },
  {
    id: "DIS-217",
    orderId: "CMD-2838",
    date: "2025-02-24",
    buyer: "Coopérative Muramvya",
    farmer: "Pierre Ndayishimiye",
    reason: "Retard de livraison > 4h",
    detail: "Livraison prévue à 10h — arrivée à 15h30. Préjudice logistique pour la coopérative.",
    amount: 72_000,
    refundRequested: 7_200,
    status: "open",
    priority: "low",
    driver: "Emmanuel Nkurunziza",
  },
];

export type AdminUserRole = "farmer" | "buyer" | "driver" | "admin";

export const adminUsers = [
  { id: "U001", name: "Pascal Niyonkuru", phone: "+257 79 123 456", role: "farmer" as AdminUserRole, province: "Kayanza", status: "active", joinedAt: "Jan 2024", gmv: 4_820_000, orders: 87 },
  { id: "U002", name: "Générose Hakizimana", phone: "+257 79 234 567", role: "farmer" as AdminUserRole, province: "Muramvya", status: "active", joinedAt: "Mar 2024", gmv: 3_210_000, orders: 64 },
  { id: "U003", name: "Hôtel Source du Nil", phone: "+257 22 234 567", role: "buyer" as AdminUserRole, province: "Bujumbura", status: "active", joinedAt: "Fév 2024", gmv: 8_400_000, orders: 143 },
  { id: "U004", name: "Théodore Manirambona", phone: "+257 76 456 789", role: "driver" as AdminUserRole, province: "Bujumbura", status: "active", joinedAt: "Avr 2024", gmv: 0, orders: 312 },
  { id: "U005", name: "Aline Nzeyimana", phone: "+257 79 345 678", role: "farmer" as AdminUserRole, province: "Gitega", status: "active", joinedAt: "Mai 2024", gmv: 2_940_000, orders: 58 },
  { id: "U006", name: "Jean-Pierre Nkurunziza", phone: "+257 79 456 789", role: "farmer" as AdminUserRole, province: "Ngozi", status: "active", joinedAt: "Juin 2024", gmv: 2_180_000, orders: 42 },
  { id: "U007", name: "Supermarché Tanganyika", phone: "+257 22 345 678", role: "buyer" as AdminUserRole, province: "Bujumbura", status: "active", joinedAt: "Jan 2024", gmv: 6_100_000, orders: 98 },
  { id: "U008", name: "Restaurant Kiriri", phone: "+257 22 456 789", role: "buyer" as AdminUserRole, province: "Bujumbura", status: "active", joinedAt: "Fév 2024", gmv: 2_800_000, orders: 54 },
  { id: "U009", name: "Pierre Ndayishimiye", phone: "+257 79 567 890", role: "farmer" as AdminUserRole, province: "Bubanza", status: "pending", joinedAt: "Mar 2025", gmv: 1_760_000, orders: 31 },
  { id: "U010", name: "Emmanuel Nkurunziza", phone: "+257 76 567 890", role: "driver" as AdminUserRole, province: "Kayanza", status: "active", joinedAt: "Juil 2024", gmv: 0, orders: 178 },
  { id: "U011", name: "Marie-Claire Nduwimana", phone: "+257 79 678 901", role: "farmer" as AdminUserRole, province: "Kirundo", status: "suspended", joinedAt: "Aoû 2024", gmv: 420_000, orders: 9 },
  { id: "U012", name: "Didier Hakizimana", phone: "+257 76 789 012", role: "driver" as AdminUserRole, province: "Gitega", status: "suspended", joinedAt: "Sep 2024", gmv: 0, orders: 22 },
];

export const recentAdminNotifications = [
  { id: 1, type: "dispute", title: "Nouveau litige ouvert", body: "DIS-221 — Hôtel Source du Nil signale des dommages sur CMD-2871.", time: "Il y a 20 min", read: false },
  { id: 2, type: "farmer", title: "Nouveau fermier inscrit", body: "Marie-Claire Nduwimana (Kirundo) demande une vérification de compte.", time: "Il y a 1h", read: false },
  { id: 3, type: "stock", title: "Alerte stock — Muyinga", body: "Stock de tomates critique dans la province de Muyinga (< 2 tonnes).", time: "Il y a 2h", read: true },
  { id: 4, type: "payout", title: "Paiements groupés exécutés", body: "32 transferts Lumicash pour 18 500 000 BIF traités avec succès.", time: "Il y a 3h", read: true },
  { id: 5, type: "dispute", title: "Litige DIS-220 en révision", body: "Agent Sandrine a pris en charge le litige Restaurant Kiriri.", time: "Il y a 5h", read: true },
];

export const recentNotifications = [
  { id: 1, type: "sale", title: "Vente confirmée", body: "Votre lot de 20kg de Tomates cerises a été payé par Hôtel Source du Nil.", time: "Il y a 10 min", read: false },
  { id: 2, type: "alert", title: "Alerte météo", body: "Forte pluie prévue demain sur Kayanza. Pensez à protéger vos récoltes.", time: "Il y a 1h", read: false },
  { id: 3, type: "market", title: "Hausse des prix", body: "Le prix des Haricots verts a augmenté de 12% sur le marché de Ngozi.", time: "Il y a 3h", read: true },
  { id: 4, type: "system", title: "Mise à jour", body: "La nouvelle version d'AgriConnect est disponible avec le suivi logistique.", time: "Hier", read: true },
];

export const deliveryDetail = {
  id: "COL-501",
  orderId: "CMD-2891",
  farmer: {
    name: "Pascal Niyonkuru",
    phone: "+257 79 123 456",
    address: "Butaganzwa, Kayanza",
    coordinates: "(-3.12, 29.63)",
  },
  buyer: {
    name: "Hôtel Source du Nil",
    phone: "+257 22 234 567",
    address: "Boulevard du 28 Novembre, Bujumbura",
    coordinates: "(-3.38, 29.36)",
  },
  items: [
    { name: "Tomates cerises", qty: 25, unit: "kg" },
    { name: "Poivrons rouges", qty: 8, unit: "kg" },
  ],
  totalWeight: "33 kg",
  instructions: "Appeler à l'arrivée. Livrer à la cuisine, pas à la réception.",
  qrCode: "QR-CMD2891-PASCAL-SOURCE",
  distance: "47 km",
  estimatedDuration: "1h 20min",
};
