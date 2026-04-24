"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const CART_STORAGE_KEY = "agriconnect_cart";
const CART_STORAGE_VERSION = 1;

export interface CartItem {
    productId: number;
    name: string;
    price: number;
    quantity: number;
    unit: string;
    image_url: string | null;
    category: string;
}

interface CartContextType {
    items: CartItem[];
    hydrated: boolean;
    updatedAt: string | null;
    addItem: (item: CartItem) => void;
    removeItem: (productId: number) => void;
    updateQuantity: (productId: number, quantity: number) => void;
    replaceItems: (items: CartItem[]) => void;
    clearCart: () => void;
    totalItems: number;
    totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface StoredCartEnvelope {
    version: number;
    items: CartItem[];
    updatedAt: string;
}

function isCartItem(value: unknown): value is CartItem {
    if (!value || typeof value !== "object") return false;

    const item = value as Partial<CartItem>;

    return Number.isFinite(Number(item.productId))
        && typeof item.name === "string"
        && Number.isFinite(Number(item.price))
        && Number.isFinite(Number(item.quantity))
        && typeof item.unit === "string"
        && (item.image_url === null || typeof item.image_url === "string" || typeof item.image_url === "undefined")
        && typeof item.category === "string";
}

function normalizeCartItems(input: unknown): CartItem[] {
    if (!Array.isArray(input)) return [];

    return input.flatMap((rawItem) => {
        if (!isCartItem(rawItem)) return [];

        const quantity = Number(rawItem.quantity);
        const price = Number(rawItem.price);
        const productId = Number(rawItem.productId);

        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(productId) || productId <= 0) {
            return [];
        }

        return [{
            productId,
            name: rawItem.name,
            price,
            quantity,
            unit: rawItem.unit,
            image_url: rawItem.image_url ?? null,
            category: rawItem.category,
        }];
    });
}

function loadStoredCart() {
    if (typeof window === "undefined") {
        return { items: [] as CartItem[], updatedAt: null as string | null };
    }

    try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) {
            return { items: [] as CartItem[], updatedAt: null as string | null };
        }

        const parsed = JSON.parse(raw) as StoredCartEnvelope | CartItem[];
        if (Array.isArray(parsed)) {
            return {
                items: normalizeCartItems(parsed),
                updatedAt: null,
            };
        }

        return {
            items: normalizeCartItems(parsed?.items),
            updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : null,
        };
    } catch (error) {
        console.error("Failed to parse cart", error);
        return { items: [] as CartItem[], updatedAt: null as string | null };
    }
}

function persistStoredCart(items: CartItem[], updatedAt: string) {
    if (typeof window === "undefined") return;

    try {
        const payload: StoredCartEnvelope = {
            version: CART_STORAGE_VERSION,
            items,
            updatedAt,
        };
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Ignore localStorage quota/privacy errors.
    }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);

    useEffect(() => {
        const storedCart = loadStoredCart();
        setItems(storedCart.items);
        setUpdatedAt(storedCart.updatedAt);
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;

        const persistAt = updatedAt ?? new Date().toISOString();
        persistStoredCart(items, persistAt);
        if (!updatedAt) {
            setUpdatedAt(persistAt);
        }
    }, [hydrated, items, updatedAt]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== CART_STORAGE_KEY) return;

            const storedCart = loadStoredCart();
            setItems(storedCart.items);
            setUpdatedAt(storedCart.updatedAt);
        };

        window.addEventListener("storage", handleStorage);
        return () => {
            window.removeEventListener("storage", handleStorage);
        };
    }, []);

    const commitItems = (nextItems: CartItem[]) => {
        setItems(normalizeCartItems(nextItems));
        setUpdatedAt(new Date().toISOString());
    };

    const addItem = (newItem: CartItem) => {
        setItems((prev) => {
            const existing = prev.find((i) => i.productId === newItem.productId);
            return normalizeCartItems(existing
                ? prev.map((i) =>
                    i.productId === newItem.productId
                        ? { ...i, quantity: i.quantity + newItem.quantity }
                        : i,
                )
                : [...prev, newItem]);
        });
        setUpdatedAt(new Date().toISOString());
    };

    const removeItem = (productId: number) => {
        setItems((prev) => prev.filter((i) => i.productId !== productId));
        setUpdatedAt(new Date().toISOString());
    };

    const updateQuantity = (productId: number, quantity: number) => {
        setItems((prev) => normalizeCartItems(
            prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
        ));
        setUpdatedAt(new Date().toISOString());
    };

    const replaceItems = (nextItems: CartItem[]) => {
        commitItems(nextItems);
    };

    const clearCart = () => commitItems([]);

    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    return (
        <CartContext.Provider
            value={{
                items,
                hydrated,
                updatedAt,
                addItem,
                removeItem,
                updateQuantity,
                replaceItems,
                clearCart,
                totalItems,
                totalPrice,
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error("useCart must be used within a CartProvider");
    }
    return context;
}
