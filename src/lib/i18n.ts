import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const LANGUAGE_STORAGE_KEY = "bzaf.language";
export const supportedLanguages = ["en", "fr", "ar"] as const;
export type AppLanguage = (typeof supportedLanguages)[number];

const resources = {
  en: {
    translation: {
      language: { label: "Language" },
      brand: { title: "Bzaf Fresh" },
      header: {
        searchPlaceholder: "Search essentials",
        userProfile: "User profile",
        myOrders: "My orders",
        locationFallback: "Select delivery location",
      },
      nav: { home: "Home", search: "Search", cart: "Cart", profile: "Profile", carnet: "Carnet" },
      categories: {
        title: "Quick categories",
        subtitleDefault: "Essentials first",
        viewAll: "View All",
        noCategories: "No categories available in your area yet.",
        productsCount: "{{count}} Products",
      },
      products: {
        title: "All Products",
        pricesInMad: "Prices in MAD",
        add: "Add",
        loadMore: "Load More",
        empty: "No active products available in this category right now.",
      },
      allProducts: {
        title: "All Products",
        searchPlaceholder: "Search all products",
        searchHint: "Type at least 3 characters to filter",
      },
      productDetail: {
        back: "Back",
        addToCart: "Add to Cart",
        notFound: "Product not found",
      },
      flashDeals: {
        title: "Flash Deals",
        endsIn: "Ends in",
        inviteTitle: "Invite a Friend",
        inviteCopy: "Share Bzaf and get free delivery on your next order.",
        ecoTitle: "Zero Carbon Emissions",
        ecoCopy: "Every order is delivered by bicycle, reducing traffic and keeping Moroccan air cleaner.",
        freeDelivery: "Free delivery reward",
      },
      categoryPage: {
        allProducts: "All",
        organic: "Organic",
        seasonal: "Seasonal",
        bestseller: "Best Seller",
        searchPlaceholder: "Search products in this category",
      },
      categoryDetail: {
        back: "Back",
        subtitle: "Choose what you need from top products",
        search: "Search in this category",
        error: "Failed to load category details.",
        retry: "Retry",
        emptyTitle: "No products yet",
        emptyHint: "Products for this category will appear here soon.",
        pills: {
          all: "All",
          leafy: "Leafy",
          fresh: "Fresh",
          popular: "Popular",
        },
      },
      ticker: {
        default: "Fresh groceries • Fast bicycle delivery • Trusted neighborhood vendors",
      },
      categoryNames: {
        "Groceries": "Groceries",
        "Vegetables & Fruits": "Vegetables & Fruits",
        "Meat & Poultry": "Meat & Poultry",
        "Bakery & Pastry": "Bakery & Pastry",
        "Dairy & Eggs": "Dairy & Eggs",
        "Drinks & Water": "Drinks & Water",
        "Cleaning Supplies": "Cleaning Supplies",
      },
      admin: {
        productNameEn: "Product Name (EN)",
        productNameFr: "Product Name (FR)",
        productNameAr: "Product Name (AR)",
        tickerEn: "Ticker Message (EN)",
        tickerFr: "Ticker Message (FR)",
        tickerAr: "Ticker Message (AR)",
      },
      cart: { title: "Your Cart" },
    },
  },
  fr: {
    translation: {
      language: { label: "Langue" },
      brand: { title: "Bzaf Fresh" },
      header: {
        searchPlaceholder: "Rechercher des essentiels",
        userProfile: "Profil utilisateur",
        myOrders: "Mes commandes",
        locationFallback: "Choisir la zone de livraison",
      },
      nav: { home: "Accueil", search: "Recherche", cart: "Panier", profile: "Profil", carnet: "Carnet" },
      categories: {
        title: "Catégories rapides",
        subtitleDefault: "Les essentiels d'abord",
        viewAll: "Voir tout",
        noCategories: "Aucune catégorie disponible dans votre zone pour le moment.",
        productsCount: "{{count}} Produits",
      },
      products: {
        title: "Tous les produits",
        pricesInMad: "Prix en MAD",
        add: "Ajouter",
        loadMore: "Charger plus",
        empty: "Aucun produit actif disponible dans cette catégorie.",
      },
      allProducts: {
        title: "Tous les produits",
        searchPlaceholder: "Rechercher tous les produits",
        searchHint: "Tapez au moins 3 caractères pour filtrer",
      },
      productDetail: {
        back: "Retour",
        addToCart: "Ajouter au panier",
        notFound: "Produit introuvable",
      },
      flashDeals: {
        title: "Offres Flash",
        endsIn: "Se termine dans",
        inviteTitle: "Invitez un ami",
        inviteCopy: "Partagez Bzaf et obtenez une livraison offerte sur votre prochaine commande.",
        ecoTitle: "Zéro émission carbone",
        ecoCopy: "Chaque commande est livrée à vélo pour réduire le trafic et garder un air plus propre.",
        freeDelivery: "Récompense livraison offerte",
      },
      categoryPage: {
        allProducts: "Tous",
        organic: "Bio",
        seasonal: "De saison",
        bestseller: "Meilleure vente",
        searchPlaceholder: "Rechercher dans cette catégorie",
      },
      categoryDetail: {
        back: "Retour",
        subtitle: "Choisissez ce dont vous avez besoin parmi les meilleurs produits",
        search: "Rechercher dans cette catégorie",
        error: "Impossible de charger les détails de la catégorie.",
        retry: "Réessayer",
        emptyTitle: "Aucun produit pour le moment",
        emptyHint: "Les produits de cette catégorie apparaîtront bientôt.",
        pills: {
          all: "Tous",
          leafy: "Feuilles",
          fresh: "Frais",
          popular: "Populaire",
        },
      },
      ticker: {
        default: "Produits frais • Livraison rapide à vélo • Vendeurs locaux de confiance",
      },
      categoryNames: {
        "Groceries": "Épicerie",
        "Vegetables & Fruits": "Légumes et fruits",
        "Meat & Poultry": "Viandes et volailles",
        "Bakery & Pastry": "Boulangerie et pâtisserie",
        "Dairy & Eggs": "Produits laitiers et œufs",
        "Drinks & Water": "Boissons et eau",
        "Cleaning Supplies": "Produits de nettoyage",
      },
      admin: {
        productNameEn: "Nom du produit (EN)",
        productNameFr: "Nom du produit (FR)",
        productNameAr: "Nom du produit (AR)",
        tickerEn: "Message du ticker (EN)",
        tickerFr: "Message du ticker (FR)",
        tickerAr: "Message du ticker (AR)",
      },
      cart: { title: "Votre panier" },
    },
  },
  ar: {
    translation: {
      language: { label: "اللغة" },
      brand: { title: "بزاف فريش" },
      header: {
        searchPlaceholder: "ابحث عن المنتجات الأساسية",
        userProfile: "الملف الشخصي",
        myOrders: "طلباتي",
        locationFallback: "اختر موقع التوصيل",
      },
      nav: { home: "الرئيسية", search: "بحث", cart: "السلة", profile: "الملف", carnet: "الدفتر" },
      categories: {
        title: "الفئات السريعة",
        subtitleDefault: "الأساسيات أولاً",
        viewAll: "عرض الكل",
        noCategories: "لا توجد فئات متاحة في منطقتك حالياً.",
        productsCount: "{{count}} منتج",
      },
      products: {
        title: "جميع المنتجات",
        pricesInMad: "الأسعار بالدرهم",
        add: "إضافة",
        loadMore: "عرض المزيد",
        empty: "لا توجد منتجات متاحة حالياً في هذه الفئة.",
      },
      allProducts: {
        title: "جميع المنتجات",
        searchPlaceholder: "ابحث في جميع المنتجات",
        searchHint: "اكتب 3 أحرف على الأقل لتفعيل البحث",
      },
      productDetail: {
        back: "رجوع",
        addToCart: "إضافة إلى السلة",
        notFound: "المنتج غير موجود",
      },
      flashDeals: {
        title: "همزة اليوم",
        endsIn: "ينتهي خلال",
        inviteTitle: "شارك وربح",
        inviteCopy: "شارك بزاف واحصل على توصيل مجاني في طلبك القادم.",
        ecoTitle: "انبعاثات كربونية صفرية",
        ecoCopy: "كل طلب يتم توصيله بالدراجة لتقليل الزحام والحفاظ على هواء أنظف.",
        freeDelivery: "مكافأة توصيل مجاني",
      },
      categoryPage: {
        allProducts: "الكل",
        organic: "عضوي",
        seasonal: "موسمي",
        bestseller: "الأكثر مبيعاً",
        searchPlaceholder: "ابحث داخل هذا القسم",
      },
      categoryDetail: {
        back: "رجوع",
        subtitle: "اختر ما تحتاجه من أفضل المنتجات",
        search: "ابحث داخل هذا القسم",
        error: "تعذر تحميل تفاصيل القسم.",
        retry: "إعادة المحاولة",
        emptyTitle: "لا توجد منتجات حالياً",
        emptyHint: "ستظهر منتجات هذا القسم هنا قريباً.",
        pills: {
          all: "الكل",
          leafy: "ورقيات",
          fresh: "طازجة",
          popular: "الأكثر طلباً",
        },
      },
      ticker: {
        default: "منتجات طازجة • توصيل سريع بالدراجة • باعة محليون موثوقون",
      },
      categoryNames: {
        "Groceries": "مواد غذائية",
        "Vegetables & Fruits": "خضروات وفواكه",
        "Meat & Poultry": "لحوم ودواجن",
        "Bakery & Pastry": "مخبوزات وحلويات",
        "Dairy & Eggs": "منتجات الألبان والبيض",
        "Drinks & Water": "مشروبات ومياه",
        "Cleaning Supplies": "مواد التنظيف",
      },
      admin: {
        productNameEn: "اسم المنتج (EN)",
        productNameFr: "اسم المنتج (FR)",
        productNameAr: "اسم المنتج (AR)",
        tickerEn: "رسالة الشريط (EN)",
        tickerFr: "رسالة الشريط (FR)",
        tickerAr: "رسالة الشريط (AR)",
      },
      cart: { title: "سلتك" },
    },
  },
} as const;

function getInitialLanguage(): AppLanguage {
  return "en";
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: "en",
    initAsync: false,
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
    supportedLngs: [...supportedLanguages],
  });
}

export default i18n;