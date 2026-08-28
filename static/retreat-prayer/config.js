/*
 * Public runtime configuration for the retreat prayer app.
 *
 * The Supabase URL and publishable key are designed to be public. Never place a
 * service-role key, database password, rate-limit salt, or other secret here.
 * Until the two Supabase values are configured, the deployed app fails closed.
 * A clearly labelled preview data set is available only on local hosts.
 */
window.RETREAT_PRAYER_CONFIG = Object.freeze({
  appName: "수련회를 위한 공동기도",
  churchName: "우리 공동체",
  timeZone: "Asia/Seoul",
  retreatDate: "",
  dailyPrayerTime: "21:00",
  siteOrigin: "https://thelogos.dev",
  supabaseUrl: "",
  supabasePublishableKey: "",
  supabaseModuleUrl: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm",
  presenceTopic: "retreat-prayer:presence",
  demoAllowedHosts: ["localhost", "127.0.0.1", "[::1]"],
});
