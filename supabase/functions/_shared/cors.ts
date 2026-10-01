// Toda funcion que se llame desde el navegador necesita estas cabeceras,
// y responder la peticion OPTIONS que Chrome manda antes del POST.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function responder(datos: unknown, status = 200) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
