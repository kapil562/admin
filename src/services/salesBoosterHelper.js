/**
 * salesBoosterHelper.js
 * High-conversion sales & marketing utility functions for Univo Infotech
 */

/**
 * Generate a professional, high-converting WhatsApp proposal pitch message
 */
export const generateWhatsAppPitch = ({
  businessName,
  ownerName,
  clientType = 'Library',
  customDiscount = '30%',
  salesRepName = '',
  salesRepPhone = '',
}) => {
  const greeting = ownerName ? `Dear ${ownerName}` : `Hello`;
  const type = clientType === 'Gym' ? 'Gym & Fitness Center' : 'Study Library';

  const text = `${greeting},
Greetings from *Univo Infotech*.

To help streamline and digitize operations at *${businessName || 'your organization'}*, our smart *${type} Management Software* is ready for a quick live demonstration:

🚀 *Key Features for Seamless Management:*
✅ *Live Seat Map & Shift Allocation* (Real-time seat view & booking)
✅ *Biometric & QR Code Attendance* (Automated in-out tracking)
✅ *Automated WhatsApp & SMS Fee Slips* (Instant payment confirmation & renewal alerts)
✅ *Digital ID Cards & Online Payments*
✅ *Complete Staff, Revenue & Expense Tracking*

🎁 *Exclusive On-Spot Offer:* Flat ${customDiscount} Discount for your branch!
🌐 *Live Details:* https://univoinfotech.com

Would you be open for a quick 10-minute live demo on your mobile or laptop today or tomorrow?

Best regards,
*Univo Infotech Growth Team*${salesRepName ? `\n👤 Representative: ${salesRepName}` : ''}${salesRepPhone ? `\n📞 Call/WhatsApp: ${salesRepPhone}` : ''}`;

  return encodeURIComponent(text);
};

/**
 * Filter visits whose competitor subscription is expiring soon (within next X days)
 */
export const getCompetitorExpiringLeads = (visits, daysThreshold = 30) => {
  if (!visits || visits.length === 0) return [];
  const now = new Date();
  const pastCutoff = new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0];
  const futureCutoff = new Date(Date.now() + daysThreshold * 86400000).toISOString().split('T')[0];

  return visits
    .filter((v) => {
      if (!v.competitorExpiryDate) return false;
      const exp = v.competitorExpiryDate.trim();
      return exp >= pastCutoff && exp <= futureCutoff;
    })
    .map((v) => {
      const expDate = new Date(v.competitorExpiryDate);
      const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
      return {
        ...v,
        daysRemaining: diffDays,
        isOverdue: diffDays < 0,
        isUrgent: diffDays <= 7,
      };
    })
    .sort((a, b) => (a.competitorExpiryDate || '').localeCompare(b.competitorExpiryDate || ''));
};

/**
 * Multi-stop Google Maps turn-by-turn route link
 */
export const generateMultiStopGoogleMapsRoute = (startLocation, places) => {
  if (!places || places.length === 0) return '';
  const validPlaces = places.filter((p) => p.lat && p.lng);
  if (validPlaces.length === 0) return '';

  const origin = startLocation?.latitude && startLocation?.longitude
    ? `${startLocation.latitude},${startLocation.longitude}`
    : `${validPlaces[0].lat},${validPlaces[0].lng}`;

  const destination = `${validPlaces[validPlaces.length - 1].lat},${validPlaces[validPlaces.length - 1].lng}`;

  const waypoints = validPlaces.length > 2
    ? validPlaces.slice(1, -1).map((p) => `${p.lat},${p.lng}`).join('|')
    : (validPlaces.length === 2 && startLocation ? `${validPlaces[0].lat},${validPlaces[0].lng}` : '');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }
  return url;
};
