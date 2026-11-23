import type { OptionDef } from "@/lib/variants";

export type EditorVariant = {
  id?: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  price: string;
  compareAt: string;
  cost: string;
  sku: string;
  barcode: string;
  trackInventory: boolean;
  inventoryQty: number;
  allowBackorder: boolean;
  requiresShipping: boolean;
  taxable: boolean;
  weightGrams: number;
};

export type EditorProduct = {
  title: string;
  handle: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  vendor: string;
  productType: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  images: { url: string; alt: string }[];
  options: OptionDef[];
  variants: EditorVariant[];
  collectionIds: string[];
};

export const emptyVariant = (): EditorVariant => ({
  option1: null, option2: null, option3: null, price: "0.00", compareAt: "", cost: "", sku: "", barcode: "",
  trackInventory: true, inventoryQty: 0, allowBackorder: false, requiresShipping: true, taxable: true, weightGrams: 0,
});
