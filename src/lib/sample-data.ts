export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
};

export const sampleProducts: Product[] = [
  { id: "1", name: "Espresso", price: 3.5, category: "Beverages", stock: 120 },
  { id: "2", name: "Cappuccino", price: 4.5, category: "Beverages", stock: 98 },
  { id: "3", name: "Latte", price: 4.75, category: "Beverages", stock: 85 },
  { id: "4", name: "Croissant", price: 3.25, category: "Bakery", stock: 45 },
  { id: "5", name: "Blueberry Muffin", price: 3.75, category: "Bakery", stock: 32 },
  { id: "6", name: "Club Sandwich", price: 8.99, category: "Food", stock: 28 },
  { id: "7", name: "Caesar Salad", price: 9.5, category: "Food", stock: 22 },
  { id: "8", name: "Bottled Water", price: 2.0, category: "Beverages", stock: 200 },
  { id: "9", name: "Orange Juice", price: 3.99, category: "Beverages", stock: 64 },
  { id: "10", name: "Chocolate Bar", price: 2.5, category: "Retail", stock: 150 },
  { id: "11", name: "Tote Bag", price: 12.99, category: "Retail", stock: 40 },
  { id: "12", name: "Gift Card $25", price: 25.0, category: "Retail", stock: 999 },
];
