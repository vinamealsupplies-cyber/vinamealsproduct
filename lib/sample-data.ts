export type ProductMedia = {
  id: string;
  type: "image" | "video";
  src?: string;
  poster?: string;
  alt: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  category: string;
  categorySlug: string;
  price: number;
  wholesalePrice: number;
  stock: number;
  featured: boolean;
  newestRank: number;
  shortDescription: string;
  description: string;
  media: ProductMedia[];
};

export const categories = [
  { name: "Pantry", slug: "pantry", children: ["Noodles", "Rice", "Meal Kits"] },
  { name: "Frozen", slug: "frozen", children: ["Dumplings", "Buns", "Ready Meals"] },
  { name: "Beverages", slug: "beverages", children: ["Coconut Water", "Tea", "Juice"] },
  { name: "Snacks", slug: "snacks", children: ["Crackers", "Fruit", "Sweet Treats"] },
  { name: "Sauces", slug: "sauces", children: ["Chili", "Cooking Sauces", "Condiments"] }
];

export const products: Product[] = [
  {
    id: "p1",
    slug: "tropical-mango-slices",
    name: "Tropical Mango Slices",
    sku: "MANGO-8OZ",
    category: "Snacks",
    categorySlug: "snacks",
    price: 8.99,
    wholesalePrice: 6.25,
    stock: 42,
    featured: true,
    newestRank: 6,
    shortDescription: "Sweet, sunny mango slices ready to enjoy.",
    description:
      "Bright tropical mango slices with a soft bite and naturally sweet flavor. A colorful pantry snack for lunchboxes, road trips, and easy sharing.",
    media: [
      { id: "p1-1", type: "image", src: "/products/tropical-mango.svg", alt: "Bright tropical mango slices" },
      { id: "p1-2", type: "image", src: "/products/tropical-mango-detail.svg", alt: "Close-up of sliced mango pieces" },
      { id: "p1-3", type: "video", poster: "/products/tropical-mango.svg", alt: "Tropical Mango Slices product video placeholder" }
    ]
  },
  {
    id: "p2",
    slug: "garden-veggie-dumplings",
    name: "Garden Veggie Dumplings",
    sku: "DUMP-VEG-20",
    category: "Frozen",
    categorySlug: "frozen",
    price: 12.99,
    wholesalePrice: 9.4,
    stock: 18,
    featured: true,
    newestRank: 5,
    shortDescription: "Tender dumplings filled with colorful vegetables.",
    description:
      "Freezer-friendly vegetable dumplings for quick lunches, appetizers, and family meals. Steam, pan-fry, or add to soup.",
    media: [
      { id: "p2-1", type: "image", src: "/products/veggie-dumplings.svg", alt: "Garden vegetable dumplings" },
      { id: "p2-2", type: "image", src: "/products/veggie-dumplings-detail.svg", alt: "Dumplings served in a bright bowl" }
    ]
  },
  {
    id: "p3",
    slug: "golden-chili-crisp",
    name: "Golden Chili Crisp",
    sku: "CHILI-6OZ",
    category: "Sauces",
    categorySlug: "sauces",
    price: 10.5,
    wholesalePrice: 7.6,
    stock: 27,
    featured: true,
    newestRank: 4,
    shortDescription: "Crunchy, savory, and gently spicy.",
    description:
      "A spoonable chili crisp for noodles, rice, eggs, vegetables, and more. Balanced heat with a satisfying golden crunch.",
    media: [
      { id: "p3-1", type: "image", src: "/products/chili-crisp.svg", alt: "Jar of golden chili crisp" },
      { id: "p3-2", type: "image", src: "/products/chili-crisp-detail.svg", alt: "Golden chili crisp served with noodles" }
    ]
  },
  {
    id: "p4",
    slug: "sesame-rice-crackers",
    name: "Sesame Rice Crackers",
    sku: "RICE-SES-5",
    category: "Snacks",
    categorySlug: "snacks",
    price: 5.99,
    wholesalePrice: 4.2,
    stock: 9,
    featured: false,
    newestRank: 3,
    shortDescription: "Light, crisp crackers with toasted sesame.",
    description:
      "A bright pantry snack with a satisfying crunch. Serve alone, with dips, or in a snack board.",
    media: [
      { id: "p4-1", type: "image", src: "/products/rice-crackers.svg", alt: "Sesame rice crackers" },
      { id: "p4-2", type: "image", src: "/products/rice-crackers-detail.svg", alt: "Close-up of crisp sesame crackers" }
    ]
  },
  {
    id: "p5",
    slug: "pure-coconut-water",
    name: "Pure Coconut Water",
    sku: "COCO-169",
    category: "Beverages",
    categorySlug: "beverages",
    price: 3.99,
    wholesalePrice: 2.65,
    stock: 64,
    featured: false,
    newestRank: 2,
    shortDescription: "Clean, refreshing coconut water.",
    description:
      "Serve chilled for a crisp, refreshing drink. A convenient beverage for home, work, or events.",
    media: [
      { id: "p5-1", type: "image", src: "/products/coconut-water.svg", alt: "Bottle of pure coconut water" },
      { id: "p5-2", type: "image", src: "/products/coconut-water-detail.svg", alt: "Coconut water served over ice" }
    ]
  },
  {
    id: "p6",
    slug: "weeknight-ramen-kit",
    name: "Weeknight Ramen Kit",
    sku: "RAMEN-KIT-2",
    category: "Pantry",
    categorySlug: "pantry",
    price: 11.99,
    wholesalePrice: 8.5,
    stock: 14,
    featured: false,
    newestRank: 1,
    shortDescription: "A quick ramen kit for cozy weeknight meals.",
    description:
      "Noodles and a savory soup base packed for an easy meal. Add vegetables, egg, or your favorite protein.",
    media: [
      { id: "p6-1", type: "image", src: "/products/ramen-kit.svg", alt: "Weeknight ramen kit" },
      { id: "p6-2", type: "image", src: "/products/ramen-kit-detail.svg", alt: "Prepared ramen bowl with vegetables" }
    ]
  }
];

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getProductById(id: string) {
  return products.find((product) => product.id === id);
}
