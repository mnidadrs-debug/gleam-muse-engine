import { createServerFn } from "@tanstack/react-start";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const requiredAdminTables = [
  "communes",
  "neighborhoods",
  "vendors",
  "cyclists",
  "cyclist_coverage",
  "master_products",
  "vendor_products",
  "customers",
  "orders",
  "otp_requests",
  "vendor_carnet",
  "carnet_payments",
  "categories",
  "site_ads",
  "announcements",
] as const;

export type AdminDatabaseHealth = {
  healthy: boolean;
  missingTables: string[];
  checkedTables: string[];
  error: string | null;
};

async function tableExists(tableName: string) {
  const { error } = await (supabaseAdmin as any)
    .from(tableName)
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (!error) {
    return true;
  }

  if (error.code === "42P01") {
    return false;
  }

  if (typeof error.message === "string" && error.message.toLowerCase().includes("does not exist")) {
    return false;
  }

  throw new Error(`Unable to verify table \"${tableName}\": ${error.message}`);
}

export const checkAdminDatabaseHealth = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const checks = await Promise.all(
      requiredAdminTables.map(async (tableName) => ({
        tableName,
        exists: await tableExists(tableName),
      })),
    );

    const missingTables = checks.filter((table) => !table.exists).map((table) => table.tableName);

    return {
      healthy: missingTables.length === 0,
      missingTables,
      checkedTables: [...requiredAdminTables],
      error: null,
    } satisfies AdminDatabaseHealth;
  } catch (error) {
    console.error("checkAdminDatabaseHealth failed:", error);

    return {
      healthy: false,
      missingTables: [],
      checkedTables: [...requiredAdminTables],
      error: error instanceof Error ? error.message : "Unknown database health check error.",
    } satisfies AdminDatabaseHealth;
  }
});