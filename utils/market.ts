/**
 * Verifies if the Indian Stock Market (NSE/BSE) is currently open.
 * Operating hours: Monday to Friday, 9:15 AM to 3:30 PM Indian Standard Time (IST).
 */
export function isIndianMarketOpen(): boolean {
  try {
    // Convert current time to India Standard Time (IST)
    const indiaTimeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const indiaDate = new Date(indiaTimeStr);

    const day = indiaDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hours = indiaDate.getHours();
    const minutes = indiaDate.getMinutes();

    // Market operates Monday (1) through Friday (5) only
    if (day < 1 || day > 5) {
      return false;
    }

    // Operating window: 9:15 AM (555 minutes) to 3:30 PM (930 minutes)
    const totalMinutes = hours * 60 + minutes;
    const startMinutes = 9 * 60 + 15; // 9:15 AM
    const endMinutes = 15 * 60 + 30;  // 3:30 PM

    return totalMinutes >= startMinutes && totalMinutes <= endMinutes;
  } catch (err) {
    console.error("Error checking market open status, defaulting to open", err);
    return true; // Fallback
  }
}
