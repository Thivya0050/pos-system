import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const SUPABASE_CONFIG_ERROR =
  "Supabase environment variables are not configured";

const PLACEHOLDER_VALUES = [
  "your_supabase_url",
  "your_supabase_anon_key",
  "your-project.supabase.co",
  "your-anon-key",
];

function isPlaceholder(value: string) {
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_VALUES.some(
    (placeholder) =>
      normalized === placeholder.toLowerCase() ||
      normalized.includes("your_") ||
      normalized.includes("your-")
  );
}

export function isSupabaseConfigured() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }

  if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
    return false;
  }

  return true;
}

export class SupabaseConfigError extends Error {
  constructor(message = SUPABASE_CONFIG_ERROR) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

function warnMissingEnvFile() {
  if (process.env.NODE_ENV !== "development") return;

  console.warn(
    "[POS] Warning: .env.local is missing or contains placeholder Supabase values."
  );
  console.warn(
    "[POS] Create .env.local in the project root with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
  console.warn("[POS] See .env.local.example for the required format.");
}

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured()) {
    warnMissingEnvFile();
    throw new SupabaseConfigError();
  }
}

assertSupabaseConfigured();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const customFetch: typeof fetch = async (input, init) => {
  if (!isSupabaseConfigured()) {
    throw new SupabaseConfigError();
  }

  try {
    return await fetch(input, init);
  } catch (error) {
    if (!isSupabaseConfigured()) {
      throw new SupabaseConfigError();
    }
    throw error;
  }
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: customFetch,
  },
});

export function getSupabaseErrorMessage(error: unknown): string {
  if (error instanceof SupabaseConfigError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (
      error.message.includes("Failed to fetch") &&
      !isSupabaseConfigured()
    ) {
      return SUPABASE_CONFIG_ERROR;
    }
    return error.message;
  }

  return "An unexpected error occurred";
}
