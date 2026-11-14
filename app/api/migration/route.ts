// Cutover is complete. This route is permanently closed; future restores use
// the authenticated owner interface in Settings.
export async function POST(){return Response.json({error:'Migration access permanently closed.'},{status:403,headers:{'Cache-Control':'no-store','X-Compass-Migration-Closed':'2026-11-08'}});}
