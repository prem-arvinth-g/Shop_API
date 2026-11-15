// The shapes of the JSON the API sends. They mirror backend/Models/Dtos.cs.

export interface Category {
  id: number;
  name: string;
  imageUrl: string | null;
  productCount: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;        // whole rupees
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: number;
  categoryName: string;
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selected?: boolean;   // ticked in the cart = goes to checkout. Missing counts as ticked (carts saved before this existed).
}

export interface Me {
  id: number;
  email: string;
  isAdmin: boolean;
}

// What the server returns after creating an order: enough to open the Razorpay popup.
export interface Checkout {
  orderId: number;
  total: number;
  razorpayOrderId: string;
  razorpayKeyId: string | null;   // null = test mode on your PC
}

export interface PaymentResult {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface OrderItem {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: number;
  customerName: string;
  phone: string;
  address: string;
  latitude: number | null;    // map pin from checkout, if the customer set one
  longitude: number | null;
  pinAddress: string | null;  // the map's address for that pin
  total: number;
  status: string;
  createdAt: string;
  email: string | null;
  items: OrderItem[];
}

export const ORDER_STATUSES = ['Pending', 'Paid', 'Shipped', 'Delivered', 'Cancelled'];

// One item in the moving strip on the home page (Admin > Banner).
export interface Banner {
  id: number;
  text: string;
  imageUrl: string | null;
  link: string | null;       // https://... (opens in a new tab) or /path (inside the shop)
  sortOrder: number;
  isActive: boolean;
}
export type BannerInput = Omit<Banner, 'id'>;
