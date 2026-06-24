// ============================================================
//  FamiliaPlanning configuration
//
//  WHAT IS THIS FILE?
//  This is where you connect the app to your free cloud database
//  (Supabase) so the WHOLE FAMILY shares one calendar.
//
//  YOU DO NOT NEED TO TOUCH THIS TO TRY THE APP.
//  If you leave the values blank, the app still works — it just
//  saves data only in YOUR browser (great for testing).
//
//  When you're ready to share with the family, follow SETUP.md.
//  It walks you through creating a free Supabase project and tells
//  you exactly what to paste below.
//
//  Note: the "anon key" below is SAFE to be public. Supabase
//  designed it that way; your data is protected by database rules.
// ============================================================

export const SUPABASE_URL = "";      // e.g. "https://abcdxyz.supabase.co"
export const SUPABASE_ANON_KEY = ""; // the long "anon public" key from Supabase

// How many upcoming weekends to show in the grid. Change if you like.
export const WEEKENDS_TO_SHOW = 12;
