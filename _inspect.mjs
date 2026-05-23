import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await supabase.from("products").select("*").limit(1);
if (error) console.error("err:", error);
else console.log("columns on products:", Object.keys(data[0] ?? {}));

const { data: o, error: oe } = await supabase.from("orders").select("*").limit(1);
if (oe) console.error("err:", oe);
else console.log("columns on orders:", Object.keys(o[0] ?? {}));

console.log("\n=== schema introspection (information_schema) ===");
const { data: cols, error: ce } = await supabase
  .rpc("exec_sql", { sql: "select column_name from information_schema.columns where table_schema='public' and table_name='products' order by ordinal_position" })
  .single()
  .catch(() => ({ data: null, error: "no exec_sql rpc" }));
if (ce) console.log("(rpc fallback unavailable)", ce);
else console.log(cols);
